// `bun run conformance`: the shared test cases of every stack (../conformance/<domain>.json). For
// each domain, a fixed set of applications, drawn from the fields of its form, and what this engine
// decides for each: the questions asked and missing, the values, the findings, the next steps, and
// whether the application is allowed. Every stack that runs the knowledge model must decide the
// same; the Bun test (test/conformance.test.ts) and the Java core check it.
// The draw needs no domain code: it takes the answers from each field's choices, type and limits,
// with a fixed seed, so a new run gives the same applications. Of the applications drawn, the first
// with each outcome (the questions asked, the findings, the next steps, allowed or not) is kept, so
// the cases cover many paths of the rules with few cases.
import { createEngine, type Answers } from "../core/engine";
import type { Field } from "../core/model";
import { ready } from "../core/rdf";
import { root } from "./generate";

export const directory = `${root}../conformance/`;
const drawn = 400; // applications drawn for each domain; one is kept for each distinct outcome
const kept = 80; // at most
const dates = ["2026-10-02", "2027-03-01"];
const datePool = [
  "1960-06-15", "1962-03-15", "1964-10-01", "1964-10-02", "1972-02-29", "1976-10-02", "1976-10-03", "1986-03-15",
  "1990-01-31", "2010-05-01", "2019-01-01", "2021-10-02", "2024-08-29", "2026-01-31", "2026-08-31", "2026-10-02", "2027-01-01",
];
const amountPool = [0, 1000, 19999, 20000, 50000, 150000, 400000];

if (import.meta.main) {
  const files = await conformanceFiles();
  await Promise.all(Object.entries(files).map(([path, text]) => Bun.write(`${directory}${path}`, text)));
  console.log(`Wrote ${Object.keys(files).map((f) => `../conformance/${f}`).join(", ")}`);
}

// The content of each file of cases, by its name in ../conformance/.
export async function conformanceFiles() {
  await ready;
  const domains = await Array.fromAsync(new Bun.Glob("domains/*/domain.ts").scan({ cwd: root }));
  const files = await Promise.all(
    domains.sort().map(async (path) => {
      const name = path.split("/")[1]!;
      return record(name, await entry(path), await examples(name));
    }),
  );
  return Object.fromEntries(files);
}

// The example applications written by hand for a domain (../conformance/<domain>.examples.json), if any.
async function examples(name: string) {
  const file = Bun.file(`${directory}${name}.examples.json`);
  return (await file.exists()) ? ((await file.json()).examples as { date: string; answers: Answers }[]) : [];
}

async function entry(path: string) {
  const module = await import(`${root}${path}`);
  return Object.values(module)[0] as { model: string[] };
}

function record(name: string, files: { model: string[] }, examples: { date: string; answers: Answers }[]) {
  const { shape, evaluate } = createEngine(files.model);
  const next = random(name.length * 7919);
  const drafts = Array.from({ length: drawn }, (_, i) => ({
    date: dates[i % dates.length]!,
    answers: Object.fromEntries(shape.fields.flatMap((field) => draw(field, next))),
  }));
  const candidates = [...examples, ...drafts].map(({ date, answers }) => ({ date, answers, expected: evaluate(answers, date) }));
  const outcomes = Map.groupBy(candidates, ({ expected: e }) =>
    JSON.stringify([e.allowed, e.shown, e.findings.map((f) => f.id), e.nextSteps.map((s) => s.id)]),
  );
  const cases = [...outcomes.values()]
    .map((group) => group[0]!)
    .slice(0, kept)
    .map((c, i) => ({ id: `${name}-${String(i + 1).padStart(3, "0")}`, ...c }));
  const content = {
    $comment: `Shared test cases of ${name}: what every stack must decide. Recorded by react-bun/generator/conformance.ts. Do not edit.`,
    domain: name,
    cases,
  };
  return [`${name}.json`, JSON.stringify(content, null, 2) + "\n"] as const;
}

// One answer for a field, or none: 1 in 10 is left empty, to test missing answers.
function draw(field: Field, next: () => number): [string, unknown][] {
  if (next() < 0.1) return [];
  const pool = values(field);
  return [[field.name, pool[Math.floor(next() * pool.length)]]];
}

function values(field: Field): unknown[] {
  if (field.choices) return field.choices.map((c) => c.replace(/^.*[#/]/, ""));
  const type = field.datatype?.replace(/^.*#/, "");
  if (type === "date") return datePool;
  const within = (n: number) => (field.minimum === undefined || n >= field.minimum) && (field.maximum === undefined || n <= field.maximum);
  if (type === "integer") {
    const low = field.minimum ?? 0;
    const high = field.maximum ?? low + 10;
    return [low, Math.round((low + high) / 2), high].filter(within);
  }
  return amountPool.filter(within);
}

function random(seed: number) {
  const state = { seed };
  return () => {
    state.seed = (state.seed + 0x6d2b79f5) | 0;
    const a = Math.imul(state.seed ^ (state.seed >>> 15), 1 | state.seed);
    const b = (a + Math.imul(a ^ (a >>> 7), 61 | a)) ^ a;
    return ((b ^ (b >>> 14)) >>> 0) / 4294967296;
  };
}

export type Case = { id: string; date: string; answers: Answers; expected: ReturnType<ReturnType<typeof createEngine>["evaluate"]> };
