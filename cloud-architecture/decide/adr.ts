// The recommendation as an architecture decision record, in Markdown, for the team to keep with
// its code: the context (the answers), the decision, its consequences (from the diagram), when to
// revisit it, and where the rules come from.
import { type Answers, criteria, notSure } from "./decide";
import type { Explanation } from "./explain";

const source = "https://www.linkedin.com/feed/update/urn:li:activity:7514433067860582400/";

export function adr(answers: Answers, e: Explanation, date: string) {
  const partStyles = [...new Set(e.parts.map((p) => p.style.toLowerCase()))];
  return [
    `# Architecture style: ${e.style.label}${partStyles.length ? `, with ${partStyles.join(" and ")} parts` : ""}`,
    "",
    `Date: ${date}`,
    "",
    "## Context",
    "",
    ...criteria.filter((c) => c.key in answers).map((c) => `- ${c.label}: ${answerLabel(c, answers[c.key]!)}`),
    "",
    "## Decision",
    "",
    `${e.style.label}. “${e.rule.quote}”`,
    "",
    ...e.because.map((b) => `- ${b}`),
    ...(e.parts.length ? ["", ...e.parts.map((p) => `${p.style} for ${p.part}.`), "", `Tools: ${e.tools.join(", ")}.`] : []),
    ...e.cautions.flatMap((c) => ["", `**${c.label}.** ${c.explanation}`]),
    "",
    "## Consequences",
    "",
    ...e.style.dimensions.map((d) => `- ${d.label}: ${d.characteristics.join("; ")}`),
    ...e.revisit.flatMap((r) => ["", `## Revisit: ${r.style.label} when`, "", ...r.when.map((w) => `- ${w}`)]),
    "",
    "## Sources",
    "",
    `The rules are Alok Sharan's heuristics and the consequences his diagram "Microservices VS Serverless VS Modular Monolith" (${source}), written down as an ontology.`,
    "",
  ].join("\n");
}

function answerLabel(c: (typeof criteria)[number], code: string) {
  return code === notSure ? "Not sure" : c.answers.find((a) => a.code === code)!.label;
}
