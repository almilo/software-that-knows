// Oxigraph: an RDF store with a SPARQL 1.1 engine, compiled to WebAssembly. The generator, the
// engine and the tests all use it through this file.
import init, { Store, literal, namedNode, quad, type Quad, type Term } from "oxigraph/web.js";
import wasm from "oxigraph/web_bg.wasm" with { type: "file" };

export { Store, literal, namedNode, quad, type Quad, type Term };

// The WebAssembly must load before the first call. In the browser `wasm` is the URL of the file in
// the build; in Bun (generator, tests) it is its path.
export const ready: Promise<unknown> = init({
  module_or_path: typeof Bun === "undefined" ? wasm : Bun.file(wasm).arrayBuffer(),
});

export const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
export const RDFS = "http://www.w3.org/2000/01/rdf-schema#";
export const XSD = "http://www.w3.org/2001/XMLSchema#";
export const SH = "http://www.w3.org/ns/shacl#";
export const PROV = "http://www.w3.org/ns/prov#";
export const OWL = "http://www.w3.org/2002/07/owl#";
export const FORM = "https://example.org/form#";

// For the queries of the generator and the engine. The queries of a model declare their own.
export const PREFIXES = Object.entries({ rdf: RDF, rdfs: RDFS, xsd: XSD, owl: OWL, sh: SH, prov: PROV, form: FORM })
  .map(([prefix, namespace]) => `PREFIX ${prefix}: <${namespace}>\n`)
  .join("");

// The rows of a SELECT query, each as an object from variable name to term.
export function select(store: Store, query: string, options?: Parameters<Store["query"]>[1]) {
  return (store.query(PREFIXES + query, options) as Map<string, Term>[]).map((row): Record<string, Term> => Object.fromEntries(row));
}

// https://example.org/domain#birthDate → birthDate
export function local(t: Term | string) {
  return (typeof t === "string" ? t : t.value).replace(/^.*[#/]/, "");
}

export function objects(store: Store, subject: Term, predicate: string) {
  return store.match(subject, namedNode(predicate), null).map((q) => q.object);
}

// An RDF list ( a b c ) is a chain of rdf:first and rdf:rest nodes that ends with rdf:nil. SPARQL
// cannot read it in order, so this walks it.
export function list(store: Store, head: Term): Term[] {
  if (head.value === `${RDF}nil`) return [];
  return [objects(store, head, `${RDF}first`)[0]!, ...list(store, objects(store, head, `${RDF}rest`)[0]!)];
}

// A term as JSON: a number, a boolean, a date or other text, or the local name of an IRI.
export function toJson(t: Term): number | boolean | string {
  if (t.termType !== "Literal") return local(t);
  const type = local(t.datatype);
  if (["integer", "decimal", "double", "float"].includes(type)) return Number(t.value);
  return type === "boolean" ? t.value === "true" : t.value;
}

// Numbers in labels sort as numbers: "Art. 5" before "Art. 10".
export const byNumber = new Intl.Collator("en", { numeric: true }).compare;
