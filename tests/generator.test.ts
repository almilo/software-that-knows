// The generator is deterministic, and the committed generated files are current.
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generate } from "../generator/generate";

const root = join(import.meta.dir, "..");
const modelFiles = [join(root, "model/vocabulary.ttl"), join(root, "model/famzg.ttl")];
const committed = join(root, "app/src/generated");

function run() {
  const outDir = mkdtempSync(join(tmpdir(), "stk-"));
  generate({ modelFiles, outDir });
  return outDir;
}

describe("generator", () => {
  test("two runs give the same files as the committed generated files", () => {
    const a = run();
    const b = run();
    const names = readdirSync(a).sort();
    expect(names).toEqual(readdirSync(committed).sort());
    for (const name of names) {
      const content = readFileSync(join(a, name), "utf8");
      expect(readFileSync(join(b, name), "utf8")).toBe(content);
      expect(readFileSync(join(committed, name), "utf8")).toBe(content);
    }
  });

  test("every rule has an outcome, a message and a source; every parameter has a source", () => {
    const { catalog } = generate({ modelFiles, outDir: mkdtempSync(join(tmpdir(), "stk-")) });
    expect(Object.keys(catalog.rules).length).toBeGreaterThan(5);
    for (const rule of Object.values(catalog.rules)) {
      expect(Object.keys(catalog.outcomes)).toContain(rule.outcome);
      expect(rule.sources.length).toBeGreaterThan(0);
    }
    for (const p of catalog.parameters) expect(p.sources.length).toBeGreaterThan(0);
    for (const s of Object.values(catalog.sources)) expect(s.url).toBeDefined();
  });

  test("the generator refuses a model without a questionnaire", () => {
    expect(() =>
      generate({ modelFiles: [join(root, "model/vocabulary.ttl")], outDir: mkdtempSync(join(tmpdir(), "stk-")) }),
    ).toThrow(/stk:Questionnaire/);
  });
});
