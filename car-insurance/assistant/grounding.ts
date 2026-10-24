// Grounding: the facts that the language model writes into a component are checked against the
// model before the engine sees them. A fact must exist, belong to a group that the component asks
// about, and have a value that the fact allows. Anything else is rejected, with the reason, and the
// component shows it: the model cannot invent a question, an answer or a part of the policy.
import type { Answers, Fact, Policy } from "../engine/model";

export type Rejected = { fact: string; value: unknown; reason: string };

export function ground(policy: Policy, facts: Record<string, unknown> | undefined, groups: Fact["group"][]): { answers: Answers; rejected: Rejected[] } {
  const answers: Answers = {};
  const rejected: Rejected[] = [];
  for (const [id, value] of Object.entries(facts ?? {})) {
    const fact = policy.facts.find((f) => f.id === id);
    const reason = !fact
      ? "no question of the model has this id"
      : fact.group === "certificate"
        ? "this comes from the certificate of the policy, not from the question"
        : !groups.includes(fact.group)
          ? `this component does not use ${fact.group} facts`
          : invalid(fact, value);
    if (reason) rejected.push({ fact: id, value, reason });
    else answers[id] = value as string | number;
  }
  return { answers, rejected };
}

// Why a value does not fit its fact, or undefined when it fits.
function invalid(fact: Fact, value: unknown): string | undefined {
  if (fact.kind === "number") return typeof value === "number" && Number.isFinite(value) && value >= 0 ? undefined : "not a number of 0 or more";
  if (fact.kind === "date") return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? undefined : "not a date as YYYY-MM-DD";
  return fact.values.some((v) => v.id === value) ? undefined : "not one of the answers of this question";
}
