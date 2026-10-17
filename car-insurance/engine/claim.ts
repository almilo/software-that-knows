// The claim check: from the answers to a decision, with the rules that make it. It knows the words
// of an insurance policy (cover, exclusion, reduction, precedence), not this product: the product is
// the generated policy.
//
// The decision, in order:
//   1. the cover: the first cover rule that holds says which cover the event is a case of;
//   2. the policy: the cover must be insurable for the vehicle class, its module must be in the
//      policy, and an optional cover must be in the policy too. The certificate gives these answers,
//      as yes or no;
//   3. the exclusions and territory rules of the cover: one that holds excludes the claim, unless a
//      precedence lets another statement that holds win over it;
//   4. the reductions: one that holds reduces the benefit, unless a waiver wins over it;
//   5. the amount (benefit.ts) for a cover with a calculation, when the answers for it are there;
//      the benefits of the cover, with the sums of the certificate, for a cover without one.
// A question is asked only when a rule that can still apply needs its answer: next() gives it.
import { type Amount, calculate } from "./benefit";
import { all, openFacts } from "./conditions";
import { type Answers, type Cover, type Fact, type Policy, type Precedence, type Rule, YES } from "./model";

export type Status = "open" | "covered" | "reduced" | "excluded" | "noCover" | "notInsurable" | "moduleNotActive" | "notAgreed";

export type Applied = {
  rule: Rule;
  role: "covers" | "excludes" | "reduces" | "overridden";
  // For an overridden rule: the statement that wins over it, and why.
  by?: { rule: Rule; precedence: Precedence };
};

export type ClaimResult = {
  status: Status;
  cover?: Cover;
  // The rules that hold and decide, in the order of the decision.
  applied: Applied[];
  // The facts that the decision still needs, then the facts that the amount needs.
  pending: string[];
  amountPending: string[];
  amount?: Amount;
  // For a cover without a calculation: what it pays, from the model and the certificate.
  benefits?: { label: string; amount?: number; per?: string; sources: string[] }[];
};

export type Claim = ReturnType<typeof createClaim>;

export function createClaim(policy: Policy) {
  // The questions of a claim, and the facts of the certificate: the app gives these, and the claim
  // check asks one only if the certificate misses it.
  const facts = policy.facts.filter((f) => f.group === "claim" || f.group === "certificate").sort((a, b) => a.order - b.order);
  const module = new Map(policy.modules.map((m) => [m.id, m]));
  const fact = new Map(facts.map((f) => [f.id, f]));
  const cover = new Map(policy.covers.map((c) => [c.id, c]));
  const rule = new Map(policy.rules.map((r) => [r.id, r]));
  const coverRules = policy.rules.filter((r) => r.kind === "cover");
  // Exclusions, reductions and the territory rules that exclude. Waivers, and the territory rules
  // that give cover, act only by winning over another rule.
  const effectRules = policy.rules.filter((r) => r.kind === "exclusion" || r.kind === "reduction" || (r.kind === "territory" && !r.covers));
  const winners = (r: Rule, coverId: string) =>
    policy.precedences
      .filter((p) => p.loser === r.id && rule.has(p.winner))
      .map((p) => ({ precedence: p, rule: rule.get(p.winner)! }))
      .filter((w) => w.rule.covers === coverId || w.rule.appliesTo.includes(coverId));

  function evaluate(answers: Answers): ClaimResult {
    const required = facts.filter((f) => f.required && answers[f.id] === undefined).map((f) => f.id);
    if (required.length) return open([], required);

    // 1. The cover
    const coverRule = coverRules.find((r) => all(r.when, answers) === "met");
    if (!coverRule) {
      const undecided = coverRules.filter((r) => all(r.when, answers) === "open");
      if (undecided.length) return open([], undecided.flatMap((r) => openFacts(r.when, answers)));
      return withoutCover(answers);
    }
    const c = cover.get(coverRule.covers!)!;
    const applied: Applied[] = [{ rule: coverRule, role: "covers" }];

    // 2. The policy
    const availability = c.availability[String(answers.vehicleClass)] ?? "none";
    if (availability === "none") return { status: "notInsurable", cover: c, applied, pending: [], amountPending: [] };
    if (!module.get(c.module)?.mandatory) {
      const fact = facts.find((f) => f.moduleOf === c.module);
      const included = fact && answers[fact.id];
      if (fact && included === undefined) return { ...open(applied, [fact.id]), cover: c };
      if (!fact || included !== YES) return { status: "moduleNotActive", cover: c, applied, pending: [], amountPending: [], benefits: benefits(c, answers) };
    }
    if (availability === "option") {
      const option = facts.find((f) => f.optionOf === c.id);
      const included = option && answers[option.id];
      if (option && included === undefined) return { ...open(applied, [option.id]), cover: c };
      if (!option || included !== YES) return { status: "notAgreed", cover: c, applied, pending: [], amountPending: [], benefits: benefits(c, answers) };
    }

    // 3 and 4. Exclusions and reductions, with precedence
    const pending: string[] = [];
    for (const r of effectRules.filter((r) => r.appliesTo.includes(c.id))) {
      const s = all(r.when, answers);
      if (s === "open") pending.push(...openFacts(r.when, answers));
      if (s !== "met") continue;
      const ws = winners(r, c.id);
      const winner = ws.find((w) => all(w.rule.when, answers) === "met");
      if (winner) applied.push({ rule: r, role: "overridden", by: winner });
      else if (ws.some((w) => all(w.rule.when, answers) === "open")) pending.push(...ws.flatMap((w) => openFacts(w.rule.when, answers)));
      else applied.push({ rule: r, role: r.kind === "reduction" ? "reduces" : "excludes" });
    }
    if (applied.some((a) => a.role === "excludes")) return { status: "excluded", cover: c, applied, pending: [], amountPending: [] };
    if (pending.length) return { ...open(applied, pending), cover: c };

    // 5. The amount
    const status = applied.some((a) => a.role === "reduces") ? "reduced" : "covered";
    if (!c.calculation) return { status, cover: c, applied, pending: [], amountPending: [], benefits: benefits(c, answers) };
    const amountPending = facts
      .filter((f) => f.neededFor.includes(c.calculation!) && answers[f.id] === undefined && all(f.askWhen, answers, true) === "met")
      .map((f) => f.id);
    return {
      status,
      cover: c,
      applied,
      pending: [],
      amountPending,
      ...(amountPending.length ? {} : { amount: calculate(policy, c, answers) }),
    };
  }

  // The benefits of a cover, and the sums of the certificate for the covers of its module.
  function benefits(c: Cover, answers: Answers): NonNullable<ClaimResult["benefits"]> {
    const sameModule = new Set(policy.covers.filter((x) => x.module === c.module).map((x) => x.id));
    return [
      ...policy.benefits.filter((b) => b.covers.includes(c.id)).map((b) => ({ label: b.label, amount: b.limit, per: b.per, sources: b.sources })),
      ...facts
        .filter((f) => f.sumOf && sameModule.has(f.sumOf) && answers[f.id] !== undefined)
        .map((f) => ({ label: `${f.label}, in your policy`, amount: Number(answers[f.id]), sources: cover.get(f.sumOf!)!.sources })),
    ];
  }

  // No cover rule holds. If an exclusion of a cover that the event almost matched holds, it says
  // why: theft of fuel is not theft (Art. 204.7). Otherwise no cover of the policy includes it.
  function withoutCover(answers: Answers): ClaimResult {
    const near = new Set(coverRules.filter((r) => r.when.some((c) => all([c], answers) === "met")).map((r) => r.covers!));
    const exclusions = effectRules.filter((r) => r.kind !== "reduction" && r.appliesTo.some((c) => near.has(c)));
    const holding = exclusions.filter((r) => all(r.when, answers) === "met");
    if (holding.length) return { status: "excluded", applied: holding.map((r) => ({ rule: r, role: "excludes" })), pending: [], amountPending: [] };
    const undecided = exclusions.filter((r) => all(r.when, answers) === "open");
    if (undecided.length) return open([], undecided.flatMap((r) => openFacts(r.when, answers)));
    return { status: "noCover", applied: [], pending: [], amountPending: [] };
  }

  function open(applied: Applied[], pending: string[]): ClaimResult {
    return { status: "open", applied, pending: [...new Set(pending)], amountPending: [] };
  }

  // The next question: the first one, by the order of the model, that the decision or the amount
  // still needs. Undefined when the claim is decided and its amount calculated.
  function next(answers: Answers): Fact | undefined {
    const r = evaluate(answers);
    const needed = new Set([...r.pending, ...r.amountPending]);
    return facts.find((f) => needed.has(f.id));
  }

  // The questions that a claim asked, in order, with their answers. Answers to questions that are
  // no longer needed (after a change) are left out.
  function asked(answers: Answers): Fact[] {
    const kept: Answers = {};
    const result: Fact[] = [];
    for (let f = next(kept); f && answers[f.id] !== undefined; f = next(kept)) {
      kept[f.id] = answers[f.id]!;
      result.push(f);
    }
    return result;
  }

  return { facts, fact: (id: string) => fact.get(id)!, cover: (id: string) => cover.get(id)!, rule: (id: string) => rule.get(id)!, evaluate, next, asked };
}

// The answers that the questions asked, without the ones that are no longer needed.
export function keep(claim: Claim, answers: Answers): Answers {
  return Object.fromEntries(claim.asked(answers).map((f) => [f.id, answers[f.id]!]));
}
