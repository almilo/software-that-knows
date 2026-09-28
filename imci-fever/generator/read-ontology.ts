// Reads the Turtle file into an RDF store, and gives small helpers to walk the graph.
import { Parser, Store, type Term } from "n3";

export const IMCI = "https://example.org/imci#";
export const SH = "http://www.w3.org/ns/shacl#";
export const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
export const RDFS = "http://www.w3.org/2000/01/rdf-schema#";
export const XSD = "http://www.w3.org/2001/XMLSchema#";
export const PROV = "http://www.w3.org/ns/prov#";

export type Ontology = ReturnType<typeof parseOntology>;

export async function readOntology(path: string): Promise<Ontology> {
  return parseOntology(await Bun.file(path).text());
}

export function parseOntology(turtle: string) {
  const store = new Store(new Parser().parse(turtle));
  const all = (s: Term, p: string) => store.getObjects(s, p, null);
  const one = (s: Term, p: string) => all(s, p)[0];
  return {
    all,
    one,
    text: (s: Term, p: string) => one(s, p)?.value,
    number: (s: Term, p: string) => (one(s, p) ? Number(one(s, p)!.value) : undefined),
    ofType: (type: string) => store.getSubjects(`${RDF}type`, type, null),
    isA: (s: Term, type: string) => store.countQuads(s, `${RDF}type`, type, null) > 0,
    // True when a SHACL property shape has this field as its sh:path.
    isField: (field: Term) => store.countQuads(null, `${SH}path`, field, null) > 0,
    // An RDF list ( a b c ) is a chain of rdf:first and rdf:rest nodes that ends with rdf:nil.
    list(head: Term | undefined): Term[] {
      const items: Term[] = [];
      while (head && head.value !== `${RDF}nil`) {
        items.push(one(head, `${RDF}first`)!);
        head = one(head, `${RDF}rest`);
      }
      return items;
    },
  };
}

// https://example.org/imci#temperature → temperature
export const local = (t: Term) => t.value.replace(IMCI, "");

export function literal(t: Term): unknown {
  if (t.termType !== "Literal") throw new Error(`Expected a literal, got ${t.value}`);
  const type = t.datatype.value;
  if (type === `${XSD}boolean`) return t.value === "true";
  if (type === `${XSD}integer` || type === `${XSD}decimal`) return Number(t.value);
  return t.value;
}
