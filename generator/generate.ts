// Deterministic generator: turns a knowledge model (Turtle, SHACL + stk vocabulary)
// into the files that the browser app needs. It knows the W3C standards and the
// stk vocabulary. It does not know the law: all terms of the process come from the model.
import { Parser, Store, Writer, DataFactory, type Quad, type Term } from "n3";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const { namedNode } = DataFactory;

const NS = {
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  xsd: "http://www.w3.org/2001/XMLSchema#",
  sh: "http://www.w3.org/ns/shacl#",
  dcterms: "http://purl.org/dc/terms/",
  stk: "https://software-that-knows.example/vocab#",
};
const rdf = (l: string) => namedNode(NS.rdf + l);
const rdfs = (l: string) => namedNode(NS.rdfs + l);
const sh = (l: string) => namedNode(NS.sh + l);
const dcterms = (l: string) => namedNode(NS.dcterms + l);
const stk = (l: string) => namedNode(NS.stk + l);

export interface GeneratorOptions {
  modelFiles: string[];
  outDir: string;
  language?: string;
}

export interface Source { label: string; url?: string; description?: string }
export interface Interpretation { label: string; comment: string; sources: string[] }
export interface Question {
  key: string;
  path: string;
  label: string;
  order: number;
  group?: string;
  askWhen?: string;
  sources: string[];
  interpretations: string[];
}
export interface Rule {
  label: string;
  outcome: string;
  sources: string[];
  interpretations: string[];
}
export interface OpenPoint { iri: string; label: string; comment: string; sources: string[] }
export interface Parameter { iri: string; label: string; value: string; sources: string[]; interpretations: string[] }
export interface Catalog {
  title: string;
  focusClass: string;
  questionnaire: string;
  questions: Question[];
  rules: Record<string, Rule>;
  outcomes: Record<string, { label: string; order: number }>;
  labels: Record<string, string>;
  sources: Record<string, Source>;
  interpretations: Record<string, Interpretation>;
  openPoints: OpenPoint[];
  parameters: Parameter[];
}

class Model {
  constructor(readonly store: Store, readonly language: string) {}

  objects(s: Term, p: Term): Term[] {
    return this.store.getObjects(s, p, null);
  }
  object(s: Term, p: Term): Term | undefined {
    return this.objects(s, p)[0];
  }
  subjects(p: Term, o: Term): Term[] {
    return this.store.getSubjects(p, o, null);
  }
  has(s: Term, p: Term, o: Term): boolean {
    return this.store.countQuads(s, p, o, null) > 0;
  }
  // Literal in the preferred language, else without language, else any.
  text(s: Term, ...ps: Term[]): string | undefined {
    for (const p of ps) {
      const literals = this.objects(s, p).filter((o) => o.termType === "Literal") as any[];
      const best =
        literals.find((l) => l.language === this.language) ??
        literals.find((l) => !l.language) ??
        literals[0];
      if (best) return best.value;
    }
    return undefined;
  }
  number(s: Term, p: Term): number | undefined {
    const o = this.object(s, p);
    return o ? Number(o.value) : undefined;
  }
  list(head: Term | undefined): Term[] {
    const items: Term[] = [];
    while (head && head.value !== NS.rdf + "nil") {
      const first = this.object(head, rdf("first"));
      if (first) items.push(first);
      head = this.object(head, rdf("rest"));
    }
    return items;
  }
  label(t: Term): string {
    return this.text(t, rdfs("label"), sh("name")) ?? localName(t.value);
  }
}

export function localName(iri: string): string {
  const m = iri.match(/[^#/]+$/);
  return m ? m[0] : iri;
}

function sortedValues(terms: Term[]): string[] {
  return terms.map((t) => t.value).sort();
}

function jsonSchemaFor(model: Model, shape: Term): Record<string, unknown> {
  const schema: Record<string, unknown> = {};
  const label = model.text(shape, sh("name"));
  const description = model.text(shape, sh("description"));
  if (label) schema.title = label;
  if (description) schema.description = description;

  const inList = model.object(shape, sh("in"));
  const datatype = model.object(shape, sh("datatype"))?.value;
  if (inList) {
    schema.type = "string";
    schema.oneOf = model.list(inList).map((t) => ({ const: t.value, title: model.label(t) }));
  } else if (datatype === NS.xsd + "boolean") {
    // A boolean answer has three states: yes, no, not answered.
    schema.type = "string";
    schema.oneOf = [
      { const: "true", title: "Yes" },
      { const: "false", title: "No" },
    ];
  } else if (datatype === NS.xsd + "date") {
    schema.type = "string";
    schema.format = "date";
  } else if (datatype === NS.xsd + "integer") {
    schema.type = "integer";
  } else if (datatype === NS.xsd + "decimal" || datatype === NS.xsd + "double") {
    schema.type = "number";
  } else {
    schema.type = "string";
  }
  const min = model.number(shape, sh("minInclusive"));
  const max = model.number(shape, sh("maxInclusive"));
  if (min !== undefined) schema.minimum = min;
  if (max !== undefined) schema.maximum = max;
  return schema;
}

export function generate(options: GeneratorOptions) {
  const language = options.language ?? "en";
  const store = new Store();
  const prefixes: Record<string, string> = {};
  options.modelFiles.forEach((file, fileIndex) => {
    const parser = new Parser({ baseIRI: "file://" + resolve(file) });
    const quads = parser.parse(readFileSync(file, "utf8"), null, (prefix, iri) => {
      prefixes[prefix] = iri.value;
    });
    // Blank node labels in the order of the file, so that the output does not depend on the run.
    const labels = new Map<string, Term>();
    const stable = (t: Term): Term => {
      if (t.termType !== "BlankNode") return t;
      if (!labels.has(t.value)) labels.set(t.value, DataFactory.blankNode(`m${fileIndex}b${labels.size}`));
      return labels.get(t.value)!;
    };
    for (const q of quads) {
      store.addQuad(DataFactory.quad(stable(q.subject) as any, q.predicate, stable(q.object) as any, q.graph));
    }
  });
  const model = new Model(store, language);

  const questionnaires = model.subjects(rdf("type"), stk("Questionnaire"));
  if (questionnaires.length !== 1) {
    throw new Error(`The model must have exactly one stk:Questionnaire, found ${questionnaires.length}`);
  }
  const questionnaire = questionnaires[0];
  const focusClass = model.object(questionnaire, sh("targetClass"));
  if (!focusClass) throw new Error("The questionnaire must have sh:targetClass");

  // --- Questions ----------------------------------------------------------
  const questions: Question[] = model.objects(questionnaire, sh("property")).map((shape) => {
    const path = model.object(shape, sh("path"));
    if (!path || path.termType !== "NamedNode") {
      throw new Error(`Question ${shape.value} must have an IRI as sh:path`);
    }
    return {
      key: localName(path.value),
      path: path.value,
      label: model.text(shape, sh("name")) ?? localName(path.value),
      order: model.number(shape, sh("order")) ?? 0,
      group: model.object(shape, sh("group"))?.value,
      askWhen: model.object(shape, stk("askWhen"))?.value,
      sources: sortedValues(model.objects(shape, dcterms("source"))),
      interpretations: sortedValues(model.objects(shape, stk("interpretation"))),
    };
  });
  questions.sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));
  const keys = new Set<string>();
  for (const q of questions) {
    if (keys.has(q.key)) throw new Error(`Two questions have the key ${q.key}`);
    keys.add(q.key);
  }
  const shapeOfKey = new Map(
    model.objects(questionnaire, sh("property")).map((s) => [localName(model.object(s, sh("path"))!.value), s]),
  );

  // --- JSON Schema ----------------------------------------------------------
  const properties: Record<string, unknown> = {};
  for (const q of questions) properties[q.key] = jsonSchemaFor(model, shapeOfKey.get(q.key)!);
  const schema = {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: model.label(questionnaire),
    type: "object",
    properties,
  };

  // --- JSON Forms UI schema ------------------------------------------------
  const groups = [...new Set(questions.map((q) => q.group).filter(Boolean) as string[])].sort(
    (a, b) => (model.number(namedNode(a), sh("order")) ?? 0) - (model.number(namedNode(b), sh("order")) ?? 0),
  );
  const control = (q: Question) => {
    const s = properties[q.key] as Record<string, unknown>;
    return {
      type: "Control",
      scope: `#/properties/${q.key}`,
      ...(s.oneOf ? { options: { format: "radio" } } : {}),
    };
  };
  const uischema = {
    type: "VerticalLayout",
    elements: [
      ...groups.map((g) => ({
        type: "Group",
        label: model.label(namedNode(g)),
        elements: questions.filter((q) => q.group === g).map(control),
      })),
      ...questions.filter((q) => !q.group).map(control),
    ],
  };

  // --- JSON-LD context: maps form data to RDF -------------------------------
  const context: Record<string, unknown> = {};
  for (const q of questions) {
    const shape = shapeOfKey.get(q.key)!;
    const datatype = model.object(shape, sh("datatype"))?.value;
    context[q.key] = { "@id": q.path, "@type": model.object(shape, sh("in")) ? "@id" : datatype ?? NS.xsd + "string" };
  }
  const jsonld = { "@context": context };

  // --- Rules, outcomes, open points ------------------------------------------
  const rules: Record<string, Rule> = {};
  const openPoints: OpenPoint[] = [];
  for (const rule of model.subjects(rdf("type"), stk("Rule"))) {
    if (model.has(rule, rdf("type"), stk("OpenPoint"))) {
      openPoints.push({
        iri: rule.value,
        label: model.label(rule),
        comment: model.text(rule, rdfs("comment")) ?? "",
        sources: sortedValues(model.objects(rule, dcterms("source"))),
      });
      continue;
    }
    const outcome = model.object(rule, stk("outcome"));
    if (!outcome) throw new Error(`Rule ${rule.value} must have stk:outcome`);
    if (model.objects(rule, sh("sparql")).length !== 1) {
      throw new Error(`Rule ${rule.value} must have one sh:sparql constraint`);
    }
    for (const c of model.objects(rule, sh("sparql"))) {
      if (!model.text(c, sh("message"))) throw new Error(`Rule ${rule.value} must have sh:message`);
    }
    const sources = sortedValues(model.objects(rule, dcterms("source")));
    if (sources.length === 0) throw new Error(`Rule ${rule.value} must have dcterms:source`);
    rules[rule.value] = {
      label: model.label(rule),
      outcome: outcome.value,
      sources,
      interpretations: sortedValues(model.objects(rule, stk("interpretation"))),
    };
  }
  openPoints.sort((a, b) => a.iri.localeCompare(b.iri));

  const outcomes: Catalog["outcomes"] = {};
  for (const kind of model.subjects(rdf("type"), stk("OutcomeKind"))) {
    outcomes[kind.value] = { label: model.label(kind), order: model.number(kind, sh("order")) ?? 0 };
  }

  // --- Parameters: added to the data graph by the app -----------------------
  const parameterQuads: Quad[] = [];
  const parameters: Parameter[] = [];
  for (const p of model.subjects(rdf("type"), stk("Parameter"))) {
    const value = model.object(p, rdf("value"));
    if (!value) throw new Error(`Parameter ${p.value} must have rdf:value`);
    const sources = sortedValues(model.objects(p, dcterms("source")));
    if (sources.length === 0) throw new Error(`Parameter ${p.value} must have dcterms:source`);
    parameterQuads.push(...store.getQuads(p, null, null, null));
    parameters.push({
      iri: p.value,
      label: model.label(p),
      value: value.value,
      sources,
      interpretations: sortedValues(model.objects(p, stk("interpretation"))),
    });
  }
  parameters.sort((a, b) => a.iri.localeCompare(b.iri));

  // --- Sources and interpretations ------------------------------------------
  const referenced = new Set<string>();
  for (const q of questions) q.sources.forEach((s) => referenced.add(s));
  for (const r of Object.values(rules)) r.sources.forEach((s) => referenced.add(s));
  for (const o of openPoints) o.sources.forEach((s) => referenced.add(s));
  for (const p of parameters) p.sources.forEach((s) => referenced.add(s));
  const interpretations: Catalog["interpretations"] = {};
  for (const i of model.subjects(rdf("type"), stk("Interpretation"))) {
    const sources = sortedValues(model.objects(i, dcterms("source")));
    sources.forEach((s) => referenced.add(s));
    interpretations[i.value] = { label: model.label(i), comment: model.text(i, rdfs("comment")) ?? "", sources };
  }
  const sources: Catalog["sources"] = {};
  for (const s of [...referenced].sort()) {
    const t = namedNode(s);
    sources[s] = {
      label: model.label(t),
      url: model.object(t, rdfs("seeAlso"))?.value,
      description: model.text(t, dcterms("description")),
    };
  }

  // --- Labels of all IRIs (answer values, result values, result properties) --
  const labels: Record<string, string> = {};
  for (const q of model.store.getQuads(null, rdfs("label"), null, null)) {
    if (q.subject.termType === "NamedNode") labels[q.subject.value] = model.label(q.subject);
  }
  const sortedLabels = Object.fromEntries(Object.entries(labels).sort(([a], [b]) => a.localeCompare(b)));

  const catalog: Catalog = {
    title: model.label(questionnaire),
    focusClass: focusClass.value,
    questionnaire: questionnaire.value,
    questions,
    rules: Object.fromEntries(Object.entries(rules).sort(([a], [b]) => a.localeCompare(b))),
    outcomes,
    labels: sortedLabels,
    sources,
    interpretations: Object.fromEntries(Object.entries(interpretations).sort(([a], [b]) => a.localeCompare(b))),
    openPoints,
    parameters,
  };

  // --- Write the files --------------------------------------------------------
  const toTurtle = (quads: Quad[]) => {
    const writer = new Writer({ prefixes });
    const sorted = [...quads].sort((a, b) =>
      (a.subject.value + a.predicate.value + a.object.value).localeCompare(b.subject.value + b.predicate.value + b.object.value),
    );
    writer.addQuads(sorted);
    let out = "";
    writer.end((error, result) => {
      if (error) throw error;
      out = result;
    });
    return out;
  };

  mkdirSync(options.outDir, { recursive: true });
  const write = (name: string, content: string) => {
    const file = join(options.outDir, name);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  };
  const json = (v: unknown) => JSON.stringify(v, null, 2) + "\n";
  write("schema.json", json(schema));
  write("uischema.json", json(uischema));
  write("context.jsonld", json(jsonld));
  write("catalog.json", json(catalog));
  write("shapes.ttl", toTurtle(store.getQuads(null, null, null, null)));
  write("parameters.ttl", toTurtle(parameterQuads));
  return { schema, uischema, jsonld, catalog };
}

if (import.meta.main) {
  const [outDir, ...modelFiles] = process.argv.slice(2);
  if (!outDir || modelFiles.length === 0) {
    console.error("Usage: bun generator/generate.ts <out-dir> <model.ttl>...");
    process.exit(1);
  }
  generate({ modelFiles, outDir });
  console.log(`Generated files in ${outDir}`);
}
