// Reads Turtle files into one RDF store (Oxigraph: an RDF store with a SPARQL engine), applies the
// subclass rule of RDFS, and gives small helpers to walk the graph.
import { namedNode, Store, type Term } from "oxigraph";

export const INS = "https://example.org/insurance#";
export const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
export const RDFS = "http://www.w3.org/2000/01/rdf-schema#";
export const DCTERMS = "http://purl.org/dc/terms/";

const prefixes = `PREFIX rdf: <${RDF}>\nPREFIX rdfs: <${RDFS}>\n`;

export type Model = ReturnType<typeof loadModel>;

export function loadModel(turtles: string[]) {
  const store = new Store();
  for (const turtle of turtles) store.load(turtle, { format: "text/turtle" });
  // A resource of a subclass is also a resource of its superclass: a fact of a claim is a fact.
  store.update(`${prefixes}INSERT { ?s a ?super } WHERE { ?s a/rdfs:subClassOf+ ?super }`);

  const all = (s: Term, p: string) => store.match(s as never, namedNode(p), null, null).map((q) => q.object);
  const one = (s: Term, p: string) => all(s, p)[0];
  return {
    all,
    one,
    text: (s: Term, p: string) => one(s, p)?.value,
    number(s: Term, p: string) {
      const value = one(s, p)?.value;
      return value === undefined ? undefined : Number(value);
    },
    // The value that the subject must have: the generator stops when the model misses it.
    required(s: Term, p: string) {
      const value = one(s, p)?.value;
      if (value === undefined) throw new Error(`${s.value} has no ${p}`);
      return value;
    },
    node: (iri: string) => namedNode(iri) as Term,
    ofType: (type: string) => store.match(null, namedNode(`${RDF}type`), namedNode(type), null).map((q) => q.subject),
    // An RDF list ( a b c ) is a chain of rdf:first and rdf:rest nodes that ends with rdf:nil.
    list(head: Term | undefined): Term[] {
      if (!head || head.value === `${RDF}nil`) return [];
      return [one(head, `${RDF}first`)!, ...this.list(one(head, `${RDF}rest`))];
    },
  };
}

// https://example.org/zurich-motor-2015#Collision → Collision; …/article/202.3a → 202.3a
export function local(t: Term) {
  return t.value.replace(/^.*[#/]/, "");
}
