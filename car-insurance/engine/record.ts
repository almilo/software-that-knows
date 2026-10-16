// The decision of a claim as a record in Markdown, for the person to keep: the situation (the
// questions asked and their answers), the decision, the rules with their articles, the statements
// that a precedence set aside, and the amount.
import { chf } from "./benefit";
import type { Claim, ClaimResult } from "./claim";
import type { Answers, Policy } from "./model";

export const statusWords: Record<ClaimResult["status"], string> = {
  open: "Not decided yet",
  covered: "Covered",
  reduced: "Covered, with a possible reduction",
  excluded: "Not covered: an exclusion applies",
  noCover: "Not covered: no cover of the policy includes this event",
  notInsurable: "Not covered: this cover is not insurable for this vehicle",
  moduleNotActive: "Not covered: the module is not in the policy",
  notAgreed: "Not covered: the option is not in the policy",
};

export function record(policy: Policy, claim: Claim, answers: Answers, result: ClaimResult, date: string) {
  const art = (id: string) => `Art. ${policy.articles.find((a) => a.id === id)?.number ?? id}`;
  const arts = (ids: string[]) => ids.map(art).join(", ");
  const answer = (id: string) => {
    const f = claim.fact(id);
    const v = answers[id]!;
    return f.kind === "choice" ? f.values.find((x) => x.id === v)?.label ?? String(v) : `${f.unit === "CHF" ? `CHF ${chf(Number(v))}` : v}${f.unit && f.unit !== "CHF" ? ` ${f.unit}` : ""}`;
  };
  const decisive = result.applied.filter((a) => a.role !== "overridden");
  const setAside = result.applied.filter((a) => a.role === "overridden");
  return [
    `# Claim check: ${statusWords[result.status].toLowerCase()}`,
    "",
    `Date: ${date}`,
    "",
    "## Situation",
    "",
    ...claim.asked(answers).filter((f) => f.group === "claim").map((f) => `- ${f.label} ${answer(f.id)}`),
    "",
    "## Decision",
    "",
    `${statusWords[result.status]}${result.cover ? ` (${result.cover.label})` : ""}.`,
    "",
    ...decisive.map((a) => `- ${a.role === "covers" ? "Cover" : a.role === "excludes" ? "Exclusion" : "Reduction"}: ${a.rule.label} (${arts(a.rule.sources)})`),
    ...(setAside.length
      ? ["", "Set aside:", "", ...setAside.map((a) => `- ${a.rule.label} (${arts(a.rule.sources)}), because “${a.by!.rule.label}” wins. Basis: ${a.by!.precedence.basis === "text" ? "the text" : "our interpretation"}. ${a.by!.precedence.comment}`)]
      : []),
    ...(result.status === "reduced" ? ["", "The amount of the reduction depends on the degree of fault. A person at Zurich decides it."] : []),
    ...(result.amount
      ? [
          "",
          "## Amount",
          "",
          "| Step | CHF | Source |",
          "| --- | ---: | --- |",
          ...result.amount.steps.map((s) => `| ${s.label} | ${chf(s.amount)} | ${arts(s.sources)} |`),
          `| **${result.status === "reduced" ? "Payment, before the reduction" : "Payment"}** | **${chf(result.amount.payment)}** | |`,
          "",
          ...result.amount.notes.map((n) => `- ${n.text} (${arts(n.sources)})`),
        ]
      : []),
    ...(result.benefits?.length
      ? ["", "## Benefits", "", ...result.benefits.map((b) => `- ${b.label}${b.amount !== undefined ? `: CHF ${chf(b.amount)}${b.per ? ` per ${b.per}` : ""}` : ""} (${arts(b.sources)})`)]
      : []),
    "",
    "## Source",
    "",
    `${policy.source}. The rules are our reading of this document, written down as an ontology. This record is not a decision of the insurer.`,
    "",
  ].join("\n");
}
