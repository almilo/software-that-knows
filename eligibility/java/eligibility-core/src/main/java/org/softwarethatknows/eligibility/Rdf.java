package org.softwarethatknows.eligibility;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.apache.jena.query.QueryExecutionFactory;
import org.apache.jena.query.QuerySolution;
import org.apache.jena.rdf.model.Literal;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.RDFNode;

// Jena, as the TypeScript core uses Oxigraph (react-bun/core/rdf.ts): the namespaces, a SELECT that
// returns rows, local names, terms as JSON values, and the order of numbered labels.
public final class Rdf {

    public static final String RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
    public static final String RDFS = "http://www.w3.org/2000/01/rdf-schema#";
    public static final String XSD = "http://www.w3.org/2001/XMLSchema#";
    public static final String SH = "http://www.w3.org/ns/shacl#";
    public static final String PROV = "http://www.w3.org/ns/prov#";
    public static final String OWL = "http://www.w3.org/2002/07/owl#";
    public static final String FORM = "https://example.org/form#";

    // For the queries of the core. The queries of a model declare their own.
    public static final String PREFIXES = Map.of(
                    "rdf", RDF, "rdfs", RDFS, "xsd", XSD, "owl", OWL, "sh", SH, "prov", PROV, "form", FORM)
            .entrySet()
            .stream()
            .map(e -> "PREFIX %s: <%s>%n".formatted(e.getKey(), e.getValue()))
            .collect(Collectors.joining());

    private Rdf() {}

    // The rows of a SELECT query.
    public static List<QuerySolution> select(Model model, String query) {
        try (final var execution = QueryExecutionFactory.create(PREFIXES + query, model)) {
            return java.util.stream.StreamSupport.stream(
                            java.util.Spliterators.spliteratorUnknownSize(execution.execSelect(), 0), false)
                    .toList();
        }
    }

    // https://example.org/domain#birthDate → birthDate
    public static String local(String iri) {
        return iri.replaceAll("^.*[#/]", "");
    }

    public static String local(RDFNode node) {
        return node.isURIResource() ? local(node.asResource().getURI()) : node.toString();
    }

    // A term as JSON: a number, a boolean, a date or other text, or the local name of an IRI.
    public static Object toJson(RDFNode node) {
        if (!node.isLiteral()) return local(node);
        final Literal literal = node.asLiteral();
        final var type = local(literal.getDatatypeURI() == null ? "" : literal.getDatatypeURI());
        if (List.of("integer", "decimal", "double", "float").contains(type))
            return new BigDecimal(literal.getLexicalForm()).stripTrailingZeros();
        return type.equals("boolean") ? Boolean.parseBoolean(literal.getLexicalForm()) : literal.getLexicalForm();
    }

    // Numbers in labels sort as numbers: "Art. 5" before "Art. 10", as Intl.Collator with numeric.
    public static final Comparator<String> BY_NUMBER = Rdf::compareNumbered;

    private static final Pattern CHUNK = Pattern.compile("\\d+|\\D+");

    private static int compareNumbered(String a, String b) {
        final var left = CHUNK.matcher(a).results().map(m -> m.group()).toList();
        final var right = CHUNK.matcher(b).results().map(m -> m.group()).toList();
        return java.util.stream.IntStream.range(0, Math.min(left.size(), right.size()))
                .map(i -> compareChunk(left.get(i), right.get(i)))
                .filter(c -> c != 0)
                .findFirst()
                .orElse(Integer.compare(left.size(), right.size()));
    }

    private static int compareChunk(String a, String b) {
        final boolean numbers = Character.isDigit(a.charAt(0)) && Character.isDigit(b.charAt(0));
        return numbers ? new BigDecimal(a).compareTo(new BigDecimal(b)) : a.compareToIgnoreCase(b);
    }
}
