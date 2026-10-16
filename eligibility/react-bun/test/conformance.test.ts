// The shared test cases (../conformance/<domain>.json): this engine must decide each case as
// recorded, as every other stack must. A change to the model or to the engine that changes a
// decision fails here; if the change is intended, record the cases again: bun run conformance
import { describe, expect, test } from "bun:test";
import { createEngine } from "../core/engine";
import { conformanceFiles, directory, type Case } from "../generator/conformance";

const names = (await Array.fromAsync(new Bun.Glob("*.json").scan({ cwd: directory }))).filter((f) => !f.endsWith(".examples.json")).sort();

describe.each(names)("the cases of %s", async (file) => {
  const { domain, cases } = (await Bun.file(`${directory}${file}`).json()) as { domain: string; cases: Case[] };
  const entry = Object.values(await import(`../domains/${domain}/domain.ts`))[0] as { model: string[] };
  const { evaluate } = createEngine(entry.model);

  test.each(cases.map((c) => [c.id, c] as const))("%s is decided as recorded", (_, c) => {
    expect(evaluate(c.answers, c.date)).toEqual(c.expected);
  });
});

describe("conformanceFiles()", () => {
  test("records the same cases as the files have: the draw and the examples have not changed", async () => {
    const files = await conformanceFiles();
    const onDisk = Object.fromEntries(await Promise.all(Object.keys(files).map(async (f) => [f, await Bun.file(`${directory}${f}`).text()])));
    expect(onDisk).toEqual(files);
  });
});
