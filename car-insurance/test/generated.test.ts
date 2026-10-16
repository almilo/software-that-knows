import { expect, test } from "bun:test";
import { generateFiles, root } from "../generator/generate";

// Git tracks the generated files. They must be the same as a new generation from the model, or
// the app uses old rules and shows an old report. To correct a failure: bun run generate
test("the generated files are the same as a new generation from the model", async () => {
  const files = Object.entries(await generateFiles());
  const current = await Promise.all(files.map(([path]) => Bun.file(`${root}${path}`).text()));
  files.forEach(([path, text], i) => expect(current[i], `${path} is old or edited by hand`).toBe(text));
});
