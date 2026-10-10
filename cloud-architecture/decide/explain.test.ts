import { describe, expect, test } from "bun:test";
import { evaluate } from "./decide";
import { explain } from "./explain";

const smallTeam = {
  teamSize: "small",
  teams: "one",
  domainSeparation: "connected",
  traffic: "steady",
  backgroundWork: "scheduled_or_event",
  platform: "aws",
  expectedScale: "medium",
  opsMaturity: "low",
};

describe("explain()", () => {
  test("explains a modular monolith with the rule's words, and what microservices would need", () => {
    const explanation = explain(smallTeam, evaluate(smallTeam));
    expect(explanation).toMatchObject({
      style: { id: "ModularMonolith" },
      because: ["For many startups, internal tools, and early-stage products, this is often the smartest starting point."],
      revisit: [
        {
          style: { id: "Microservices" },
          when: [
            "Expected scale: High, or Team size: Large",
            "Number of teams: Two or three / More than three",
            "Domain separation: Clearly separate",
            "Operations maturity: Medium / High",
          ],
        },
      ],
    });
  });

  test("lists only the conditions still missing", () => {
    const answers = { ...smallTeam, teams: "two_or_three", domainSeparation: "clearly_separate" };
    expect(explain(answers, evaluate(answers)).revisit[0]!.when).toEqual(["Expected scale: High, or Team size: Large", "Operations maturity: Medium / High"]);
  });

  test("explains microservices with the answers that met its conditions, and nothing to revisit", () => {
    const answers = { ...smallTeam, teamSize: "large", teams: "more_than_three", domainSeparation: "clearly_separate", opsMaturity: "high" };
    expect(explain(answers, evaluate(answers))).toMatchObject({
      style: { id: "Microservices" },
      because: ["Team size: Large", "Number of teams: More than three", "Domain separation: Clearly separate", "Operations maturity: High"],
      revisit: [],
    });
  });

  test("names the serverless parts and the tool of the platform", () => {
    expect(explain(smallTeam, evaluate(smallTeam))).toMatchObject({ parts: [{ id: "ServerlessForEvents" }], tools: ["AWS Lambda"] });
  });
});
