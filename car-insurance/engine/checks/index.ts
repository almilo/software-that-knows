// The checks of the model. The generator runs them at build time and writes the report to
// generated/checks.json; the app shows it, and a test fails when a check finds an open problem.
//
// A finding is:
//   ok        the check passed for this item, for example two statements of the same number agree;
//   resolved  the document is unclear or contradicts itself here, and a precedence of the model
//             decides: from the text, or from our interpretation, which the insurer must confirm;
//   open      a problem that nothing decides: the app would give no answer, or a wrong one.
import type { TestClaim } from "../claim";
import type { Policy, Precedence } from "../model";
import { certificates } from "./certificates";
import { claims } from "./claims";
import { contradictions } from "./contradictions";
import { overview } from "./overview";
import { questions } from "./questions";
import { repeated } from "./repeated";
import { sources } from "./sources";
import { table } from "./table";

export type Finding = { status: "ok" | "resolved" | "open"; text: string; sources: string[]; basis?: Precedence["basis"]; resolution?: string };
// stats: numbers that the app shows, for example the questions per test claim.
export type Check = { id: string; title: string; what: string; why: string; findings: Finding[]; stats?: Record<string, number> };

// One file for each check, in the order of the report.
export function runChecks(policy: Policy, testClaims: TestClaim[]): Check[] {
  return [sources(policy), overview(policy), certificates(policy), questions(policy), contradictions(policy), repeated(policy), table(policy), claims(policy, testClaims)];
}

export function status(check: Check): Finding["status"] {
  return check.findings.some((f) => f.status === "open") ? "open" : check.findings.some((f) => f.status === "resolved") ? "resolved" : "ok";
}
