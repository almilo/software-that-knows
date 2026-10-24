// Reads a knowledge model (../knowledge/): the form vocabulary (ontology/form.ttl), which every
// domain uses, the Turtle files of one domain (domains/<name>/ontology/), and the shared modules
// that they import
// (modules/). The generator reads the fields from it; the engine also reads the rules.
import vocabulary from "../../knowledge/ontology/form.ttl" with { type: "text" };
import { PROV, Store, byNumber, list, local, objects, select, type Term } from "./rdf";

// files: the Turtle files of the domain and of every module that it imports, directly or through
// another module. The imports must be closed: every ontology that a file imports (owl:imports) is
// loaded, and every loaded ontology but one, the domain's, is imported by another. So a domain
// cannot miss a module, nor load one that it does not use.
export function loadModel(files: string[]) {
  const store = new Store();
  [vocabulary, ...files].forEach((file) => store.load(file, { format: "text/turtle" }));
  const missing = select(store, `SELECT ?by ?ontology WHERE { ?by a owl:Ontology ; owl:imports ?ontology FILTER NOT EXISTS { ?ontology a owl:Ontology } }`);
  if (missing.length > 0) throw new Error(`Not loaded: ${missing.map((r) => `${r.ontology!.value}, imported by ${r.by!.value}`).join("; ")}`);
  const roots = select(store, `SELECT ?ontology WHERE { ?ontology a owl:Ontology FILTER NOT EXISTS { ?any owl:imports ?ontology } }`);
  if (roots.length !== 1) throw new Error(`One ontology must import all the others, directly or not. Not imported: ${roots.map((r) => r.ontology!.value).join(", ")}`);
  return store;
}

export type Field = {
  name: string; // the local name of sh:path: the property in the JSON data
  path: string; // sh:path
  group: string; // the local name of sh:group
  datatype?: string; // sh:datatype
  choices?: string[]; // sh:in
  minimum?: number; // sh:minInclusive
  maximum?: number; // sh:maxInclusive
  required: boolean; // sh:minCount 1: when the field is asked, it needs an answer
  askedWhen?: string; // form:askedWhen: an ASK query, with its PREFIX lines
};

export type NumberFormat = { group: string; decimal: string };

export type Shape = {
  iri: string; // the sh:NodeShape
  name: string; // its local name
  region: string; // form:region: how the app writes dates and numbers
  numbers: Record<string, NumberFormat>; // the form:NumberFormat of the region, by language
  targetClass: string; // sh:targetClass: the class of $this
  groups: string[]; // the local names of the sh:PropertyGroups, in sh:order
  fields: Field[]; // in the order of their groups, then in sh:order
  rules: string[]; // the CONSTRUCT queries of the sh:SPARQLRules, in sh:order, with their PREFIX lines
};

// The form of a domain: its shape, the one sh:NodeShape with a form:region, and every shape whose
// sh:targetClass is the class of that shape or one of its superclasses. As in SHACL, a shape for a
// class applies to the members of its subclasses: a module's shape for person:Applicant applies to
// wef:Application, a subclass. Its fields and rules become part of the domain's form.
export function readShape(store: Store) {
  const shapes = select(store, `SELECT ?shape ?class ?region WHERE { ?shape a sh:NodeShape ; sh:targetClass ?class ; form:region ?region }`);
  if (shapes.length !== 1) throw new Error(`The model must have one sh:NodeShape with a sh:targetClass and a form:region, not ${shapes.length}`);
  const { shape, class: targetClass, region } = shapes[0]!;
  const applies = `<${targetClass!.value}> rdfs:subClassOf* ?class . ?shape sh:targetClass ?class .`;
  const declared = declaredPrefixes(store);
  function withPrefixes(executable: Term, query: Term) {
    return (declared.get(executable.value) ?? "") + query.value;
  }

  const fields = select(
    store,
    `SELECT DISTINCT ?field ?path ?group ?datatype ?in ?min ?max ?minCount ?asked ?ask ?groupOrder ?order WHERE {
       ${applies}
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
     } ORDER BY ?groupOrder ?order`,
  ).map((f) => ({
    name: local(f.path!),
    path: f.path!.value,
    group: local(f.group!),
    datatype: f.datatype?.value,
    choices: f.in && list(store, f.in).map((c) => c.value),
    minimum: number(f.min),
    maximum: number(f.max),
    required: (number(f.minCount) ?? 0) >= 1,
    askedWhen: f.ask && withPrefixes(f.asked!, f.ask),
  }) satisfies Field);

  const rules = select(
    store,
    `SELECT DISTINCT ?rule ?construct ?order WHERE {
       ${applies}
       ?shape sh:rule ?rule .
       ?rule a sh:SPARQLRule ; sh:construct ?construct .
       OPTIONAL { ?rule sh:order ?order }
       FILTER NOT EXISTS { ?rule sh:deactivated true }
     } ORDER BY ?order`,
  ).map((r) => withPrefixes(r.rule!, r.construct!));

  const numbers = Object.fromEntries(
    select(
      store,
      `SELECT ?language ?group ?decimal WHERE {
         ?format a form:NumberFormat ; form:region "${region!.value}" ; form:language ?language ; form:groupSeparator ?group ; form:decimalSeparator ?decimal } ORDER BY ?language`,
    ).map((n) => [n.language!.value, { group: n.group!.value, decimal: n.decimal!.value }]),
  );

  // The groups of the fields, in their order: a module can define groups that a domain does not use.
  const groups = [...new Set(fields.map((f) => f.group))];

  return {
    iri: shape!.value,
    name: local(shape!),
    region: region!.value,
    numbers,
    targetClass: targetClass!.value,
    groups,
    fields,
    rules,
  } satisfies Shape;
}

// The sources of a node (prov:wasDerivedFrom), by local name, in the order of their numbers.
export function sources(store: Store, node: Term) {
  return objects(store, node, `${PROV}wasDerivedFrom`).map(local).sort(byNumber);
}

// SHACL: a SPARQL query uses the prefixes that its sh:prefixes declare (sh:declare), also through
// owl:imports. The executables are blank nodes, so they are matched by their value. The result maps
// each executable to its PREFIX lines.
function declaredPrefixes(store: Store) {
  const rows = select(
    store,
    `SELECT ?executable ?prefix ?namespace WHERE {
       ?executable sh:prefixes/owl:imports*/sh:declare [ sh:prefix ?prefix ; sh:namespace ?namespace ] }`,
  );
  return rows.reduce(
    (declared, { executable, prefix, namespace }) =>
      declared.set(executable!.value, (declared.get(executable!.value) ?? "") + `PREFIX ${prefix!.value}: <${namespace!.value}>\n`),
    new Map<string, string>(),
  );
}

function number(t?: Term) {
  return t ? Number(t.value) : undefined;
}
