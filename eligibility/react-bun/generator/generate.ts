// The code generator. For each domain (domains/<name>/), it reads the knowledge model (the form
// vocabulary in ontology/, the domain's Turtle files in domains/<name>/ontology/ and the shared
// modules in modules/ that they import) and writes the
// files that JSON Forms and the app need, in domains/<name>/generated/:
//   schema.json    JSON Forms schema
//   uischema.json  JSON Forms UI schema
//   messages.json  the texts, by language
//   domain.json    what else the app needs: the region of its dates, and how it writes numbers
// and, for all domains, generated/index.json: the list of processes (index.html) with its texts.
// The rules need no generation: the engine runs the SPARQL of the model as it is (core/engine.ts).
// Git tracks these files, so a review shows how a change to the model changes the app.
import { loadModel, readShape } from "../core/model";
import { ready, select, Store } from "../core/rdf";
import { generateForm } from "./generate-form";
import { generateMessages } from "./generate-messages";

// The React app (react-bun/), where the generated files go, and the knowledge model that they come
// from (knowledge/), shared by every stack. Paths of Turtle files are relative to the knowledge.
export const root = new URL("..", import.meta.url).pathname;
export const knowledge = new URL("../../knowledge/", import.meta.url).pathname;

if (import.meta.main) {
  const files = await generateFiles();
  await Promise.all(Object.entries(files).map(([path, text]) => Bun.write(`${root}${path}`, text)));
  console.log(`Wrote ${Object.keys(files).join(", ")}`);
}

// The content of each generated file, by its path relative to the project root. from: the knowledge
// model to read; the tests give another one, with a test domain added.
export async function generateFiles(from = knowledge) {
  await ready;
  const generated = await Promise.all([...(await domains(from))].map(([name, paths]) => generateDomain(name, paths, from)));
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
  const index = { $comment: "Generated from knowledge/domains/*/ontology/ by generator/generate.ts. Do not edit.", domains: domains.map((d) => d.name), messages };
  return ["generated/index.json", JSON.stringify(index, null, 2) + "\n"] as const;
}

function summary(domain: string, text: string | undefined) {
  if (text === undefined) throw new Error(`The shape of ${domain} needs a form:summary in each of its languages: the list of processes shows it`);
  return text;
}

// The Turtle files of each domain, by domain name: its own (domains/<name>/ontology/) and the
// modules that they import (modules/), directly or through another module.
export async function domains(from = knowledge) {
  const paths = (await Array.fromAsync(new Bun.Glob("domains/*/ontology/*.ttl").scan({ cwd: from }))).sort();
  const index = await moduleIndex(from);
  const own = Map.groupBy(paths, (path) => path.split("/")[1]!);
  const entries = await Promise.all(
    [...own].map(async ([name, files]): Promise<[string, string[]]> => [name, [...files, ...(await imported(files, index, from))]]),
  );
  return new Map(entries);
}

// Each module by the IRI of its ontology.
async function moduleIndex(from: string) {
  const paths = (await Array.fromAsync(new Bun.Glob("modules/**/*.ttl").scan({ cwd: from }))).sort();
  const entries = await Promise.all(paths.map(async (path) => ontologies(await text(path, from)).map((iri) => [iri, path] as const)));
  return new Map(entries.flat());
}

// The modules that the files import, and the modules that those import, without repeats.
async function imported(files: string[], index: Map<string, string>, from: string, seen = new Set<string>()): Promise<string[]> {
  const next = (await Promise.all(files.map(async (f) => imports(await text(f, from)))))
    .flat()
    .flatMap((iri) => (index.has(iri) ? [index.get(iri)!] : []))
    .filter((path) => !seen.has(path) && seen.add(path));
  return next.length === 0 ? [] : [...next, ...(await imported(next, index, from, seen))];
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
function text(path: string, from: string) {
  return Bun.file(`${from}${path}`).text();
}

async function generateDomain(name: string, paths: string[], from: string) {
  const store = loadModel(await Promise.all(paths.map((path) => text(path, from))));
  const shape = readShape(store);
  const comment = `Generated from knowledge/domains/${name}/ontology/ by generator/generate.ts. Do not edit.`;
  const messages = generateMessages(store, shape);
  const outputs = { ...generateForm(shape), messages, domain: { region: shape.region, numbers: shape.numbers } };
  const files = Object.entries(outputs).map(
    ([file, value]) => [`domains/${name}/generated/${file}.json`, JSON.stringify({ $comment: comment, ...value }, null, 2) + "\n"] as const,
  );
  return { name, shape: shape.name, messages, files: [...files, ...entry(name, paths, messages, shape.name)] };
}

// The entry of a domain in the app: its page (index.html), the script that starts it (main.tsx), and
// the files that it loads (domain.ts): its Turtle files and the modules that they import, and the
// files generated from them. So a new domain needs only its model.
function entry(name: string, paths: string[], messages: Record<string, Record<string, string>>, shape: string) {
  const variable = camel(name);
  const note = `Generated by generator/generate.ts from knowledge/domains/${name}/. Do not edit.`;
  const language = "en" in messages ? "en" : Object.keys(messages)[0]!;
  const imports = paths.map((path, i) => `import file${i} from "../../../knowledge/${path}" with { type: "text" };`);
  const domain = [
    `// ${note}`,
    `// The files of the domain for the app and the tests: its model, the modules that it imports, and`,
    `// the files generated from them.`,
    `import type { DomainFiles } from "../../app/domain";`,
    `import domain from "./generated/domain.json";`,
    `import messages from "./generated/messages.json";`,
    `import schema from "./generated/schema.json";`,
    `import uischema from "./generated/uischema.json";`,
    ...imports,
    ``,
    `export const ${variable}: DomainFiles = {`,
    `  model: [${paths.map((_, i) => `file${i}`).join(", ")}],`,
    `  schema,`,
    `  uischema,`,
    `  messages,`,
    `  region: domain.region,`,
    `  numbers: domain.numbers,`,
    `};`,
    ``,
  ].join("\n");
  const main = [`// ${note}`, `import { start } from "../../app/main";`, `import { ${variable} } from "./domain";`, ``, `start(${variable});`, ``].join("\n");
  const page = `<!doctype html>
<!-- ${note} -->
<html lang="${language}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${messages[language]![`${shape}.label`]}</title>
    <link rel="icon" href="../../favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="../../app/styles.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
`;
  return [
    [`domains/${name}/domain.ts`, domain],
    [`domains/${name}/main.tsx`, main],
    [`domains/${name}/index.html`, page],
  ] as const;
}

// vested-benefits → vestedBenefits
function camel(name: string) {
  return name.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());
}
