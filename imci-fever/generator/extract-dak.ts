// Extracts the data elements of the WHO DAK core data dictionary (Web Annex A) into
// source/dak-data-dictionary.json: for each element, its ID, label, definition and input options.
// The generator joins them to the knowledge model through prov:wasDerivedFrom, so the DAK text
// reaches the app by code, not by hand. Deterministic: the same spreadsheet gives the same file.
//
// Run: bun generator/extract-dak.ts "<path to WHO DAK child health - core data dictionary.xlsx>"
// The spreadsheet is published with the DAK (https://www.who.int/publications/i/item/9789240089907).
// An .xlsx file is a zip of XML files; `unzip` reads them, so no spreadsheet library is needed.
import { root } from "./generate";

export type DakElement = { id: string; sheet: string; label: string; definition: string; options: string };
export type DakDictionary = { $comment: string; source: { title: string; version: string }; elements: DakElement[] };

const COLUMNS = { id: "Data element ID", label: "Data element label", definition: "Description and definition", options: "Input options" };

// The text of every cell of a sheet, row by row, by column letter.
export function parseSheet(xml: string, strings: string[]): Record<string, string>[] {
  return [...xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map(([, row]) =>
    Object.fromEntries(
      [...row!.matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)].map(([, column, attributes, body = ""]) => {
        const value = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? "";
        const text = attributes!.includes('t="s"') ? strings[Number(value)]! : attributes!.includes('t="inlineStr"') ? texts(body) : value;
        return [column!, decode(text).trim()];
      }),
    ),
  );
}

// The data elements of one sheet: the rows below its header row that have a data element ID.
export function elementsOf(sheet: string, rows: Record<string, string>[]): DakElement[] {
  const headerAt = rows.findIndex((r) => Object.values(r).some((v) => v.includes(COLUMNS.id)));
  if (headerAt < 0) return [];
  const column = (name: string) => Object.entries(rows[headerAt]!).find(([, v]) => v.includes(name))?.[0];
  const [id, label, definition, options] = [COLUMNS.id, COLUMNS.label, COLUMNS.definition, COLUMNS.options].map(column);
  return rows
    .slice(headerAt + 1)
    .filter((r) => /^CHE\.[\w.]+$/.test(r[id!] ?? ""))
    .map((r) => ({ id: r[id!]!, sheet, label: r[label!] ?? "", definition: r[definition!] ?? "", options: r[options!] ?? "" }));
}

function texts(xml: string): string {
  return [...xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(([, t]) => t).join("");
}

function decode(s: string): string {
  return s.replace(/\r\n?/g, "\n").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

function read(xlsx: string, part: string): string {
  const out = Bun.spawnSync(["unzip", "-p", xlsx, part]);
  if (out.exitCode !== 0) throw new Error(`Cannot read ${part} from ${xlsx}`);
  return out.stdout.toString();
}

export function extract(xlsx: string): DakDictionary {
  const strings = [...read(xlsx, "xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map(([, si]) => texts(si!));
  const relations = Object.fromEntries(
    [...read(xlsx, "xl/_rels/workbook.xml.rels").matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)].map(([, rid, target]) => [rid, target]),
  );
  const sheets = [...read(xlsx, "xl/workbook.xml").matchAll(/<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)].map(([, name, rid]) => ({
    name: decode(name!),
    part: `xl/${relations[rid!]!.replace(/^\/?xl\//, "")}`,
  }));
  const rowsOf = (part: string) => parseSheet(read(xlsx, part), strings);
  const overview = rowsOf(sheets.find((s) => s.name === "OVERVIEW")!.part);
  const field = (name: string) => overview.find((r) => r.A === name)?.B ?? "";
  return {
    $comment: "Extracted from the WHO DAK core data dictionary by generator/extract-dak.ts. Do not edit.",
    source: { title: field("Title"), version: field("Version") },
    elements: sheets.flatMap((s) => elementsOf(s.name, rowsOf(s.part))),
  };
}

if (import.meta.main) {
  const xlsx = Bun.argv[2];
  if (!xlsx) throw new Error("Give the path of the DAK core data dictionary (.xlsx)");
  const dictionary = extract(xlsx);
  await Bun.write(`${root}source/dak-data-dictionary.json`, JSON.stringify(dictionary, null, 2) + "\n");
  console.log(`Wrote source/dak-data-dictionary.json: ${dictionary.elements.length} data elements (${dictionary.source.version})`);
}
