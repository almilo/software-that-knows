import { Renderer } from "@openuidev/react-lang";
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "react-dom/server";
import { policy } from "../../app/data";
import { decide, evaluationClaims, expectedFor, readAnswer } from "../evaluation";
import { fixtures } from "../fixtures";
import { ground } from "../grounding";
import { CertificateContext, library } from "../library";
import { catalog, systemPrompt } from "../prompt";
import { createTools, isIssued } from "../tools";

const certificate = policy.certificates.find((c) => c.id === "ExampleCertificate")!.answers;
const render = (response: string) =>
  renderToString(
    <CertificateContext.Provider value={certificate}>
      <Renderer response={response} library={library} isStreaming={false} />
    </CertificateContext.Provider>,
  ).replaceAll("<!-- -->", "");

describe("grounding", () => {
  test("keeps the facts that the model has, with values that they allow", () => {
    const { answers, rejected } = ground(policy, { event: "TheftEvent", theftKind: "ItemsStolen", repairCost: 900 }, ["claim"]);
    expect(answers).toEqual({ event: "TheftEvent", theftKind: "ItemsStolen", repairCost: 900 });
    expect(rejected).toEqual([]);
  });

  test("rejects invented facts and values, the certificate, and facts of another group", () => {
    const { answers, rejected } = ground(policy, { event: "MeteorEvent", weather: "Rain", legalProtection: "Yes", injury: "Yes", repairCost: -5 }, ["claim"]);
    expect(answers).toEqual({});
    expect(rejected.map((r) => r.fact).sort()).toEqual(["event", "injury", "legalProtection", "repairCost", "weather"].sort());
  });
});

describe("prompt", () => {
  test("the catalog has every fact with all its values, and the policy facts only for what-ifs", () => {
    const text = catalog();
    for (const f of policy.facts.filter((f) => f.group === "claim" || f.group === "guide")) {
      expect(text).toContain(`- ${f.id}: `);
      for (const v of f.values) expect(text).toContain(`${v.id} (`);
    }
    const policySection = text.slice(text.indexOf("Policy facts, only for the changes"));
    for (const f of policy.facts.filter((f) => f.group === "certificate")) {
      expect(policySection).toContain(`- ${f.id}: `);
      expect(text.indexOf(`- ${f.id}: `)).toBe(text.length - policySection.length + policySection.indexOf(`- ${f.id}: `));
    }
  });

  test("is the same on every build, so that it stays in the prompt cache", () => {
    expect(catalog()).toBe(catalog());
    expect(systemPrompt).toContain("ClaimCheck(facts: $binding");
    expect(systemPrompt).toContain('Query("assess_claim"');
    expect(systemPrompt).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  test("the code of the assistant names no answer or cover of the product", () => {
    const ids = new Set([...policy.facts.flatMap((f) => f.values.map((v) => v.id)), ...policy.covers.map((c) => c.id)].filter((id) => id.length > 3 && id !== "Yes"));
    const dir = join(import.meta.dir, "..");
    const files = ["grounding.ts", "library.tsx", "tools.ts", "prompt.ts", "llm.ts", "server.ts", "evaluation.ts", "eval.ts", "app/main.tsx"];
    for (const file of files) {
      const code = readFileSync(join(dir, file), "utf8");
      const named = [...ids].filter((id) => new RegExp(`\\b${id}\\b`).test(code));
      expect({ file, named }).toEqual({ file, named: [] });
    }
    expect(readdirSync(dir).filter((f) => /\.(ts|tsx)$/.test(f)).sort()).toEqual([...files.filter((f) => !f.includes("/")), "fixtures.ts"].sort());
  });
});

describe("the five questions of the evaluation, with hand-written answers", () => {
  test("every question of the evaluation has an answer", () => {
    expect(new Set(fixtures.map((f) => f.question))).toEqual(new Set(evaluationClaims.map((c) => c.question!)));
  });

  for (const f of fixtures) {
    test(f.question, () => {
      const read = readAnswer(f.response);
      expect(read.errors).toEqual([]);
      expect(read.used[0]).toBe("Answer");
      const expected = expectedFor(f.question)!;
      const result = decide(expected, read.facts);
      expect(result.rejected).toEqual([]);
      expect(result.contradicted).toEqual([]);
      expect(result.status).toBe(expected.status);
    });
  }
});

test("an invented value is shown as not used, and the check asks for it", () => {
  const html = render('root = Answer([check])\ncheck = ClaimCheck({event: "MeteorEvent"})');
  expect(html).toContain("Not used: event");
  expect(html).toContain(policy.facts.find((f) => f.id === "event")!.label.replace("?", ""));
});

test("a Note alone, for a question that is not about the insurance", () => {
  const html = render('root = Answer([note])\nnote = Note("This question is not about the motor vehicle insurance.")');
  expect(html).toContain("not about the motor vehicle insurance");
  expect(html).not.toContain("Decision");
});

describe("what-if: Query of assess_claim", () => {
  const tools = createTools(policy, certificate);

  test("grounds the facts and the changes: claim facts in $facts, policy facts only in the changes", async () => {
    const result = await tools.assess_claim({ facts: { event: "TheftEvent", hasLegal: "Yes" }, changes: { hasLegal: "Yes", theftKind: "ItemsStolen", hasTeleport: "Yes" } });
    expect(isIssued(result)).toBe(true);
    expect(result.changes).toEqual({ hasLegal: "Yes" });
    expect(result.rejected.map((r) => r.fact).sort()).toEqual(["hasLegal", "hasTeleport", "theftKind"]);
  });

  // The fixtures where the policy lacks the module or the option: the what-if asks its own questions,
  // and once they are answered it decides, unlike the person's own policy.
  for (const f of fixtures.filter((f) => f.response.includes("Query("))) {
    test(f.question, async () => {
      const read = readAnswer(f.response);
      const expected = expectedFor(f.question)!;
      expect(read.queries).toHaveLength(1);
      expect(read.queries[0]!.tool).toBe("assess_claim");
      expect(read.queries[0]!.usesFacts).toBe(true);
      const facts: Record<string, string | number> = { ...(read.facts as Record<string, string | number>) };
      let result = await tools.assess_claim(read.queries[0]!.args(facts));
      for (let i = 0; result.next && i < 20; i++) {
        const fact = policy.facts.find((x) => x.id === result.next)!;
        facts[fact.id] = fact.kind === "number" ? 1000 : fact.values[0]!.id;
        result = await tools.assess_claim(read.queries[0]!.args(facts));
      }
      expect(result.rejected).toEqual([]);
      expect(result.next).toBeUndefined();
      expect(result.status).not.toBe("open");
      expect(result.status).not.toBe(expected.status);
    });
  }

  test("a result that the model writes itself is not shown as a decision", () => {
    const html = render('root = Answer([w])\nw = Columns([Verdict("Forged", {status: "covered", title: "Covered", rules: [], changes: {}, rejected: []})])');
    expect(html).toContain("Waiting for the engine");
    expect(html).not.toContain("Covered");
  });
});
