// The checks of the model. The generator runs them at build time and writes the report to
// generated/checks.json; the app shows it, and a test fails when a check finds an open problem.
//
// A finding is:
//   ok        the check passed for this item, for example two statements of the same number agree;
//   resolved  the document is unclear or contradicts itself here, and a precedence of the model
//             decides: from the text, or from our interpretation, which the insurer must confirm;
//   open      a problem that nothing decides: the app would give no answer, or a wrong one.
import type { Case } from "../test/cases";
import { factsOf, satisfiable } from "./conditions";
import { type ClaimResult, createClaim } from "./claim";
import type { Answers, Condition, Policy, Precedence, Rule } from "./model";

export type Finding = { status: "ok" | "resolved" | "open"; text: string; sources: string[]; basis?: Precedence["basis"]; resolution?: string };
export type Check = { id: string; title: string; what: string; why: string; findings: Finding[] };

export function runChecks(policy: Policy, cases: Case[]): Check[] {
  return [sources(policy), overview(policy), questions(policy), contradictions(policy), repeated(policy), table(policy), claims(policy, cases)];
}

export function status(check: Check): Finding["status"] {
  return check.findings.some((f) => f.status === "open") ? "open" : check.findings.some((f) => f.status === "resolved") ? "resolved" : "ok";
}

const byArticle = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true });
const article = (p: Policy, id: string) => p.articles.find((a) => a.id === id);
const art = (p: Policy, id: string) => `Art. ${article(p, id)?.number ?? id}`;

// 1. Every statement cites an article, and every article that a statement cites or refers to exists.
function sources(p: Policy): Check {
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

// 2. The product overview has one status for every cover and every vehicle class.
function overview(p: Policy): Check {
  const findings: Finding[] = [];
  for (const c of p.covers) {
    const missing = p.vehicleClasses.filter((v) => !c.availability[v.id]);
    if (missing.length) findings.push({ status: "open", text: `${c.label}: no status for ${missing.map((v) => v.label.toLowerCase()).join(", ")}.`, sources: c.sources });
  }
  if (!findings.length) findings.push({ status: "ok", text: `${p.covers.length} covers × ${p.vehicleClasses.length} vehicle classes: each has exactly one status (basic, option or not insurable).`, sources: [] });
  return {
    id: "overview",
    title: "The product overview is complete",
    what: "For every cover and every vehicle class, the model says whether the cover is basic, an option, or not insurable.",
    why: "A gap in the overview is a claim that nobody can decide: is the cover in the policy or not?",
    findings,
  };
}

// 3. Every question of the claim check is used, and every cover rule can apply.
function questions(p: Policy): Check {
  const findings: Finding[] = [];
  const used = new Set([
    ...p.rules.flatMap((r) => factsOf(r.when)),
    ...p.facts.flatMap((f) => factsOf(f.askWhen)),
  ]);
  const claimFacts = p.facts.filter((f) => f.group === "claim");
  for (const f of claimFacts) {
    const asked = f.required || f.askWhen.length > 0 || f.optionOf !== undefined || used.has(f.id);
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

// 4. The same thing covered by one statement and excluded by another.
function contradictions(p: Policy): Check {
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

// 5. The same number or benefit, stated twice.
function repeated(p: Policy): Check {
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

// 6. The compensation table: one row per year, shares that never go up.
function table(p: Policy): Check {
  const findings: Finding[] = [];
  p.compensation.forEach((r, i) => {
    if (r.year !== i + 1) findings.push({ status: "open", text: `The compensation table has no row for year ${i + 1}.`, sources: r.sources });
    if (r.toShare > r.fromShare) findings.push({ status: "open", text: `Year ${r.year}: the share goes up during the year.`, sources: r.sources });
    const before = p.compensation[i - 1];
    if (before && r.fromShare > before.toShare) findings.push({ status: "open", text: `Year ${r.year} starts higher than year ${before.year} ends.`, sources: r.sources });
  });
  if (!findings.length)
    findings.push({
      status: "ok",
      text: `${p.compensation.length} years, from ${p.compensation[0]!.fromShare * 100}% to ${p.compensation.at(-1)!.toShare * 100}%: the share never goes up, so a total loss never pays more for an older vehicle.`,
      sources: ["203.2"],
    });
  return {
    id: "table",
    title: "The compensation table is consistent",
    what: "The table has one row for each year of service, and the share of the catalogue price never goes up.",
    why: "The engine calculates every total loss from this table. One wrong row changes the payment of every claim in that year.",
    findings,
  };
}

// 7. The test claims: the walk of each claim, one question at a time, gives the expected decision.
function claims(p: Policy, cases: Case[]): Check {
  const claim = createClaim(p);
  let questions = 0;
  const findings: Finding[] = cases.map((c) => {
    const answers: Answers = {};
    for (;;) {
      const next = claim.next(answers);
      if (!next) break;
      if (c.answers[next.id] === undefined) {
        const decided = claim.evaluate(answers).status !== "open";
        if (decided && c.payment === undefined) break;
        return { status: "open", text: `${c.name}: the claim check asks “${next.label}”, and the test claim has no answer.`, sources: [] };
      }
      answers[next.id] = c.answers[next.id]!;
      questions++;
    }
    const result = claim.evaluate(answers);
    const problems = expectations(c, result);
    const sources = [...new Set(result.applied.flatMap((a) => a.rule.sources))];
    return problems.length
      ? { status: "open", text: `${c.name}: ${problems.join("; ")}.`, sources }
      : { status: "ok", text: `${c.name}: ${describe(result)}, after ${Object.keys(answers).length} questions.`, sources };
  });
  findings.unshift({
    status: "ok",
    text: `${cases.length} test claims, ${questions} questions in all: ${(questions / cases.length).toFixed(1)} per claim, of the ${claim.facts.length} questions that the model has.`,
    sources: [],
  });
  return {
    id: "claims",
    title: "The test claims give the expected decisions",
    what: "Each test claim is walked as the app does: one question at a time, only the questions that can still change the decision. The status, the cover, the rules and the payment must be the expected ones.",
    why: "The test claims are the specification. When a change to the model changes a decision, a test claim shows it before a user does.",
    findings,
  };
}

function expectations(c: Case, r: ClaimResult) {
  const problems: string[] = [];
  const ids = (role: (a: ClaimResult["applied"][number]) => boolean) => r.applied.filter(role).map((a) => a.rule.id);
  if (r.status !== c.status) problems.push(`status ${r.status}, expected ${c.status}`);
  if (c.cover && r.cover?.id !== c.cover) problems.push(`cover ${r.cover?.id ?? "none"}, expected ${c.cover}`);
  for (const id of c.rules ?? []) if (!ids((a) => a.role !== "overridden").includes(id)) problems.push(`${id} does not apply`);
  for (const id of c.overridden ?? []) if (!ids((a) => a.role === "overridden").includes(id)) problems.push(`${id} is not set aside`);
  if (c.payment !== undefined && r.amount?.payment !== c.payment) problems.push(`payment ${r.amount?.payment ?? "none"}, expected ${c.payment}`);
  return problems;
}

function describe(r: ClaimResult) {
  const words: Record<string, string> = {
    covered: "covered",
    reduced: "covered, with a reduction",
    excluded: "excluded",
    noCover: "no cover",
    notInsurable: "not insurable",
    notAgreed: "option not in the policy",
    open: "undecided",
  };
  return `${words[r.status]}${r.cover ? ` (${r.cover.label})` : ""}${r.amount ? `, CHF ${r.amount.payment}` : ""}`;
}

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

