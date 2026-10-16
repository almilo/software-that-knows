// The maternity allowance and the other parent's allowance, path by path. The test names cite the articles of the EOG
// that each path comes from. The date of the application is 2 October 2026.
import { describe, expect, test } from "bun:test";
import { createEngine, type Answers } from "../../../core/engine";
import { parentalAllowance } from "../domain";

const today = "2026-10-02";
const { evaluate: evaluateOn, shape } = createEngine(parentalAllowance.model);

// A complete application that the rules allow: an employed mother, born on 1 September.
const mother = {
  parent: "mother",
  childBirthDate: "2026-09-01",
  insured: "yes",
  worked: "yes",
  status: "employed",
  monthlyIncome: 6000,
};
const otherParent = { ...mother, parent: "otherParent", legalParent: "yes", leaveStart: "2026-09-14" };

describe("evaluate(): the paths of the law", () => {
  test("an employed mother: 80 % of her daily income for 98 days, until the 98th day (EOG Art. 16b, 16c, 16d, 16e)", () => {
    const e = evaluate(mother);
    expect(e).toMatchObject({ missing: [], findings: [], allowed: true });
    expect(values(e)).toEqual({ dailyAllowance: 160, days: 98, totalAllowance: 15680, lastAllowanceDay: "2026-12-07" });
    expect(e.nextSteps.map((s) => s.id)).toEqual(["Claim", "EndsEarly"]);
  });

  test("an income that 30 does not divide still gives the amounts (EOG Art. 16e)", () => {
    // 5000 / 30 = 166.67 a day, 80 % of it 133.33. As xsd:decimal, Oxigraph gave no amount at all.
    const v = values(evaluate({ ...mother, monthlyIncome: 5000 }));
    expect(v.dailyAllowance).toBeCloseTo(133.33, 2);
    expect(v.totalAllowance).toBeCloseTo(13066.67, 2);
  });

  test("at most CHF 220 a day (EOG Art. 16f, 16l)", () => {
    expect(values(evaluate({ ...mother, monthlyIncome: 12000 })).dailyAllowance).toBe(220);
    expect(values(evaluate({ ...mother, monthlyIncome: 8250 })).dailyAllowance).toBe(220);
  });

  test("a self-employed parent: the annual income divided by 360 (EOG Art. 16e)", () => {
    const e = evaluate({ ...mother, status: "selfEmployed", monthlyIncome: undefined, annualIncome: 72000 });
    expect(e.shown).not.toContain("monthlyIncome");
    expect(values(e).dailyAllowance).toBe(160);
  });

  test("the other parent: 14 daily allowances, within the 6 months after the birth, the day of the birth being the first (EOG Art. 16i, 16j, 16k, 16l)", () => {
    const e = evaluate(otherParent);
    expect(e).toMatchObject({ findings: [], allowed: true });
    expect(values(e)).toEqual({ dailyAllowance: 160, days: 14, totalAllowance: 2240, lastLeaveDay: "2027-02-28" });
    expect(e.nextSteps.map((s) => s.id)).toEqual(["Claim", "TakeWithinSixMonths"]);
    expect(findings({ ...otherParent, leaveStart: "2027-02-28" })).toEqual([]);
    expect(findings({ ...otherParent, leaveStart: "2027-03-01" })).toEqual(["LeaveOutsidePeriod"]);
    expect(findings({ ...otherParent, leaveStart: "2026-08-31" })).toEqual(["LeaveOutsidePeriod"]);
  });

  test("only the legal other parent, at the birth or within 6 months (EOG Art. 16i)", () => {
    expect(findings({ ...otherParent, legalParent: "no" })).toEqual(["NotLegalParent"]);
    expect(evaluate(mother).shown).not.toContain("legalParent");
  });

  test("working in the spouse's business for a cash wage counts, with the monthly wage (EOG Art. 16b para. 1 c, 16i para. 1 d)", () => {
    const e = evaluate({ ...mother, status: "spouseBusiness" });
    expect(e).toMatchObject({ findings: [], allowed: true });
    expect(values(e).dailyAllowance).toBe(160);
  });

  test("9 months of AHV insurance and 5 months of work (EOG Art. 16b para. 1, 16i)", () => {
    expect(findings({ ...mother, insured: "no" })).toEqual(["NotInsured"]);
    expect(findings({ ...mother, worked: "no", insured: "no" })).toEqual(["NotEnoughWork", "NotInsured"]);
  });

  test("not before the birth (EOG Art. 16c para. 1)", () => {
    expect(evaluate({ ...mother, childBirthDate: "2026-10-03" }).findings.map((f) => [f.id, f.severity])).toEqual([["NotBornYet", "NotYet"]]);
  });

  test("other situations go to the compensation office, without an amount", () => {
    const e = evaluate({ ...mother, status: "otherStatus", monthlyIncome: undefined });
    expect(e.findings.map((f) => [f.id, f.severity])).toEqual([["AskOffice", "Notice"]]);
    expect(values(e).dailyAllowance).toBeUndefined();
  });

  test("no field of the shared modules: the domain imports none", () => {
    expect(shape.groups).toEqual(["birth", "work", "income"]);
    expect(evaluate({}).missing).toEqual(["parent", "childBirthDate", "insured", "worked", "status"]);
  });
});

function evaluate(answers: Answers) {
  return evaluateOn(answers, today);
}

function findings(answers: Answers) {
  return evaluate(answers).findings.map((f) => f.id);
}

function values(e: ReturnType<typeof evaluate>) {
  return Object.fromEntries(e.values.map((v) => [v.id, v.value]));
}
