import { expect, test } from "bun:test";
import { generateFiles, root } from "./generate";

// Git tracks the generated files. They must be the same as a new generation from the models, or
// the app uses old questions and rules. To correct a failure: bun run generate
test("the generated files are the same as a new generation from the models", async () => {
  const files = Object.entries(await generateFiles());
  const current = await Promise.all(files.map(([path]) => Bun.file(`${root}${path}`).text()));
  files.forEach(([path, text], i) => expect(current[i], `${path} is old or edited by hand`).toBe(text));
});
