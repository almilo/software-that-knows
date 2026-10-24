// The tools that OpenUI's Query() calls: the engine of the demonstrator, behind the same grounding
// as the components. assess_claim decides a claim on the person's own policy, or on the policy with
// changes for a what-if ("and with legal protection?"). The language model chooses the facts and
// the changes; the tool grounds both, and the engine decides.
//
// Each result carries a proof: a random id that the tool issues and remembers. A view shows a result
// only with a proof that the tool issued, so a result that the language model writes itself, as a
// literal, is never shown as a decision.
import { createClaim } from "../engine/claim";
import type { Answers, Policy } from "../engine/model";
import { statusWords } from "../engine/text";
import { ground, type Rejected } from "./grounding";

export type Assessment = {
  proof: string;
  status: string;
  title: string;
  cover?: { label: string; sources: string[] };
  rules: { label: string; role: string; sources: string[] }[];
  payment?: number;
  // The next question that this decision needs, a claim fact id.
  next?: string;
  changes: Answers;
  rejected: Rejected[];
};

const issued = new Set<string>();
export const isIssued = (result: unknown): result is Assessment =>
  typeof result === "object" && result !== null && issued.has((result as Assessment).proof);

// The JSON Schema of the tool, for the system prompt.
export const assessClaimSpec = {
  name: "assess_claim",
  description:
    "Decides a claim with the rules of the policy. facts: the claim facts, usually $facts. changes: optional policy facts of the catalog, for a what-if on the person's own policy.",
  inputSchema: {
    type: "object",
    properties: { facts: { type: "object" }, changes: { type: "object" } },
    required: ["facts"],
  },
  outputSchema: {
    type: "object",
    properties: { status: { type: "string" }, title: { type: "string" }, payment: { type: "number" }, next: { type: "string" } },
  },
};

export function createTools(policy: Policy, certificate: Answers) {
  const claim = createClaim(policy);
  return {
    assess_claim: async (args: Record<string, unknown>): Promise<Assessment> => {
      const facts = ground(policy, args.facts as Record<string, unknown> | undefined, ["claim"]);
      const changes = ground(policy, args.changes as Record<string, unknown> | undefined, ["certificate"]);
      const answers = { ...certificate, ...changes.answers, ...facts.answers };
      const result = claim.evaluate(answers);
      const proof = crypto.randomUUID();
      issued.add(proof);
      return {
        proof,
        status: result.status,
        title: statusWords[result.status].title,
        cover: result.cover && { label: result.cover.label, sources: result.cover.sources },
        rules: result.applied.map((a) => ({ label: a.rule.label, role: a.role, sources: a.rule.sources })),
        payment: result.amount?.payment,
        next: claim.next(answers)?.id,
        changes: changes.answers,
        rejected: [...facts.rejected, ...changes.rejected],
      };
    },
  };
}
