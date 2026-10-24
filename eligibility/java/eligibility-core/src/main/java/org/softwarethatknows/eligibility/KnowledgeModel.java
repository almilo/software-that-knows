package org.softwarethatknows.eligibility;

import java.io.StringReader;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.apache.jena.query.QuerySolution;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.RDFList;
import org.apache.jena.rdf.model.RDFNode;
import org.apache.jena.rdf.model.Resource;

// Reads a knowledge model, as react-bun/core/model.ts does: the form vocabulary and the Turtle files
// of one domain and of the modules that it imports, in one model; the form of the domain; and the
// sources of a node.
public final class KnowledgeModel {

    private KnowledgeModel() {}

    // The imports must be closed: every ontology that a file imports (owl:imports) is loaded, and
    // every loaded ontology but one, the domain's, is imported by another.
    public static Model load(List<String> texts) {
        final Model model = ModelFactory.createDefaultModel();
        texts.forEach(text -> model.read(new StringReader(text), null, "TTL"));
        final var missing = Rdf.select(
                model,
                "SELECT ?by ?ontology WHERE { ?by a owl:Ontology ; owl:imports ?ontology FILTER NOT EXISTS { ?ontology a owl:Ontology } }");
        if (!missing.isEmpty()) {
            throw new IllegalArgumentException("Not loaded: "
                    + missing.stream()
                            .map(r -> r.get("ontology") + ", imported by " + r.get("by"))
                            .collect(Collectors.joining("; ")));
        }
        final var roots = Rdf.select(
                model,
                "SELECT ?ontology WHERE { ?ontology a owl:Ontology FILTER NOT EXISTS { ?any owl:imports ?ontology } }");
        if (roots.size() != 1) {
            throw new IllegalArgumentException(
                    "One ontology must import all the others, directly or not. Not imported: "
                            + roots.stream()
                                    .map(r -> r.get("ontology").toString())
                                    .collect(Collectors.joining(", ")));
        }
        return model;
    }

    public static Shape readShape(Model model) {
        final var shapes = Rdf.select(
                model,
                "SELECT ?shape ?class ?region WHERE { ?shape a sh:NodeShape ; sh:targetClass ?class ; form:region ?region }");
        if (shapes.size() != 1)
            throw new IllegalArgumentException(
                    "The model must have one sh:NodeShape with a sh:targetClass and a form:region, not "
                            + shapes.size());
        final var row = shapes.getFirst();
        final var targetClass = row.getResource("class").getURI();
        final var applies = "<%s> rdfs:subClassOf* ?class . ?shape sh:targetClass ?class .".formatted(targetClass);
        final var declared = declaredPrefixes(model);

        final var fields = Rdf.select(model, """
                SELECT DISTINCT ?field ?path ?group ?datatype ?in ?min ?max ?minCount ?asked ?ask ?groupOrder ?order WHERE {
                  %s
                  ?shape sh:property ?field .
                  ?field sh:path ?path ; sh:group ?group .
                  ?group sh:order ?groupOrder .
                  OPTIONAL { ?field sh:order ?order }
                  OPTIONAL { ?field sh:datatype ?datatype }
                  OPTIONAL { ?field sh:in ?in }
                  OPTIONAL { ?field sh:minInclusive ?min }
                  OPTIONAL { ?field sh:maxInclusive ?max }
                  OPTIONAL { ?field sh:minCount ?minCount }
                  OPTIONAL { ?field form:askedWhen ?asked . ?asked sh:ask ?ask }
                } ORDER BY ?groupOrder ?order""".formatted(applies)).stream()
                .map(f -> field(f, declared))
                .toList();

        final var rules = Rdf.select(model, """
                SELECT DISTINCT ?rule ?construct ?order WHERE {
                  %s
                  ?shape sh:rule ?rule .
                  ?rule a sh:SPARQLRule ; sh:construct ?construct .
                  OPTIONAL { ?rule sh:order ?order }
                  FILTER NOT EXISTS { ?rule sh:deactivated true }
                } ORDER BY ?order""".formatted(applies)).stream()
                .map(r -> declared.getOrDefault(r.get("rule"), "")
                        + r.getLiteral("construct").getLexicalForm())
                .toList();

        final var region = row.getLiteral("region").getLexicalForm();
        final var numbers = Rdf.select(model, """
                SELECT ?language ?group ?decimal WHERE {
                  ?format a form:NumberFormat ; form:region "%s" ; form:language ?language ;
                    form:groupSeparator ?group ; form:decimalSeparator ?decimal
                }""".formatted(region)).stream()
                .collect(Collectors.toMap(
                        n -> n.getLiteral("language").getLexicalForm(),
                        n -> new Shape.Numbers(
                                n.getLiteral("group").getLexicalForm().charAt(0),
                                n.getLiteral("decimal").getLexicalForm().charAt(0))));

        // The groups of the fields, in their order: a module can define groups that a domain does not use.
        final var groups =
                List.copyOf(fields.stream().map(Field::group).collect(Collectors.toCollection(LinkedHashSet::new)));
        final var shape = row.getResource("shape").getURI();
        return new Shape(shape, Rdf.local(shape), region, Map.copyOf(numbers), targetClass, groups, fields, rules);
    }

    // The sources of a node (prov:wasDerivedFrom), by local name, in the order of their numbers.
    public static List<String> sources(Model model, Resource node) {
        return model.listObjectsOfProperty(node, model.createProperty(Rdf.PROV + "wasDerivedFrom")).toList().stream()
                .map(Rdf::local)
                .sorted(Rdf.BY_NUMBER)
                .toList();
    }

    private static Field field(QuerySolution f, Map<RDFNode, String> declared) {
        final var path = f.getResource("path").getURI();
        return new Field(
                Rdf.local(path),
                path,
                Rdf.local(f.getResource("group")),
                Optional.ofNullable(f.getResource("datatype")).map(Resource::getURI),
                Optional.ofNullable(f.get("in"))
                        .map(in -> in.as(RDFList.class).asJavaList().stream()
                                .map(c -> c.asResource().getURI())
                                .toList()),
                number(f.get("min")),
                number(f.get("max")),
                number(f.get("minCount"))
                        .map(n -> n.compareTo(BigDecimal.ONE) >= 0)
                        .orElse(false),
                Optional.ofNullable(f.get("ask"))
                        .map(ask -> declared.getOrDefault(f.get("asked"), "")
                                + ask.asLiteral().getLexicalForm()));
    }

    // SHACL: a SPARQL query uses the prefixes that its sh:prefixes declare (sh:declare), also through
    // owl:imports. The result maps each executable to its PREFIX lines.
    private static Map<RDFNode, String> declaredPrefixes(Model model) {
        final var declared = new HashMap<RDFNode, String>();
        final var query = """
                SELECT ?executable ?prefix ?namespace WHERE {
                  ?executable sh:prefixes/owl:imports*/sh:declare [ sh:prefix ?prefix ; sh:namespace ?namespace ]
                }""";
        Rdf.select(model, query)
                .forEach(r -> declared.merge(
                        r.get("executable"),
                        "PREFIX %s: <%s>%n"
                                .formatted(
                                        r.getLiteral("prefix").getLexicalForm(),
                                        r.get("namespace").asLiteral().getLexicalForm()),
                        String::concat));
        return declared;
    }

    private static Optional<BigDecimal> number(RDFNode node) {
        return Optional.ofNullable(node).map(n -> new BigDecimal(n.asLiteral().getLexicalForm()));
    }
}
