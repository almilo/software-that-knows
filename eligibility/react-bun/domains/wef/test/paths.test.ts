// The law, path by path. The test names cite the articles of the BVG and the WEFV that each path
// comes from (part 5 of the model). The date of the application is 2 October 2026.
import { describe, expect, test } from "bun:test";
import { createEngine, type Answers } from "../../../core/engine";
import { wef } from "../domain";

const today = "2026-10-02";
const { evaluate: evaluateOn } = createEngine(wef.model);

// A complete application that the rules allow: 40 years old, an apartment of their own.
const ok = {
  birthDate: "1986-03-15",
  retirementAge: 65,
  married: "no",
  purpose: "buyOrBuild",
  propertyType: "apartment",
  ownership: "soleOwnership",
  ownUse: "yes",
  vestedBenefit: 150000,
  requestedAmount: 100000,
  withdrawnBefore: "no",
};

describe("evaluate(): the paths of the law", () => {
  test("a complete application within the rules is allowed, with the next steps of a purchase (WEFV Art. 10, BVG Art. 30c para. 4, 30d, 30e, 83a, WEFV Art. 6)", () => {
    const e = evaluate(ok);
    expect(e).toMatchObject({ missing: [], findings: [], allowed: true });
    expect(e.nextSteps.map((s) => s.id)).toEqual(["AttachPurchaseContract", "LandRegister", "BenefitsReduced", "Tax", "Repayment", "PaymentTime"]);
    expect(e.nextSteps[0]!.sources).toEqual(["WEFV-10"]);
  });

  test("an incomplete application names the questions that need an answer, and is not allowed", () => {
    expect(evaluate({ ...ok, requestedAmount: undefined })).toMatchObject({ missing: ["requestedAmount"], allowed: false });
    expect(evaluate({}).missing).toEqual(["birthDate", "retirementAge", "married", "purpose", "ownUse", "vestedBenefit", "requestedAmount", "withdrawnBefore"]);
  });

  test("possible until the day 3 years before the reference age in the fund's regulations (BVG Art. 30c para. 1, Art. 13)", () => {
    function born(birthDate: string) {
      return { ...ok, birthDate, vestedBenefitAt50: 150000 };
    }
    expect(value(born("1964-10-02"), "lastDayToApply")).toBe("2026-10-02");
    expect(evaluate(born("1964-10-02")).allowed).toBe(true);
    expect(findings(born("1964-10-01"))).toEqual(["TooCloseToRetirement"]);
    expect(findings({ ...born("1966-01-01"), retirementAge: 62 })).toEqual(["TooCloseToRetirement"]);
  });

  test("a reference age with months, as for women born from 1961 to 1963, moves the last day (BVG Art. 13)", () => {
    const born1962 = { ...ok, birthDate: "1962-03-15", vestedBenefitAt50: 150000, retirementAge: 64 };
    expect(value({ ...born1962, retirementAgeMonths: 6 }, "lastDayToApply")).toBe("2023-09-15");
    expect(value({ ...ok, retirementAgeMonths: 0 }, "lastDayToApply")).toBe(value(ok, "lastDayToApply"));
  });

  test("a birthday on 29 February falls on 28 February in other years (BVG Art. 30c para. 1)", () => {
    expect(value({ ...ok, birthDate: "1972-02-29" }, "lastDayToApply")).toBe("2034-02-28");
  });

  test("up to 50, the maximum is the vested benefit; the vested benefit at 50 is not asked (BVG Art. 30c para. 2)", () => {
    const e = evaluate({ ...ok, birthDate: "1976-10-03", vestedBenefitAt50: 10 });
    expect(e.shown).not.toContain("vestedBenefitAt50");
    expect(value(e.answers, "maximumAmount")).toBe(150000);
    expect(findings({ ...ok, requestedAmount: 150001 })).toEqual(["AboveMaximum"]);
  });

  test("from the 50th birthday, the vested benefit at 50 is asked, and the maximum is not known without it (BVG Art. 30c para. 2)", () => {
    const e = evaluate({ ...ok, birthDate: "1976-10-02" });
    expect(e.missing).toEqual(["vestedBenefitAt50"]);
    expect(e.values.map((v) => v.id)).not.toContain("maximumAmount");
  });

  test("over 50, the maximum is the vested benefit at 50 or half of today's, whichever is higher (BVG Art. 30c para. 2, WEFV Art. 5 para. 4)", () => {
    const over50 = { ...ok, birthDate: "1971-05-20", vestedBenefit: 150000 };
    expect(value({ ...over50, vestedBenefitAt50: 120000 }, "maximumAmount")).toBe(120000);
    expect(value({ ...over50, vestedBenefitAt50: 60000 }, "maximumAmount")).toBe(75000);
    expect(findings({ ...over50, vestedBenefitAt50: 60000, requestedAmount: 80000 })).toEqual(["AboveMaximum"]);
  });

  test("over 50, after an earlier withdrawal, the half is taken of today's vested benefit minus the money already in the home (WEFV Art. 5 para. 4 b)", () => {
    const again = { ...ok, birthDate: "1971-05-20", vestedBenefit: 150000, vestedBenefitAt50: 20000, withdrawnBefore: "yes", lastWithdrawal: "2015-01-01", otherHome: "no" };
    expect(evaluate(again).missing).toEqual(["alreadyInvested"]);
    expect(value(again, "maximumAmount")).toBeUndefined();
    expect(value({ ...again, alreadyInvested: 50000 }, "maximumAmount")).toBe(50000);
    expect(evaluate({ ...ok, withdrawnBefore: "yes", lastWithdrawal: "2015-01-01" }).shown).not.toContain("alreadyInvested");
  });

  test("only for a home where the person lives (BVG Art. 30c para. 1, WEFV Art. 4)", () => {
    expect(findings({ ...ok, ownUse: "no" })).toEqual(["NotOwnUse"]);
  });

  test("only an apartment or a single-family house, in one of the four allowed forms (WEFV Art. 2)", () => {
    expect(evaluate({ ...ok, propertyType: "house" }).allowed).toBe(true);
    expect(findings({ ...ok, propertyType: "otherProperty" })).toEqual(["HomeNotEligible"]);
    ["coOwnership", "jointOwnership", "buildingRight"].forEach((ownership) => expect(evaluate({ ...ok, ownership }).allowed).toBe(true));
    expect(findings({ ...ok, ownership: "otherOwnership" })).toEqual(["HomeNotEligible"]);
  });

  test("once every 5 years, counted from the date of the last withdrawal (WEFV Art. 5 para. 3)", () => {
    function before(lastWithdrawal: string) {
      return { ...ok, withdrawnBefore: "yes", lastWithdrawal, otherHome: "no" };
    }
    expect(evaluate({ ...ok, withdrawnBefore: "yes" }).missing).toEqual(["lastWithdrawal", "otherHome"]);
    expect(evaluate(before("2021-10-02")).allowed).toBe(true);
    expect(findings(before("2021-10-03"))).toEqual(["TooSoon"]);
    expect(value(before("2021-10-03"), "nextPossibleWithdrawal")).toBe("2026-10-03");
  });

  test("pension money for only one home at a time (WEFV Art. 1 para. 2)", () => {
    expect(findings({ ...ok, withdrawnBefore: "yes", lastWithdrawal: "2015-01-01", otherHome: "yes" })).toEqual(["OtherHome"]);
  });

  test("at least CHF 20 000, except for shares in a housing cooperative (WEFV Art. 5 para. 1 and 2)", () => {
    expect(evaluate({ ...ok, requestedAmount: 20000 }).allowed).toBe(true);
    expect(findings({ ...ok, requestedAmount: 19999 })).toEqual(["BelowMinimum"]);
    expect(findings({ ...ok, purpose: "repayMortgage", fundUnderfunded: "no", requestedAmount: 19999 })).toEqual(["BelowMinimum"]);
    expect(evaluate({ ...ok, purpose: "cooperativeShares", requestedAmount: 5000 }).allowed).toBe(true);
  });

  test("married or in a registered partnership: only with the written consent of the spouse or partner (BVG Art. 30c para. 5)", () => {
    const married = { ...ok, married: "yes" };
    expect(evaluate(married).missing).toEqual(["spouseConsent"]);
    expect(evaluate({ ...married, spouseConsent: "no" }).findings).toMatchObject([{ id: "ConsentMissing", severity: "NotYet", blocks: true }]);
    expect(evaluate({ ...married, spouseConsent: "yes" }).nextSteps.map((s) => s.id)).toContain("AttachConsent");
  });

  test("repaying a mortgage: the loan contract; an underfunded fund can limit it, which does not block (WEFV Art. 6a and 10)", () => {
    const mortgage = { ...ok, purpose: "repayMortgage", fundUnderfunded: "no" };
    expect(evaluate(mortgage).nextSteps[0]!.id).toBe("AttachLoanContract");
    const e = evaluate({ ...mortgage, fundUnderfunded: "yes" });
    expect(e.findings).toMatchObject([{ id: "MayBeLimited", severity: "Notice", blocks: false }]);
    expect(e.allowed).toBe(true);
    // For a purchase the question is not asked, and an old answer does not count.
    expect(findings({ ...ok, fundUnderfunded: "yes" })).toEqual([]);
  });

  test("shares in a housing cooperative: the certificates, no land register, and the property questions do not count (WEFV Art. 3 and 16)", () => {
    const e = evaluate({ ...ok, purpose: "cooperativeShares", propertyType: "otherProperty" });
    expect(e.allowed).toBe(true);
    expect(e.shown).not.toContain("propertyType");
    expect(e.nextSteps.map((s) => s.id)).toEqual(["AttachShares", "BenefitsReduced", "Tax", "Repayment", "PaymentTime"]);
  });

  test("implausible dates are found, without a source in the law: younger than 18, or a last withdrawal after today", () => {
    expect(evaluate({ ...ok, birthDate: "2010-01-01" }).findings).toMatchObject([{ id: "CheckDates", sources: [] }]);
    expect(findings({ ...ok, withdrawnBefore: "yes", lastWithdrawal: "2027-01-01", otherHome: "no" })).toEqual(["TooSoon", "CheckDates"]);
  });

  test("every reason to refuse is found, not only the first, the most serious first", () => {
    expect(findings({ ...ok, birthDate: "1960-01-01", vestedBenefitAt50: 1, ownUse: "no", married: "yes", spouseConsent: "no" })).toEqual([
      "AboveMaximum",
      "NotOwnUse",
      "TooCloseToRetirement",
      "ConsentMissing",
    ]);
  });
});

function evaluate(answers: Answers) {
  return evaluateOn(answers, today);
}

function findings(answers: Answers) {
  return evaluate(answers).findings.map((f) => f.id);
}

function value(answers: Answers, id: string) {
  return evaluate(answers).values.find((v) => v.id === id)?.value;
}
