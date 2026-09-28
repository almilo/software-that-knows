// Rules that must be true for all form data, not only for the examples in chart-paths.test.ts.
// The form data is random, but the seed is fixed, so each run tests the same combinations.
import { expect, test } from "bun:test";
import { createAjv } from "@jsonforms/core";
import { classify, type Assessment } from "../app/classify";
import rules from "../generated/rules.json";

const choices: Record<string, unknown[]> = {
  convulsingNow: [undefined, true],
  convulsions: [undefined, true],
  convulsionCount: [undefined, "one", "two or more"],
  convulsionLong: [undefined, true],
  lethargic: [undefined, true],
  notAbleToDrink: [undefined, true],
  vomitsEverything: [undefined, true],
  oralFluidTest: [undefined, "completely unable to drink", "drinks poorly"],
  feverReported: [undefined, true, false],
  axillaryTemperature: [undefined, 36.5, 37.5, 38.5],
  rectalTemperature: [undefined, 37.9, 39],
  thermometerNotAvailable: [undefined, true],
  hotToTouch: [undefined, true],
  malariaRisk: [undefined, "high", "low", "no"],
  travelToHighRiskArea: [undefined, true, false],
  obviousCause: [undefined, true, false],
  feverDuration: [undefined, "7 days or less", "more than 7 days"],
  feverEveryDay: [undefined, true],
  stiffNeck: [undefined, true],
  refusalToUseLimb: [undefined, true],
  warmTenderJoint: [undefined, true],
  painPassingUrine: [undefined, true],
  cough: [undefined, true],
  runnyNose: [undefined, true],
  redEyes: [undefined, true],
  otherSevereClassification: [undefined, true],
  malariaTest: [undefined, "positive", "negative", "unknown"],
  highParasiteDensity: [undefined, true],
  skinProblem: [undefined, "generalized", "localized"],
  measlesRash: [undefined, true],
  measlesRecent: [undefined, true],
  mouthUlcers: [undefined, "deep and extensive", "not deep and extensive"],
  pusFromEye: [undefined, true],
  corneaClouding: [undefined, true],
  vitaminARecent: [undefined, true],
};

// A small seeded random generator (mulberry32).
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const next = random(2024);
const samples: Assessment[] = Array.from({ length: 3000 }, () => {
  const data: Assessment = {};
  for (const [field, values] of Object.entries(choices)) {
    const value = values[Math.floor(next() * values.length)];
    if (value !== undefined) data[field] = value;
  }
  return data;
});

// The same definitions as the DAK, written independently of the ontology.
const hasFever = (d: Assessment) =>
  d.feverReported === true ||
  (d.thermometerNotAvailable === true && d.hotToTouch === true) ||
  (d.axillaryTemperature as number) >= 37.5 ||
  (d.rectalTemperature as number) >= 38;
const hasDangerSign = (d: Assessment) =>
  d.convulsingNow === true ||
  (d.convulsions === true && (d.convulsionCount === "two or more" || d.convulsionLong === true)) ||
  d.lethargic === true ||
  ((d.notAbleToDrink === true || d.vomitsEverything === true) && d.oralFluidTest === "completely unable to drink");
const hasCatarrhalSign = (d: Assessment) => d.cough === true || d.runnyNose === true || d.redEyes === true;
const hasMeasles = (d: Assessment) =>
  hasFever(d) &&
  ((hasCatarrhalSign(d) && d.skinProblem === "generalized" && d.measlesRash === true) || d.measlesRecent === true);
const byTable = (d: Assessment, table: string) => classify(d).find((r) => r.table === table);

test("a child without fever gets no result", () => {
  for (const d of samples.filter((d) => !hasFever(d))) expect(classify(d)).toEqual([]);
});

test("a child with fever always gets a result from the fever table", () => {
  for (const d of samples.filter(hasFever)) expect(byTable(d, "Fever")).toBeDefined();
});

test("fever and a danger sign or a stiff neck always give the pink row, whatever the other answers", () => {
  for (const d of samples.filter((d) => hasFever(d) && (hasDangerSign(d) || d.stiffNeck === true))) {
    expect(byTable(d, "Fever")?.classification?.label).toBe("VERY SEVERE FEBRILE DISEASE");
  }
});

test("each pink result tells to refer urgently", () => {
  for (const d of samples) {
    for (const r of classify(d).filter((r) => r.classification?.severity === "pink")) {
      expect(r.classification!.treatments).toContain("Refer URGENTLY to the hospital");
    }
  }
});

test("the fever table is pending only when the malaria risk or the malaria test result is missing", () => {
  for (const d of samples.filter(hasFever)) {
    if (byTable(d, "Fever")?.classification === undefined) {
      expect(d.malariaRisk === undefined || d.malariaTest === undefined).toBe(true);
    }
  }
});

test("malaria is unconfirmed whenever the test result is unknown or not asked for because of a severe classification", () => {
  for (const d of samples) {
    const malaria = byTable(d, "Fever")?.classification;
    if (malaria?.label !== "MALARIA") continue;
    const confirmed = !malaria.qualifiers.includes("Malaria unconfirmed (no test available or performed)");
    if (confirmed) expect(d.malariaTest).toBe("positive");
  }
});

test("the measles table is used exactly when the child has measles", () => {
  for (const d of samples) expect(byTable(d, "Measles") !== undefined).toBe(hasMeasles(d));
});

test("the results come in the order pink, yellow, green, then pending", () => {
  const rank = ["pink", "yellow", "green", undefined];
  for (const d of samples) {
    const ranks = classify(d).map((r) => rank.indexOf(r.classification?.severity));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  }
});

test("in rules.json, at most one row of each table matches, so the order of the rows does not matter", () => {
  const ajv = createAjv();
  for (const d of samples) {
    for (const table of rules.tables) {
      const matching = table.rows.filter((row) => ajv.validate(row.matchesWhen, d)).map((row) => row.label);
      expect(matching.length, `${table.label}: ${matching}`).toBeLessThanOrEqual(1);
    }
  }
});

test("the samples include all kinds of results", () => {
  const labels = new Set(samples.flatMap((d) => classify(d).map((r) => r.classification?.label ?? `${r.table}: pending`)));
  expect([...labels].sort()).toEqual([
    "FEVER",
    "FEVER: NO MALARIA",
    "Fever: pending",
    "MALARIA",
    "MEASLES",
    "MEASLES WITH EYE OR MOUTH COMPLICATIONS",
    "POSSIBLE BONE/JOINT INFECTION",
    "POSSIBLE URINE INFECTION",
    "SEVERE COMPLICATED MEASLES",
    "VERY SEVERE FEBRILE DISEASE",
  ]);
});
