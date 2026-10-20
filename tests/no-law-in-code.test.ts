// The generator and the app must not contain a word or a number of the law.
//
// Forbidden words: all words (4 letters or more) of the literals of the
// knowledge model and of the local names in its own namespace, without
// - the words of the sk: vocabulary (the generator and the app know it),
// - the local names of the standard terms (RDF, RDFS, SHACL, SKOS, PROV, XSD)
//   and the keywords of JSON Schema (the generator writes JSON Schema),
// - common English words and technical words (STOP_WORDS).
// Forbidden numbers: all numbers in the literals of the model with two digits
// or more (without leading zeros), and all decimal numbers (for example 0.5).
// The SPARQL queries (sh:select) are not used for numbers: they contain
// calendar arithmetic, not law. IRIs (also xsd:anyURI literals) are not text.
//
// The code is cut into words (also camelCase and snake_case parts) and numbers.

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { Parser } from "n3";

const ROOT = join(import.meta.dir, "..");
const CODE_DIRECTORIES = ["generator", "app"];
const EXCLUDED = [join("app", "src", "generated")];
const CODE_FILES = /\.(ts|tsx|js|jsx|css|html)$/;
const SH_SELECT = "http://www.w3.org/ns/shacl#select";
const XSD_ANY_URI = "http://www.w3.org/2001/XMLSchema#anyURI";
const MODEL_NAMESPACE = "https://github.com/almilo/software-that-knows/model/";
const JSON_SCHEMA_WORDS = ["type", "object", "properties", "title", "description", "const", "oneOf", "format", "minimum", "maximum", "string", "number", "integer", "boolean"];

const STOP_WORDS = new Set(
  `about after also because before between both does each from have into less more most must only other over same some such
   than that their them then there these they this those under until upon very what when where which while will with without
   your yours also been being could should would than were what whom whose shall still give gives given take takes
   main term terms start show ends cannot`
    .split(/\s+/)
    .filter(Boolean),
);

// Whole tokens and their camelCase parts: "FamZG" gives "famzg", "fam", "zg".
function words(text: string): string[] {
  return text
    .split(/[^A-Za-zÀ-ÿ]+/)
    .flatMap((token) => [token, ...token.replace(/([a-z])([A-Z])/g, "$1 $2").split(" ")])
    .map((w) => w.toLowerCase())
    .filter((w) => w.length >= 4);
}

function numbers(text: string): string[] {
  return (text.match(/(?<![\w.])\d+(?:\.\d+)?(?![\w.])/g) ?? [])
    .map((n) => String(Number(n)))
    .filter((n) => n.length >= 2 || n.includes("."));
}

const localName = (iri: string) => iri.replace(/^.*[#/]/, "");
const withPlurals = (ws: Iterable<string>) => new Set([...ws].flatMap((w) => [w, w + "s", w + "es"]));

function termsOf(turtle: string) {
  const quads = new Parser().parse(turtle);
  const own: string[] = [];
  const standard: string[] = [];
  const numeric: string[] = [];
  for (const q of quads) {
    for (const term of [q.subject, q.predicate, q.object]) {
      if (term.termType !== "NamedNode") continue;
      (term.value.startsWith(MODEL_NAMESPACE) ? own : standard).push(localName(term.value));
    }
    if (q.object.termType === "Literal" && q.predicate.value !== SH_SELECT && q.object.datatype.value !== XSD_ANY_URI) {
      own.push(q.object.value);
      numeric.push(...numbers(q.object.value));
    }
  }
  return { words: new Set(own.flatMap(words)), standardWords: new Set(standard.flatMap(words)), numbers: new Set(numeric) };
}

function codeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (EXCLUDED.some((e) => path === join(ROOT, e))) return [];
    if (statSync(path).isDirectory()) return codeFiles(path);
    return CODE_FILES.test(name) ? [path] : [];
  });
}

const model = termsOf(readFileSync(join(ROOT, "model", "famzg.ttl"), "utf8"));
const vocabulary = termsOf(readFileSync(join(ROOT, "vocabulary", "sk.ttl"), "utf8"));
const allowedWords = withPlurals([
  ...vocabulary.words,
  ...vocabulary.standardWords,
  ...model.standardWords,
  ...JSON_SCHEMA_WORDS.flatMap(words),
  ...STOP_WORDS,
]);
const forbiddenWords = new Set([...model.words].filter((w) => !allowedWords.has(w)));
const forbiddenNumbers = model.numbers;
const files = CODE_DIRECTORIES.flatMap((d) => codeFiles(join(ROOT, d)));

describe("no knowledge of the law in the generator and the app", () => {
  test("the lists of forbidden words and numbers are not empty", () => {
    expect(files.length).toBeGreaterThan(3);
    for (const w of ["allowance", "child", "education", "income", "famzg", "pension", "apprenticeship"]) {
      expect(forbiddenWords.has(w)).toBe(true);
    }
    for (const n of ["215", "268", "1260", "16", "25", "0.5", "1.5"]) expect(forbiddenNumbers.has(n)).toBe(true);
  });

  for (const file of files) {
    test(relative(ROOT, file), () => {
      const code = readFileSync(file, "utf8");
      const foundWords = [...new Set(words(code))].filter((w) => forbiddenWords.has(w));
      const foundNumbers = [...new Set(numbers(code))].filter((n) => forbiddenNumbers.has(n));
      expect({ words: foundWords, numbers: foundNumbers }).toEqual({ words: [], numbers: [] });
    });
  }
});
