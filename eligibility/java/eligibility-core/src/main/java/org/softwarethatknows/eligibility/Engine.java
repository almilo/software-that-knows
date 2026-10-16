package org.softwarethatknows.eligibility;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.apache.jena.datatypes.TypeMapper;
import org.apache.jena.query.QueryExecutionFactory;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.RDFNode;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.rdf.model.Statement;

// The rule engine, as react-bun/core/engine.ts: it knows SHACL, SHACL Advanced Features, SPARQL and
// the form vocabulary, and nothing about the domain.
//
// 1. The answers become triples about one focus node, $this, with the date of the evaluation.
// 2. The rules of the model (SPARQL CONSTRUCT) add triples until none adds a new one.
// 3. A field with form:askedWhen is asked when its ASK query is true. The answer to a field that is
//    not asked does not count: it is removed, and the rules run again.
// 4. What the rules derived is read back: values, findings, next steps.
//
// Not thread-safe: an engine holds the answers of one evaluation at a time. Create one per
// evaluation, or synchronize.
public final class Engine {

    private static final String FOCUS = "urn:form:this";

    private final Model model;
    private final Shape shape;
    private final List<String> rules;
    private final Map<String, String> askedWhen;

    public Engine(Model model) {
        this.model = model;
        this.shape = KnowledgeModel.readShape(model);
        this.rules = shape.rules().stream().map(Engine::bind).toList();
        this.askedWhen = shape.fields().stream().filter(f -> f.askedWhen().isPresent())
                .collect(Collectors.toMap(Field::name, f -> bind(f.askedWhen().get())));
    }

    public Shape shape() {
        return shape;
    }

    public Model model() {
        return model;
    }

    public synchronized Evaluation evaluate(Map<String, ?> input, LocalDate date) {
        final var known = shape.fields().stream().map(Field::name).toList();
        final var answers = new LinkedHashMap<String, Object>();
        input.forEach((name, value) -> {
            if (known.contains(name) && value != null && !"".equals(value)) answers.put(name, value);
        });
        return evaluateAsked(answers, date);
    }

    // The answer to a field that is not asked does not count: it is removed, and the rules run again.
    private Evaluation evaluateAsked(Map<String, Object> answers, LocalDate date) {
        final var union = infer(answers, date);
        final var shown = shape.fields().stream().filter(f -> isAsked(f, union)).map(Field::name).toList();
        final var hidden = answers.keySet().stream().filter(name -> !shown.contains(name)).toList();
        if (!hidden.isEmpty()) {
            final var asked = new LinkedHashMap<>(answers);
            hidden.forEach(asked::remove);
            return evaluateAsked(asked, date);
        }
        final var findings = readFindings(union);
        final var missing = shape.fields().stream().filter(f -> f.required() && shown.contains(f.name()) && !answers.containsKey(f.name())).map(Field::name).toList();
        return new Evaluation(Map.copyOf(answers), shown, missing, readValues(union), findings, readNextSteps(union),
                missing.isEmpty() && findings.stream().noneMatch(Evaluation.Finding::blocks));
    }

    // The answers and what the rules derive from them go into their own model; the queries see the
    // knowledge model and it together.
    private Model infer(Map<String, Object> answers, LocalDate date) {
        final Model derived = ModelFactory.createDefaultModel();
        final Resource focus = derived.createResource(FOCUS);
        focus.addProperty(derived.createProperty(Rdf.RDF + "type"), derived.createResource(shape.targetClass()));
        focus.addProperty(derived.createProperty(Rdf.FORM + "today"), derived.createTypedLiteral(date.toString(), TypeMapper.getInstance().getSafeTypeByName(Rdf.XSD + "date")));
        shape.fields().stream().filter(f -> answers.containsKey(f.name()))
                .forEach(f -> term(f, answers.get(f.name()), derived).ifPresent(object -> focus.addProperty(derived.createProperty(f.path()), object)));
        final Model union = ModelFactory.createUnion(model, derived);
        applyRules(union, derived);
        return union;
    }

    // SHACL-AF: the rules in sh:order, again and again until no rule adds a new triple.
    private void applyRules(Model union, Model derived) {
        final boolean added = rules.stream().map(rule -> addNew(construct(rule, union), union, derived)).reduce(false, Boolean::logicalOr);
        if (added) applyRules(union, derived);
    }

    private static boolean addNew(List<Statement> statements, Model union, Model derived) {
        final var fresh = statements.stream().filter(s -> !union.contains(s)).toList();
        derived.add(fresh);
        return !fresh.isEmpty();
    }

    private static List<Statement> construct(String query, Model union) {
        try (final var execution = QueryExecutionFactory.create(query, union)) {
            return execution.execConstruct().listStatements().toList();
        }
    }

    private boolean isAsked(Field f, Model union) {
        if (!askedWhen.containsKey(f.name())) return true;
        try (final var execution = QueryExecutionFactory.create(askedWhen.get(f.name()), union)) {
            return execution.execAsk();
        }
    }

    private List<Evaluation.Value> readValues(Model union) {
        return Rdf.select(union, bind("SELECT ?property ?value WHERE { ?property a form:Value . $this ?property ?value . OPTIONAL { ?property sh:order ?order } } ORDER BY ?order"))
                .stream()
                .map(r -> new Evaluation.Value(Rdf.local(r.get("property")), Rdf.toJson(r.get("value")), datatype(r.get("value")), KnowledgeModel.sources(model, r.getResource("property"))))
                .toList();
    }

    // The most serious first, then by name: a finding of a shared module has another namespace, which
    // must not change the order.
    private List<Evaluation.Finding> readFindings(Model union) {
        record Ordered(Evaluation.Finding finding, int order) {}
        return Rdf.select(union, bind("SELECT ?finding ?severity ?blocks ?order WHERE { $this form:finding ?finding . ?finding form:severity ?severity . ?severity form:blocks ?blocks ; sh:order ?order }"))
                .stream()
                .map(r -> new Ordered(
                        new Evaluation.Finding(Rdf.local(r.get("finding")), Rdf.local(r.get("severity")), Boolean.TRUE.equals(Rdf.toJson(r.get("blocks"))), KnowledgeModel.sources(model, r.getResource("finding"))),
                        r.getLiteral("order").getInt()))
                .sorted(Comparator.comparingInt(Ordered::order).thenComparing(o -> o.finding().id(), Rdf.BY_NUMBER))
                .map(Ordered::finding)
                .toList();
    }

    private List<Evaluation.NextStep> readNextSteps(Model union) {
        return Rdf.select(union, bind("SELECT ?step WHERE { $this form:nextStep ?step . OPTIONAL { ?step sh:order ?order } } ORDER BY ?order"))
                .stream()
                .map(r -> new Evaluation.NextStep(Rdf.local(r.get("step")), KnowledgeModel.sources(model, r.getResource("step"))))
                .toList();
    }

    // SHACL pre-binds $this to the focus node. A VALUES clause at the end of a query does the same.
    private static String bind(String query) {
        return query + "\nVALUES $this { <" + FOCUS + "> }";
    }

    private static String datatype(RDFNode node) {
        return node.isLiteral() ? Rdf.local(node.asLiteral().getDatatypeURI()) : "";
    }

    // An answer as an RDF term: a choice becomes the IRI of the choice, anything else a typed literal.
    private static Optional<RDFNode> term(Field f, Object value, Model derived) {
        if (f.choices().isEmpty()) {
            return Optional.of(derived.createTypedLiteral(lexical(value), TypeMapper.getInstance().getSafeTypeByName(f.datatype().orElseThrow())));
        }
        return f.choices().get().stream().filter(c -> Rdf.local(c).equals(String.valueOf(value))).findFirst().map(derived::createResource);
    }

    // A JSON value as a lexical form, as String(value) in JavaScript: 150000, not 150000.0.
    private static String lexical(Object value) {
        if (value instanceof Double || value instanceof Float || value instanceof BigDecimal) {
            final var number = new BigDecimal(value.toString()).stripTrailingZeros();
            return number.scale() <= 0 ? number.toBigInteger().toString() : number.toPlainString();
        }
        return String.valueOf(value);
    }
}
