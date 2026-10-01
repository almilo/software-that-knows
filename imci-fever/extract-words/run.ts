// The code steps of the extract-words skill (.claude/skills/extract-words in the repository). The
// step in between, three independent runs of the skill's run prompt, is the only one that needs an
// LLM. Each run has a folder in extract-words/runs/, which records where the words came from.
//
//   bun extract-words/run.ts input <folder>   writes <folder>/input.json (each question's title, DAK
//                                             definition, allowed values and current words) and
//                                             <folder>/prompt.md (the run prompt of the skill)
//   bun extract-words/run.ts apply <folder>   reads <folder>/run-*.json, keeps the words that at
//                                             least two runs propose, checks them, keeps only those
//                                             that do not make the development notes worse, adds
//                                             them to part 6 of the ontology, and writes
//                                             <folder>/record.md
import schema from "../generated/schema.json";
import type { Lexicon } from "../shared/rules-contract";
import { canMatch } from "../shared/clauses";
import { root } from "../generator/generate";

export type Kind = "altLabel" | "absentLabel" | "valueLabel";
export type Proposal = { question: string; kind: Kind; value?: string; word: string; reason: string };
type Counted = Proposal & { runs: number; result?: string };
type Totals = { correct: number; expected: number; wrong: number; invented: number; denied: number };

const ontologyPath = `${root}ontology/imci-fever.ttl`;
const skillPath = `${root}../.claude/skills/extract-words/SKILL.md`;
const properties = schema.properties as Record<string, { title: string; enum?: string[] }>;
const lexicon = async (): Promise<Lexicon> => Bun.file(`${root}generated/lexicon.json`).json();

export async function writeInput(folder: string) {
  const { fields } = await lexicon();
  const questions = Object.entries(fields).map(([question, w]) => ({
    question,
    title: properties[question]!.title,
    definition: w.definition ?? "",
    values: properties[question]!.enum ?? [],
    words: { altLabel: w.labels, absentLabel: w.absent, valueLabel: (w.values ?? []).map((v) => ({ value: v.value, words: v.labels })) },
  }));
  await Bun.write(`${folder}/input.json`, JSON.stringify({ questions }, null, 2) + "\n");
  await Bun.write(`${folder}/prompt.md`, runPrompt(await Bun.file(skillPath).text()));
  console.log(`Wrote ${folder}/input.json (${questions.length} questions) and ${folder}/prompt.md`);
}

// The run prompt of the skill: the quoted text under "## Run prompt", without the quote marks.
export function runPrompt(skill: string): string {
  const section = skill.split(/^## Run prompt\s*$/m)[1]?.split(/^## /m)[0] ?? "";
  const lines = section.split("\n").filter((l) => l.startsWith(">")).map((l) => l.replace(/^> ?/, ""));
  if (lines.length === 0) throw new Error("The skill has no run prompt");
  return lines.join("\n") + "\n";
}

// The proposals that at least two runs make, with how many runs made each. A run counts a word once.
export function consensus(runs: Proposal[][]): { kept: Counted[]; all: Counted[]; unanimous: number } {
  const key = (p: Proposal) => [p.question, p.kind, p.value ?? "", p.word].join("|");
  const counted = new Map<string, Counted>();
  for (const run of runs) {
    for (const p of new Map(run.map((p) => [key(normal(p)), normal(p)])).values()) {
      const seen = counted.get(key(p));
      counted.set(key(p), seen ? { ...seen, runs: seen.runs + 1 } : { ...p, runs: 1 });
    }
  }
  const all = [...counted.values()];
  return { kept: all.filter((p) => p.runs >= 2), all, unanimous: all.filter((p) => p.runs === runs.length).length };
}

const normal = (p: Proposal): Proposal => ({ ...p, word: p.word.toLowerCase().replace(/\s+/g, " ").trim() });

// Why a proposal cannot be added, or undefined: an unknown question or kind, a value the question
// does not allow, a word the question already has, a word that can never match, or a word that
// would state a sign both present and absent.
export function problem(p: Proposal, fields: Lexicon["fields"], kept: Proposal[]): string | undefined {
  const w = fields[p.question];
  if (!w) return "unknown question";
  if (!["altLabel", "absentLabel", "valueLabel"].includes(p.kind)) return "unknown kind";
  if (p.kind === "valueLabel" && !(properties[p.question]!.enum ?? []).includes(p.value ?? "")) return "not an allowed value";
  if (p.kind === "absentLabel" && properties[p.question]!.enum) return "absent words are for yes/no questions";
  if ([...w.labels, ...w.absent, ...(w.values ?? []).flatMap((v) => v.labels)].includes(p.word)) return "already a word of the question";
  if (!canMatch(p.word)) return "contains a comma, \"and\" or \"but\", where a note is split, so it can never match";
  const words = (kind: Kind) => [...kept, p].filter((k) => k.kind === kind).map((k) => k.word);
  const present = new Set([...Object.values(fields).flatMap((f) => f.labels), ...words("altLabel")]);
  const absent = new Set([...Object.values(fields).flatMap((f) => f.absent), ...words("absentLabel")]);
  if (present.has(p.word) && absent.has(p.word)) return "would state a sign both present and absent";
  return undefined;
}

// The words as Turtle statements, added below part 6 with a header for the run.
export function turtle(words: Proposal[], header: string): string {
  const q = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  const lines = [...Map.groupBy(words, (p) => p.question)].map(([question, ps]) => {
    const list = (kind: Kind) => ps.filter((p) => p.kind === kind).map((p) => q(p.word));
    const values = [...Map.groupBy(ps.filter((p) => p.kind === "valueLabel"), (p) => p.value!)].map(
      ([value, vs]) => `imci:valueLabel [ imci:value ${q(value)} ; skos:altLabel ${vs.map((v) => q(v.word)).join(", ")} ]`,
    );
    const parts = [
      ...(list("altLabel").length ? [`skos:altLabel ${list("altLabel").join(", ")}`] : []),
      ...(list("absentLabel").length ? [`imci:absentLabel ${list("absentLabel").join(", ")}`] : []),
      ...values,
    ];
    return `imci:${question} ${parts.join(" ;\n  ")} .`;
  });
  return `\n${header}\n${lines.join("\n")}\n`;
}

async function evaluate(): Promise<Totals> {
  const run = (cmd: string[]) => {
    const out = Bun.spawnSync(cmd, { cwd: root });
    if (out.exitCode !== 0) throw new Error(`${cmd.join(" ")} failed: ${out.stderr.toString()}`);
    return out.stdout.toString();
  };
  run(["bun", "generator/generate.ts"]);
  return JSON.parse(run(["bun", "eval/words-eval.ts", "--json"])).development;
}

// Worse: fewer facts found, more wrong answers, or a danger sign invented or wrongly denied.
const worse = (after: Totals, before: Totals) =>
  after.correct < before.correct || after.wrong > before.wrong || after.invented > 0 || after.denied > before.denied;

export async function apply(folder: string) {
  const files = [...new Bun.Glob("run-*.json").scanSync(folder)].sort();
  if (files.length < 3) throw new Error(`Expected three runs in ${folder}, found ${files.length}`);
  const runs: Proposal[][] = await Promise.all(files.map((f) => Bun.file(`${folder}/${f}`).json()));
  const { kept, all, unanimous } = consensus(runs);
  const { fields } = await lexicon();
  const checked: Counted[] = [];
  for (const p of kept) {
    const why = problem(p, fields, checked.filter((c) => !c.result));
    checked.push(why ? { ...p, result: `dropped: ${why}` } : p);
  }

  // The regression gate, one question at a time: a question's words stay if the development notes
  // do not get worse; otherwise each word is tried alone.
  const original = await Bun.file(ontologyPath).text();
  const date = folder.replace(/\/$/, "").split("/").pop()!; // the run's folder is named by its date
  const header = `# Words added by the extract-words skill on ${date}: ${runs.length} runs, ${kept.length} of ${all.length}\n# proposed words made by at least two runs. Record: extract-words/runs/${folder.split("/").pop()}/record.md`;
  const write = (words: Proposal[]) => Bun.write(ontologyPath, original + (words.length ? turtle(words, header) : ""));
  let accepted: Proposal[] = [];
  let best = await evaluate();
  const baseline = best;
  for (const [, ps] of Map.groupBy(checked.filter((c) => !c.result), (p) => p.question)) {
    for (const group of [ps, ...(ps.length > 1 ? ps.map((p) => [p]) : [])]) {
      if (group.every((p) => accepted.includes(p) || p.result)) continue;
      const candidate = [...accepted, ...group.filter((p) => !accepted.includes(p))];
      await write(candidate);
      const totals = await evaluate();
      if (!worse(totals, best)) {
        accepted = candidate;
        best = totals;
        if (group === ps) break;
      }
    }
    for (const p of ps) if (!accepted.includes(p)) p.result = "dropped: the development notes got worse";
  }
  await write(accepted);
  await evaluate();
  for (const p of checked) p.result ??= "added";

  const row = (p: Counted) => `| ${p.question} | ${p.kind}${p.value ? ` (${p.value})` : ""} | ${p.word} | ${p.reason.replace(/\|/g, "/")} | ${p.runs}/${runs.length} | ${p.result} |`;
  const record = [
    `# Words run ${date}`,
    "",
    `- Skill: extract-words; ${runs.length} independent runs (run-*.json) of the prompt in prompt.md, with input.json`,
    `- Proposed: ${all.length} distinct words; made by all ${runs.length} runs: ${unanimous} (${Math.round((100 * unanimous) / all.length)}%); by at least two: ${kept.length}`,
    `- Added: ${accepted.length}. Development notes before: ${baseline.correct}/${baseline.expected} found, ${baseline.wrong} wrong; after: ${best.correct}/${best.expected} found, ${best.wrong} wrong; danger signs invented: ${best.invented}, wrongly denied: ${best.denied}`,
    "",
    "| Question | Kind | Word | Reason | Runs | Result |",
    "| --- | --- | --- | --- | --- | --- |",
    ...checked.map(row),
    "",
  ].join("\n");
  await Bun.write(`${folder}/record.md`, record);
  console.log(record.split("\n").slice(0, 5).join("\n"));
}

if (import.meta.main) {
  const [command, folder] = Bun.argv.slice(2);
  if (!folder || !["input", "apply"].includes(command!)) throw new Error("Usage: bun extract-words/run.ts input|apply <folder>");
  await (command === "input" ? writeInput(folder) : apply(folder));
}
