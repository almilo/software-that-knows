// The code generator. For each domain (domains/<name>/), it reads the knowledge model (the form
// vocabulary in ontology/ and the domain's Turtle files in domains/<name>/ontology/) and writes the
// files that JSON Forms and the app need, in domains/<name>/generated/:
//   schema.json    JSON Forms schema
//   uischema.json  JSON Forms UI schema
//   messages.json  the texts, by language
//   domain.json    what else the app needs: the region of its dates and numbers
// The rules need no generation: the engine runs the SPARQL of the model as it is (core/engine.ts).
// Git tracks these files, so a review shows how a change to the model changes the app.
import { loadModel, readShape } from "../core/model";
import { ready } from "../core/rdf";
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
  return Object.fromEntries(generated.flat());
}

// The Turtle files of each domain, by domain name.
export async function domains() {
  const paths = (await Array.fromAsync(new Bun.Glob("domains/*/ontology/*.ttl").scan({ cwd: root }))).sort();
  return Map.groupBy(paths, (path) => path.split("/")[1]!);
}

async function generateDomain(name: string, paths: string[]) {
  const store = loadModel(await Promise.all(paths.map((p) => Bun.file(`${root}${p}`).text())));
  const shape = readShape(store);
  const comment = `Generated from domains/${name}/ontology/ by generator/generate.ts. Do not edit.`;
  const outputs = { ...generateForm(shape), messages: generateMessages(store, shape), domain: { region: shape.region } };
  return Object.entries(outputs).map(
    ([file, value]) => [`domains/${name}/generated/${file}.json`, JSON.stringify({ $comment: comment, ...value }, null, 2) + "\n"] as const,
  );
}
