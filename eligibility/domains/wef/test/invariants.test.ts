// The law written again here, in TypeScript and independently of the model, and compared with the
// engine on random applications. The seed is fixed, so each run tests the same applications.
import { describe, expect, test } from "bun:test";
import { createEngine, type Answers, type Evaluation } from "../../../core/engine";
import { wef } from "../domain";

const { evaluate } = createEngine(wef.model);

const today = "2026-10-02";
const choices: Record<string, unknown[]> = {
  birthDate: [undefined, "2010-05-01", "1990-01-31", "1976-10-02", "1976-10-03", "1972-02-29", "1964-10-02", "1964-10-01", "1960-06-15"],
  retirementAge: [undefined, 60, 64, 65],
  retirementAgeMonths: [undefined, 0, 3, 9],
  married: [undefined, "no", "yes"],
  spouseConsent: [undefined, "yes", "no"],
  purpose: [undefined, "buyOrBuild", "repayMortgage", "cooperativeShares"],
  propertyType: [undefined, "apartment", "house", "otherProperty"],
  ownership: [undefined, "soleOwnership", "coOwnership", "jointOwnership", "buildingRight", "otherOwnership"],
  ownUse: [undefined, "yes", "no"],
  vestedBenefit: [undefined, 0, 30000, 150000, 400000],
  vestedBenefitAt50: [undefined, 0, 50000, 200000],
  requestedAmount: [undefined, 5000, 19999, 20000, 80000, 150000, 300000],
  withdrawnBefore: [undefined, "no", "yes"],
  lastWithdrawal: [undefined, "2019-01-01", "2021-10-02", "2021-10-03", "2027-01-01"],
  alreadyInvested: [undefined, 0, 40000, 500000],
  otherHome: [undefined, "no", "yes"],
  fundUnderfunded: [undefined, "yes", "no"],
};

const next = random(30);
const samples: { answers: Answers; e: Evaluation }[] = Array.from({ length: 1000 }, () => {
  const picked = Object.entries(choices).map(([field, values]) => [field, values[Math.floor(next() * values.length)]] as const);
  const answers: Answers = Object.fromEntries(picked.filter(([, value]) => value !== undefined));
  return { answers, e: evaluate(answers, today) };
});

describe("evaluate(): the law written again", () => {
  test("the engine asks the questions that the law asks", () => {
    samples.forEach(({ answers, e }) => expect(e.shown).toEqual(law(answers).asked));
  });

  test("the engine finds exactly the findings that the law gives", () => {
    samples.forEach(({ answers, e }) => expect(new Set(e.findings.map((f) => f.id))).toEqual(law(answers).findings));
  });

  test("the maximum withdrawal is the one the law gives, whenever it is known", () => {
    samples.forEach(({ answers, e }) => expect(e.values.find((v) => v.id === "maximumAmount")?.value).toBe(law(answers).maximum));
  });

  test("allowed only when complete and when no finding but the notice applies", () => {
    samples.forEach(({ answers, e }) => {
      const blocking = [...law(answers).findings].filter((f) => f !== "MayBeLimited");
      expect(e.allowed).toBe(e.missing.length === 0 && blocking.length === 0);
    });
  });

  test("the samples include every finding, and allowed applications", () => {
    const found = new Set(samples.flatMap(({ e }) => e.findings.map((f) => f.id)));
    expect(found.size).toBe(10);
    expect(samples.filter(({ e }) => e.allowed).length).toBeGreaterThan(0);
  });
});

// A date plus whole years and months; a day that the month does not have becomes its last day.
function addYears(date: string, years: number, months = 0) {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const total = y * 12 + (m - 1) + years * 12 + months;
  const [year, month] = [Math.floor(total / 12), (total % 12) + 1];
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

// BVG Art. 13 and 30c and the WEFV, as the questions are asked, and as the findings follow.
function law(a: Answers) {
  const property = a.purpose === "buyOrBuild" || a.purpose === "repayMortgage";
  const over50 = typeof a.birthDate === "string" && today >= addYears(a.birthDate, 50);
  const asked: Record<string, boolean> = {
    spouseConsent: a.married === "yes",
    propertyType: property,
    ownership: property,
    vestedBenefitAt50: over50,
    lastWithdrawal: a.withdrawnBefore === "yes",
    alreadyInvested: over50 && a.withdrawnBefore === "yes",
    otherHome: a.withdrawnBefore === "yes",
    fundUnderfunded: a.purpose === "repayMortgage",
  };
  const v = Object.fromEntries(Object.entries(a).filter(([f]) => asked[f] ?? true)) as Record<string, any>;
  const maximum =
    v.birthDate === undefined || v.vestedBenefit === undefined ? undefined
    : !over50 ? v.vestedBenefit
    : v.vestedBenefitAt50 === undefined ? undefined
    : v.withdrawnBefore === "no" ? Math.max(v.vestedBenefitAt50, v.vestedBenefit / 2)
    : v.alreadyInvested === undefined ? undefined
    : Math.max(v.vestedBenefitAt50, (v.vestedBenefit - v.alreadyInvested) / 2);
  const findings = new Set<string>();
  if (v.birthDate && v.retirementAge && today > addYears(v.birthDate, v.retirementAge - 3, v.retirementAgeMonths ?? 0)) findings.add("TooCloseToRetirement");
  if (v.ownUse === "no") findings.add("NotOwnUse");
  if (property && (v.propertyType === "otherProperty" || v.ownership === "otherOwnership")) findings.add("HomeNotEligible");
  if (v.lastWithdrawal && today < addYears(v.lastWithdrawal, 5)) findings.add("TooSoon");
  if (property && v.requestedAmount < 20000) findings.add("BelowMinimum");
  if (maximum !== undefined && v.requestedAmount > maximum) findings.add("AboveMaximum");
  if (v.otherHome === "yes") findings.add("OtherHome");
  if (v.married === "yes" && v.spouseConsent === "no") findings.add("ConsentMissing");
  if ((v.birthDate && today < addYears(v.birthDate, 18)) || (v.lastWithdrawal && v.lastWithdrawal > today)) findings.add("CheckDates");
  if (v.purpose === "repayMortgage" && v.fundUnderfunded === "yes") findings.add("MayBeLimited");
  return { asked: Object.keys(choices).filter((f) => asked[f] ?? true), maximum, findings };
}

// A small seeded random generator (mulberry32). Its state is an object, so that each call moves it on.
function random(seed: number) {
  const state = { seed };
  return () => {
    state.seed = (state.seed + 0x6d2b79f5) | 0;
    const a = Math.imul(state.seed ^ (state.seed >>> 15), 1 | state.seed);
    const b = (a + Math.imul(a ^ (a >>> 7), 61 | a)) ^ a;
    return ((b ^ (b >>> 14)) >>> 0) / 4294967296;
  };
}
