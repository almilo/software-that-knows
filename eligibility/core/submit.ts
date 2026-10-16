// What a server would do with an application: check the answers against the generated schema,
// decide again with the same engine and model, and give a receipt or a refusal with the ids of the
// model (the page shows them in its language). In this demo the page calls it directly: nothing is
// sent and nothing is stored. A real server would also know who applies, read the data it already
// has instead of asking for it, use its own clock, and keep the application.
import { today, type Answers, type Evaluation } from "./engine";
import { fieldOf, type Validator } from "./validate";

export type Receipt = Pick<Evaluation, "values" | "findings" | "nextSteps"> & {
  reference: string;
  received: string; // date, YYYY-MM-DD
};
export type Refusal = {
  error: "invalid" | "incomplete" | "refused";
  details?: string[]; // the fields that are wrong or missing, or the findings that block
};
export type Reply = { receipt: Receipt } | { refusal: Refusal };

type Evaluate = (answers: Answers, date: string) => Evaluation;

export function createSubmit(evaluate: Evaluate, { validate }: Validator) {
  return function submit(answers: Answers, now = new Date(), reference = newReference) {
    if (!validate(answers)) return refuse("invalid", [...new Set((validate.errors ?? []).map(fieldOf))]);
    const e = evaluate(answers, today(now));
    if (e.missing.length > 0) return refuse("incomplete", e.missing);
    if (!e.allowed) return refuse("refused", e.findings.filter((f) => f.blocks).map((f) => f.id));
    const { values, findings, nextSteps } = e;
    return accept({ reference: reference(now), received: today(now), values, findings, nextSteps });
  };
}

function refuse(error: Refusal["error"], details: string[]): Reply {
  return { refusal: { error, details } };
}

function accept(receipt: Receipt): Reply {
  return { receipt };
}

function newReference(now: Date) {
  return `${now.getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}
