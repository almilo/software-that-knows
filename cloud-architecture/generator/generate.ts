// The code generator. It reads the ontology and writes the file that the rest of the code reads:
//   generated/decision.json  the questions, the styles of the diagram and the rules
//                            (generate-decision.ts)
// Git tracks it, so a review shows how a change to the ontology changes the app.
import { generateDecision } from "./generate-decision";
import { readOntology } from "./read-ontology";

export const root = new URL("..", import.meta.url).pathname;

// The content of each generated file, by its path relative to the project root.
export async function generateFiles() {
  const ontology = await readOntology(["cloud-native-architecture.ttl", "criteria.ttl", "rules.ttl"].map((f) => `${root}ontology/${f}`));
  return { "generated/decision.json": json(generateDecision(ontology)) };
}

function json(content: object) {
  const comment = "Generated from ontology/ by generator/generate.ts. Do not edit.";
  return JSON.stringify({ $comment: comment, ...content }, null, 2) + "\n";
}

if (import.meta.main) {
  const files = await generateFiles();
  await Promise.all(Object.entries(files).map(([path, text]) => Bun.write(`${root}${path}`, text)));
  console.log(`Wrote ${Object.keys(files).join(", ")}`);
}
