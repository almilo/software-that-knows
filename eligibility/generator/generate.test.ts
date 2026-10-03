import { describe, expect, test } from "bun:test";
import { generateFiles, root } from "./generate";

// Git tracks the generated files. They must be the same as a new generation from the ontology,
// or the app and the tests use old logic. To correct a failure: bun run generate
describe("generateFiles()", () => {
  test("gives the same files as Git has, for every domain", async () => {
    const generated = await generateFiles();
    const onDisk = Object.fromEntries(await Promise.all(Object.keys(generated).map(async (path) => [path, await Bun.file(`${root}${path}`).text()])));
    expect(onDisk).toEqual(generated);
  });
});
