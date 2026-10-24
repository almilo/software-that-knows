// The system prompt: the rules of the assistant, the OpenUI syntax, components and tool (from the
// library), and the catalog of the facts that it may fill in. Everything specific to the product
// comes from the generated policy and the test claims, so the prompt changes when the model does,
// and stays byte for byte the same between requests, which keeps it in the prompt cache.
import { testClaims } from "../claims/test-claims";
import type { Fact } from "../engine/model";
import { policy } from "../app/data";
import { library } from "./library";
import { assessClaimSpec } from "./tools";

// One line for each fact that the components and the tool can take, with its allowed values.
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
  return [
    "## Fact catalog",
    `Claim facts, for $facts:\n${group("claim")}`,
    `Guide facts, for Obligations (yes or no):\n${group("guide")}`,
    `Policy facts, only for the changes of a what-if Query of assess_claim:\n${group("certificate")}`,
  ].join("\n\n");
}

// The test claims that the demonstrator offers as examples and that are not part of the evaluation,
// with only the facts of the claim (not those of the certificate).
const exampleClaims = testClaims
  .filter((c) => c.example && !c.question)
  .map((c) => ({ ...c, facts: Object.entries(c.answers).filter(([id]) => policy.facts.some((f) => f.id === id && f.group === "claim")) }))
  .filter((c) => c.facts.length <= 3);
const factsLiteral = (facts: [string, string | number][]) => `{${facts.map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(", ")}}`;

function examples(): string[] {
  return exampleClaims.map((c) => `Person: ${c.example}\nroot = Answer([check])\n$facts = ${factsLiteral(c.facts)}\ncheck = ClaimCheck($facts)`);
}

// A what-if: an example claim, and the policy fact that adds the module or the option of its cover.
function toolExamples(): string[] {
  const found = exampleClaims
    .map((c) => {
      const cover = policy.covers.find((v) => v.id === c.cover);
      const fact = cover && policy.facts.find((f) => f.group === "certificate" && (f.optionOf === cover.id || f.moduleOf === cover.module));
      return fact && { c, fact };
    })
    .find(Boolean);
  if (!found) return [];
  const { c, fact } = found;
  return [
    [
      `Person: ${c.example}. And with ${fact.label}?`,
      "root = Answer([check, whatIf])",
      `$facts = ${factsLiteral(c.facts)}`,
      "check = ClaimCheck($facts)",
      `withChange = Query("assess_claim", {facts: $facts, changes: {${fact.id}: "Yes"}}, {status: "open"})`,
      `whatIf = Columns([Verdict("With ${fact.label}", withChange, $facts)])`,
    ].join("\n"),
  ];
}

const preamble = [
  `You are the assistant of a demonstrator for the motor vehicle insurance conditions "${policy.title}" (${policy.publisher}).`,
  "A person describes an event or asks a question. You answer with a screen built from the components below, in OpenUI Lang, and nothing else.",
  "You do not decide whether something is covered. The ClaimCheck component and the assess_claim tool decide it with the rules of the policy, and ask the questions that the decision still needs. Your job is to choose the components and to fill in the facts that the person stated.",
].join("\n");

const rules = [
  "Only the components listed above exist. There is no Button, Select, Form, Input or TextContent.",
  "Declare the claim facts once, as the object $facts, and pass $facts to ClaimCheck, to every Query and to every Verdict. $facts is the one variable that holds an object.",
  "Use only fact ids and value ids from the fact catalog. Never invent an id or a value.",
  "Fill in only the facts that the person stated, or that follow directly from their words. Leave out everything else: the components ask for it.",
  "Never put policy facts (modules, options, sums insured, the vehicle class) into $facts: they come from the certificate of the person's policy. Use them only in the changes of a what-if Query.",
  "For a what-if (another module or option, or the person asks what would change), add a Query of assess_claim with the changes, and show it with Verdict inside Columns, next to ClaimCheck. Never write a result of assess_claim yourself.",
  "You cannot call the tool yourself: Query calls it in the app. Use {status: \"open\"} as the default data. Ignore the advice above to inspect data with a tool first, or to use mock data: there is no mock data here.",
  "Never write in your own words whether something is covered, an amount, a deadline or an obligation. The components show them, with their articles.",
  "Use at most one Note, of one or two short sentences.",
  "Use Obligations when the person describes an event that has already happened.",
  "If the question is not about this insurance, answer with one Note that says so, and no other component.",
];

export const systemPrompt = `${library.prompt({
  preamble,
  additionalRules: rules,
  tools: [assessClaimSpec],
  toolCalls: true,
  bindings: true,
  builtinFunctions: false,
  examples: examples(),
  toolExamples: toolExamples(),
})}\n\n${catalog()}\n`;
