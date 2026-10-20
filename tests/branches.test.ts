// Other branches of the model: refusals, next steps and relevance.
import { describe, expect, test } from "bun:test";
import { createEngine } from "../app/src/model";
import { OUTCOME } from "../app/src/engine";

const FZ = "https://software-that-knows.example/famzg#";
const engine = createEngine();

const base = {
  activity: FZ + "Employed",
  annualIncome: 60000,
  relationship: FZ + "OwnChild",
  applicationDate: "2026-10-19",
};

async function outcomes(answers: Record<string, unknown>) {
  const e = await engine.evaluate(answers);
  return { e, ids: e.outcomes.map((o) => o.id.replace(FZ, "")) };
}

const valueOf = (e: Awaited<ReturnType<typeof engine.evaluate>>, property: string) =>
  e.outcomes.flatMap((o) => o.values).find((v) => v.property === FZ + property)?.value;

describe("model branches", () => {
  test("young child: child allowance until the end of the month of the 16th birthday", async () => {
    const { e, ids } = await outcomes({ ...base, birthDate: "2016-02-29", schooling: FZ + "CompulsorySchool" });
    expect(ids).toEqual(["RuleChildAllowance", "RuleApplyEmployed"]);
    expect(valueOf(e, "minimumMonthlyAmount")).toBe("215");
    expect(valueOf(e, "claimFrom")).toBe("2016-02-01");
    expect(valueOf(e, "claimUntilLatest")).toBe("2032-02-29");
  }, 30_000);

  test("compulsory school after the 16th birthday: education allowance from the next month", async () => {
    const { e, ids } = await outcomes({ ...base, birthDate: "2010-01-15", schooling: FZ + "CompulsorySchool" });
    expect(ids[0]).toBe("RuleEducationAllowance");
    expect(valueOf(e, "claimFrom")).toBe("2026-02-01");
  }, 30_000);

  test("education before the 15th birthday: education allowance from the month of the 15th birthday", async () => {
    const { e } = await outcomes({
      ...base,
      birthDate: "2011-09-20",
      schooling: FZ + "PostCompulsoryEducation",
      educationStart: "2026-08-01",
    });
    expect(valueOf(e, "claimFrom")).toBe("2026-09-01");
    expect(valueOf(e, "claimUntilLatest")).toBe("2036-09-30");
  }, 30_000);

  test("child over 16 without education: asks about incapacity, then refusal or child allowance until 20", async () => {
    const answers = { ...base, birthDate: "2008-05-01", schooling: FZ + "NoEducation" };
    const first = await engine.evaluate(answers);
    expect(first.open).toEqual(["incapableOfWork"]);
    expect(first.outcomes.some((o) => o.kind === OUTCOME.refusal)).toBe(false);

    const refused = await outcomes({ ...answers, incapableOfWork: "false" });
    expect(refused.ids).toEqual(["RuleNoAllowanceAtDate"]);
    expect(refused.e.complete).toBe(true);

    const incapable = await outcomes({ ...answers, incapableOfWork: "true" });
    expect(incapable.ids[0]).toBe("RuleChildAllowance");
    expect(valueOf(incapable.e, "claimUntilLatest")).toBe("2028-05-31");
  }, 30_000);

  test("income below the minimum: counts as not gainfully employed and gets the extra questions", async () => {
    const { e, ids } = await outcomes({ activity: FZ + "Employed", annualIncome: 7000 });
    expect(ids).toContain("RuleBelowMinimumIncome");
    expect(Number(valueOf(e, "minimumAnnualIncome"))).toBe(7560);
    expect(e.visible).toContain("taxableIncome");
    expect(e.visible).toContain("supplementaryBenefits");
  }, 30_000);

  test("not gainfully employed with too high taxable income: refusal, no more questions", async () => {
    const { e, ids } = await outcomes({ activity: FZ + "NonEmployed", taxableIncome: 50000 });
    expect(ids).toEqual(["RuleTaxableIncomeTooHigh"]);
    expect(Number(valueOf(e, "taxableIncomeLimit"))).toBe(45360);
    expect(e.visible).toEqual(["activity", "taxableIncome"]);
  }, 30_000);

  test("not gainfully employed, conditions met: claim and canton of residence", async () => {
    const { ids } = await outcomes({
      ...base,
      activity: FZ + "NonEmployed",
      annualIncome: undefined,
      taxableIncome: 40000,
      supplementaryBenefits: "false",
      birthDate: "2015-01-01",
      schooling: FZ + "CompulsorySchool",
    });
    expect(ids).toEqual(["RuleChildAllowance", "RuleApplyNonEmployed"]);
  }, 30_000);

  test("agriculture: next step under the FLG and no questions about the child", async () => {
    const { e, ids } = await outcomes({ activity: FZ + "Agriculture" });
    expect(ids).toEqual(["RuleAgriculture"]);
    expect(e.visible).toEqual(["activity"]);
    expect(e.complete).toBe(true);
  }, 30_000);

  test("sibling without predominant maintenance: refusal", async () => {
    const { ids } = await outcomes({ ...base, relationship: FZ + "SiblingOrGrandchild", predominantSupport: "false" });
    expect(ids).toEqual(["RuleNoPredominantSupport"]);
  }, 30_000);

  test("answers to questions that are no longer relevant are not used", async () => {
    const e = await engine.evaluate({ activity: FZ + "NonEmployed", annualIncome: 60000 });
    expect(e.answers).toEqual({ activity: FZ + "NonEmployed" });
  }, 30_000);

  test("SHACL core checks the answers", async () => {
    const e = await engine.evaluate({
      ...base,
      birthDate: "2027-01-01",
      schooling: FZ + "PostCompulsoryEducation",
      educationStart: "2026-01-01",
    });
    const keys = e.inputErrors.map((i) => i.key);
    expect(keys).toContain("birthDate");
  }, 30_000);
});
