// Generates messages.json: every text of the model for the person who uses the app, by language
// and by key. A text is for that person when it has a language tag (rdfs:label, rdfs:comment,
// sh:name, sh:description). The languages of the domain are those of the shape's rdfs:label (its
// title); every text must exist in each of them, and texts in other languages are left out (the
// form vocabulary, for example, has more languages than a domain may need). Two terms with the same
// local name would share a key, so that is an error.
// The keys are the ones JSON Forms uses (https://jsonforms.io/docs/i18n):
//   <field>.label, <field>.description, <field>.<choice>   for the questions
//   <name>.label, <name>.comment                           for everything else (local names)
import type { Shape } from "../core/model";
import { Store, local, select } from "../core/rdf";

const kinds: Record<string, string> = { label: "label", comment: "comment", name: "label", description: "description" };

export function generateMessages(store: Store, shape: Shape) {
  const texts = new Map<string, Map<string, string>>(); // key → language → text
  const languages = select(store, `SELECT DISTINCT (LANG(?title) AS ?language) WHERE { <${shape.iri}> rdfs:label ?title FILTER (LANG(?title) != "") }`)
    .map((r) => r.language!.value)
    .sort();
  if (languages.length === 0) throw new Error(`The shape ${shape.name} needs an rdfs:label with a language tag: its title`);
  const owners = new Map<string, string>(); // key → the term whose texts it holds
  function add(key: string, owner: string, language: string, text: string) {
    if (!languages.includes(language)) return;
    const known = owners.get(key);
    if (known && known !== owner) throw new Error(`Two terms have the key ${key}: ${known} and ${owner}`);
    owners.set(key, owner);
    if (!texts.has(key)) texts.set(key, new Map());
    texts.get(key)!.set(language, text);
  }

  const rows = select(
    store,
    `SELECT ?subject ?path ?predicate ?text WHERE {
       VALUES ?predicate { rdfs:label rdfs:comment sh:name sh:description }
       ?subject ?predicate ?text .
       FILTER (LANG(?text) != "")
       OPTIONAL { ?subject sh:path ?path }
     }`,
  );
  rows
    .filter(({ subject, path }) => subject!.termType !== "BlankNode" || path) // a property shape's texts take the name of its field
    .forEach(({ subject, path, predicate, text }) => {
      const owner = path ?? subject!;
      add(`${local(owner)}.${kinds[local(predicate!)]}`, owner.value, (text as { language: string }).language, text!.value);
    });
  // The choices of a question, under the question's name.
  shape.fields.forEach((field) =>
    (field.choices ?? []).forEach((choice) =>
      [...(texts.get(`${local(choice)}.label`) ?? [])].forEach(([language, text]) => add(`${field.name}.${local(choice)}`, choice, language, text)),
    ),
  );

  const incomplete = [...texts].filter(([, t]) => t.size < languages.length).map(([key, t]) => `${key}: no ${languages.filter((l) => !t.has(l)).join(", ")}`);
  if (incomplete.length > 0) throw new Error(`Texts missing: ${incomplete.join("; ")}`);

  const keys = [...texts.keys()].sort();
  return Object.fromEntries(languages.map((language) => [language, Object.fromEntries(keys.map((k) => [k, texts.get(k)!.get(language)!]))]));
}
