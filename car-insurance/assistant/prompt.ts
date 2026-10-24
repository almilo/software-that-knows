// The system prompt: the rules of the assistant, the OpenUI syntax and components (from the
// library), and the catalog of the facts that it may fill in. Everything specific to the product
// comes from the generated policy and the test claims, so the prompt changes when the model does,
// and stays byte for byte the same between requests, which keeps it in the prompt cache.
import { testClaims } from "../claims/test-claims";
import type { Fact } from "../engine/model";
import { policy } from "../app/data";
import { library } from "./library";

// One line for each fact that the components can take, with its allowed values.
export function catalog(): string {
  const line = (f: Fact) => {
    const values = f.kind === "number" ? `a number${f.unit ? ` in ${f.unit}` : ""}` : f.values.map((v) => `${v.id} (${v.label})`).join("; ");
    return `- ${f.id}: ${f.label} → ${values}`;
  };
  const group = (g: Fact["group"]) =>
    policy.facts
      .filter((f) => f.group === g)
      .sort((a, b) => a.order - b.order)
      .map(line)
      .join("\n");
  return `## Fact catalog\n\nClaim facts, for ClaimCheck:\n${group("claim")}\n\nGuide facts, for Obligations (yes or no):\n${group("guide")}`;
}

// The examples: the test claims that the demonstrator offers as examples and that are not part of
// the evaluation, with only the facts of the claim (not those of the certificate).
function examples(): string[] {
  return testClaims
    .filter((c) => c.example && !c.question)
    .map((c) => ({ label: c.example!, facts: Object.entries(c.answers).filter(([id]) => policy.facts.some((f) => f.id === id && f.group === "claim")) }))
    .filter((c) => c.facts.length <= 3)
    .map((c) => `Person: ${c.label}\nroot = Answer([check])\ncheck = ClaimCheck({${c.facts.map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(", ")}})`);
}

const preamble = [
  `You are the assistant of a demonstrator for the motor vehicle insurance conditions "${policy.title}" (${policy.publisher}).`,
  "A person describes an event or asks a question. You answer with a screen built from the components below, in OpenUI Lang, and nothing else.",
  "You do not decide whether something is covered. The ClaimCheck component decides it with the rules of the policy and asks the questions that the decision still needs. Your job is to choose the components and to fill in the facts that the person stated.",
].join("\n");

const rules = [
  "Use only fact ids and value ids from the fact catalog. Never invent an id or a value.",
  "Fill in only the facts that the person stated, or that follow directly from their words. Leave out everything else: ClaimCheck asks for it.",
  "Never fill in facts about the policy itself (modules, options, sums insured, the vehicle class): they come from the certificate of the person's policy.",
  "Never write in your own words whether something is covered, an amount, a deadline or an obligation. The components show them, with their articles.",
  "Use at most one Note, of one or two short sentences.",
  "Use Obligations when the person describes an event that has already happened.",
  "If the question is not about this insurance, answer with one Note that says so, and no other component.",
];

export const systemPrompt = `${library.prompt({ preamble, additionalRules: rules, examples: examples() })}\n\n${catalog()}\n`;
