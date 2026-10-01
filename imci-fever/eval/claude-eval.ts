// Measurement only: Claude Haiku 4.5 on the eval notes, through the Claude API. Not part of the app:
// the notes leave the device. The API key comes from ANTHROPIC_API_KEY.
//   bun eval/claude-eval.ts count   counts the input tokens of every request (free), estimates the cost
//   bun eval/claude-eval.ts run     runs the eval (paid), saves the replies and prints the scores
// The requests are the ones the local server sends (../server/claude.ts), checked by the app's own
// code (note/check.ts: allowed values, quote in the note).
import Anthropic from "@anthropic-ai/sdk";
import type { Interpretation } from "../note/check";
import { claudeModel, claudeRequest, interpretWithClaude } from "../server/claude";
import { heldOut } from "./held-out";
import { cases, type Case } from "./phrases";
import { scoreCase, summaryLine } from "./score";

const sets: [string, Case[]][] = [["development", cases], ["held-out", heldOut]];
const client = new Anthropic();
const { price } = claudeModel;

const mode = process.argv[2];
if (mode === "count") await count();
else if (mode === "run") await run();
else console.log("Usage: bun eval/claude-eval.ts count | run");

async function count() {
  const requests = sets.flatMap(([, list]) => list.map((c) => claudeRequest(c.text)));
  const tokens = await Promise.all(requests.map(async (r) => (await client.beta.messages.countTokens(r)).input_tokens));
  const input = tokens.reduce((a, b) => a + b, 0);
  const output = requests.length * 600; // about 60 tokens per answer, up to 10 answers
  console.log(`${requests.length} requests, ${input} input tokens. Estimated cost of one run: $${(input * price.input + output * price.output).toFixed(2)}`);
}

async function run() {
  const results = [];
  for (const [set, list] of sets) {
    for (const c of list) {
      results.push({ set, c, alone: await interpretWithClaude(client, c.text) });
      process.stdout.write(".");
    }
  }
  console.log();
  await Bun.write(`${import.meta.dir}/results/claude-results-${claudeModel.id}.json`, JSON.stringify(results, null, 1));
  const cost = results.reduce((n, r) => n + r.alone.usage.input_tokens * price.input + r.alone.usage.output_tokens * price.output, 0);
  console.log(`Model(s) that answered: ${[...new Set(results.map((r) => r.alone.model))].join(", ")}. Cost: $${cost.toFixed(2)}. Median time: ${median(results.map((r) => r.alone.ms))} ms`);
  console.log("model\tset\tfully correct\tfound\tcorrect of proposed\tdanger signs wrong (invented or denied)");
  for (const [set] of sets) console.log(line(claudeModel.id, set, results.filter((r) => r.set === set).map((r) => ({ c: r.c, r: r.alone.r }))));
}

function line(name: string, set: string, rows: { c: Case; r: Interpretation }[]) {
  return summaryLine(`${name}\t${set}`, rows.map(({ c, r }) => scoreCase(c, Object.fromEntries(r.proposals.map((p) => [p.field, p.value])))));
}

function median(xs: number[]) {
  return Math.round([...xs].sort((a, b) => a - b)[xs.length >> 1] ?? 0);
}
