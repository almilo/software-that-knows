// Reads a knowledge model: the form vocabulary (ontology/form.ttl), which every domain uses, and
// the Turtle files of one domain (domains/<name>/ontology/). The generator reads the fields from
// it; the engine also reads the rules.
import vocabulary from "../ontology/form.ttl" with { type: "text" };
import { PROV, Store, byNumber, list, local, objects, select, type Term } from "./rdf";

export function loadModel(domain: string[]) {
  const store = new Store();
  [vocabulary, ...domain].forEach((file) => store.load(file, { format: "text/turtle" }));
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

export type Shape = {
  iri: string; // the sh:NodeShape
  name: string; // its local name
  region: string; // form:region: how the app writes dates and numbers
  targetClass: string; // sh:targetClass: the class of $this
  groups: string[]; // the local names of the sh:PropertyGroups, in sh:order
  fields: Field[]; // in the order of their groups, then in sh:order
  rules: string[]; // the CONSTRUCT queries of the sh:SPARQLRules, in sh:order, with their PREFIX lines
};

export function readShape(store: Store) {
  const shapes = select(store, `SELECT ?shape ?class ?region WHERE { ?shape a sh:NodeShape ; sh:targetClass ?class ; form:region ?region }`);
  if (shapes.length !== 1) throw new Error(`The model must have one sh:NodeShape with a sh:targetClass and a form:region, not ${shapes.length}`);
  const { shape, class: targetClass, region } = shapes[0]!;
  const declared = declaredPrefixes(store);
  function withPrefixes(executable: Term, query: Term) {
    return (declared.get(executable.value) ?? "") + query.value;
  }

  const fields = select(
    store,
    `SELECT ?field ?path ?group ?datatype ?in ?min ?max ?minCount ?asked ?ask WHERE {
       <${shape!.value}> sh:property ?field .
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
    `SELECT ?rule ?construct WHERE {
       <${shape!.value}> sh:rule ?rule .
       ?rule a sh:SPARQLRule ; sh:construct ?construct .
       OPTIONAL { ?rule sh:order ?order }
       FILTER NOT EXISTS { ?rule sh:deactivated true }
     } ORDER BY ?order`,
  ).map((r) => withPrefixes(r.rule!, r.construct!));

  const groups = select(store, `SELECT ?group WHERE { ?group a sh:PropertyGroup ; sh:order ?order } ORDER BY ?order`);

  return {
    iri: shape!.value,
    name: local(shape!),
    region: region!.value,
    targetClass: targetClass!.value,
    groups: groups.map((g) => local(g.group!)),
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
