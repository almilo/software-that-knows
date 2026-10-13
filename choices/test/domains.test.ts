import { expect, test } from "bun:test";
import { domains } from "../generator/generate";
import { verifyModel } from "../generator/verify-model";

// The checks of the knowledge model, the same for every domain: the structure of its decision tree,
// if it has one, and the behaviour of its rules in every situation (decide/verify.ts). The table
// of `bun run verify` shows the same results.
test.each(await domains())("the model of %s has no findings", async (name) => {
  const result = await verifyModel(name);
  expect(result.situations).toBeGreaterThan(0);
  expect(result.structure).toEqual([]);
  expect(result.behaviour).toEqual([]);
});
