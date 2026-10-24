import { Renderer } from "@openuidev/react-lang";
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "react-dom/server";
import { policy } from "../../app/data";
import { statusWords } from "../../engine/text";
import { decide, evaluationClaims, expectedFor, readAnswer } from "../evaluation";
import { fixtures } from "../fixtures";
import { ground } from "../grounding";
import { CertificateContext, library } from "../library";
import { catalog, systemPrompt } from "../prompt";

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
  test("the catalog has every claim and guide fact with all its values, and no certificate fact", () => {
    const text = catalog();
    for (const f of policy.facts.filter((f) => f.group === "claim" || f.group === "guide")) {
      expect(text).toContain(`- ${f.id}: `);
      for (const v of f.values) expect(text).toContain(`${v.id} (`);
    }
    for (const f of policy.facts.filter((f) => f.group === "certificate")) expect(text).not.toContain(`- ${f.id}: `);
  });

  test("is the same on every build, so that it stays in the prompt cache", () => {
    expect(catalog()).toBe(catalog());
    expect(systemPrompt).toContain("ClaimCheck(facts:");
    expect(systemPrompt).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  test("the code of the assistant names no answer or cover of the product", () => {
    const ids = new Set([...policy.facts.flatMap((f) => f.values.map((v) => v.id)), ...policy.covers.map((c) => c.id)].filter((id) => id.length > 3 && id !== "Yes"));
    const dir = join(import.meta.dir, "..");
    const files = ["grounding.ts", "library.tsx", "prompt.ts", "llm.ts", "server.ts", "evaluation.ts", "eval.ts", "app/main.tsx"];
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

      const html = render(f.response);
      expect(html).toContain("What I understood");
      // The first screen shows the decision, or the next question that it needs.
      if (result.firstStatus !== "open") expect(html).toContain(statusWords[result.firstStatus].title);
      else expect(html).toContain("Not decided yet");
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
