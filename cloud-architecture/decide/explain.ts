// The words of a recommendation, from the rules: what the team's answers met, and what would have
// to change for the next style. The app shows them; the ADR (adr.ts) writes them down.
import { type Answers, type Clause, clauseState, describeClause, type Outcome, rules, styles } from "./decide";

export type Explanation = ReturnType<typeof explain>;

export function explain(answers: Answers, outcome: Outcome) {
  const styleRule = rules.style.find((r) => r.id === outcome.style)!;
  return {
    style: style(styleRule.recommends!),
    rule: styleRule,
    // The team's answers that met the conditions; a rule without conditions has its explanation.
    because: styleRule.when.length ? styleRule.when.map((c) => metBy(c, answers)) : [styleRule.explanation],
    parts: rules.parts.filter((r) => outcome.parts.includes(r.id)).map((r) => ({ ...r, style: style(r.recommends!).label })),
    tools: outcome.tools,
    cautions: rules.cautions.filter((r) => outcome.cautions.includes(r.id)),
    revisit: revisit(answers, outcome),
  };
}

// For a style that a rule before it did not choose: the conditions of that rule that the answers
// do not meet yet. When they all hold, the recommendation changes.
function revisit(answers: Answers, outcome: Outcome) {
  const index = rules.style.findIndex((r) => r.id === outcome.style);
  const before = rules.style.slice(0, index);
  return before.map((rule) => ({
    style: style(rule.recommends!),
    when: rule.when.filter((c) => clauseState(c, answers) !== "met").map(describeClause),
  }));
}

// The answers that met a clause, not the clause: "Number of teams: More than three".
function metBy(clause: Clause, answers: Answers) {
  return clause
    .filter((atom) => atom.answers.includes(answers[atom.criterion]!))
    .map((atom) => describeClause([{ criterion: atom.criterion, answers: [answers[atom.criterion]!] }]))
    .join(", and ");
}

function style(id: string) {
  return styles.find((s) => s.id === id)!;
}
