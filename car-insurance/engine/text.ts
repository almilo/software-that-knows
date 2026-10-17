// Words and formats that the engine, the report and the app share.
import type { ClaimResult } from "./claim";
import type { Condition, Fact, Policy } from "./model";

// The status of a claim: as a title (the app, the record), and short (the report).
export const statusWords: Record<ClaimResult["status"], { title: string; short: string }> = {
  open: { title: "Not decided yet", short: "undecided" },
  covered: { title: "Covered", short: "covered" },
  reduced: { title: "Covered, with a possible reduction", short: "covered, with a reduction" },
  excluded: { title: "Not covered: an exclusion applies", short: "excluded" },
  noCover: { title: "Not covered: no cover of the policy includes this event", short: "no cover" },
  notInsurable: { title: "Not covered: this cover is not insurable for this vehicle", short: "not insurable" },
  moduleNotActive: { title: "Not covered: the module is not in the policy", short: "module not in the policy" },
  notAgreed: { title: "Not covered: the option is not in the policy", short: "option not in the policy" },
};

// 12000 → 12'000, as in Switzerland.
export const chf = (x: number) => Math.round(x).toLocaleString("en-CH").replace(/,/g, "'");

// An answer in words: the label of a value, or a number with its unit.
export function answerText(fact: Fact, value: string | number) {
  if (fact.kind === "choice" || fact.kind === "yesno") return fact.values.find((v) => v.id === value)?.label ?? String(value);
  if (fact.unit === "CHF") return `CHF ${chf(Number(value))}`;
  return fact.unit ? `${value} ${fact.unit}` : String(value);
}

// Article numbers in reading order: 4.1 before 4.10, 202.3 before 202.3a before 202.4.
export const byArticle = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true });
export const article = (p: Policy, id: string) => p.articles.find((a) => a.id === id);
export const art = (p: Policy, id: string) => `Art. ${article(p, id)?.number ?? id}`;

// The conditions of a rule, in words, for the explorer and the report.
export function conditionText(p: Policy, c: Condition): string {
  if ("anyOf" in c) return c.anyOf.map((x) => conditionText(p, x)).join(" or ");
  const f = p.facts.find((x) => x.id === c.fact)!;
  const label = (id: string) => f.values.find((v) => v.id === id)?.label ?? id;
  if (c.in) return `${f.label} ${c.in.map(label).join(" / ")}`;
  if (c.notIn) return `${f.label} not ${c.notIn.map(label).join(" / ")}`;
  if (c.atLeast !== undefined) return `${f.label} at least ${c.atLeast}`;
  return `${f.label} below ${c.below}`;
}
