// How an interpretation is scored against a case, the same for every interpreter (the words of the ontology, Jev,
// Claude, OpenAI). A case lists only the facts that the note states. An answer that follows
// clinically from a stated fact is an accepted inference: it counts neither as found nor as wrong.
import uischema from "../generated/uischema.json";
import type { Case } from "./phrases";

// Each inference: when the case has all the "when" answers, the "also" answers are accepted.
export const acceptedInferences: { when: Record<string, unknown>; also: Record<string, unknown>; why: string }[] = [
  { when: { convulsingNow: true }, also: { convulsions: true }, why: "a child convulsing now has convulsions in this illness" },
];

// The danger signs: the fields of the first tab of the form.
export const dangerSigns = uischema.elements[0]!.elements.map((c) => c.scope.replace("#/properties/", ""));

// invented: a danger sign proposed as present that the note does not state; denied: a danger sign
// proposed as absent that the note does not state as absent.
export type Score = { correct: number; expected: number; proposed: number; missed: number; wrong: number; invented: number; denied: number; full: boolean };

export function scoreCase(c: Case, got: Record<string, unknown>): Score {
  const inferred = (f: string) =>
    acceptedInferences.some((i) => Object.entries(i.when).every(([k, v]) => c.answers[k] === v) && i.also[f] !== undefined && i.also[f] === got[f]);
  const counted = Object.keys(got).filter((f) => !(f in c.answers && got[f] === c.answers[f]) && !inferred(f));
  const correct = Object.keys(c.answers).filter((f) => got[f] === c.answers[f]).length;
  const missed = Object.keys(c.answers).filter((f) => !(f in got)).length;
  return {
    correct,
    expected: Object.keys(c.answers).length,
    proposed: correct + counted.length,
    missed,
    wrong: counted.length,
    invented: counted.filter((f) => dangerSigns.includes(f) && got[f] === true).length,
    denied: counted.filter((f) => dangerSigns.includes(f) && got[f] === false).length,
    full: counted.length === 0 && missed === 0 && correct === Object.keys(c.answers).length,
  };
}

// One line of a results table: fully correct, found, correct of proposed, danger signs wrong
// (invented or denied).
export function summaryLine(label: string, scores: Score[]): string {
  const sum = (k: "correct" | "expected" | "proposed" | "invented" | "denied") => scores.reduce((n, s) => n + s[k], 0);
  const pct = (a: number, b: number) => `${a}/${b} (${b ? Math.round((100 * a) / b) : 100}%)`;
  return [label, `${scores.filter((s) => s.full).length}/${scores.length}`, pct(sum("correct"), sum("expected")), pct(sum("correct"), sum("proposed")), sum("invented") + sum("denied")].join("\t");
}
