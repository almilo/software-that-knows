// Interpreting a note with the words of the ontology: the words found in a note become form answers.
import { expect, test } from "bun:test";
import { interpretNote, typedValues } from "../note/interpret";
import { candidates, clauses, days, polarity } from "../note/words";

const answers = (text: string) => Object.fromEntries(interpretNote(text).proposals.map((p) => [p.field, p.value]));

test("a note is split into clauses, and a decimal point does not end a sentence", () => {
  expect(clauses("Fever for 3 days, temperature 38.9 under the arm. No cough and runny nose")).toEqual([
    "fever for 3 days", "temperature 38.9 under the arm", "no cough", "runny nose",
  ]);
});

test("a full stop after a number ends the sentence, but a decimal point does not", () => {
  expect(clauses("The temperature is 40. He has not slept. Temp 38.9")).toEqual(["the temperature is 40", "he has not slept", "temp 38.9"]);
});

test("the candidates are the fields that the note mentions with words of the ontology", () => {
  expect(candidates("No cough. RDT negative.")).toEqual(["cough", "malariaTest"]);
});

test("an absent label or a negation before a label states false", () => {
  expect(polarity("cough", "no cough")).toBe(false);
  expect(polarity("notAbleToDrink", "drinks well")).toBe(false);
  expect(polarity("notAbleToDrink", "not able to drink")).toBe(true);
  expect(polarity("cough", "cough since monday")).toBe(true);
  expect(polarity("cough", "runny nose")).toBeUndefined();
});

test("durations are taken in days", () => {
  expect([days("fever for 3 days"), days("for two weeks"), days("fever since yesterday"), days("fever")]).toEqual([3, 14, 1, undefined]);
});

test("temperatures are taken with their site, and durations as the day ranges of the values", () => {
  const text = "Fever for 10 days. Temperature 38.9 under the arm.";
  expect(typedValues(text, candidates(text)).map((p) => [p.field, p.value])).toEqual([
    ["axillaryTemperature", 38.9], ["feverDuration", "more than 7 days"],
  ]);
});

test("a temperature without its site is not taken, and a single-word value needs a word for its field", () => {
  expect(answers("The temperature is 40. Measles two months ago. High risk area.")).toEqual({ malariaRisk: "high" });
});

test("each answer quotes the clause of the note that it comes from", () => {
  expect(interpretNote("No vomiting. RDT positive.").proposals).toEqual([
    { field: "vomitsEverything", value: false, quote: "no vomiting" },
    { field: "malariaTest", value: "positive", quote: "rdt positive" },
  ]);
});

test("an answer that the form would not ask with the other answers is removed", () => {
  const r = interpretNote("No convulsions, two fits. Drinks well.");
  expect(Object.fromEntries(r.proposals.map((p) => [p.field, p.value]))).toEqual({ convulsions: false, notAbleToDrink: false });
  expect(r.rejected.map((x) => x.proposal)).toContainEqual(expect.objectContaining({ field: "convulsionCount" }));
});

test("more than, over or longer than a duration is longer than its number", () => {
  expect(days("fever for more than a week")).toBe(8);
  expect(days("fever for over 7 days")).toBe(8);
  expect(days("fever for a week")).toBe(7);
  expect(answers("Fever for more than a week.").feverDuration).toBe("more than 7 days");
});
