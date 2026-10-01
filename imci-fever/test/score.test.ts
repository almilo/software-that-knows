// The eval's scoring: stated facts count, accepted inferences are neutral, anything else is wrong.
import { expect, test } from "bun:test";
import { scoreCase } from "../eval/score";

const c = { text: "She is convulsing now.", answers: { convulsingNow: true } };

test("an accepted inference counts neither as found nor as wrong", () => {
  expect(scoreCase(c, { convulsingNow: true, convulsions: true })).toMatchObject({ correct: 1, proposed: 1, wrong: 0, invented: 0, full: true });
});

test("an answer that no stated fact supports is wrong, and a danger sign set to yes is invented", () => {
  expect(scoreCase(c, { convulsingNow: true, lethargic: true })).toMatchObject({ correct: 1, proposed: 2, wrong: 1, invented: 1, full: false });
});

test("a danger sign set to no that the note does not state as absent is denied", () => {
  expect(scoreCase(c, { convulsingNow: true, lethargic: false })).toMatchObject({ wrong: 1, invented: 0, denied: 1 });
});
