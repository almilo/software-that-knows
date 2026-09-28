import { expect, test } from "bun:test";
import { generateFiles, root } from "./generate";

// Git tracks the generated files. They must be the same as a new generation from the ontology,
// or the app and the tests use old logic. To correct a failure: bun run generate
test("the files in generated/ are the same as a new generation from the ontology", async () => {
  for (const [path, text] of Object.entries(await generateFiles())) {
    expect(await Bun.file(`${root}${path}`).text(), `${path} is old or edited by hand`).toBe(text);
  }
});
