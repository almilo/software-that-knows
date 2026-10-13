// The recommendation as a record in Markdown, for the person to keep: the context (the answers),
// the decision, where to start, its consequences (from the diagram), when to revisit it, and
// where the rules come from. In part 7 this was the architecture decision record; the words of
// the title and the appendix come from the domain.
import type { Answers, Decision } from "./decision";
import type { Explanation } from "./explain";

export function record(d: Decision, answers: Answers, e: Explanation, date: string) {
  const { domain } = d;
  const additionOptions = [...new Set(e.additions.map((a) => a.option.toLowerCase()))];
  return [
    `# ${domain.recordTitle}: ${e.option.label}${additionOptions.length ? `, with ${additionOptions.join(" and ")} parts` : ""}`,
    "",
    `Date: ${date}`,
    "",
    "## Context",
    "",
    ...d.criteria.filter((c) => c.key in answers).map((c) => `- ${c.label}${c.label.endsWith("?") ? "" : ":"} ${d.answerLabel(c.key, answers[c.key]!)}`),
    "",
    "## Decision",
    "",
    `${e.option.label}. “${e.rule.quote}”`,
    "",
    ...e.because.map((b) => `- ${b}`),
    ...(e.additions.length ? ["", ...e.additions.map((a) => `${a.option} for ${a.part}.`), "", `Tools: ${e.tools.join(", ")}.`] : []),
    ...e.cautions.flatMap((c) => ["", `**${c.label}.** ${c.explanation}`]),
    ...(e.ladder
      ? [
          "",
          `Start with ${e.option.label} at ${e.ladder.start.level.toLowerCase()} effort: ${e.ladder.start.explanation.toLowerCase()}.`,
          ...(e.ladder.next ? [`If the result falls short: ${ladderStep(d, e.ladder.next)}.`] : []),
        ]
      : []),
    "",
    "## Consequences",
    "",
    ...e.option.dimensions.filter((dim) => dim.characteristics.length).map((dim) => `- ${dim.label}: ${dim.characteristics.join("; ")}`),
    ...e.revisit.flatMap((r) => ["", `## Revisit: ${r.option.label} when`, "", ...r.when.map((w) => `- ${w}`)]),
    "",
    "## Sources",
    "",
    `The rules and the consequences are ${domain.author}'s, from "${domain.sourceTitle}" (${domain.source}), written down as an ontology.`,
    ...(domain.recordAppendix ? ["", domain.recordAppendix] : []),
    "",
  ].join("\n");
}

export function ladderStep(d: Decision, step: Decision["ladder"][number]) {
  return `${d.option(step.option).label} at ${step.level.toLowerCase()} effort, for ${step.explanation.toLowerCase()}`;
}
