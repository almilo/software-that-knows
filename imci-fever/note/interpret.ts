// Interprets a note as proposed form answers with the words of the ontology (generated/lexicon.json),
// without a language model. Three steps:
//   1  the fields that the note mentions (a word of the field or of one of its values)
//   2  their values: numbers and durations are taken as typed values (the temperature where the note
//      names its site, durations as the day ranges of the values); yes/no fields from their words and
//      negations ("no cough", "drinks well"); choices from the words of their values
//   3  structure: an answer that the form would not ask with the other answers is removed
// Each proposal quotes the clause of the note that it comes from.
import { apply, type Interpretation, type Proposal, type Rejected } from "./check";
import { fields, formOrder } from "./fields";
import type { Assessment } from "../app/classify";
import generatedRules from "../generated/rules.json";
import type { Rules } from "../shared/rules-contract";
import { candidates, clauses, days, hasDayRanges, mentions, namedValue, numbersFor, polarity, valueForDays, wordsOf } from "./words";

const rules: Rules = generatedRules;

export function interpretNote(text: string, data: Assessment = {}): Interpretation {
  const listed = candidates(text);
  const typed = typedValues(text, listed);
  const open = listed.filter((f) => !typed.some((t) => t.field === f));
  const r = structure({ proposals: [...typed, ...byWords(text, open)], rejected: [] }, data);
  const rank = (f: string) => formOrder.indexOf(f);
  return { ...r, proposals: [...r.proposals].sort((a, b) => rank(a.field) - rank(b.field)) };
}

// Numbers and durations, taken where the clause names the field.
export function typedValues(text: string, listed: string[]): Proposal[] {
  return listed.flatMap((field) => {
    const f = fields[field]!;
    const clause = clauses(text).find((c) => mentions(c, wordsOf(field).labels) && (f.type === "number" ? numbersFor(field, c).length > 0 : hasDayRanges(field) && days(c) !== undefined));
    if (!clause || (f.type !== "number" && !hasDayRanges(field))) return [];
    const value = f.type === "number" ? numbersFor(field, clause)[0] : valueForDays(field, days(clause)!);
    return value === undefined ? [] : [{ field, value, quote: clause }];
  });
}

// An answer that the form would not ask is removed, when the note states every answer that decides
// it (for example the number of convulsions, when the note says there were none). An answer whose
// question depends on answers that the note does not give is kept.
export function structure(r: Interpretation, data: Assessment): Interpretation {
  const { data: merged, unused } = apply(data, r.proposals);
  const all = { ...data, ...Object.fromEntries(r.proposals.map((p) => [p.field, p.value])) };
  // Decided: every answer that the question depends on is given, and is itself decided.
  const decided = (field: string): boolean =>
    fieldsIn(rules.shownWhen[field]).every((f) => f in all && (f === field || decided(f)));
  const removed = unused.filter((p) => decided(p.field) && !(p.field in merged));
  const reason = "the form does not ask this question with the other answers";
  return {
    proposals: r.proposals.filter((p) => !removed.includes(p)),
    rejected: [...r.rejected, ...removed.map((p): Rejected => ({ proposal: p, reason }))],
  };
}

// Yes/no fields from their words and negations, choices from the words of their values.
function byWords(text: string, listed: string[]): Proposal[] {
  return listed.flatMap((field): Proposal[] => {
    const isBoolean = fields[field]!.type === "boolean";
    const found = clauses(text)
      .map((clause) => ({ clause, value: isBoolean ? polarity(field, clause) : namedValue(field, clause) }))
      .find((c) => c.value !== undefined);
    return found ? [{ field, value: found.value, quote: found.clause }] : [];
  });
}

// The fields that a condition (a JSON Schema from rules.json) reads.
function fieldsIn(condition: unknown): string[] {
  if (typeof condition !== "object" || condition === null) return [];
  const c = condition as Record<string, unknown>;
  const own = c.properties && typeof c.properties === "object" ? Object.keys(c.properties) : [];
  return [...own, ...Object.values(c).flatMap((v) => (Array.isArray(v) ? v.flatMap(fieldsIn) : fieldsIn(v)))];
}
