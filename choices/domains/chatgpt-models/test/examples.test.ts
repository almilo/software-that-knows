import { describe, expect, test } from "bun:test";
import { createDecision } from "../../../decide/decision";
import { explain } from "../../../decide/explain";
import type { DecisionModel } from "../../../decide/model";
import { record } from "../../../decide/record";
import decision from "../generated/decision.json";

const d = createDecision(decision as DecisionModel);
const keys = (answers: Record<string, string>) => d.questionsThatMatter(answers).map((c) => c.key);

describe("the tree", () => {
  test("recommends the model at the end of each path", () => {
    expect(d.evaluate({ finishedWork: "no", carefulReasoning: "no" }).choice).toBe("QuickAnswers");
    expect(d.evaluate({ finishedWork: "no", carefulReasoning: "yes", hardest: "no" }).choice).toBe("DeeperAnswers");
    expect(d.evaluate({ finishedWork: "no", carefulReasoning: "yes", hardest: "yes" }).choice).toBe("HardestProblem");
    expect(d.evaluate({ finishedWork: "yes", scoped: "yes" }).choice).toBe("ScopedWork");
    expect(d.evaluate({ finishedWork: "yes", scoped: "no", ambiguous: "no" }).choice).toBe("RefinedDeliverables");
    expect(d.evaluate({ finishedWork: "yes", scoped: "no", ambiguous: "yes" }).choice).toBe("AmbiguousWork");
  });

  test("asks only the questions of the branch it is on", () => {
    expect(keys({ finishedWork: "no" })).toEqual(["carefulReasoning", "hardest", "plan"]);
    expect(keys({ finishedWork: "yes" })).toEqual(["scoped", "ambiguous", "plan"]);
  });

  test("asks for the plan only when a caution depends on it", () => {
    expect(keys({ finishedWork: "no", carefulReasoning: "no" })).toEqual([]);
    expect(keys({ finishedWork: "yes", scoped: "no", ambiguous: "no" })).toEqual([]);
    expect(keys({ finishedWork: "no", carefulReasoning: "yes", hardest: "yes" })).toEqual(["plan"]);
  });
});

describe("the cautions", () => {
  test("warns when the model is not on the plan", () => {
    const hardest = { finishedWork: "no", carefulReasoning: "yes", hardest: "yes" };
    expect(d.evaluate({ ...hardest, plan: "plus" }).cautions).toEqual(["ProNeedsPlan"]);
    expect(d.evaluate({ ...hardest, plan: "pro" }).cautions).toEqual([]);
  });

  test("warns about a plan only for the model it is about", () => {
    expect(d.evaluate({ finishedWork: "yes", scoped: "no", ambiguous: "no", plan: "free_go" }).cautions).toEqual([]);
  });
});

describe("the ladder", () => {
  const answers = { finishedWork: "yes", scoped: "no", ambiguous: "no" };
  const e = explain(d, answers, d.evaluate(answers));

  test("starts at the first step of the model, and steps up to the next one", () => {
    expect(e.ladder).toMatchObject({ start: { option: "Sol", level: "Low" }, next: { option: "Sol", level: "Extra high" } });
  });

  test("has no ladder for the models in Chat", () => {
    const quick = { finishedWork: "no", carefulReasoning: "no" };
    expect(explain(d, quick, d.evaluate(quick)).ladder).toBeUndefined();
  });

  test("names the closest other models to reconsider", () => {
    expect(e.revisit.map((r) => [r.option.id, r.when])).toEqual([
      ["Luna", ["Is it scoped, repeatable or high-volume? Yes"]],
      ["Astra", ["Ambiguous, high-stakes or exacting? Yes"]],
    ]);
  });

  test("writes a brief to start from", () => {
    const text = record(d, answers, e, "2026-10-13");
    expect(text.split("\n")[0]).toBe("# Model: GPT-6.1 Sol");
    expect(text).toContain("Start with GPT-6.1 Sol at low effort: complex technical work, drafts you will revise.");
    expect(text).toContain("## Your brief");
  });
});
