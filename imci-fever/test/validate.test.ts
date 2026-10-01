// The form shows an error only for a field the user has touched (app/validate.ts).
import { expect, test } from "bun:test";
import { changedFields, errorsFor, fieldOf } from "../app/validate";

test("a required question that is not touched shows no error", () => {
  expect(errorsFor({ feverReported: true }, new Set())).toEqual([]);
});

test("a required question shows its error once touched", () => {
  const errors = errorsFor({ feverReported: true }, new Set(["malariaRisk"]));
  expect(errors.map(fieldOf)).toEqual(["malariaRisk"]);
});

test("a value out of range shows its error once touched", () => {
  const data = { axillaryTemperature: 10, malariaRisk: "high" };
  expect(errorsFor(data, new Set())).toEqual([]);
  expect(errorsFor(data, new Set(["axillaryTemperature"])).map(fieldOf)).toEqual(["axillaryTemperature"]);
});

test("changed fields are the ones whose value differs", () => {
  expect(changedFields({ cough: true, runnyNose: false }, { cough: true, runnyNose: true, redEyes: true })).toEqual(["runnyNose", "redEyes"]);
});
