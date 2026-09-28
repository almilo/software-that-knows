// One test for each path of the classification logic. The row IDs in the test names are the
// entries of the WHO DAK decision-support logic (CHE.DT.01 classifications, CHE.DT.03 treatments).
import { expect, test } from "bun:test";
import { classify } from "../app/classify";

type Data = Record<string, unknown>;
const labels = (data: Data) => classify(data).map((r) => r.classification?.label ?? `${r.table}: pending`);
const result = (data: Data, label: string) => classify(data).find((r) => r.classification?.label === label)!.classification!;
const treatments = (data: Data, label: string) => result(data, label).treatments;

const high = { feverReported: true, malariaRisk: "high" };
const low = { feverReported: true, malariaRisk: "low" };
const noRisk = { feverReported: true, malariaRisk: "no" };

test("no fever: no classification", () => {
  expect(labels({ axillaryTemperature: 37.4 })).toEqual([]);
});

test("fever: reported, hot to touch, axillary 37.5 °C or rectal 38.0 °C or above (CHE.B27.G.DE06)", () => {
  expect(labels({ axillaryTemperature: 37.5, malariaRisk: "no" })).toEqual(["FEVER"]);
  expect(labels({ rectalTemperature: 37.9, malariaRisk: "no" })).toEqual([]);
  expect(labels({ rectalTemperature: 38, malariaRisk: "no" })).toEqual(["FEVER"]);
  expect(labels({ thermometerNotAvailable: true, hotToTouch: true, malariaRisk: "no" })).toEqual(["FEVER"]);
});

test("danger signs: two or more convulsions or a long one, not one short convulsion (CHE.B27.G.DE01)", () => {
  expect(labels({ ...noRisk, convulsions: true, convulsionCount: "one" })).toEqual(["FEVER"]);
  expect(labels({ ...noRisk, convulsions: true, convulsionCount: "two or more" })).toEqual(["VERY SEVERE FEBRILE DISEASE"]);
  expect(labels({ ...noRisk, convulsions: true, convulsionCount: "one", convulsionLong: true })).toEqual([
    "VERY SEVERE FEBRILE DISEASE",
  ]);
});

test("danger signs: not able to drink counts only when the oral fluid test confirms it (CHE.B27.G.DE01)", () => {
  expect(labels({ ...noRisk, notAbleToDrink: true, oralFluidTest: "drinks poorly" })).toEqual(["FEVER"]);
  expect(labels({ ...noRisk, notAbleToDrink: true, oralFluidTest: "completely unable to drink" })).toEqual([
    "VERY SEVERE FEBRILE DISEASE",
  ]);
});

test("VERY SEVERE FEBRILE DISEASE: a danger sign or a stiff neck (CL84, CL85)", () => {
  expect(labels({ ...high, lethargic: true })).toEqual(["VERY SEVERE FEBRILE DISEASE"]);
  expect(labels({ ...high, stiffNeck: true })).toEqual(["VERY SEVERE FEBRILE DISEASE"]);
});

test("VERY SEVERE FEBRILE DISEASE: the antibiotic depends on the stiff neck, artesunate on the malaria risk (TR46-TR51)", () => {
  const vsfd = "VERY SEVERE FEBRILE DISEASE";
  expect(treatments({ ...high, stiffNeck: true }, vsfd)).toEqual([
    "Give first dose of artesunate (IM or rectal)",
    "Give first dose of ceftriaxone (IM)",
    "Treat the child to prevent low blood sugar",
    "Refer URGENTLY to the hospital",
  ]);
  expect(treatments({ ...noRisk, lethargic: true, axillaryTemperature: 38.5 }, vsfd)).toEqual([
    "Give first dose of ampicillin (IM) and gentamicin (IM)",
    "Treat the child to prevent low blood sugar",
    "Give one dose of paracetamol in the clinic for high fever (38.5 °C or above)",
    "Refer URGENTLY to the hospital",
  ]);
});

test("high fever is axillary 38.5 °C or rectal 39.0 °C or above", () => {
  const vsfd = "VERY SEVERE FEBRILE DISEASE";
  const paracetamol = "Give one dose of paracetamol in the clinic for high fever (38.5 °C or above)";
  expect(treatments({ ...noRisk, stiffNeck: true, rectalTemperature: 38.9 }, vsfd)).not.toContain(paracetamol);
  expect(treatments({ ...noRisk, stiffNeck: true, rectalTemperature: 39 }, vsfd)).toContain(paracetamol);
});

test("MALARIA: high risk, or low risk with travel or with no obvious cause, and a positive test (CL86, CL88, CL89)", () => {
  expect(labels({ ...high, malariaTest: "positive" })).toEqual(["MALARIA"]);
  expect(labels({ ...low, travelToHighRiskArea: true, malariaTest: "positive" })).toEqual(["MALARIA"]);
  expect(labels({ ...low, obviousCause: false, malariaTest: "positive" })).toEqual(["MALARIA"]);
  expect(treatments({ ...high, malariaTest: "positive" }, "MALARIA")).toEqual([
    "Give antimalarial medication: artemether with lumefantrine (oral), dose by weight",
    "Advise the caregiver when to return immediately",
    "Follow up in 3 days if fever persists",
  ]);
});

test("MALARIA, unconfirmed: no test available, then refer for assessment (CL96, TR56)", () => {
  const malaria = result({ ...high, malariaTest: "unknown" }, "MALARIA");
  expect(malaria.qualifiers).toEqual(["Malaria unconfirmed (no test available or performed)"]);
  expect(malaria.treatments).toContain("Refer to the hospital for assessment");
});

test("MALARIA, unconfirmed: another severe classification means no test (CL95, CL97, CL98)", () => {
  expect(labels({ ...high, otherSevereClassification: true })).toEqual(["MALARIA"]);
  expect(result({ ...high, otherSevereClassification: true }, "MALARIA").qualifiers).toEqual([
    "Malaria unconfirmed (no test available or performed)",
  ]);
  // A test result entered before is ignored, because the test is not asked for.
  expect(result({ ...high, otherSevereClassification: true, malariaTest: "negative" }, "MALARIA")).toBeDefined();
  expect(labels({ ...high, refusalToUseLimb: true })).toEqual(["POSSIBLE BONE/JOINT INFECTION", "MALARIA"]);
});

test("MALARIA: high parasite density and fever every day for more than 7 days are qualifiers (CL92-CL94)", () => {
  const long = { feverDuration: "more than 7 days", feverEveryDay: true };
  const malaria = result({ ...high, ...long, malariaTest: "positive", highParasiteDensity: true }, "MALARIA");
  expect(malaria.qualifiers).toEqual(["High parasite density", "Fever present every day for more than 7 days"]);
  expect(malaria.treatments).toContain("Refer to the hospital for assessment");
});

test("FEVER: NO MALARIA: a negative test, or low risk with an obvious cause and no travel (CL110-CL113)", () => {
  expect(labels({ ...high, malariaTest: "negative" })).toEqual(["FEVER: NO MALARIA"]);
  expect(labels({ ...low, travelToHighRiskArea: true, malariaTest: "negative" })).toEqual(["FEVER: NO MALARIA"]);
  expect(labels({ ...low, obviousCause: true })).toEqual(["FEVER: NO MALARIA"]);
  expect(treatments({ ...low, obviousCause: true }, "FEVER: NO MALARIA")).toEqual([
    "Give oral paracetamol",
    "Advise the caregiver when to return immediately",
    "Follow up in 3 days if fever persists",
  ]);
});

test("the classification waits for the malaria test, and for the malaria risk", () => {
  expect(labels(high)).toEqual(["Fever: pending"]);
  expect(labels({ ...low, travelToHighRiskArea: true })).toEqual(["Fever: pending"]);
  expect(labels({ feverReported: true })).toEqual(["Fever: pending"]);
  // A danger sign still gives the pink row, as it comes first for all risk levels.
  expect(labels({ feverReported: true, lethargic: true })).toEqual(["VERY SEVERE FEBRILE DISEASE"]);
});

test("FEVER: no malaria risk (CL115); travel is asked only in a low risk area (CHE.B12S1.DE19)", () => {
  expect(labels(noRisk)).toEqual(["FEVER"]);
  expect(labels({ ...noRisk, travelToHighRiskArea: true })).toEqual(["FEVER"]);
});

test("fever every day for more than 7 days: a qualifier and a referral for assessment (CL116, TR63)", () => {
  const fever = result({ ...noRisk, feverDuration: "more than 7 days", feverEveryDay: true }, "FEVER");
  expect(fever.qualifiers).toEqual(["Fever present every day for more than 7 days"]);
  expect(fever.treatments).toContain("Refer to the hospital for assessment");
  expect(result({ ...noRisk, feverDuration: "7 days or less" }, "FEVER").qualifiers).toEqual([]);
});

test("POSSIBLE BONE/JOINT INFECTION: refusal to use a limb, or a warm, tender or swollen joint or bone (CL107, CL108)", () => {
  expect(labels({ ...noRisk, warmTenderJoint: true })).toEqual(["POSSIBLE BONE/JOINT INFECTION", "FEVER"]);
  expect(treatments({ ...noRisk, warmTenderJoint: true }, "POSSIBLE BONE/JOINT INFECTION")).toEqual([
    "Give an antibiotic (IM or oral)",
    "Refer URGENTLY to the hospital",
  ]);
});

test("POSSIBLE URINE INFECTION: pain or difficulty passing urine (CL109, TR59)", () => {
  expect(labels({ ...noRisk, painPassingUrine: true })).toEqual(["POSSIBLE URINE INFECTION", "FEVER"]);
  expect(treatments({ ...noRisk, painPassingUrine: true }, "POSSIBLE URINE INFECTION")).toEqual([
    "Give an oral antibiotic",
    "Follow up in 3 days if fever persists, otherwise in 5 days",
    "Advise the caregiver when to return immediately",
  ]);
});

const measlesNow = { ...noRisk, cough: true, skinProblem: "generalized", measlesRash: true };

test("MEASLES: a generalized measles rash with cough, runny nose or red eyes, or measles in the last 3 months (CL159, CL160)", () => {
  expect(labels(measlesNow)).toEqual(["FEVER", "MEASLES"]);
  expect(labels({ ...noRisk, measlesRecent: true })).toEqual(["FEVER", "MEASLES"]);
  // Without cough, runny nose or red eyes, the skin is not asked about, so the rash does not count.
  expect(labels({ ...noRisk, skinProblem: "generalized", measlesRash: true })).toEqual(["FEVER"]);
  expect(treatments(measlesNow, "MEASLES")).toEqual([
    "Give vitamin A treatment: first dose in the clinic, one dose at home the next day",
  ]);
  expect(treatments({ ...measlesNow, vitaminARecent: true }, "MEASLES")).toEqual([]);
});

test("SEVERE COMPLICATED MEASLES: a danger sign, clouding of the cornea, or deep and extensive mouth ulcers (CL117-CL120)", () => {
  expect(labels({ ...measlesNow, corneaClouding: true })).toEqual(["SEVERE COMPLICATED MEASLES", "FEVER"]);
  expect(labels({ ...measlesNow, mouthUlcers: "deep and extensive" })).toEqual(["SEVERE COMPLICATED MEASLES", "FEVER"]);
  expect(treatments({ ...measlesNow, corneaClouding: true }, "SEVERE COMPLICATED MEASLES")).toEqual([
    "Give vitamin A treatment: first dose in the clinic, one dose at home the next day",
    "Give first dose of amoxicillin (oral)",
    "Give first dose of tetracycline eye ointment",
    "Refer URGENTLY to the hospital",
  ]);
  expect(treatments({ ...measlesNow, lethargic: true }, "SEVERE COMPLICATED MEASLES")).toContain(
    "Give first dose of ampicillin (IM) and gentamicin (IM)",
  );
});

test("MEASLES WITH EYE OR MOUTH COMPLICATIONS: pus from the eye, or mouth ulcers that are not deep (CL139-CL141)", () => {
  const eyeAndMouth = { ...measlesNow, pusFromEye: true, mouthUlcers: "not deep and extensive" };
  expect(labels(eyeAndMouth)).toEqual(["MEASLES WITH EYE OR MOUTH COMPLICATIONS", "FEVER"]);
  expect(treatments(eyeAndMouth, "MEASLES WITH EYE OR MOUTH COMPLICATIONS")).toEqual([
    "Give vitamin A treatment: first dose in the clinic, one dose at home the next day",
    "Tetracycline eye ointment, four times daily for 7 days",
    "For mouth ulcers, treat with half-strength gentian violet four times daily for 7 days",
    "Follow up in 3 days",
    "Advise the caregiver when to return immediately",
  ]);
});

test("the values of hidden fields do not change the result", () => {
  // The malaria test is hidden when there is no malaria risk, so its old value must not count.
  expect(labels({ ...noRisk, malariaTest: "positive" })).toEqual(["FEVER"]);
  // Travel is hidden when there is a danger sign.
  expect(labels({ ...low, lethargic: true, travelToHighRiskArea: true, obviousCause: true })).toEqual([
    "VERY SEVERE FEBRILE DISEASE",
  ]);
});

test("each result names the DAK entries it comes from", () => {
  expect(result({ ...high, stiffNeck: true }, "VERY SEVERE FEBRILE DISEASE").derivedFrom).toEqual(
    expect.arrayContaining(["CHE.DT.01.CL84", "CHE.DT.01.CL85", "CHE.DT.03.TR46", "CHE.DT.03.TR50"]),
  );
  expect(classify(noRisk)[0]!.source).toBe("WHO DAK child health (2024), Web Annex B: decision-support logic");
});
