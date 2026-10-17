// The claim check: from the answers to a decision, with the rules that make it. It knows the words
// of an insurance policy (module, cover, exclusion, reduction, precedence), not this product: the
// product is the generated policy.
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

export type Benefit = { label: string; amount?: number; per?: string; sources: string[] };

export type ClaimResult = {
  status: Status;
  cover?: Cover;
  // The rules that hold and decide, in the order of the decision.
  applied: Applied[];
  // The facts that the decision still needs, then the facts that the amount needs.
  pending: string[];
  amountPending: string[];
  amount?: Amount;
  // What the cover pays, from the model and the certificate: for a cover without a calculation,
  // and for a cover that the policy does not include.
  benefits?: Benefit[];
};

// A test claim: the answers of a user, and the expected decision.
export type TestClaim = {
  name: string;
  // The certificate of the policy (an id of certificate.ttl). The answers of the claim come after
  // it and can replace its answers.
  certificate?: string;
  // For the evaluation claims: the question in the words of a user.
  question?: string;
  // For the claims that the app offers as examples: the label of the button.
  example?: string;
  answers: Answers;
  status: Status;
  cover?: string;
  // The rules that decide, and the rules that a precedence sets aside.
  rules?: string[];
  overridden?: string[];
  // The payment in CHF.
  payment?: number;
};

export type Claim = ReturnType<typeof createClaim>;

// A decided claim, or one that still needs answers.
const decided = (status: Status, applied: Applied[], more: Partial<ClaimResult> = {}): ClaimResult => ({ status, applied, pending: [], amountPending: [], ...more });
const open = (applied: Applied[], pending: string[], more: Partial<ClaimResult> = {}): ClaimResult => ({ ...decided("open", applied, more), pending: [...new Set(pending)] });

export function createClaim(policy: Policy) {
  // The questions of a claim, and the facts of the certificate: the app gives these, and the claim
  // check asks one only if the certificate misses it.
  const facts = policy.facts.filter((f) => f.group === "claim" || f.group === "certificate").sort((a, b) => a.order - b.order);
  const factById = new Map(facts.map((f) => [f.id, f]));
  const coverById = new Map(policy.covers.map((c) => [c.id, c]));
  const ruleById = new Map(policy.rules.map((r) => [r.id, r]));
  const modules = new Map(policy.modules.map((m) => [m.id, m]));
  const coverRules = policy.rules.filter((r) => r.kind === "cover");
  // Exclusions, reductions and the territory rules that exclude. Waivers, and the territory rules
  // that give cover, act only by winning over another rule.
  const effectRules = policy.rules.filter((r) => r.kind === "exclusion" || r.kind === "reduction" || (r.kind === "territory" && !r.covers));

  function evaluate(answers: Answers): ClaimResult {
    const required = facts.filter((f) => f.required && answers[f.id] === undefined).map((f) => f.id);
    if (required.length) return open([], required);

    // 1. The cover
    const coverRule = coverRules.find((r) => all(r.when, answers) === "met");
    if (!coverRule) {
      const undecided = coverRules.filter((r) => all(r.when, answers) === "open");
      return undecided.length ? open([], undecided.flatMap((r) => openFacts(r.when, answers))) : withoutCover(answers);
    }
    const cover = coverById.get(coverRule.covers!)!;
    const applied: Applied[] = [{ rule: coverRule, role: "covers" }];

    // 2. The policy: the module, then the option
    const availability = cover.availability[String(answers.vehicleClass)] ?? "none";
    if (availability === "none") return decided("notInsurable", applied, { cover });
    const inPolicy = [
      { needed: !modules.get(cover.module)?.mandatory, fact: facts.find((f) => f.moduleOf === cover.module), otherwise: "moduleNotActive" as const },
      { needed: availability === "option", fact: facts.find((f) => f.optionOf === cover.id), otherwise: "notAgreed" as const },
    ];
    for (const { fact, otherwise } of inPolicy.filter((x) => x.needed)) {
      const included = fact && answers[fact.id];
      if (fact && included === undefined) return open(applied, [fact.id], { cover });
      if (included !== YES) return decided(otherwise, applied, { cover, benefits: benefits(cover, answers) });
    }

    // 3 and 4. Exclusions and reductions, with precedence
    const effects = judge(cover.id, answers);
    applied.push(...effects.applied);
    if (applied.some((a) => a.role === "excludes")) return decided("excluded", applied, { cover });
    if (effects.pending.length) return open(applied, effects.pending, { cover });

    // 5. The amount, or the benefits
    const status = applied.some((a) => a.role === "reduces") ? "reduced" : "covered";
    if (!cover.calculation) return decided(status, applied, { cover, benefits: benefits(cover, answers) });
    const amountPending = facts
      .filter((f) => f.neededFor.includes(cover.calculation!) && answers[f.id] === undefined && all(f.askWhen, answers, true) === "met")
      .map((f) => f.id);
    return decided(status, applied, { cover, amountPending, ...(amountPending.length ? {} : { amount: calculate(policy, cover, answers) }) });
  }

  // The exclusions and reductions of a cover that hold, the ones that a precedence sets aside, and
  // the facts that can still change them.
  function judge(coverId: string, answers: Answers, rules = effectRules) {
    const applied: Applied[] = [];
    const pending: string[] = [];
    for (const r of rules.filter((r) => r.appliesTo.includes(coverId))) {
      const state = all(r.when, answers);
      if (state === "open") pending.push(...openFacts(r.when, answers));
      if (state !== "met") continue;
      const winners = winnersOver(r, coverId);
      const winner = winners.find((w) => all(w.rule.when, answers) === "met");
      if (winner) applied.push({ rule: r, role: "overridden", by: winner });
      else if (winners.some((w) => all(w.rule.when, answers) === "open")) pending.push(...winners.flatMap((w) => openFacts(w.rule.when, answers)));
      else applied.push({ rule: r, role: r.kind === "reduction" ? "reduces" : "excludes" });
    }
    return { applied, pending };
  }

  // The statements that win over a rule, for a cover.
  function winnersOver(r: Rule, coverId: string) {
    return policy.precedences
      .filter((p) => p.loser === r.id && ruleById.has(p.winner))
      .map((p) => ({ precedence: p, rule: ruleById.get(p.winner)! }))
      .filter((w) => w.rule.covers === coverId || w.rule.appliesTo.includes(coverId));
  }

  // No cover rule holds. If an exclusion of a cover that the event almost matched holds, it says
  // why: theft of fuel is not theft (Art. 204.7). Otherwise no cover of the policy includes it.
  function withoutCover(answers: Answers): ClaimResult {
    const near = [...new Set(coverRules.filter((r) => r.when.some((c) => all([c], answers) === "met")).map((r) => r.covers!))];
    const exclusions = effectRules.filter((r) => r.kind !== "reduction");
    const effects = near.map((c) => judge(c, answers, exclusions));
    const excluding = [...new Map(effects.flatMap((e) => e.applied).filter((a) => a.role === "excludes").map((a) => [a.rule.id, a])).values()];
    if (excluding.length) return decided("excluded", excluding);
    const pending = effects.flatMap((e) => e.pending);
    return pending.length ? open([], pending) : decided("noCover", []);
  }

  // The benefits of a cover, and the sums of the certificate for the covers of its module.
  function benefits(cover: Cover, answers: Answers): Benefit[] {
    const sameModule = new Set(policy.covers.filter((c) => c.module === cover.module).map((c) => c.id));
    return [
      ...policy.benefits.filter((b) => b.covers.includes(cover.id)).map((b) => ({ label: b.label, amount: b.limit, per: b.per, sources: b.sources })),
      ...facts
        .filter((f) => f.sumOf && sameModule.has(f.sumOf) && answers[f.id] !== undefined)
        .map((f) => ({ label: `${f.label}, in your policy`, amount: Number(answers[f.id]), sources: coverById.get(f.sumOf!)!.sources })),
    ];
  }

  // The next question: the first one, by the order of the model, that the decision or the amount
  // still needs. Undefined when the claim is decided and its amount calculated.
  function next(answers: Answers): Fact | undefined {
    const result = evaluate(answers);
    const needed = new Set([...result.pending, ...result.amountPending]);
    return facts.find((f) => needed.has(f.id));
  }

  // The questions that a claim asked, in order. Answers to questions that are no longer needed
  // (after a change) are left out.
  function asked(answers: Answers): Fact[] {
    const kept: Answers = {};
    const result: Fact[] = [];
    for (let f = next(kept); f && answers[f.id] !== undefined; f = next(kept)) {
      kept[f.id] = answers[f.id]!;
      result.push(f);
    }
    return result;
  }

  return { facts, fact: (id: string) => factById.get(id)!, evaluate, next, asked };
}

// The answers that the questions asked, without the ones that are no longer needed.
export function keep(claim: Claim, answers: Answers): Answers {
  return Object.fromEntries(claim.asked(answers).map((f) => [f.id, answers[f.id]!]));
}
