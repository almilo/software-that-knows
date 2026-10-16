// The code generator. For each domain (domains/<name>/), it reads the knowledge model (the form
// vocabulary in ontology/, the domain's Turtle files in domains/<name>/ontology/ and the shared
// modules in modules/ that they import) and writes the
// files that JSON Forms and the app need, in domains/<name>/generated/:
//   schema.json    JSON Forms schema
//   uischema.json  JSON Forms UI schema
//   messages.json  the texts, by language
//   domain.json    what else the app needs: the region of its dates and numbers
// and, for all domains, generated/index.json: the list of processes (index.html) with its texts.
// The rules need no generation: the engine runs the SPARQL of the model as it is (core/engine.ts).
// Git tracks these files, so a review shows how a change to the model changes the app.
import { loadModel, readShape } from "../core/model";
import { ready, select, Store } from "../core/rdf";
import { generateForm } from "./generate-form";
import { generateMessages } from "./generate-messages";

export const root = new URL("..", import.meta.url).pathname;

if (import.meta.main) {
  const files = await generateFiles();
  await Promise.all(Object.entries(files).map(([path, text]) => Bun.write(`${root}${path}`, text)));
  console.log(`Wrote ${Object.keys(files).join(", ")}`);
}

// The content of each generated file, by its path relative to the project root.
export async function generateFiles() {
  await ready;
  const generated = await Promise.all([...(await domains())].map(([name, paths]) => generateDomain(name, paths)));
  return Object.fromEntries([...generated.flatMap((d) => d.files), generateIndex(generated)]);
}

// The list of processes: for each domain, its title and summary, and the texts of the list, in the
// languages that every domain has. The keys are the names of the domain folders.
function generateIndex(domains: { name: string; shape: string; messages: Record<string, Record<string, string>> }[]) {
  const languages = domains.map((d) => Object.keys(d.messages)).reduce((common, l) => common.filter((c) => l.includes(c)));
  if (languages.length === 0) throw new Error("The domains have no language in common: the list of processes needs one");
  const texts = ["language.label", "processes.label", "processesIntro.label", "open.label"];
  const messages = Object.fromEntries(
    languages.map((language) => {
      const own = domains.flatMap(({ name, shape, messages }) => [
        [`${name}.label`, messages[language]![`${shape}.label`]!],
        [`${name}.summary`, summary(name, messages[language]![`${shape}.summary`])],
      ]);
      return [language, Object.fromEntries([...texts.map((key) => [key, domains[0]!.messages[language]![key]!]), ...own])];
    }),
  );
  const index = { $comment: "Generated from domains/*/ontology/ by generator/generate.ts. Do not edit.", domains: domains.map((d) => d.name), messages };
  return ["generated/index.json", JSON.stringify(index, null, 2) + "\n"] as const;
}

function summary(domain: string, text: string | undefined) {
  if (text === undefined) throw new Error(`The shape of ${domain} needs a form:summary in each of its languages: the list of processes shows it`);
  return text;
}

// The Turtle files of each domain, by domain name: its own (domains/<name>/ontology/) and the
// modules that they import (modules/), directly or through another module.
export async function domains() {
  const paths = (await Array.fromAsync(new Bun.Glob("domains/*/ontology/*.ttl").scan({ cwd: root }))).sort();
  const index = await moduleIndex();
  const own = Map.groupBy(paths, (path) => path.split("/")[1]!);
  const entries = await Promise.all([...own].map(async ([name, files]): Promise<[string, string[]]> => [name, [...files, ...(await imported(files, index))]]));
  return new Map(entries);
}

// Each module by the IRI of its ontology.
async function moduleIndex() {
  const paths = (await Array.fromAsync(new Bun.Glob("modules/**/*.ttl").scan({ cwd: root }))).sort();
  const entries = await Promise.all(paths.map(async (path) => ontologies(await text(path)).map((iri) => [iri, path] as const)));
  return new Map(entries.flat());
}

// The modules that the files import, and the modules that those import, without repeats.
async function imported(files: string[], index: Map<string, string>, seen = new Set<string>()): Promise<string[]> {
  const next = (await Promise.all(files.map(async (f) => imports(await text(f)))))
    .flat()
    .flatMap((iri) => (index.has(iri) ? [index.get(iri)!] : []))
    .filter((path) => !seen.has(path) && seen.add(path));
  return next.length === 0 ? [] : [...next, ...(await imported(next, index, seen))];
}

function ontologies(turtle: string) {
  return select(parse(turtle), `SELECT ?o WHERE { ?o a owl:Ontology }`).map((r) => r.o!.value);
}
function imports(turtle: string) {
  return select(parse(turtle), `SELECT ?i WHERE { ?o owl:imports ?i }`).map((r) => r.i!.value);
}
function parse(turtle: string) {
  const store = new Store();
  store.load(turtle, { format: "text/turtle" });
  return store;
}
function text(path: string) {
  return Bun.file(`${root}${path}`).text();
}

async function generateDomain(name: string, paths: string[]) {
  const store = loadModel(await Promise.all(paths.map(text)));
  const shape = readShape(store);
  const comment = `Generated from domains/${name}/ontology/ by generator/generate.ts. Do not edit.`;
  const messages = generateMessages(store, shape);
  const outputs = { ...generateForm(shape), messages, domain: { region: shape.region } };
  const files = Object.entries(outputs).map(
    ([file, value]) => [`domains/${name}/generated/${file}.json`, JSON.stringify({ $comment: comment, ...value }, null, 2) + "\n"] as const,
  );
  return { name, shape: shape.name, messages, files };
}
