// The cash payment of the vested benefit, path by path. The test names cite the articles of the FZG
// that each path comes from. The date of the application is 2 October 2026.
import { describe, expect, test } from "bun:test";
import { createEngine, type Answers } from "../../../core/engine";
import { vestedBenefits } from "../domain";

const today = "2026-10-02";
const { evaluate: evaluateOn, shape } = createEngine(vestedBenefits.model);

// A complete application that the rules allow: 45 years old, single, leaves for another country.
const ok = {
  birthDate: "1981-05-20",
  retirementAge: 65,
  married: "no",
  heldBy: "inPensionFund",
  leaving: "yes",
  reason: "leavingSwitzerland",
  destination: "otherCountry",
  vestedBenefit: 80000,
};

describe("evaluate(): the paths of the law", () => {
  test("leaving Switzerland for good allows a cash payment, with its proof, interest and taxes (FZG Art. 5 para. 1 a, Art. 2 para. 3 and 4)", () => {
    const e = evaluate(ok);
    expect(e).toMatchObject({ missing: [], findings: [], allowed: true });
    expect(e.nextSteps.map((s) => s.id)).toEqual(["ProofOfDeparture", "Interest", "CapitalTax", "SourceTax"]);
    expect(e.nextSteps[1]!.sources).toEqual(["FZG-2-3", "FZG-2-4"]);
  });

  test("the form starts with the fields of the shared modules, then the domain's own step", () => {
    expect(shape.groups).toEqual(["you", "cashPayment", "pensionFund"]);
    expect(shape.fields.slice(0, 5).map((f) => f.name)).toEqual(["birthDate", "retirementAge", "retirementAgeMonths", "married", "spouseConsent"]);
  });

  test("an incomplete application names the questions that need an answer", () => {
    expect(evaluate({}).missing).toEqual(["birthDate", "retirementAge", "married", "heldBy", "reason", "vestedBenefit"]);
  });

  test("the vested benefit falls due only when the person leaves the fund (FZG Art. 2 para. 1 and 3)", () => {
    expect(findings({ ...ok, leaving: "no" })).toEqual(["NotLeaving"]);
    const institution = evaluate({ ...ok, heldBy: "inVestedBenefitsInstitution", leaving: "no" });
    expect(institution.shown).not.toContain("leaving");
    expect(institution.allowed).toBe(true);
    expect(institution.nextSteps.map((s) => s.id)).not.toContain("Interest");
  });

  test("not at or after the reference age, in years and months (FZG Art. 2 para. 1, BVG Art. 13)", () => {
    expect(findings({ ...ok, birthDate: "1961-10-03" })).toEqual([]);
    expect(findings({ ...ok, birthDate: "1961-10-02" })).toEqual(["AtReferenceAge"]);
    expect(findings({ ...ok, birthDate: "1962-04-02", retirementAge: 64, retirementAgeMonths: 6 })).toEqual(["AtReferenceAge"]);
    expect(findings({ ...ok, birthDate: "1962-04-03", retirementAge: 64, retirementAgeMonths: 6 })).toEqual([]);
  });

  test("another reason allows no cash payment (FZG Art. 3, 4, 5 para. 1)", () => {
    expect(findings({ ...ok, reason: "otherReason" })).toEqual(["NoReason"]);
  });

  test("self-employment, only when no longer subject to the mandatory scheme (FZG Art. 5 para. 1 b)", () => {
    const self = { ...ok, reason: "selfEmployment", destination: undefined };
    expect(evaluate(self).missing).toEqual(["stillMandatory"]);
    expect(findings({ ...self, stillMandatory: "yes" })).toEqual(["StillInsured"]);
    const e = evaluate({ ...self, stillMandatory: "no" });
    expect(e.allowed).toBe(true);
    expect(e.nextSteps.map((s) => s.id)).toEqual(["ProofOfSelfEmployment", "Interest", "CapitalTax"]);
  });

  test("a small amount, only when less than the annual contribution (FZG Art. 5 para. 1 c)", () => {
    const small = { ...ok, reason: "smallAmount", destination: undefined, vestedBenefit: 3000 };
    expect(evaluate(small).missing).toEqual(["annualContribution"]);
    expect(findings({ ...small, annualContribution: 3001 })).toEqual([]);
    expect(findings({ ...small, annualContribution: 3000 })).toEqual(["NotSmall"]);
  });

  test("to the EU or EFTA, with mandatory insurance there, the BVG part stays in Switzerland (FZG Art. 25f)", () => {
    const eu = { ...ok, destination: "euEfta" };
    expect(evaluate(eu).missing).toEqual(["insuredAbroad"]);
    const e = evaluate({ ...eu, insuredAbroad: "yes" });
    expect(e.findings.map((f) => [f.id, f.severity])).toEqual([["MandatoryPartStays", "Notice"]]);
    expect(e.allowed).toBe(true);
    expect(findings({ ...eu, insuredAbroad: "no" })).toEqual([]);
  });

  test("married: the consent of the module, with this law as its basis (FZG Art. 5 para. 2 and 3)", () => {
    const married = { ...ok, married: "yes" };
    expect(evaluate(married).missing).toEqual(["spouseConsent"]);
    const refused = evaluate({ ...married, spouseConsent: "no" });
    expect(refused.findings).toEqual([{ id: "ConsentMissing", severity: "NotYet", blocks: true, sources: ["FZG-5-2", "FZG-5-3"] }]);
    const agreed = evaluate({ ...married, spouseConsent: "yes" });
    expect(agreed.nextSteps.find((s) => s.id === "AttachConsent")?.sources).toEqual(["FZG-5-2"]);
  });
});

function evaluate(answers: Answers) {
  return evaluateOn(answers, today);
}

function findings(answers: Answers) {
  return evaluate(answers).findings.map((f) => f.id);
}
