// The code generator. For each domain (domains/<name>/), it reads the knowledge model (the figures
// vocabulary in ontology/ and the domain's four Turtle files in domains/<name>/ontology/) and the
// source rows (domains/<name>/source/transactions.csv), and writes the files that the rest of the
// code reads:
//   domains/<name>/generated/model.json  the lists, the master data, the templates and the rankings
//   domains/<name>/generated/as-shown.json  the same, with the template as the source shows it
//   domains/<name>/generated/rows.json   the source rows, as they are in the CSV file
// Git tracks them, so a review shows how a change to the model changes the app.
import type { SourceRow } from "../engine/model";
import { generateModel } from "./generate-model";
import { loadModel } from "./rdf";

export const root = new URL("..", import.meta.url).pathname;

// The four files of a domain, each with one role. The same names in every domain.
export const domainFiles = ["domain.ttl", "lists.ttl", "business.ttl", "articles.ttl"];

export async function domains() {
  const folders = await Array.fromAsync(new Bun.Glob("domains/*/ontology/domain.ttl").scan({ cwd: root }));
  return folders.map((path) => path.split("/")[1]!).sort();
}

// The model of a domain. replace: other files to read in place of some of the domain's files, by
// name; the tests and `bun run verify` use it to read the template as the video shows it.
export async function readModel(name: string, replace: Record<string, string> = {}) {
  const paths = [`${root}ontology/figures.ttl`, ...domainFiles.map((f) => replace[f] ?? `${root}domains/${name}/ontology/${f}`)];
  return generateModel(loadModel(await Promise.all(paths.map((path) => Bun.file(path).text()))));
}

// The source rows: a CSV file with a header line, without quotes. The amount is a number; an empty
// cell is an empty text.
export async function readRows(name: string): Promise<SourceRow[]> {
  const [header, ...lines] = (await Bun.file(`${root}domains/${name}/source/transactions.csv`).text()).trim().split("\n");
  const columns = header!.split(",");
  return lines.map((line) => {
    const cells = line.split(",");
    return Object.fromEntries(columns.map((c, i) => [c, c === "amount" ? Number(cells[i]) : (cells[i] ?? "")])) as SourceRow;
  });
}

// The content of each generated file, by its path relative to the project root.
export async function generateFiles() {
  const files = await Promise.all(
    (await domains()).map(async (name) => [
      [`domains/${name}/generated/model.json`, json(name, await readModel(name))],
      [`domains/${name}/generated/as-shown.json`, json(name, await readModel(name, await asShown(name)))],
      [`domains/${name}/generated/rows.json`, json(name, { rows: await readRows(name) })],
    ]),
  );
  return Object.fromEntries(files.flat() as [string, string][]);
}

// The files of the template as the source shows it, in place of the domain's files of the same
// name: domains/<name>/test/as-shown/*.ttl. The app shows its articles next to the model's.
export async function asShown(name: string) {
  const files = await Array.fromAsync(new Bun.Glob(`domains/${name}/test/as-shown/*.ttl`).scan({ cwd: root }));
  return Object.fromEntries(files.map((f) => [f.split("/").at(-1)!, `${root}${f}`]));
}

function json(name: string, content: object) {
  const comment = `Generated from ontology/ and domains/${name}/ by generator/generate.ts. Do not edit.`;
  return JSON.stringify({ $comment: comment, ...content }, null, 2) + "\n";
}

if (import.meta.main) {
  const files = await generateFiles();
  await Promise.all(Object.entries(files).map(([path, text]) => Bun.write(`${root}${path}`, text)));
  console.log(`Wrote ${Object.keys(files).join(", ")}`);
}
