import { describe, expect, test } from "bun:test";
import { adr } from "./adr";
import { evaluate } from "./decide";
import { explain } from "./explain";

const answers = {
  teamSize: "medium",
  teams: "one",
  domainSeparation: "not_sure",
  traffic: "steady",
  backgroundWork: "scheduled_or_event",
  platform: "aws",
  expectedScale: "medium",
  opsMaturity: "low",
};

describe("adr()", () => {
  const text = adr(answers, explain(answers, evaluate(answers)), "2026-10-10");

  test("titles the decision with the style and its serverless parts", () => {
    expect(text.split("\n")[0]).toBe("# Architecture style: Modular monolith, with serverless parts");
  });

  test("records the answers as the context, including not sure", () => {
    expect(text).toContain("- Team size: Medium\n- Number of teams: One\n- Domain separation: Not sure");
  });

  test("records the decision, its tools, its consequences and when to revisit it", () => {
    expect(text).toContain("Modular monolith. “Start with modular clarity.”");
    expect(text).toContain("Serverless for scheduled and event-driven jobs.\n\nTools: AWS Lambda.");
    expect(text).toContain("- Cost model: Cost-effective for growth; Predictable hosting cost; Lower operational overhead");
    expect(text).toContain("## Revisit: Microservices when\n\n- Expected scale: High, or Team size: Large");
  });
});
