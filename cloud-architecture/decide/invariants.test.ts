import { expect, test } from "bun:test";
import { type Answers, criteria, evaluate, rules, styles } from "./decide";

// Every way a team can answer the eight questions: 3^7 x 6 = 13,122 situations. The rules must hold
// for each of them, not only for the examples of decide.test.ts.
const situations = criteria.reduce<Answers[]>((partial, c) => partial.flatMap((a) => c.answers.map((x) => ({ ...a, [c.key]: x.code }))), [{}]);
const outcomes = situations.map((answers) => ({ answers, outcome: evaluate(answers) }));

test("covers every situation", () => {
  expect(situations).toHaveLength(13_122);
});

test("gives every situation a style: no situation without a recommendation", () => {
  outcomes.forEach(({ outcome }) => expect(rules.style.map((r) => r.id)).toContain(outcome.style));
});

test("uses every rule in some situation: no rule that can never apply", () => {
  const used = new Set(outcomes.flatMap(({ outcome }) => [outcome.style, ...outcome.parts, ...outcome.cautions]));
  [...rules.style, ...rules.parts, ...rules.cautions].forEach((r) => expect(used.has(r.id), r.id).toBeTrue());
});

test("never warns that microservices need experience when it recommends them", () => {
  outcomes.forEach(({ outcome }) => expect(outcome.style === "MoveToMicroservices" && outcome.cautions.includes("MicroservicesNeedOperations")).toBeFalse());
});

test("never makes continuous processing serverless", () => {
  outcomes
    .filter(({ answers }) => answers.backgroundWork === "heavy_continuous")
    .forEach(({ outcome }) => expect(outcome.parts).not.toContain("ServerlessForEvents"));
});

test("recommends styles of the diagram", () => {
  const ids = styles.map((s) => s.id);
  [...rules.style, ...rules.parts].forEach((r) => expect(ids).toContain(r.recommends!));
});
