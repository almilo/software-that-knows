// The path from an answer in OpenUI Lang to a decision, shared by the tests and `bun run eval`:
// parse the answer, take the facts of its ClaimCheck, ground them, then answer the questions that
// the check still asks from the test claim, as the person would.
import { createParser } from "@openuidev/react-lang";
import { testClaims } from "../claims/test-claims";
import { createClaim, type TestClaim } from "../engine/claim";
import type { Answers } from "../engine/model";
import { policy } from "../app/data";
import { ground } from "./grounding";
import { library } from "./library";

const claim = createClaim(policy);
const parser = createParser(library.toJSONSchema(), library.root);

type Node = { type?: string; typeName?: string; props?: Record<string, unknown> };

// The components of a parsed answer, in order.
function components(node: unknown, found: Node[] = []): Node[] {
  if (Array.isArray(node)) node.forEach((n) => components(n, found));
  else if (node && typeof node === "object") {
    const n = node as Node;
    if (n.type === "element") found.push(n);
    Object.values(n.props ?? {}).forEach((v) => components(v, found));
  }
  return found;
}

export function readAnswer(response: string) {
  const parsed = parser.parse(response);
  const used = components(parsed.root);
  const check = used.find((n) => n.typeName === "ClaimCheck");
  return { errors: parsed.meta.errors, used: used.map((n) => n.typeName!), facts: check?.props?.facts as Record<string, unknown> | undefined };
}

// The evaluation claims: the test claims with a question in the words of a user. A question can
// have more than one claim (21 and 21b); the first one is the expected reading.
export const evaluationClaims: TestClaim[] = testClaims.filter((c) => c.question);
export const expectedFor = (question: string) => evaluationClaims.find((c) => c.question === question);

export function decide(expected: TestClaim, facts: Record<string, unknown> | undefined) {
  const certificate = policy.certificates.find((c) => c.id === expected.certificate)?.answers ?? {};
  const { answers: understood, rejected } = ground(policy, facts, ["claim"]);
  // Facts that the person did not state but that the expected claim has: a wrong reading if the
  // model filled them in with another value.
  const contradicted = Object.entries(understood).filter(([id, v]) => expected.answers[id] !== undefined && expected.answers[id] !== v).map(([id]) => id);
  const answers: Answers = { ...certificate, ...understood };
  const first = claim.evaluate(answers);
  const asked: string[] = [];
  for (let next = claim.next(answers); next && expected.answers[next.id] !== undefined; next = claim.next(answers)) {
    answers[next.id] = expected.answers[next.id]!;
    asked.push(next.id);
  }
  const final = claim.evaluate(answers);
  return { rejected, contradicted, firstStatus: first.status, asked, status: final.status, cover: final.cover?.id };
}
