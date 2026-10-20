// More paths through the model: relevance of the questions and results.
import { describe, expect, test } from "bun:test";
import { choice, engine, resultOf, rulesOf } from "./helpers.ts";

const employee = () => choice("employmentStatus", "Employee");
const own = () => choice("childRelation", "My own child (also adopted)");
const base = () => ({ applicationDate: "2026-10-19", employmentStatus: employee(), annualIncome: 60000, childRelation: own() });

describe("relevance of the questions", () => {
  test("at the start only the date and the status are relevant", async () => {
    const e = await engine.evaluate({});
    expect([...e.relevant]).toEqual(["applicationDate", "employmentStatus"]);
    expect(e.results).toEqual([]);
  });

  test("the income is relevant for an employee", async () => {
    const e = await engine.evaluate({ applicationDate: "2026-10-19", employmentStatus: employee() });
    expect([...e.relevant]).toEqual(["applicationDate", "employmentStatus", "annualIncome"]);
  });

  test("an answer that is no longer relevant is removed", async () => {
    const e = await engine.evaluate({ ...base(), employmentStatus: choice("employmentStatus", "Work in agriculture"), childBirthDate: "2020-01-01" });
    expect(e.answers).toEqual({ applicationDate: "2026-10-19", employmentStatus: choice("employmentStatus", "Work in agriculture") });
    expect(rulesOf(e)).toEqual(["rule_Agriculture"]);
  });

  test("the education questions are not relevant for a young child", async () => {
    const e = await engine.evaluate({ ...base(), childBirthDate: "2020-05-05" });
    expect(e.relevant.has("inPostCompulsoryEducation")).toBe(false);
  });
});

describe("the person", () => {
  test("income below the minimum: counts as non-employed", async () => {
    const e = await engine.evaluate({ ...base(), annualIncome: 5000 });
    expect(rulesOf(e)).toEqual(["rule_CountsAsNonEmployed"]);
    expect(resultOf(e, "rule_CountsAsNonEmployed")!.args.minIncome.value).toMatch(/^7560(\.0+)?$/);
    expect(e.relevant.has("taxableIncome")).toBe(true);
    expect(e.relevant.has("childRelation")).toBe(false);
  });

  test("non-employed with a taxable income above the limit: refusal", async () => {
    const e = await engine.evaluate({
      applicationDate: "2026-10-19", employmentStatus: choice("employmentStatus", "Not employed"),
      taxableIncome: 50000, receivesSupplementaryBenefits: false,
    });
    expect(rulesOf(e)).toEqual(["rule_NonEmployedIncome"]);
    expect(Number(resultOf(e, "rule_NonEmployedIncome")!.args.taxableLimit.value)).toBe(45360);
  });

  test("non-employed with supplementary benefits: refusal", async () => {
    const e = await engine.evaluate({
      applicationDate: "2026-10-19", employmentStatus: choice("employmentStatus", "Not employed"),
      taxableIncome: 20000, receivesSupplementaryBenefits: true,
    });
    expect(rulesOf(e)).toEqual(["rule_SupplementaryBenefits"]);
  });

  test("low income, then non-employed rules: child allowance and application in the canton", async () => {
    const e = await engine.evaluate({ ...base(), annualIncome: 5000, taxableIncome: 30000, receivesSupplementaryBenefits: false, childBirthDate: "2020-05-05" });
    expect(rulesOf(e)).toEqual(["rule_ChildAllowance", "rule_CountsAsNonEmployed", "rule_ApplyNonEmployed"]);
    const child = resultOf(e, "rule_ChildAllowance")!;
    expect(child.args.amount.value).toBe("215");
    expect(child.args.start.value).toBe("2020-05-01");
    expect(child.args.end.value).toBe("2036-05-31");
  });

  test("in 2027 the minimum income follows the new pension", async () => {
    const e = await engine.evaluate({ ...base(), applicationDate: "2027-02-01", annualIncome: 7600 });
    expect(rulesOf(e)).toEqual(["rule_CountsAsNonEmployed"]);
    expect(Number(resultOf(e, "rule_CountsAsNonEmployed")!.args.minIncome.value)).toBe(7680);
  });

  test("a date before the amounts of the model: open rule", async () => {
    const e = await engine.evaluate({ applicationDate: "2024-06-01" });
    expect(rulesOf(e)).toEqual(["rule_NoParametersForDate"]);
  });
});

describe("the child", () => {
  test("stepchild not in the household: refusal, no more questions", async () => {
    const e = await engine.evaluate({ ...base(), childRelation: choice("childRelation", "My stepchild"), stepChildInHousehold: false });
    expect(rulesOf(e)).toEqual(["rule_StepChild"]);
    expect(e.relevant.has("childBirthDate")).toBe(false);
  });

  test("sibling or grandchild without support: refusal of an open rule", async () => {
    const e = await engine.evaluate({ ...base(), childRelation: choice("childRelation", "My sibling or my grandchild"), predominantMaintenance: false });
    expect(rulesOf(e)).toEqual(["rule_SiblingOrGrandchild"]);
    expect(e.results[0].rule.status).toEndWith("#Open");
  });

  test("young child: child allowance until the end of the month of the 16th birthday", async () => {
    const e = await engine.evaluate({ ...base(), childBirthDate: "2012-02-29" });
    expect(rulesOf(e)).toEqual(["rule_ChildAllowance", "rule_ApplyEmployee"]);
    expect(resultOf(e, "rule_ChildAllowance")!.args.end.value).toBe("2028-02-29");
  });

  test("child of 15 in education: education allowance instead of child allowance", async () => {
    const e = await engine.evaluate({ ...base(), childBirthDate: "2011-03-01", inPostCompulsoryEducation: true, educationStartDate: "2026-08-03", childIncomeAboveLimit: false });
    expect(rulesOf(e)).toEqual(["rule_EducationAllowance", "rule_ApplyEmployee"]);
    expect(resultOf(e, "rule_EducationAllowance")!.args.start.value).toBe("2026-08-01");
  });

  test("education before the month of the 15th birthday: start in the month of the 15th birthday", async () => {
    const e = await engine.evaluate({ ...base(), applicationDate: "2026-12-01", childBirthDate: "2011-11-20", inPostCompulsoryEducation: true, educationStartDate: "2026-08-01", childIncomeAboveLimit: false });
    expect(resultOf(e, "rule_EducationAllowance")!.args.start.value).toBe("2026-11-01");
  });

  test("child of 15 not in education: child allowance", async () => {
    const e = await engine.evaluate({ ...base(), childBirthDate: "2011-03-01", inPostCompulsoryEducation: false });
    expect(rulesOf(e)).toEqual(["rule_ChildAllowance", "rule_ApplyEmployee"]);
  });

  test("child of 17 in compulsory school: education allowance from the month after the 16th birthday", async () => {
    const e = await engine.evaluate({ ...base(), childBirthDate: "2010-02-15", inPostCompulsoryEducation: false, inCompulsorySchool: true });
    expect(rulesOf(e)).toEqual(["rule_EducationAllowance", "rule_ApplyEmployee"]);
    expect(resultOf(e, "rule_EducationAllowance")!.args.start.value).toBe("2026-03-01");
    expect(resultOf(e, "rule_EducationAllowance")!.args.end.value).toBe("2035-02-28");
  });

  test("child of 17 incapable of work: child allowance until the 20th birthday", async () => {
    const e = await engine.evaluate({ ...base(), childBirthDate: "2009-03-10", inPostCompulsoryEducation: false, inCompulsorySchool: false, childIncapableOfWork: true });
    expect(rulesOf(e)).toEqual(["rule_ChildAllowance", "rule_ApplyEmployee"]);
    expect(resultOf(e, "rule_ChildAllowance")!.args.end.value).toBe("2029-03-31");
  });

  test("child of 17 without education: refusal", async () => {
    const e = await engine.evaluate({ ...base(), childBirthDate: "2009-03-10", inPostCompulsoryEducation: false, inCompulsorySchool: false, childIncapableOfWork: false });
    expect(rulesOf(e)).toEqual(["rule_NoAllowanceForAge"]);
  });

  test("child older than 25: refusal without more questions", async () => {
    const e = await engine.evaluate({ ...base(), childBirthDate: "2000-01-01" });
    expect(rulesOf(e)).toEqual(["rule_NoAllowanceForAge"]);
    expect(e.relevant.has("inPostCompulsoryEducation")).toBe(false);
  });

  test("child with an income above the limit: no education allowance", async () => {
    const e = await engine.evaluate({ ...base(), childBirthDate: "2009-03-10", inPostCompulsoryEducation: true, educationStartDate: "2025-08-01", childIncomeAboveLimit: true });
    expect(rulesOf(e)).toEqual(["rule_ChildIncomeAboveLimit"]);
    expect(e.relevant.has("inCompulsorySchool")).toBe(true);
  });

  test("date of birth after the date of the application: problem with the answer", async () => {
    const e = await engine.evaluate({ ...base(), childBirthDate: "2027-01-01" });
    expect(e.problems.map((p) => p.question.key)).toEqual(["childBirthDate"]);
  });
});
