import { satisfiable } from "../conditions";
import type { Policy, Rule } from "../model";
import { art, byArticle } from "../text";
import type { Check, Finding } from "./index";

// The same thing covered by one statement and excluded by another.
export function contradictions(p: Policy): Check {
  const positive = (r: Rule) => r.kind === "cover" || r.kind === "waiver" || (r.kind === "territory" && !!r.covers);
  const scope = (r: Rule) => r.appliesTo;
  const findings: Finding[] = [];
  for (const concept of p.concepts) {
    const naming = p.rules.filter((r) => r.mentions.includes(concept.id));
    for (const plus of naming.filter(positive)) {
      for (const minus of naming.filter((r) => !positive(r))) {
        const both = scope(plus).filter((c) => scope(minus).includes(c));
        if (!both.length) continue;
        const sources = [...new Set([...plus.sources, ...minus.sources])].sort(byArticle);
        const pair = `“${plus.label}” (${plus.sources.map((s) => art(p, s)).join(", ")}) and “${minus.label}” (${minus.sources.map((s) => art(p, s)).join(", ")})`;
        if (!satisfiable([...plus.when, ...minus.when], p.facts)) {
          findings.push({ status: "ok", text: `${concept.label}: ${pair} never apply in the same situation. Their conditions keep them apart.`, sources });
          continue;
        }
        const precedence = p.precedences.find((x) => (x.winner === plus.id && x.loser === minus.id) || (x.winner === minus.id && x.loser === plus.id));
        findings.push(
          precedence
            ? { status: "resolved", text: `${concept.label}: ${pair} can apply in the same situation, with opposite effects.`, sources, basis: precedence.basis, resolution: precedence.comment }
            : { status: "open", text: `${concept.label}: ${pair} can apply in the same situation, with opposite effects, and nothing says which one wins.`, sources },
        );
      }
    }
  }
  return {
    id: "contradictions",
    title: "No contradictions between statements",
    what: "For each thing that the statements name (tyres, Europe, gross negligence…), the check compares the statements that cover it with the statements that exclude it. If their covers overlap and their conditions can hold together, the document must say which one wins.",
    why: "A person reads one article at a time. The model sees all statements about the same thing at once, so it finds where two articles say opposite things about the same claim.",
    findings,
  };
}
