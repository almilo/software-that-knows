// Measurement only: TypeSafe Jev on the eval notes, through the TypeSafe API. Not part of the app:
// the notes leave the device. The API key comes from TYPESAFE_API_KEY. Run: bun eval/jev-eval.ts
//
// Typed questions generated from the ontology (../server/jev-questions.ts, the ones the local
// server asks through ../server/jev.ts), and two modes, with confidence
// thresholds: Jev alone, and the words of the ontology first with Jev answering the fields that they
// leave open, then the form's structure.
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { acceptedDecisions, interpretWithJev, type Decision } from "../server/jev";
import { asked } from "../server/jev-questions";
import type { Interpretation, Proposal } from "../note/check";
import { interpretNote, structure } from "../note/interpret";
import { heldOut } from "./held-out";
import { scoreCase, summaryLine } from "./score";
import { cases, type Case } from "./phrases";

const PRICE = 0.042 / 1e6; // US dollars per input token; output is free
const thresholds = [0.5, 0.6, 0.7, 0.8, 0.9, 0.95];
const sets: [string, Case[]][] = [["development", cases], ["held-out", heldOut]];

type Result = { set: string; c: Case; decisions: Decision[]; words: Interpretation; ms: number; model: string; tokens: number };

const client = new TypeSafeClient();
const results: Result[] = [];
for (const [set, list] of sets) {
  for (const c of list) {
    const jev = await interpretWithJev(client, c.text);
    const words = interpretNote(c.text);
    results.push({ set, c, decisions: jev.decisions, words, ms: jev.ms, model: jev.model, tokens: jev.tokens });
    process.stdout.write(".");
  }
}
console.log();
await Bun.write(`${import.meta.dir}/results/jev-results.json`, JSON.stringify(results, null, 1));

const tokens = results.reduce((n, r) => n + r.tokens, 0);
console.log(`Served by: ${[...new Set(results.map((r) => r.model))].join(", ")}. ${tokens} input tokens, cost $${(tokens * PRICE).toFixed(4)}.`);
console.log(`Median time per note: ${median(results.map((r) => r.ms))} ms (${asked.length} questions in one request)`);
console.log("mode\tthreshold\tset\tfully correct\tfound\tcorrect of proposed\tdanger signs wrong (invented or denied)");
for (const t of thresholds) {
  for (const [set] of sets) {
    const rs = results.filter((r) => r.set === set);
    console.log(line("jev", t, set, rs.map((r) => ({ c: r.c, proposals: accepted(r.decisions, t) }))));
    console.log(line("words+jev", t, set, rs.map((r) => ({ c: r.c, proposals: withWords(r.words, accepted(r.decisions, t)) }))));
  }
}


function accepted(ds: Decision[], t: number): Proposal[] {
  return acceptedDecisions(ds, t);
}

// The words answer first; Jev adds the fields that the words leave open; then the form's structure.
function withWords(words: Interpretation, extra: Proposal[]): Proposal[] {
  const merged = [...words.proposals, ...extra.filter((p) => !words.proposals.some((w) => w.field === p.field))];
  return structure({ proposals: merged, rejected: [] }, {}).proposals;
}

function line(mode: string, t: number, set: string, rows: { c: Case; proposals: Proposal[] }[]) {
  return summaryLine(`${mode}\t${t}\t${set}`, rows.map(({ c, proposals }) => scoreCase(c, Object.fromEntries(proposals.map((p) => [p.field, p.value])))));
}

function median(xs: number[]) {
  return Math.round([...xs].sort((a, b) => a - b)[xs.length >> 1] ?? 0);
}
