import { expect, test } from "bun:test";
import { runChecks } from "../engine/checks";
import { generatePolicy } from "../generator/generate-policy";
import { readModel } from "../generator/generate";
import { cases } from "./cases";

const policy = generatePolicy(await readModel());

// The checks of the model, and the test claims (cases.ts). An open finding fails the build; the
// report of the app (Model checks) shows the same findings.
test.each(runChecks(policy, cases).map((c) => [c.title, c] as const))("%s: no open findings", (_, check) => {
  expect(check.findings.filter((f) => f.status === "open").map((f) => f.text)).toEqual([]);
});

// The checks find what the document says twice, or in two ways. If one of these disappears, the
// model or a check changed: look at why before you update the list.
test("the checks find the places where the document needs a decision", () => {
  const decided = runChecks(policy, cases).flatMap((c) => c.findings.filter((f) => f.status === "resolved").map((f) => `${c.id}: ${f.basis}: ${f.sources.join(" ")}`));
  expect(decided.sort()).toEqual([
    "contradictions: interpretation: 202.3f 204.1",
    "contradictions: interpretation: 3 406",
    "contradictions: text: 202.2 203.7",
    "contradictions: text: 3 301.3",
    "repeated: interpretation: 406.7",
  ]);
});
