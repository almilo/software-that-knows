// Reads Turtle files into one RDF store (Oxigraph: an RDF store with a SPARQL engine), applies the
// mapping of a domain's words to the choice words, and gives small helpers to walk the graph.
import { namedNode, Store, type Term } from "oxigraph";

export const CHOICE = "https://example.org/choice#";
export const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
export const RDFS = "http://www.w3.org/2000/01/rdf-schema#";
export const SKOS = "http://www.w3.org/2004/02/skos/core#";
export const SH = "http://www.w3.org/ns/shacl#";
export const DCTERMS = "http://purl.org/dc/terms/";

const prefixes = Object.entries({ choice: CHOICE, rdf: RDF, rdfs: RDFS, skos: SKOS, sh: SH })
  .map(([prefix, namespace]) => `PREFIX ${prefix}: <${namespace}>\n`)
  .join("");

export type Model = ReturnType<typeof loadModel>;

export function loadModel(turtles: string[]) {
  const store = new Store();
  for (const turtle of turtles) store.load(turtle, { format: "text/turtle" });
  // Two rules of RDFS: a statement with a subproperty also holds with its superproperty, and a
  // resource of a subclass is also a resource of its superclass. After them, the domain's own
  // words (arch:StyleRule, arch:recommends) can be read with the choice words.
  store.update(`${prefixes}INSERT { ?s ?super ?o } WHERE { ?p rdfs:subPropertyOf+ ?super . ?s ?p ?o }`);
  store.update(`${prefixes}INSERT { ?s a ?super } WHERE { ?s a/rdfs:subClassOf+ ?super }`);

  const all = (s: Term, p: string) => store.match(s as never, namedNode(p), null, null).map((q) => q.object);
  const one = (s: Term, p: string) => all(s, p)[0];
  return {
    // The rows of a SELECT query, each as an object from variable name to term.
    select(query: string) {
      return (store.query(prefixes + query) as Map<string, Term>[]).map((row): Record<string, Term> => Object.fromEntries(row));
    },
    all,
    one,
    text: (s: Term, p: string) => one(s, p)?.value,
    // The value that the subject must have: the generator stops when the model misses it.
    required(s: Term, p: string) {
      const value = one(s, p)?.value;
      if (value === undefined) throw new Error(`${s.value} has no ${p}`);
      return value;
    },
    ofType: (type: string) => store.match(null, namedNode(`${RDF}type`), namedNode(type), null).map((q) => q.subject),
    subjects: (p: string, o: string) => store.match(null, namedNode(p), namedNode(o), null).map((q) => q.subject),
    // An RDF list ( a b c ) is a chain of rdf:first and rdf:rest nodes that ends with rdf:nil.
    list(head: Term | undefined): Term[] {
      if (!head || head.value === `${RDF}nil`) return [];
      return [one(head, `${RDF}first`)!, ...this.list(one(head, `${RDF}rest`))];
    },
  };
}

// https://example.org/cloud-native-architecture#Microservices → Microservices
export function local(t: Term) {
  return t.value.replace(/^.*[#/]/, "");
}
