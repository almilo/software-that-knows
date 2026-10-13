import { expect, test } from "bun:test";
import { generateDecision } from "../../../generator/generate-decision";
import { readModel } from "../../../generator/generate";
import { verifyModel } from "../../../generator/verify-model";

// The tree and the ladder as drawn in the diagram (drawn/rules.ttl), not as we read them
// (ontology/rules.ttl). The checks must find each problem of the drawing, from two sides: the
// structure of the tree, and the behaviour of the rules that come from it.
const drawn = { "rules.ttl": new URL("drawn/rules.ttl", import.meta.url).pathname };

test("the generator stops at the tree as drawn", async () => {
  await expect(readModel("chatgpt-models", drawn).then((model) => generateDecision(model))).rejects.toThrow("The decision tree is not complete");
});

test("the checks find what is wrong with the drawing", async () => {
  const result = await verifyModel("chatgpt-models", drawn);
  expect(result.structure).toEqual(['Ambiguous: 2 arrows for "yes"', 'Scoped: 0 arrows for "yes"']);
  expect(result.behaviour).toEqual([
    "gap: finishedWork=yes, scoped=yes: no choice rule applies",
    "overlap: finishedWork=yes, scoped=no, ambiguous=yes: ScopedWork, AmbiguousWork apply",
    "never chosen: AmbiguousWork",
    "never applies: AstraLimitedOnPlus",
    "ladder: GPT-6.1 Sol goes from Extra high (Rung3) to Low (Rung4)",
  ]);
});
