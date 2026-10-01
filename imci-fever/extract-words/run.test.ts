import { expect, test } from "bun:test";
import type { Lexicon } from "../shared/rules-contract";
import { consensus, problem, runPrompt, turtle, type Proposal } from "./run";

const p = (word: string, extra: Partial<Proposal> = {}): Proposal => ({ question: "lethargic", kind: "altLabel", word, reason: "", ...extra });

test("a word is kept when at least two of three runs propose it; a run counts a word once", () => {
  const { kept, all, unanimous } = consensus([[p("Floppy"), p("floppy")], [p("floppy "), p("drowsy")], [p("hard to wake"), p("drowsy")]]);
  expect(kept.map((k) => [k.word, k.runs])).toEqual([["floppy", 2], ["drowsy", 2]]);
  expect([all.length, unanimous]).toEqual([3, 0]);
});

const fields: Lexicon["fields"] = {
  lethargic: { labels: ["unconscious or lethargic"], absent: ["alert"] },
  malariaRisk: { labels: ["malaria risk"], absent: [], values: [{ value: "high", labels: ["high risk"] }] },
};

test("a word for an unknown question, a value not allowed, a known word or a contradiction is dropped", () => {
  expect(problem(p("floppy", { question: "sleepiness" }), fields, [])).toBe("unknown question");
  expect(problem(p("very high", { question: "malariaRisk", kind: "valueLabel", value: "very high" }), fields, [])).toBe("not an allowed value");
  expect(problem(p("unconscious or lethargic"), fields, [])).toBe("already a word of the question");
  expect(problem(p("alert", { question: "malariaRisk" }), fields, [])).toBe("would state a sign both present and absent");
  expect(problem(p("not awake and alert"), fields, [])).toContain("can never match");
  expect(problem(p("floppy"), fields, [])).toBeUndefined();
});

test("the kept words become Turtle statements below part 6", () => {
  const words = [p("floppy"), p("wide awake", { kind: "absentLabel" }), p("high transmission", { question: "malariaRisk", kind: "valueLabel", value: "high" })];
  expect(turtle(words, "# run")).toBe(
    '\n# run\nimci:lethargic skos:altLabel "floppy" ;\n  imci:absentLabel "wide awake" .\nimci:malariaRisk imci:valueLabel [ imci:value "high" ; skos:altLabel "high transmission" ] .\n',
  );
});

test("the run prompt is the quoted text under the skill's Run prompt heading", () => {
  expect(runPrompt("# Skill\n\n## Run prompt\n\n> Read the file.\n> - A rule.\n\n## Why\n> not this")).toBe("Read the file.\n- A rule.\n");
});
