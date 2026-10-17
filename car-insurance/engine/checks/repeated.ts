import type { Policy } from "../model";
import { art } from "../text";
import type { Check, Finding } from "./index";

// The same number or benefit, stated twice.
export function repeated(p: Policy): Check {
  const findings: Finding[] = [];
  const groups = new Map<string, { id: string; label: string; value?: number; sources: string[] }[]>();
  const add = (key: string, s: { id: string; label: string; value?: number; sources: string[] }) => groups.set(key, [...(groups.get(key) ?? []), s]);
  for (const x of p.parameters) for (const m of x.mentions) add(m, { id: x.id, label: x.label, value: x.amount, sources: x.sources });
  for (const b of p.benefits) for (const m of b.mentions) for (const c of b.covers) add(`${m} ${c}`, { id: b.id, label: b.label, value: b.limit, sources: b.sources });
  for (const [key, statements] of groups) {
    if (statements.length < 2) continue;
    const [concept, cover] = key.split(" ");
    const name = `${p.concepts.find((c) => c.id === concept)?.label ?? concept}${cover ? ` (${p.covers.find((c) => c.id === cover)?.label})` : ""}`;
    const sources = [...new Set(statements.flatMap((s) => s.sources))];
    const values = statements.map((s) => (s.value === undefined ? "no limit" : String(s.value)));
    const where = statements.map((s, i) => `${s.sources.map((x) => art(p, x)).join(", ")}: ${values[i]}`).join("; ");
    if (new Set(values).size === 1) {
      findings.push({ status: "ok", text: `${name} is stated ${statements.length} times, and the statements agree (${where}).`, sources });
      continue;
    }
    const ids = statements.map((s) => s.id);
    const precedence = p.precedences.find((x) => ids.includes(x.winner) && ids.includes(x.loser));
    findings.push(
      precedence
        ? { status: "resolved", text: `${name} is stated ${statements.length} times, with different values (${where}).`, sources, basis: precedence.basis, resolution: precedence.comment }
        : { status: "open", text: `${name} is stated ${statements.length} times, with different values (${where}), and nothing says which one applies.`, sources },
    );
  }
  return {
    id: "repeated",
    title: "Repeated statements agree",
    what: "When the document states the same number or benefit in two places, the values must be the same.",
    why: "Documents grow by copy and edit. Two places that state the same limit can drift apart, and then the claim depends on which article the reader found first.",
    findings,
  };
}
