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

describe("generateIndex()", () => {
  test("lists every domain, with its title and summary in each language", async () => {
    const generated = await generateFiles();
    const index = JSON.parse(generated["generated/index.json"]!);
    const names = Object.keys(generated)
      .filter((path) => path.endsWith("/generated/domain.json"))
      .map((path) => path.split("/")[1]);
    expect(index.domains).toEqual(names);
    Object.values(index.messages as Record<string, Record<string, string>>).forEach((texts) =>
      names.forEach((name) => expect(texts).toMatchObject({ [`${name}.label`]: expect.any(String), [`${name}.summary`]: expect.any(String) })),
    );
  });
});
