// The code generator: `bun run generate`. It reads the knowledge model (ontology/*.ttl) and writes
// the two files that the app reads:
//   generated/policy.json  the policy: covers, questions, rules, tables, obligations, deadlines,
//                          articles (generate-policy.ts)
//   generated/checks.json  the report of the checks of the model, and the results of the test
//                          claims (engine/checks.ts), so the app can show it without running them
// Git tracks both, so a review shows how a change to the model changes the app and the report.
import { runChecks } from "../engine/checks";
import { cases } from "../test/cases";
import { generatePolicy } from "./generate-policy";
import { loadModel } from "./rdf";

export const root = new URL("..", import.meta.url).pathname;

export const ontologyFiles = ["insurance.ttl", "policy.ttl", "questions.ttl", "rules.ttl", "benefits.ttl", "obligations.ttl"];

export async function readModel() {
  return loadModel(await Promise.all(ontologyFiles.map((f) => Bun.file(`${root}ontology/${f}`).text())));
}

// The content of each generated file, by its path relative to the project root.
export async function generateFiles() {
  const policy = generatePolicy(await readModel());
  return {
    "generated/policy.json": json(policy),
    "generated/checks.json": json({ checks: runChecks(policy, cases) }),
  };
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
