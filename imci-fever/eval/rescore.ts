// Re-scores the saved replies of the cloud interpreters with eval/score.ts, without calling any API,
// and with the words as they are now: after a change to the words or to the scoring, the numbers
// can be updated for free. Run: bun eval/rescore.ts. Files that do not exist are skipped.
import { interpretNote } from "../note/interpret";
import type { Case } from "./phrases";
import { scoreCase, summaryLine } from "./score";

type P = { field: string; value: unknown };
type Decision = P & { probability: number };
const JEV_THRESHOLD = 0.95;
const got = (ps: P[]) => Object.fromEntries(ps.map((p) => [p.field, p.value]));
const sets = ["development", "held-out"];

async function load(path: string) {
  const f = Bun.file(`${import.meta.dir}/results/${path}`);
  return (await f.exists()) ? await f.json() : undefined;
}

console.log("interpreter\tset\tfully correct\tfound\tcorrect of proposed\tdanger signs wrong (invented or denied)");
for (const [name, path] of [["claude-haiku-4-5", "claude-results-claude-haiku-4-5.json"], ["gpt-6-luna", "openai-results-gpt-6-luna.json"]]) {
  const rs = await load(path!);
  for (const set of rs ? sets : []) {
    const r = rs.filter((x: { set: string }) => x.set === set);
    console.log(summaryLine(`${name}\t${set}`, r.map((x: { c: Case; alone: { r: { proposals: P[] } } }) => scoreCase(x.c, got(x.alone.r.proposals)))));
  }
}
// Words + Jev: the words answer first; Jev adds the fields that they leave open, above the threshold.
const jev = await load("jev-results.json");
for (const set of jev ? sets : []) {
  const r: { c: Case; decisions: Decision[] }[] = jev.filter((x: { set: string }) => x.set === set);
  const combined = r.map(({ c, decisions }) => {
    const words = interpretNote(c.text).proposals;
    return scoreCase(c, got([...words, ...decisions.filter((d) => d.probability >= JEV_THRESHOLD && !words.some((w) => w.field === d.field))]));
  });
  console.log(summaryLine(`words + jev ${JEV_THRESHOLD}\t${set}`, combined));
}
