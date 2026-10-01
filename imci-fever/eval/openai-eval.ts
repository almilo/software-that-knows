// Measurement only: gpt-6-luna on the eval notes, through the OpenAI API. Not part of the app: the
// notes leave the device. The API key comes from OPENAI_API_KEY. Run: bun eval/openai-eval.ts
// The requests are the ones the local server sends (../server/openai.ts), checked by the app's own
// code (note/check.ts: allowed values, quote in the note).
import OpenAI from "openai";
import type { Interpretation } from "../note/check";
import { interpretWithOpenAI, openaiModel } from "../server/openai";
import { heldOut } from "./held-out";
import { cases, type Case } from "./phrases";
import { scoreCase, summaryLine } from "./score";

const sets: [string, Case[]][] = [["development", cases], ["held-out", heldOut]];
const client = new OpenAI();
const { price } = openaiModel;

const results = [];
for (const [set, list] of sets) {
  for (const c of list) {
    results.push({ set, c, alone: await interpretWithOpenAI(client, c.text) });
    process.stdout.write(".");
  }
}
console.log();
await Bun.write(`${import.meta.dir}/results/openai-results-${openaiModel.id}.json`, JSON.stringify(results, null, 1));
const cost = results.reduce((n, r) => n + (r.alone.usage?.input_tokens ?? 0) * price.input + (r.alone.usage?.output_tokens ?? 0) * price.output, 0);
console.log(`Model(s) that answered: ${[...new Set(results.map((r) => r.alone.model))].join(", ")}. Cost: $${cost.toFixed(3)}. Median time: ${median(results.map((r) => r.alone.ms))} ms`);
console.log("model\tset\tfully correct\tfound\tcorrect of proposed\tdanger signs wrong (invented or denied)");
for (const [set] of sets) console.log(line(openaiModel.id, set, results.filter((r) => r.set === set).map((r) => ({ c: r.c, r: r.alone.r }))));

function line(name: string, set: string, rows: { c: Case; r: Interpretation }[]) {
  return summaryLine(`${name}\t${set}`, rows.map(({ c, r }) => scoreCase(c, Object.fromEntries(r.proposals.map((p) => [p.field, p.value])))));
}

function median(xs: number[]) {
  return Math.round([...xs].sort((a, b) => a - b)[xs.length >> 1] ?? 0);
}
