// A new domain needs only its model: the generator writes the files of the test domain
// (../fixtures/domains/library-card/), added to a copy of the knowledge model, and the engine runs
// it. No code of the app knows it; the app's code reads only these generated files.
import { afterAll, describe, expect, test } from "bun:test";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createEngine } from "../core/engine";
import { domains, generateFiles, knowledge } from "../generator/generate";

const copy = `${await mkdtemp(`${tmpdir()}/knowledge-`)}/`;
await cp(knowledge, copy, { recursive: true });
await cp(new URL("../../fixtures/domains/", import.meta.url).pathname, `${copy}domains/`, { recursive: true });
afterAll(() => rm(copy, { recursive: true }));

describe("the test domain library-card", async () => {
  const files = await generateFiles(copy);
  const paths = (await domains(copy)).get("library-card")!;
  const model = await Promise.all(paths.map((p) => Bun.file(`${copy}${p}`).text()));

  test("gets the same files as every domain: its form, texts, entry page and the files it loads", () => {
    expect(Object.keys(files).filter((f) => f.startsWith("domains/library-card/")).sort()).toEqual([
      "domains/library-card/domain.ts",
      "domains/library-card/generated/domain.json",
      "domains/library-card/generated/messages.json",
      "domains/library-card/generated/schema.json",
      "domains/library-card/generated/uischema.json",
      "domains/library-card/index.html",
      "domains/library-card/main.tsx",
    ]);
    expect(JSON.parse(files["generated/index.json"]!).domains).toContain("library-card");
    const schema = JSON.parse(files["domains/library-card/generated/schema.json"]!);
    expect(Object.keys(schema.properties)).toEqual(["birthDate", "resident", "parentConsent", "cardType", "books", "deposit"]);
    expect(JSON.parse(files["domains/library-card/generated/messages.json"]!).de["ApplicationShape.label"]).toBe("Bibliotheksausweis");
  });

  test("runs in the engine: it asks, decides and derives", () => {
    const { evaluate } = createEngine(model);
    expect(evaluate({ birthDate: "2015-01-01", resident: "yes", cardType: "student" }, "2026-10-17").missing).toEqual(["parentConsent"]);
    const adult = evaluate({ birthDate: "1990-01-01", resident: "yes", cardType: "adult" }, "2026-10-17");
    expect(adult).toMatchObject({ allowed: true, nextSteps: [{ id: "BringId" }], values: [{ id: "fee", value: 30 }] });
    expect(evaluate({ birthDate: "1990-01-01", resident: "no", cardType: "adult" }, "2026-10-17").findings.map((f) => f.id)).toEqual(["NotResident"]);
  });

  test("is not in the knowledge model itself", async () => {
    expect((await domains()).has("library-card")).toBe(false);
  });
});
