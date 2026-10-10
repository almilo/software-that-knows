// Reads Turtle files into one RDF store, and gives small helpers to walk the graph.
import { Parser, Store, type Term } from "n3";

export const ARCH = "https://example.org/cloud-native-architecture#";
export const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
export const RDFS = "http://www.w3.org/2000/01/rdf-schema#";
export const SKOS = "http://www.w3.org/2004/02/skos/core#";
export const SH = "http://www.w3.org/ns/shacl#";

export type Ontology = ReturnType<typeof parseOntology>;

export async function readOntology(paths: string[]) {
  const texts = await Promise.all(paths.map((path) => Bun.file(path).text()));
  return parseOntology(texts.join("\n"));
}

export function parseOntology(turtle: string) {
  const store = new Store(new Parser().parse(turtle));
  const all = (s: Term, p: string) => store.getObjects(s, p, null);
  const one = (s: Term, p: string) => all(s, p)[0];
  return {
    all,
    one,
    text: (s: Term, p: string) => one(s, p)?.value,
    // The value that the subject must have: the generator stops when the ontology misses it.
    required(s: Term, p: string) {
      const value = one(s, p)?.value;
      if (value === undefined) throw new Error(`${s.value} has no ${p}`);
      return value;
    },
    ofType: (type: string) => store.getSubjects(`${RDF}type`, type, null),
    subjects: (p: string, o: string) => store.getSubjects(p, o, null),
    // An RDF list ( a b c ) is a chain of rdf:first and rdf:rest nodes that ends with rdf:nil.
    list(head: Term | undefined): Term[] {
      if (!head || head.value === `${RDF}nil`) return [];
      return [one(head, `${RDF}first`)!, ...this.list(one(head, `${RDF}rest`))];
    },
  };
}

// https://example.org/cloud-native-architecture#Microservices → Microservices
export function local(t: Term) {
  return t.value.replace(ARCH, "");
}
