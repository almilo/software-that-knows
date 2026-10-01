// The words of the knowledge model on the evaluation notes. Free: no API, no key.
//   bun eval/words-eval.ts          a results table
//   bun eval/words-eval.ts --json   the totals of each set, for generator/words-run.ts
// The extract-words skill runs it before and after adding words: the development notes must not
// get worse, and no danger sign may be invented. The test notes are reported, never used to tune.
import { interpretNote } from "../note/interpret";
import { heldOut } from "./held-out";
import { cases, type Case } from "./phrases";
import { scoreCase, summaryLine, type Score } from "./score";

const sets: [string, Case[]][] = [["development", cases], ["held-out", heldOut]];
const scoresOf = (list: Case[]) => list.map((c) => scoreCase(c, Object.fromEntries(interpretNote(c.text).proposals.map((p) => [p.field, p.value]))));
const total = (scores: Score[], k: "correct" | "expected" | "wrong" | "invented" | "denied") => scores.reduce((n, s) => n + s[k], 0);

if (Bun.argv.includes("--json")) {
  const totals = sets.map(([set, list]) => {
    const scores = scoresOf(list);
    return [set, { correct: total(scores, "correct"), expected: total(scores, "expected"), wrong: total(scores, "wrong"), invented: total(scores, "invented"), denied: total(scores, "denied") }];
  });
  console.log(JSON.stringify(Object.fromEntries(totals)));
} else {
  console.log(["interpreter\tset", "fully correct", "found", "correct of proposed", "danger signs wrong (invented or denied)"].join("\t"));
  for (const [set, list] of sets) console.log(summaryLine(`words\t${set}`, scoresOf(list)));
}
