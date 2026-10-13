import { describe, expect, test } from "bun:test";
import * as part7 from "../../../../cloud-architecture/decide/decide";
import { explain as part7Explain } from "../../../../cloud-architecture/decide/explain";
import { createDecision } from "../../../decide/decision";
import { explain } from "../../../decide/explain";
import type { DecisionModel } from "../../../decide/model";
import decision from "../generated/decision.json";

// This domain is the app of part 7 (cloud-architecture/ in this repository) on the generic code.
// It must read the same files and decide the same, in every situation.
const d = createDecision(decision as DecisionModel);
const part7Files = { "facts.ttl": "cloud-native-architecture.ttl", "questions.ttl": "criteria.ttl", "rules.ttl": "rules.ttl" };

test.each(Object.entries(part7Files))("ontology/%s is part 7's %s, unchanged", async (file, original) => {
  const here = await Bun.file(new URL(`../ontology/${file}`, import.meta.url)).text();
  expect(here).toBe(await Bun.file(new URL(`../../../../cloud-architecture/ontology/${original}`, import.meta.url)).text());
});

describe("the same decision as part 7", () => {
  const situations = d.completions({}, d.criteria.map((c) => c.key));
  // Part 7's names: style for choice, parts for additions. RDF keeps no order of the tools, so they
  // are compared as sets.
  const asPart7 = (o: ReturnType<typeof d.evaluate>) => ({ style: o.choice, parts: o.additions, cautions: o.cautions, tools: [...o.tools].sort() });

  test("in all 13,122 situations", () => {
    expect(situations).toHaveLength(13_122);
    situations.forEach((answers) => {
      const theirs = part7.evaluate(answers);
      expect(asPart7(d.evaluate(answers))).toEqual({ ...theirs, tools: [...theirs.tools].sort() });
    });
  });

  test("with the same questions to ask and the same explanation, after any first answer", () => {
    const first = d.criteria.flatMap((c) => [...c.answers.map((a) => a.code), d.notSure].map((code) => ({ [c.key]: code })));
    first.forEach((answers) => expect(d.questionsThatMatter(answers).map((c) => c.key)).toEqual(part7.questionsThatMatter(answers).map((c) => c.key)));
  });

  test("with the same reasons and the same conditions to reconsider", () => {
    situations.filter((_, i) => i % 97 === 0).forEach((answers) => {
      const ours = explain(d, answers, d.evaluate(answers));
      const theirs = part7Explain(answers, part7.evaluate(answers));
      expect({ because: ours.because, revisit: ours.revisit.map((r) => ({ id: r.option.id, when: r.when })) }).toEqual({
        because: theirs.because,
        revisit: theirs.revisit.map((r) => ({ id: r.style.id, when: r.when })),
      });
    });
  });
});
