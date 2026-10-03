// The rule engine. It knows SHACL, SHACL Advanced Features, SPARQL and the form vocabulary
// (ontology/form.ttl), and nothing about the domain. The wizard (app/) and the submission
// (submit.ts) both decide with it.
//
// 1. The answers become triples about one focus node, $this, with the date of the evaluation.
// 2. The rules of the model (SPARQL CONSTRUCT) add triples until none adds a new one.
// 3. A field with form:askedWhen is asked when its ASK query is true. The answer to a field that is
//    not asked does not count: it is removed, and the rules run again.
// 4. What the rules derived is read back: values, findings, next steps.
import { loadModel, readShape, sources, type Field } from "./model";
import { FORM, RDF, XSD, literal, local, namedNode, quad, select, toJson, type Quad } from "./rdf";

export type Answers = Record<string, unknown>;

export type Evaluation = {
  answers: Answers; // the answers to the fields that are asked; the others do not count
  shown: string[]; // the fields that are asked, in the order of the form
  missing: string[]; // the fields that are asked and need an answer, but have none
  values: { id: string; value: number | boolean | string; datatype: string; sources: string[] }[];
  findings: { id: string; severity: string; blocks: boolean; sources: string[] }[];
  nextSteps: { id: string; sources: string[] }[];
  allowed: boolean; // nothing is missing, and no finding blocks the application
};

// domain: the Turtle files of one domain. The form vocabulary is always added.
export function createEngine(domain: string[]) {
  const store = loadModel(domain);
  const shape = readShape(store);
  const focus = namedNode("urn:form:this");
  // The answers and what the rules derive from them go into their own graph, cleared for each
  // evaluation. The queries see the model and this graph together.
  const graph = namedNode("urn:form:answers");
  const union = { use_default_graph_as_union: true };
  const rules = shape.rules.map(bind);
  const askedWhen = new Map(shape.fields.flatMap((f) => (f.askedWhen ? [[f.name, bind(f.askedWhen)]] : [])));

  function evaluate(input: Answers, date = today()) {
    const known = new Set(shape.fields.map((f) => f.name));
    const answers = Object.fromEntries(Object.entries(input).filter(([k, v]) => known.has(k) && v !== undefined && v !== null && v !== ""));
    return evaluateAsked(answers, date);
  }

  // The answer to a field that is not asked does not count: it is removed, and the rules run again.
  // (The return types of the recursive functions are explicit: TypeScript cannot infer them.)
  function evaluateAsked(answers: Answers, date: string): Evaluation {
    infer(answers, date);
    const shown = shape.fields.filter(isAsked).map((f) => f.name);
    const hidden = Object.keys(answers).filter((name) => !shown.includes(name));
    if (hidden.length > 0) {
      return evaluateAsked(Object.fromEntries(Object.entries(answers).filter(([name]) => !hidden.includes(name))), date);
    }
    const findings = readFindings();
    const missing = shape.fields.filter((f) => f.required && shown.includes(f.name) && !(f.name in answers)).map((f) => f.name);
    return {
      answers,
      shown,
      missing,
      values: readValues(),
      findings,
      nextSteps: readNextSteps(),
      allowed: missing.length === 0 && !findings.some((f) => f.blocks),
    };
  }

  function infer(answers: Answers, date: string) {
    store.update(`CLEAR SILENT GRAPH <${graph.value}>`);
    store.add(quad(focus, namedNode(`${RDF}type`), namedNode(shape.targetClass), graph));
    store.add(quad(focus, namedNode(`${FORM}today`), literal(date, namedNode(`${XSD}date`)), graph));
    shape.fields
      .filter((f) => f.name in answers)
      .forEach((f) => {
        const object = term(f, answers[f.name]);
        if (object) store.add(quad(focus, namedNode(f.path), object, graph));
      });
    applyRules();
  }

  // SHACL-AF: the rules in sh:order, again and again until no rule adds a new triple.
  function applyRules(): void {
    const added = rules.reduce((any, rule) => addNew(store.query(rule, union) as Quad[]) || any, false);
    if (added) applyRules();
  }

  function addNew(quads: Quad[]) {
    const fresh = quads.map(inGraph).filter((q) => !store.has(q));
    fresh.forEach((q) => store.add(q));
    return fresh.length > 0;
  }

  function isAsked(f: Field) {
    return !askedWhen.has(f.name) || store.query(askedWhen.get(f.name)!, union) === true;
  }

  function readValues() {
    return read(
      `SELECT ?property ?value WHERE { ?property a form:Value . $this ?property ?value . OPTIONAL { ?property sh:order ?order } } ORDER BY ?order`,
    ).map(({ property, value }) => ({
      id: local(property!),
      value: toJson(value!),
      datatype: value!.termType === "Literal" ? local(value!.datatype) : "",
      sources: sources(store, property!),
    }));
  }

  function readFindings() {
    return read(
      `SELECT ?finding ?severity ?blocks WHERE {
         $this form:finding ?finding . ?finding form:severity ?severity . ?severity form:blocks ?blocks ; sh:order ?order
       } ORDER BY ?order ?finding`,
    ).map(({ finding, severity, blocks }) => ({
      id: local(finding!),
      severity: local(severity!),
      blocks: toJson(blocks!) === true,
      sources: sources(store, finding!),
    }));
  }

  function readNextSteps() {
    return read(`SELECT ?step WHERE { $this form:nextStep ?step . OPTIONAL { ?step sh:order ?order } } ORDER BY ?order`).map(({ step }) => ({
      id: local(step!),
      sources: sources(store, step!),
    }));
  }

  function read(query: string) {
    return select(store, bind(query), union);
  }

  // SHACL pre-binds $this to the focus node. A VALUES clause at the end of a query does the same.
  function bind(query: string) {
    return `${query}\nVALUES $this { <${focus.value}> }`;
  }

  function inGraph(q: Quad) {
    return quad(q.subject, q.predicate, q.object, graph);
  }

  return { shape, evaluate };
}

// Today in the time zone of the computer, as YYYY-MM-DD.
export function today(now = new Date()) {
  return [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((n) => String(n).padStart(2, "0")).join("-");
}

// An answer as an RDF term: a choice becomes the IRI of the choice, anything else a typed literal.
function term(f: Field, value: unknown) {
  if (!f.choices) return literal(String(value), namedNode(f.datatype!));
  const choice = f.choices.find((c) => local(c) === value);
  return choice ? namedNode(choice) : undefined;
}
