// `bun run eval`: asks the language model the five questions of the evaluation and checks each answer
// as the tests check the hand-written ones: it parses, its facts are grounded and do not contradict
// the expected claim, and after the questions that the check asks, the decision is the expected
// one. It needs an API key, and it costs a few cents.
import { answer, model } from "./llm";
import { decide, evaluationClaims, expectedFor, readAnswer } from "./evaluation";

if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
  console.error("Set ANTHROPIC_API_KEY to run the evaluation against the language model.");
  process.exit(1);
}

const questions = [...new Set(evaluationClaims.map((c) => c.question!))];
let passed = 0;
for (const question of questions) {
  const expected = expectedFor(question)!;
  const { text, stopReason } = await answer(question);
  const read = readAnswer(text);
  const result = decide(expected, read.facts);
  const ok = stopReason !== "refusal" && read.errors.length === 0 && result.rejected.length === 0 && result.contradicted.length === 0 && result.status === expected.status;
  if (ok) passed++;
  console.log(`\n${ok ? "PASS" : "FAIL"} ${expected.name}`);
  console.log(`  components: ${read.used.join(", ") || "none"}; facts: ${JSON.stringify(read.facts ?? {})}`);
  if (read.errors.length) console.log(`  parse errors: ${JSON.stringify(read.errors)}`);
  if (result.rejected.length) console.log(`  rejected: ${result.rejected.map((r) => `${r.fact} (${r.reason})`).join("; ")}`);
  if (result.contradicted.length) console.log(`  contradicts the expected claim: ${result.contradicted.join(", ")}`);
  console.log(`  decision: ${result.status} (expected ${expected.status}); questions asked after the answer: ${result.asked.join(", ") || "none"}`);
}
console.log(`\n${passed} of ${questions.length} questions pass, with ${model}.`);
process.exit(passed === questions.length ? 0 : 1);
