// Finds the words of the ontology (generated/lexicon.json) in a note. Only general text handling
// lives here: splitting, matching, negation and durations in English. Which words mean which field
// or value comes from the ontology.
import generatedLexicon from "../generated/lexicon.json";
import { CLAUSE_BREAK, SENTENCE_BREAK } from "../shared/clauses";
import type { FieldWords, Lexicon } from "../shared/rules-contract";
import { fields, formOrder } from "./fields";

const lexicon: Lexicon = generatedLexicon;

export const wordsOf = (field: string): FieldWords => lexicon.fields[field]!;

// The parts of a note that one statement covers (the breaks are in shared/clauses.ts).
export function clauses(text: string): string[] {
  return normalize(text)
    .split(SENTENCE_BREAK)
    .flatMap((sentence) => sentence.split(CLAUSE_BREAK))
    .map((c) => c.trim())
    .filter(Boolean);
}

// Lower case, hyphens as spaces, one space between words.
export function normalize(s: string): string {
  return s.toLowerCase().replace(/[‐-―-]/g, " ").replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
}

// Where a word or phrase occurs as whole words, or -1.
export function find(text: string, phrase: string): number {
  const m = new RegExp(`(^|[^a-z0-9'])${escape(phrase)}(?=$|[^a-z0-9'])`).exec(text);
  return m ? m.index + m[1]!.length : -1;
}

export const mentions = (text: string, phrases: string[]) => phrases.some((p) => find(text, p) >= 0);

// The fields that a note mentions: any word of the field or of one of its values.
export function candidates(text: string): string[] {
  const t = normalize(text);
  return formOrder.filter((f) => {
    const w = wordsOf(f);
    return mentions(t, [...w.labels, ...w.absent, ...(w.values ?? []).flatMap((v) => v.labels)]);
  });
}

// What a clause states about a yes/no field: true, false, or undefined when it has no word for it.
// An absent label ("drinks well") or a negation just before a label ("no cough") states false. A
// word inside a longer one does not count: "able to drink" in "not able to drink" is not absent.
export function polarity(field: string, clause: string): boolean | undefined {
  const w = wordsOf(field);
  const found = [...w.labels.map((l) => hit(clause, l, true)), ...w.absent.map((l) => hit(clause, l, false))].filter((h) => h.at >= 0);
  const kept = found.filter((h) => !found.some((o) => o !== h && o.at <= h.at && o.at + o.length >= h.at + h.length && o.length > h.length));
  if (kept.length === 0) return undefined;
  if (kept.some((h) => !h.present)) return false;
  const first = Math.min(...kept.map((h) => h.at));
  return !NEGATION.test(clause.slice(Math.max(0, first - 25), first));
}

const hit = (clause: string, phrase: string, present: boolean) => ({ at: find(clause, phrase), length: phrase.length, present });

// The allowed value that a clause names with the most specific (longest) word, if any. The value
// itself counts as a word for it. A single word ("two", "positive") counts only in a clause that
// also has a word for the field ("two fits", "test positive"), so "two weeks" names no count.
export function namedValue(field: string, clause: string): string | undefined {
  const w = wordsOf(field);
  const aboutField = mentions(clause, w.labels);
  const matches = (w.values ?? []).flatMap((v) =>
    [...v.labels, v.value]
      .filter((l) => find(clause, l) >= 0 && (l.includes(" ") || aboutField))
      .map((l) => ({ v: v.value, l })),
  );
  return matches.sort((a, b) => b.l.length - a.l.length)[0]?.v;
}

// A duration in days in a clause: "3 days", "two weeks", "since yesterday".
export function days(clause: string): number | undefined {
  if (/since (this morning|last night|today)|\btoday\b/.test(clause)) return 0;
  if (/since yesterday|\byesterday\b/.test(clause)) return 1;
  const m = new RegExp(`\\b(\\d+|${Object.keys(NUMBERS).join("|")}) (day|days|week|weeks|month|months)\\b`).exec(clause);
  if (!m) return undefined;
  const n = /\d/.test(m[1]!) ? Number(m[1]) : NUMBERS[m[1]!]!;
  const d = n * (m[2]!.startsWith("week") ? 7 : m[2]!.startsWith("month") ? 30 : 1);
  // "more than a week", "over 7 days": longer than the number says.
  return /\b(more than|over|longer than)\s*$/.test(clause.slice(0, m.index)) ? d + 1 : d;
}

// The value of a field whose values are day ranges (imci:minDays, imci:maxDays), for a duration.
export function valueForDays(field: string, d: number): string | undefined {
  return wordsOf(field).values?.find((v) => (v.minDays === undefined || d >= v.minDays) && (v.maxDays === undefined || d <= v.maxDays))?.value;
}

export const hasDayRanges = (field: string) => (wordsOf(field).values ?? []).some((v) => v.minDays !== undefined || v.maxDays !== undefined);

// The numbers in a clause that the field allows (its minimum and maximum).
export function numbersFor(field: string, clause: string): number[] {
  const f = fields[field]!;
  return [...clause.matchAll(/\b\d+(\.\d+)?\b/g)]
    .map((m) => Number(m[0]))
    .filter((n) => (f.minimum === undefined || n >= f.minimum) && (f.maximum === undefined || n <= f.maximum));
}

const NEGATION = /\b(no|not|without|never|denies|none|hasn't|hasnt|didn't|doesn't|isn't|free of)\b|n't\b/;
const NUMBERS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fourteen: 14,
};

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
