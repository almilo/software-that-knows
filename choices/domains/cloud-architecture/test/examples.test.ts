import { describe, expect, test } from "bun:test";
import { type Answers, createDecision } from "../../../decide/decision";
import { explain } from "../../../decide/explain";
import type { DecisionModel } from "../../../decide/model";
import { record } from "../../../decide/record";
import decision from "../generated/decision.json";

// The examples of part 7's tests, on the generic code.
const d = createDecision(decision as DecisionModel);

// A team that meets every condition of microservices: large, several teams, separate domains,
// growing, experienced. Each test changes what it is about.
const microservicesTeam: Answers = {
  teamSize: "large",
  teams: "more_than_three",
  domainSeparation: "clearly_separate",
  traffic: "steady",
  backgroundWork: "none",
  platform: "aws",
  expectedScale: "high",
  opsMaturity: "high",
};

describe("evaluate()", () => {
  test("recommends microservices when scale, ownership and domain boundaries justify the operational cost", () => {
    expect(d.evaluate(microservicesTeam)).toEqual({ choice: "MoveToMicroservices", additions: [], cautions: [], tools: [] });
  });

  test("warns that microservices would fit but need operations experience first", () => {
    expect(d.evaluate({ ...microservicesTeam, opsMaturity: "low" })).toMatchObject({ choice: "StartModular", cautions: ["MicroservicesNeedOperations"] });
  });

  test("adds serverless for scheduled jobs and for unpredictable traffic, with the tool of the platform", () => {
    const outcome = d.evaluate({ ...microservicesTeam, backgroundWork: "scheduled_or_event", traffic: "unpredictable", platform: "gcp" });
    expect(outcome).toMatchObject({ additions: ["ServerlessForEvents", "ServerlessForUnpredictableTraffic"], tools: ["Google Cloud Run"] });
  });

  test("names every serverless tool of the diagram when none is on the team's platform", () => {
    const outcome = d.evaluate({ ...microservicesTeam, backgroundWork: "scheduled_or_event", platform: "on_premises" });
    expect(outcome.tools).toEqual(["AWS Lambda", "Azure Functions", "Cloudflare Workers", "Google Cloud Run"]);
  });
});

describe("questionsThatMatter()", () => {
  test("stops asking about microservices once one team rules them out", () => {
    expect(d.questionsThatMatter({ teamSize: "small", teams: "one" }).map((c) => c.key)).toEqual(["traffic", "backgroundWork", "platform"]);
  });
});

describe("explain() and record()", () => {
  const answers = { ...microservicesTeam, teamSize: "medium", teams: "one", domainSeparation: "not_sure", expectedScale: "medium", opsMaturity: "low", backgroundWork: "scheduled_or_event" };
  const e = explain(d, answers, d.evaluate(answers));
  const text = record(d, answers, e, "2026-10-10");

  test("explains a modular monolith with the rule's words, and what microservices would need", () => {
    expect(e).toMatchObject({
      option: { id: "ModularMonolith" },
      because: ["For many startups, internal tools, and early-stage products, this is often the smartest starting point."],
      revisit: [{ option: { id: "Microservices" } }],
      ladder: undefined,
    });
  });

  test("writes the architecture decision record of part 7", () => {
    expect(text.split("\n")[0]).toBe("# Architecture style: Modular monolith, with serverless parts");
    expect(text).toContain("- Team size: Medium\n- Number of teams: One\n- Domain separation: Not sure");
    expect(text).toContain("Modular monolith. “Start with modular clarity.”");
    expect(text).toContain("Serverless for scheduled and event-driven jobs.\n\nTools: AWS Lambda.");
    expect(text).toContain("- Cost model: Cost-effective for growth; Lower operational overhead; Predictable hosting cost");
    expect(text).toContain("## Revisit: Microservices when\n\n- Expected scale: High, or Team size: Large");
  });
});
