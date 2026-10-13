// The checks of the behaviour of a decision, over every situation: every combination of answers
// to every question. They work on the rules alone, whatever form the rules had in the model.
//   gap            a situation where no choice rule applies: no recommendation;
//   overlap        a situation where two choice rules with conditions apply. The first one wins,
//                  so the app shows one recommendation, but the order hides the conflict: the
//                  check ignores the order;
//   never chosen   a choice rule that no situation leads to;
//   never applies  an addition or a caution that no situation shows;
//   ladder         a step of the ladder where the level of an option goes down.
import type { Answers, Decision } from "./decision";

export function verify(d: Decision) {
  const situations = d.completions({}, d.criteria.map((c) => c.key));
  const outcomes = situations.map((answers) => ({ answers, outcome: d.evaluate(answers) }));
  const withConditions = d.rules.choice.filter((r) => r.when.length);

  const gaps = outcomes.filter((o) => !o.outcome.choice).map((o) => ({ answers: o.answers, label: "no choice rule applies" }));
  const overlaps = situations.flatMap((answers) => {
    const apply = withConditions.filter((r) => r.when.every((c) => d.clauseState(c, answers) === "met")).map((r) => r.id);
    return apply.length > 1 ? [{ answers, label: `${apply.join(", ")} apply` }] : [];
  });
  const shown = new Set(outcomes.flatMap((o) => [o.outcome.choice, ...o.outcome.additions, ...o.outcome.cautions]));

  const findings = [
    ...describe(d, gaps).map((s) => `gap: ${s}`),
    ...describe(d, overlaps).map((s) => `overlap: ${s}`),
    ...d.rules.choice.filter((r) => !shown.has(r.id)).map((r) => `never chosen: ${r.id}`),
    ...[...d.rules.additions, ...d.rules.cautions].filter((r) => !shown.has(r.id)).map((r) => `never applies: ${r.id}`),
    ...ladder(d),
  ];
  return { situations: situations.length, findings };
}

function ladder(d: Decision) {
  return d.ladder.flatMap((step, i) => {
    const before = d.ladder.slice(0, i).findLast((s) => s.option === step.option);
    return before && before.levelOrder >= step.levelOrder
      ? [`ladder: ${d.option(step.option).label} goes from ${before.level} (${before.id}) to ${step.level} (${step.id})`]
      : [];
  });
}

// The situations of the findings in few words: the questions whose answer does not matter to a
// finding are left out. "finishedWork=yes, scoped=yes" stands for the 32 situations that have
// these two answers.
function describe(d: Decision, found: { answers: Answers; label: string }[]) {
  return [...Map.groupBy(found, (f) => f.label)].flatMap(([label, group]) => {
    let situations = group.map((f) => f.answers);
    for (const c of d.criteria) {
      const others = (a: Answers) => JSON.stringify({ ...a, [c.key]: undefined });
      const groups = Map.groupBy(situations, others);
      if ([...groups.values()].every((g) => g.length === c.answers.length)) {
        situations = [...groups.values()].map((g) => Object.fromEntries(Object.entries(g[0]!).filter(([k]) => k !== c.key)));
      }
    }
    return situations.map((a) => `${Object.entries(a).map(([k, v]) => `${k}=${v}`).join(", ")}: ${label}`);
  });
}
