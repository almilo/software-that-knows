// The language model only proposes answers. These tests check the code around it, with replies
// written by hand: what reaches the form, and what is rejected.
import { expect, test } from "bun:test";
import { createAjv } from "@jsonforms/core";
import { heldOut } from "../eval/held-out";
import { cases } from "../eval/phrases";
import { fields, formOrder } from "../note/fields";
import { apply, check } from "../note/check";
import { buildMessages, replySchema } from "../server/prompt";

const text = "He has had fever for 3 days, he is very sleepy and he does not drink.";
const reply = (answers: unknown[]) => JSON.stringify({ answers });

test("valid answers become proposals, in form order", () => {
  const r = check(
    text,
    reply([
      { quote: "for 3 days", field: "feverDuration", value: "7 days or less" },
      { quote: "has had fever", field: "feverReported", value: true },
      { quote: "very sleepy", field: "lethargic", value: true },
      { quote: "does not drink", field: "notAbleToDrink", value: true },
    ]),
  );
  expect(r.proposals.map((p) => p.field)).toEqual(["lethargic", "notAbleToDrink", "feverReported", "feverDuration"]);
  expect(r.rejected).toEqual([]);
});

test("a quote that is not in the text is rejected: the model cannot invent evidence", () => {
  const r = check(text, reply([{ quote: "stiff neck", field: "stiffNeck", value: true }]));
  expect(r.rejected[0]!.reason).toContain("is not in the text");
});

test("the quote may differ in case, spaces and end punctuation", () => {
  const r = check(text, reply([{ quote: "Very  sleepy,", field: "lethargic", value: true }]));
  expect(r.proposals.length).toBe(1);
});

test("unknown fields, wrong values, values out of range and second answers are rejected", () => {
  const r = check(
    "temperature 51, risk very high, dose 5 ml, temperature 38",
    reply([
      { quote: "temperature 51", field: "axillaryTemperature", value: 51 },
      { quote: "risk very high", field: "malariaRisk", value: "very high" },
      { quote: "dose 5 ml", field: "dose", value: 5 },
      { quote: "temperature 38", field: "rectalTemperature", value: 38 },
      { quote: "temperature 38", field: "rectalTemperature", value: 38.5 },
    ]),
  );
  expect(r.rejected.map((x) => x.reason)).toEqual([
    "51 is outside 30 to 44",
    'the value "very high" is not allowed',
    "unknown field dose",
    "a second answer for the same field",
  ]);
});

test("a reply that is not JSON gives no proposals", () => {
  expect(check("x", "not json")).toEqual({ proposals: [], rejected: [] });
});

test("confirmed proposals are added to the form data; an answer to a hidden question is not used", () => {
  const r = check(
    "one convulsion, hot to touch",
    reply([
      { quote: "one convulsion", field: "convulsions", value: true },
      { quote: "one convulsion", field: "convulsionCount", value: "one" },
      { quote: "hot to touch", field: "hotToTouch", value: true },
    ]),
  );
  const { data, unused } = apply({ feverReported: true }, r.proposals);
  expect(data).toEqual({ feverReported: true, convulsions: true, convulsionCount: "one" });
  expect(unused.map((p) => p.field)).toEqual(["hotToTouch"]);
});

test("the reply schema allows only fields of the form; check.ts rejects values that a field does not allow", () => {
  const ajv = createAjv();
  expect(ajv.validate(replySchema(), { answers: [{ quote: "x", field: "malariaRisk", value: "high" }] })).toBe(true);
  expect(ajv.validate(replySchema(), { answers: [{ quote: "x", field: "dose", value: 5 }] })).toBe(false);
  expect(check("x", reply([{ quote: "x", field: "malariaRisk", value: "very" }])).rejected).toHaveLength(1);
});

test("the prompt lists every field, and its examples follow the output schema and quote their text", () => {
  const messages = buildMessages("hello");
  Object.keys(fields).forEach((field) => expect(messages[0]!.content).toContain(`- ${field}:`));
  const ajv = createAjv();
  messages.slice(1, -1).forEach((m, i, rest) => {
    if (m.role !== "user") return;
    const example = rest[i + 1]!.content;
    expect(ajv.validate(replySchema(), JSON.parse(example))).toBe(true);
    expect(check(m.content, example).rejected).toEqual([]);
  });
});

test("the expected answers of the eval use real fields and allowed values", () => {
  cases.forEach((c) => {
    const answers = Object.entries(c.answers).map(([field, value]) => ({ quote: c.text, field, value }));
    expect(check(c.text, reply(answers)).rejected).toEqual([]);
  });
});

test("the expected answers of the held-out notes use real fields and allowed values", () => {
  heldOut.forEach((c) => {
    const answers = Object.entries(c.answers).map(([field, value]) => ({ quote: c.text, field, value }));
    expect(check(c.text, reply(answers)).rejected).toEqual([]);
  });
});
