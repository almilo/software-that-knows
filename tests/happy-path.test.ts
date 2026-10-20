// Happy path: form data made with JSON Forms core actions, checked by the SHACL engine.
import { describe, expect, test } from "bun:test";
import { Actions, coreReducer, type JsonFormsCore } from "@jsonforms/core";
import { createEngine, schema, uischema } from "../app/src/model";
import { OUTCOME, type Evaluation } from "../app/src/engine";

const FZ = "https://software-that-knows.example/famzg#";
const engine = createEngine();

/** Starts a JSON Forms core state with the generated schema and UI schema. */
function initForm(): JsonFormsCore {
  return coreReducer(undefined, Actions.init({}, schema as any, uischema as any));
}

/** Gives one answer as the form does it: an update action on the path of the control. */
function answer(state: JsonFormsCore, key: string, value: unknown): JsonFormsCore {
  return coreReducer(state, Actions.update(key, () => value));
}

const happyPath: [string, unknown][] = [
  ["activity", FZ + "Employed"],
  ["annualIncome", 60000],
  ["relationship", FZ + "OwnChild"],
  ["birthDate", "2009-03-10"],
  ["schooling", FZ + "PostCompulsoryEducation"],
  ["educationStart", "2025-08-01"],
  ["applicationDate", "2026-10-19"],
];

describe("happy path: employed parent, own child in an apprenticeship", () => {
  test("the form asks each question only when it is relevant, and the result is the education allowance", async () => {
    let state = initForm();
    let evaluation: Evaluation = await engine.evaluate(state.data);
    const asked: string[] = [];

    for (const [key, value] of happyPath) {
      // The question is shown before it is answered.
      expect(evaluation.visible).toContain(key);
      expect(evaluation.open[0]).toBe(key);
      asked.push(key);
      state = answer(state, key, value);
      expect(state.errors ?? []).toEqual([]);
      evaluation = await engine.evaluate(state.data);
      expect(evaluation.inputErrors).toEqual([]);
    }

    // Questions that are not relevant for these answers were not asked.
    expect(asked).toEqual(happyPath.map(([k]) => k));
    for (const key of ["taxableIncome", "supplementaryBenefits", "predominantSupport", "incapableOfWork"]) {
      expect(evaluation.visible).not.toContain(key);
    }
    expect(evaluation.complete).toBe(true);
    expect(evaluation.open).toEqual([]);

    // No refusal.
    expect(evaluation.outcomes.filter((o) => o.kind === OUTCOME.refusal)).toEqual([]);

    // Value: education allowance, at least CHF 268 a month, at the latest until 2034-03-31.
    const values = evaluation.outcomes.filter((o) => o.kind === OUTCOME.value);
    expect(values).toHaveLength(1);
    const result = values[0];
    const value = (property: string) => result.values.find((v) => v.property === FZ + property);
    expect(value("allowanceType")?.value).toBe(FZ + "EducationAllowance");
    expect(value("allowanceType")?.display).toBe("Education allowance");
    expect(Number(value("minimumMonthlyAmount")?.value)).toBeGreaterThanOrEqual(268);
    expect(value("claimUntilLatest")?.value).toBe("2034-03-31");
    expect(value("claimUntilLatest")?.datatype).toBe("http://www.w3.org/2001/XMLSchema#date");
    expect(value("claimFrom")?.value).toBe("2025-08-01");
    expect(result.message).toContain("at the latest");

    // Sources: FamZG Art. 3 para. 1 let. b and Art. 5 para. 2.
    expect(result.sources.map((s) => s.label).sort()).toEqual([
      "FamZG Art. 3 para. 1 let. b",
      "FamZG Art. 5 para. 2",
    ]);
    for (const s of result.sources) expect(s.url).toStartWith("https://fedlex.data.admin.ch/");

    // The interpretations that the result uses are marked.
    expect(result.interpretations.map((i) => i.iri)).toContain(FZ + "I-latest-end");

    // Next step: where to apply.
    const next = evaluation.outcomes.filter((o) => o.kind === OUTCOME.nextStep);
    expect(next.map((o) => o.id)).toEqual([FZ + "RuleApplyEmployed"]);
    expect(next[0].sources.length).toBeGreaterThan(0);
  }, 60_000);
});
