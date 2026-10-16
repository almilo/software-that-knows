// The guide after an event: the obligations whose conditions hold, in the order of the model. An
// unanswered question counts as "no".
import { all } from "./conditions";
import type { Answers, Obligation, Policy } from "./model";

export function obligations(policy: Policy, answers: Answers): Obligation[] {
  return policy.obligations.filter((o) => all(o.when, answers, true) === "met");
}
