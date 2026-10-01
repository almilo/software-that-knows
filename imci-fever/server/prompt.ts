// What the language model gets: the form fields with their allowed values, the rules, one example,
// and the JSON Schema that its reply must follow. Everything comes from the generated files, so the
// model can only name real fields; check.ts then rejects values that a field does not allow.

import { fields, formOrder } from "../note/fields";

export type Message = { role: "system" | "user" | "assistant"; content: string };

// The reply: a list of answers. Each answer has the words from the note that support it, a field of
// the form and a value. The quote comes first, so the model writes the evidence before the value.
export function replySchema() {
  return {
    type: "object",
    properties: {
      answers: {
        type: "array",
        items: {
          type: "object",
          properties: {
            quote: { type: "string" },
            field: { type: "string", enum: formOrder },
            value: { anyOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }] },
          },
          required: ["quote", "field", "value"],
          additionalProperties: false,
        },
      },
    },
    required: ["answers"],
    additionalProperties: false,
  };
}

export function buildMessages(text: string): Message[] {
  return [
    { role: "system", content: system() },
    { role: "user", content: exampleNote },
    { role: "assistant", content: JSON.stringify({ answers: exampleAnswers }) },
    { role: "user", content: text },
  ];
}

function describe(field: string): string {
  const f = fields[field]!;
  const values = f.enum ? f.enum.map((v) => `"${v}"`).join(", ") : f.type === "boolean" ? "true, false" : "a number";
  return `- ${field}: ${f.title} [${values}]`;
}

function system() {
  return `You read a note that a health worker wrote about a sick child, and you fill in form fields. Reply with JSON only: {"answers": [{"quote": ..., "field": ..., "value": ...}]}.

Fields (id: question [allowed values]):
${formOrder.map(describe).join("\n")}

Rules:
- Add an answer only for a sign or a value that the note states. Leave out every field that the note does not mention.
- Use false when the note says that a sign is absent.
- quote: copy the exact words from the note that support the answer.
- If the note answers no field, reply with an empty list of answers.`;
}

const exampleNote = "She has had a fever for 10 days, every day. No convulsions. Temperature 38.9 under the arm.";
const exampleAnswers = [
  { quote: "has had a fever", field: "feverReported", value: true },
  { quote: "for 10 days", field: "feverDuration", value: "more than 7 days" },
  { quote: "every day", field: "feverEveryDay", value: true },
  { quote: "No convulsions", field: "convulsions", value: false },
  { quote: "38.9 under the arm", field: "axillaryTemperature", value: 38.9 },
];
