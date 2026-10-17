import type { Policy } from "../model";
import { art, article } from "../text";
import type { Check, Finding } from "./index";

// Every statement cites an article, and every article that a statement cites or refers to exists.
export function sources(p: Policy): Check {
  const statements: { id: string; label: string; sources: string[] }[] = [
    ...p.covers,
    ...p.rules,
    ...p.benefits,
    ...p.parameters,
    ...p.obligations,
    ...p.deadlines,
    ...p.closedLists,
    ...p.compensation.map((r) => ({ id: `year ${r.year}`, label: `Compensation table, year ${r.year}`, sources: r.sources })),
  ];
  const findings: Finding[] = [];
  for (const s of statements) {
    if (!s.sources.length) findings.push({ status: "open", text: `${s.label} cites no article.`, sources: [] });
    for (const id of s.sources.filter((id) => !article(p, id))) findings.push({ status: "open", text: `${s.label} cites Art. ${id}, which is not in the model.`, sources: [] });
  }
  for (const a of p.articles) {
    for (const id of a.refersTo.filter((id) => !article(p, id))) findings.push({ status: "open", text: `Art. ${a.number} refers to Art. ${id}, which is not in the model.`, sources: [a.id] });
  }
  // The reuse of exclusions: an article that refers to another one should have the rules of that
  // one among its own statements.
  for (const a of p.articles.filter((a) => a.refersTo.length)) {
    const reused = p.rules.filter((r) => r.sources.some((s) => a.refersTo.includes(s)));
    const cited = reused.filter((r) => r.sources.includes(a.id));
    if (cited.length) findings.push({ status: "ok", text: `${art(p, a.id)} uses ${a.refersTo.map((id) => art(p, id)).join(", ")}: ${cited.length} rules of the model are the same rules, with ${art(p, a.id)} among their sources.`, sources: [a.id, ...a.refersTo] });
  }
  const cited = new Set(statements.flatMap((s) => s.sources));
  findings.push({
    status: "ok",
    text: `${statements.length} statements cite ${cited.size} of the ${p.articles.length} articles of the model.`,
    sources: [],
  });
  return {
    id: "sources",
    title: "Every statement has its source",
    what: "Each cover, rule, benefit, number, obligation and deadline cites the articles it comes from, and each cited or referred article is in the model.",
    why: "A decision is only as good as its source. With the article on every statement, a person can check each step of a decision against the document.",
    findings,
  };
}
