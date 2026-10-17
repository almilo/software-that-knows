import { type ClaimResult, createClaim, type TestClaim } from "../claim";
import type { Answers, Policy } from "../model";
import { statusWords } from "../text";
import type { Check, Finding } from "./index";

// The test claims: the walk of each claim, one question at a time, gives the expected decision.
export function claims(p: Policy, cases: TestClaim[]): Check {
  const claim = createClaim(p);
  let questions = 0;
  const findings: Finding[] = cases.map((c) => {
    const given: Answers = { ...(c.certificate ? p.certificates.find((x) => x.id === c.certificate)!.answers : {}), ...c.answers };
    // The certificate is there before the first question, as in the app.
    const answers: Answers = Object.fromEntries(Object.entries(given).filter(([id]) => p.facts.find((f) => f.id === id)?.group === "certificate"));
    for (;;) {
      const next = claim.next(answers);
      if (!next) break;
      if (given[next.id] === undefined) {
        const decided = claim.evaluate(answers).status !== "open";
        if (decided && c.payment === undefined) break;
        return { status: "open", text: `${c.name}: the claim check asks “${next.label}”, and the test claim has no answer.`, sources: [] };
      }
      answers[next.id] = given[next.id]!;
      if (next.group === "claim") questions++;
    }
    const result = claim.evaluate(answers);
    const problems = expectations(c, result);
    const sources = [...new Set(result.applied.flatMap((a) => a.rule.sources))];
    return problems.length
      ? { status: "open", text: `${c.name}: ${problems.join("; ")}.`, sources }
      : { status: "ok", text: `${c.name}: ${describe(result)}, after ${claim.asked(answers).filter((f) => f.group === "claim").length} questions.`, sources };
  });
  const modelQuestions = claim.facts.filter((f) => f.group === "claim").length;
  const perClaim = Math.round((questions / cases.length) * 10) / 10;
  findings.unshift({
    status: "ok",
    text: `${cases.length} test claims, ${questions} questions in all: ${perClaim} per claim, of the ${modelQuestions} questions that the model has. The certificate gives the other facts.`,
    sources: [],
  });
  return {
    stats: { claims: cases.length, questionsPerClaim: perClaim, modelQuestions },
    id: "claims",
    title: "The test claims give the expected decisions",
    what: "Each test claim is walked as the app does: one question at a time, only the questions that can still change the decision. The status, the cover, the rules and the payment must be the expected ones.",
    why: "The test claims are the specification. When a change to the model changes a decision, a test claim shows it before a user does.",
    findings,
  };
}

function expectations(c: TestClaim, r: ClaimResult) {
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
  return `${statusWords[r.status].short}${r.cover ? ` (${r.cover.label})` : ""}${r.amount ? `, CHF ${r.amount.payment}` : ""}`;
}
