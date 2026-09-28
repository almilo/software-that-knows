// The code generator. It reads ontology/imci-fever.ttl and writes the files that the app uses:
//   generated/schema.json    JSON Forms schema
//   generated/uischema.json  JSON Forms UI schema
//   generated/rules.json     the classification tables (shape: shared/rules-contract.ts)
// Git tracks these files, so a review shows how a change to the ontology changes the app.
import { generateForm } from "./generate-form";
import { generateRules } from "./generate-rules";
import { readOntology } from "./read-ontology";

export const root = new URL("..", import.meta.url).pathname;

const comment = "Generated from ontology/imci-fever.ttl by generator/generate.ts. Do not edit.";

// The content of each generated file, by its path relative to the project root.
export async function generateFiles(): Promise<Record<string, string>> {
  const ontology = await readOntology(`${root}ontology/imci-fever.ttl`);
  const { schema, uischema } = generateForm(ontology);
  const rules = generateRules(ontology);
  return Object.fromEntries(
    Object.entries({ schema, uischema, rules }).map(([name, value]) => [
      `generated/${name}.json`,
      JSON.stringify({ $comment: comment, ...value }, null, 2) + "\n",
    ]),
  );
}

if (import.meta.main) {
  const files = await generateFiles();
  for (const [path, text] of Object.entries(files)) await Bun.write(`${root}${path}`, text);
  console.log(`Wrote ${Object.keys(files).join(", ")}`);
}
