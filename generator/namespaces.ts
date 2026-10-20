// IRIs of the standards and of the sk: vocabulary that the generator knows.

const ns = <T extends string>(base: string, names: readonly T[]) =>
  Object.fromEntries(names.map((n) => [n, base + n])) as Record<T, string>;

export const RDF = ns("http://www.w3.org/1999/02/22-rdf-syntax-ns#", ["type", "first", "rest", "nil", "value"] as const);
export const RDFS = ns("http://www.w3.org/2000/01/rdf-schema#", ["label", "comment", "seeAlso"] as const);
export const OWL = ns("http://www.w3.org/2002/07/owl#", ["Ontology"] as const);
export const SKOS = ns("http://www.w3.org/2004/02/skos/core#", ["definition"] as const);
export const PROV = ns("http://www.w3.org/ns/prov#", ["wasDerivedFrom", "wasQuotedFrom", "value"] as const);
export const XSD = ns("http://www.w3.org/2001/XMLSchema#", ["date", "boolean", "decimal", "integer", "double", "string"] as const);
export const SH = ns("http://www.w3.org/ns/shacl#", [
  "property", "path", "datatype", "in", "name", "description", "order", "group", "minInclusive", "maxInclusive",
  "targetClass", "sparql", "message",
] as const);
export const SK = ns("https://github.com/almilo/software-that-knows/vocabulary#", [
  "Questionnaire", "RelevanceRule", "asks", "Rule", "resultKind", "ResultKind", "Parameter", "Interpretation",
  "interpretation", "OpenPoint", "openPoint", "status", "Status", "Settled", "Open",
] as const);
