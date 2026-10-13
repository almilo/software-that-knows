// The words of a recommendation, from the rules: what the answers met, what would have to change
// for another option, and where to start on the ladder. The app shows them; the record (record.ts)
// writes them down.
import type { Answers, Decision, Outcome } from "./decision";
import type { Clause } from "./model";

export type Explanation = ReturnType<typeof explain>;

export function explain(d: Decision, answers: Answers, outcome: Outcome) {
  const rule = d.rules.choice.find((r) => r.id === outcome.choice)!;
  const steps = d.ladder.filter((s) => s.option === rule.recommends);
  const start = d.ladder.indexOf(steps[0]!);
  return {
    option: d.option(rule.recommends!),
    rule,
    // The answers that met the conditions; a rule without conditions has its explanation.
    because: rule.when.length ? rule.when.map((c) => metBy(d, c, answers)) : [rule.explanation],
    additions: d.rules.additions.filter((r) => outcome.additions.includes(r.id)).map((r) => ({ ...r, option: d.option(r.recommends!).label })),
    tools: outcome.tools,
    cautions: d.rules.cautions.filter((r) => outcome.cautions.includes(r.id)),
    revisit: revisit(d, answers, rule.id),
    // Where to start on the ladder, and the step to take when the result falls short.
    ladder: steps.length ? { start: d.ladder[start]!, next: d.ladder[start + 1] } : undefined,
  };
}

// For the options closest to the answers: the conditions of their choice rules that the answers do
// not meet yet. When they all hold, the recommendation changes. The closest options are those of
// the other choice rules with conditions that need the fewest changes; in part 7 that is the one
// rule before the default.
function revisit(d: Decision, answers: Answers, chosen: string) {
  const others = d.rules.choice
    .filter((r) => r.id !== chosen && r.when.length)
    .map((rule) => ({ option: d.option(rule.recommends!), when: rule.when.filter((c) => d.clauseState(c, answers) !== "met") }));
  const fewest = Math.min(...others.map((o) => o.when.length));
  return others.filter((o) => o.when.length === fewest).map((o) => ({ option: o.option, when: o.when.map(d.describeClause) }));
}

// The answers that met a clause, not the clause: "Number of teams: More than three".
function metBy(d: Decision, clause: Clause, answers: Answers) {
  return clause
    .filter((atom) => atom.answers.includes(answers[atom.criterion]!))
    .map((atom) => d.describeClause([{ criterion: atom.criterion, answers: [answers[atom.criterion]!] }]))
    .join(", and ");
}
