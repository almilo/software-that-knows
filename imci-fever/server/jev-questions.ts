// Typed questions for Jev (a System 1 model), generated from the ontology: one question for each
// form field that is not a number, with the field's question text (sh:name) and allowed values
// (sh:in), plus "not stated". Yes/no fields have three options: present, absent, not stated.
// Numbers (temperatures) are left to the typed values of the words.
import { fields, formOrder } from "../note/fields";

export const asked = formOrder.filter((f) => fields[f]!.type !== "number");

export function questions() {
  return Object.fromEntries(
    asked.map((f) => {
      const d = fields[f]!;
      const instructions = d.description ? `${d.title} (${d.description})` : d.title;
      const criteria: Record<string, string> = d.enum
        ? Object.fromEntries(d.enum.map((v, i) => [`option_${i}`, v]))
        : { present: "the note states that this is present (yes)", absent: "the note states that this is absent (no)" };
      return [f, { type: "choice" as const, instructions, criteria: { ...criteria, not_stated: "the note does not say" } }];
    }),
  );
}

// The form value for a chosen option, or undefined for "not stated".
export function decode(field: string, choice: string): unknown {
  if (choice === "not_stated") return undefined;
  if (choice === "present") return true;
  if (choice === "absent") return false;
  return fields[field]!.enum![Number(choice.replace("option_", ""))];
}
