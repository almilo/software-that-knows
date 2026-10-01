// Checks the reply of the language model before anything reaches the form. The model only
// proposes. Code rejects each answer that names an unknown field, has a value that the field does
// not allow, or quotes words that are not in the text. A person confirms the rest.
import { visibleOnly, type Assessment } from "../app/classify";
import { fields, formOrder } from "./fields";

export type Proposal = { field: string; value: unknown; quote: string };
export type Rejected = { proposal: unknown; reason: string };
export type Interpretation = { proposals: Proposal[]; rejected: Rejected[] };

export function check(text: string, reply: string): Interpretation {
  const checked = parseAnswers(reply).map((p) => ({ p, reason: problem(p, text) }));
  const valid = checked.filter((c) => !c.reason).map((c) => c.p as Proposal);
  const proposals = valid
    .filter((p, i) => valid.findIndex((q) => q.field === p.field) === i)
    .map(({ field, value, quote }) => ({ field, value, quote }))
    // Form order, so that a field comes before the questions that it shows.
    .sort((a, b) => formOrder.indexOf(a.field) - formOrder.indexOf(b.field));
  const rejected = [
    ...checked.filter((c) => c.reason).map((c) => ({ proposal: c.p, reason: c.reason! })),
    ...valid.filter((p, i) => valid.findIndex((q) => q.field === p.field) !== i).map((p) => ({ proposal: p, reason: "a second answer for the same field" })),
  ];
  return { proposals, rejected };
}

// Adds confirmed proposals to the form data. An answer to a question that the form does not show
// for these answers (for example the number of convulsions, when there were none) is not kept.
export function apply(data: Assessment, proposals: Proposal[]): { data: Assessment; unused: Proposal[] } {
  const next = visibleOnly({ ...data, ...Object.fromEntries(proposals.map((p) => [p.field, p.value])) });
  return { data: next, unused: proposals.filter((p) => next[p.field] !== p.value) };
}

function parseAnswers(reply: string): unknown[] {
  try {
    const parsed = JSON.parse(reply) as { answers?: unknown };
    return Array.isArray(parsed.answers) ? parsed.answers : [];
  } catch {
    return [];
  }
}

function problem(answer: unknown, text: string): string | undefined {
  if (typeof answer !== "object" || answer === null) return "not an answer";
  const p = answer as Record<string, unknown>;
  const f = typeof p.field === "string" ? fields[p.field] : undefined;
  if (!f) return `unknown field ${String(p.field)}`;
  const v = p.value;
  if (f.enum ? !f.enum.includes(v as string) : f.type === "boolean" ? typeof v !== "boolean" : typeof v !== "number" || isNaN(v)) {
    return `the value ${JSON.stringify(v)} is not allowed`;
  }
  if (typeof v === "number" && ((f.minimum !== undefined && v < f.minimum) || (f.maximum !== undefined && v > f.maximum))) {
    return `${v} is outside ${f.minimum} to ${f.maximum}`;
  }
  const quote = typeof p.quote === "string" ? normalize(p.quote) : "";
  if (!quote) return "no quote from the text";
  if (!normalize(text).includes(quote)) return `the quote "${p.quote}" is not in the text`;
  return undefined;
}

// Lower case, one space between words, no punctuation at the ends: the model may change these.
function normalize(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").replace(/^[\s.,;:!?"']+|[\s.,;:!?"']+$/g, "");
}
