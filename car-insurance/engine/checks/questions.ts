import { factsOf, satisfiable } from "../conditions";
import type { Policy } from "../model";
import type { Check, Finding } from "./index";

// Every question of the claim check is used, and every cover rule can apply.
export function questions(p: Policy): Check {
  const findings: Finding[] = [];
  const used = new Set([
    ...p.rules.flatMap((r) => factsOf(r.when)),
    ...p.facts.flatMap((f) => factsOf(f.askWhen)),
  ]);
  const claimFacts = p.facts.filter((f) => f.group === "claim");
  for (const f of claimFacts) {
    const asked = f.required || f.askWhen.length > 0 || f.neededFor.length > 0 || used.has(f.id);
    if (!asked) findings.push({ status: "open", text: `The question "${f.label}" is never asked: no rule needs it.`, sources: [] });
    if (f.optionOf && !Object.values(p.covers.find((c) => c.id === f.optionOf)!.availability).includes("option"))
      findings.push({ status: "open", text: `The question "${f.label}" is about a cover that is an option for no vehicle class.`, sources: [] });
  }
  for (const r of p.rules) {
    if (!satisfiable(r.when, p.facts)) findings.push({ status: "open", text: `${r.label}: its conditions can never hold together.`, sources: r.sources });
    if (r.kind === "cover") {
      const c = p.covers.find((c) => c.id === r.covers)!;
      const classes = p.vehicleClasses.filter((v) => c.availability[v.id] !== "none" && satisfiable([...r.when, { fact: "vehicleClass", in: [v.id] }], p.facts));
      if (!classes.length) findings.push({ status: "open", text: `${r.label}: ${c.label} is not insurable for any vehicle class that the rule allows.`, sources: r.sources });
    }
  }
  if (!findings.length)
    findings.push({ status: "ok", text: `All ${claimFacts.length} questions of the claim check are used, and all ${p.rules.length} rules can apply in at least one situation.`, sources: [] });
  return {
    id: "questions",
    title: "No dead questions, no dead rules",
    what: "Every question of the claim check is needed by a rule or a calculation, and every rule can apply in at least one situation.",
    why: "A question that no rule needs wastes the user's time. A rule that can never apply is a mistake in the model, or in the document.",
    findings,
  };
}
