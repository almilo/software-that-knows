// Conditions on facts. A condition is met, failed, or open: open when a fact that it needs has no
// answer yet. The claim check asks a question only when an open condition needs its answer.
import type { Answers, Condition, Fact } from "./model";

export type State = "met" | "failed" | "open";

// closed: an answer that is missing will not come (the question was not asked because no rule
// needed it). Then "in" fails, "not in" holds, and a number range fails.
export function state(c: Condition, answers: Answers, closed = false): State {
  if ("anyOf" in c) {
    const states = c.anyOf.map((x) => state(x, answers, closed));
    return states.includes("met") ? "met" : states.includes("open") ? "open" : "failed";
  }
  const value = answers[c.fact];
  if (value === undefined) {
    if (!closed) return "open";
    return c.notIn && !c.in ? "met" : "failed";
  }
  const ok =
    (c.in === undefined || c.in.includes(String(value))) &&
    (c.notIn === undefined || !c.notIn.includes(String(value))) &&
    (c.atLeast === undefined || Number(value) >= c.atLeast) &&
    (c.below === undefined || Number(value) < c.below);
  return ok ? "met" : "failed";
}

// All conditions together: met when all are met, failed when one fails.
export function all(cs: Condition[], answers: Answers, closed = false): State {
  const states = cs.map((c) => state(c, answers, closed));
  return states.includes("failed") ? "failed" : states.includes("open") ? "open" : "met";
}

// The facts that a condition needs.
export function factsOf(cs: Condition[]): string[] {
  return cs.flatMap((c) => ("anyOf" in c ? factsOf(c.anyOf) : [c.fact]));
}

// The facts that a condition needs and that have no answer yet.
export function openFacts(cs: Condition[], answers: Answers) {
  return factsOf(cs.filter((c) => state(c, answers) === "open")).filter((f) => answers[f] === undefined);
}

// Can all these conditions hold at the same time? For the checks: two statements that can never
// apply in the same situation cannot contradict each other. Choice facts only; a condition on a
// number is taken as possible.
export function satisfiable(cs: Condition[], facts: Fact[]): boolean {
  const byId = new Map(facts.map((f) => [f.id, f]));
  // Each anyOf is a choice: try each of its conditions in turn.
  const expand = (list: Condition[]): Condition[][] => {
    const i = list.findIndex((c) => "anyOf" in c);
    if (i < 0) return [list];
    const any = list[i] as { anyOf: Condition[] };
    return any.anyOf.flatMap((option) => expand([...list.slice(0, i), option, ...list.slice(i + 1)]));
  };
  return expand(cs).some((conjunction) => {
    const allowed = new Map<string, Set<string>>();
    for (const c of conjunction as Exclude<Condition, { anyOf: Condition[] }>[]) {
      const fact = byId.get(c.fact);
      if (!fact || fact.kind !== "choice") continue;
      const current = allowed.get(c.fact) ?? new Set(fact.values.map((v) => v.id));
      const next = [...current].filter((v) => (c.in === undefined || c.in.includes(v)) && (c.notIn === undefined || !c.notIn.includes(v)));
      allowed.set(c.fact, new Set(next));
    }
    return [...allowed.values()].every((s) => s.size > 0);
  });
}
