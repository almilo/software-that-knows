// Interprets a note with TypeSafe Jev, a System 1 model: one typed question for each field (from the
// ontology, jev-questions.ts), answered with a probability for each option. Jev writes no text, so
// its answers carry their confidence instead of a quote. Used by the local server and by eval/jev.
import { TypeSafeClient } from "@typesafe-ai/sdk";
import type { Proposal } from "../note/check";
import { asked, decode, questions } from "./jev-questions";

export const jevModel = "jev-latest";

export type Decision = { field: string; value: unknown; probability: number };
export type JevResult = { decisions: Decision[]; model: string; tokens: number; ms: number };

export async function interpretWithJev(client: TypeSafeClient, text: string): Promise<JevResult> {
  const t0 = performance.now();
  const r = await client.systemOne({ model: jevModel, state: text, questions: questions() });
  const answers = r.answers as Record<string, { choice: string; probabilities: Record<string, number> }>;
  const decisions = asked.flatMap((f): Decision[] => {
    const a = answers[f]!;
    const value = decode(f, a.choice);
    return value === undefined ? [] : [{ field: f, value, probability: a.probabilities[a.choice]! }];
  });
  return { decisions, model: r.model, tokens: r.usage?.input_tokens ?? 0, ms: performance.now() - t0 };
}

// The decisions at or above a confidence threshold, as proposals.
export function acceptedDecisions(decisions: Decision[], threshold: number): Proposal[] {
  return decisions
    .filter((d) => d.probability >= threshold)
    .map((d) => ({ field: d.field, value: d.value, quote: `Jev, confidence ${Math.round(d.probability * 100)}%` }));
}
