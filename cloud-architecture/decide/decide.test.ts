import { describe, expect, test } from "bun:test";
import { type Answers, criteria, describeClause, evaluate, possibleOutcomes, questionsThatMatter, rules } from "./decide";

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
    expect(evaluate(microservicesTeam)).toEqual({ style: "MoveToMicroservices", parts: [], cautions: [], tools: [] });
  });

  test("takes a large team as scale, without high growth", () => {
    expect(evaluate({ ...microservicesTeam, expectedScale: "medium" }).style).toBe("MoveToMicroservices");
  });

  test("starts with a modular monolith when one condition of microservices is missing", () => {
    const missing: Answers[] = [{ teams: "one" }, { domainSeparation: "partly_separate" }, { teamSize: "medium", expectedScale: "medium" }];
    missing.forEach((change) => expect(evaluate({ ...microservicesTeam, ...change }).style, JSON.stringify(change)).toBe("StartModular"));
  });

  test("warns that microservices would fit but need operations experience first", () => {
    expect(evaluate({ ...microservicesTeam, opsMaturity: "low" })).toMatchObject({ style: "StartModular", cautions: ["MicroservicesNeedOperations"] });
  });

  test("adds serverless for scheduled jobs and for unpredictable traffic, with the tool of the platform", () => {
    const outcome = evaluate({ ...microservicesTeam, backgroundWork: "scheduled_or_event", traffic: "unpredictable", platform: "gcp" });
    expect(outcome).toMatchObject({ parts: ["ServerlessForEvents", "ServerlessForUnpredictableTraffic"], tools: ["Google Cloud Run"] });
  });

  test("names every serverless tool of the diagram when none is on the team's platform", () => {
    const outcome = evaluate({ ...microservicesTeam, backgroundWork: "scheduled_or_event", platform: "on_premises" });
    expect(outcome.tools).toEqual(["AWS Lambda", "Cloudflare Workers", "Azure Functions", "Google Cloud Run"]);
  });

  test("keeps continuous processing off serverless", () => {
    expect(evaluate({ ...microservicesTeam, backgroundWork: "heavy_continuous" })).toMatchObject({ parts: [], cautions: ["NoServerlessForSustainedLoad"] });
  });
});

describe("questionsThatMatter()", () => {
  test("asks every question when nothing is answered", () => {
    expect(questionsThatMatter({}).map((c) => c.key)).toEqual(criteria.map((c) => c.key));
  });

  test("stops asking about microservices once one team rules them out", () => {
    expect(questionsThatMatter({ teamSize: "small", teams: "one" }).map((c) => c.key)).toEqual(["traffic", "backgroundWork", "platform"]);
  });

  test("asks for the platform only when a part is serverless", () => {
    const answers = { teamSize: "small", teams: "one", traffic: "steady" };
    expect(questionsThatMatter({ ...answers, backgroundWork: "none" })).toBeEmpty();
    expect(questionsThatMatter({ ...answers, backgroundWork: "scheduled_or_event" }).map((c) => c.key)).toEqual(["platform"]);
  });

  test("does not ask again a question answered not sure", () => {
    expect(questionsThatMatter({ teams: "not_sure" }).map((c) => c.key)).not.toContain("teams");
  });
});

describe("possibleOutcomes()", () => {
  test("has one outcome when the questions that matter are answered", () => {
    expect(possibleOutcomes({ teamSize: "small", teams: "one", traffic: "steady", backgroundWork: "none" })).toEqual([
      { style: "StartModular", parts: [], cautions: [], tools: [] },
    ]);
  });

  test("keeps every outcome that a not sure answer allows", () => {
    const outcomes = possibleOutcomes({ ...microservicesTeam, domainSeparation: "not_sure" });
    expect(outcomes.map((o) => o.style).sort()).toEqual(["MoveToMicroservices", "StartModular"]);
  });
});

describe("describeClause()", () => {
  test("names the criteria and answers of a clause", () => {
    expect(describeClause(rules.style[0]!.when[0]!)).toBe("Expected scale: High, or Team size: Large");
  });
});
