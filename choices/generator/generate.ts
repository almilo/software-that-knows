// The code generator. For each domain (domains/<name>/), it reads the knowledge model (the choice
// vocabulary in ontology/ and the domain's four Turtle files in domains/<name>/ontology/) and
// writes the file that the rest of the code reads:
//   domains/<name>/generated/decision.json  the words of the page, the questions, the options,
//                                           the rules and the ladder (generate-decision.ts)
// Git tracks it, so a review shows how a change to the model changes the app.
import { generateDecision } from "./generate-decision";
import { loadModel } from "./rdf";

export const root = new URL("..", import.meta.url).pathname;

// The four files of a domain, each with one role. The same names in every domain.
export const domainFiles = ["facts.ttl", "questions.ttl", "rules.ttl", "domain.ttl"];

export async function domains() {
  const folders = await Array.fromAsync(new Bun.Glob("domains/*/ontology/domain.ttl").scan({ cwd: root }));
  return folders.map((path) => path.split("/")[1]!).sort();
}

// The model of a domain. replace: other files to read in place of some of the domain's files, by
// name; the tests use it to read a tree as drawn.
export async function readModel(name: string, replace: Record<string, string> = {}) {
  const paths = [`${root}ontology/choice.ttl`, ...domainFiles.map((f) => replace[f] ?? `${root}domains/${name}/ontology/${f}`)];
  return loadModel(await Promise.all(paths.map((path) => Bun.file(path).text())));
}

// The content of each generated file, by its path relative to the project root.
export async function generateFiles() {
  const names = await domains();
  const files = await Promise.all(
    names.map(async (name) => [`domains/${name}/generated/decision.json`, json(name, generateDecision(await readModel(name)))] as const),
  );
  return Object.fromEntries(files);
}

function json(name: string, content: object) {
  const comment = `Generated from ontology/ and domains/${name}/ontology/ by generator/generate.ts. Do not edit.`;
  return JSON.stringify({ $comment: comment, ...content }, null, 2) + "\n";
}

if (import.meta.main) {
  const files = await generateFiles();
  await Promise.all(Object.entries(files).map(([path, text]) => Bun.write(`${root}${path}`, text)));
  console.log(`Wrote ${Object.keys(files).join(", ")}`);
}
