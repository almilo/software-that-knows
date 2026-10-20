// The generator and the app contain no word or number of the law.
// All knowledge of the law must be in the model.
import { describe, expect, test } from "bun:test";
import { Glob } from "bun";
import { Parser } from "n3";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const MODEL = join(root, "model/famzg.ttl");
const LAW = join(root, "law/famzg-2026-01-01.de.txt");

/** The code to check: generator, app and scripts. Not the generated files. */
function codeFiles(): string[] {
  const files: string[] = [];
  for (const pattern of ["generator/**/*", "app/**/*", "scripts/**/*"]) {
    for (const f of new Glob(pattern).scanSync({ cwd: root })) {
      if (f.startsWith("app/src/generated/")) continue;
      if (!/\.(ts|tsx|js|jsx|html|css|json)$/.test(f)) continue;
      files.push(f);
    }
  }
  return files.sort();
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function lawTerms() {
  const quads = new Parser().parse(readFileSync(MODEL, "utf8"));
  const ontology = quads.find(
    (q) => q.predicate.value.endsWith("22-rdf-syntax-ns#type") && q.object.value.endsWith("owl#Ontology"),
  )!.subject.value;

  // 1. Local names of the IRIs of the model namespace, and the namespace itself.
  const localNames = new Set<string>();
  for (const q of quads) {
    for (const t of [q.subject, q.predicate, q.object]) {
      if (t.termType === "NamedNode" && t.value.startsWith(ontology) && t.value !== ontology) {
        localNames.add(t.value.slice(ontology.length));
      }
    }
  }

  // 2. Texts of the model: labels, questions, messages, comments.
  const textPredicates = ["rdf-schema#label", "shacl#name", "shacl#description", "shacl#message", "rdf-schema#comment", "terms/description"];
  const phrases = new Set<string>();
  for (const q of quads) {
    if (q.object.termType === "Literal" && textPredicates.some((p) => q.predicate.value.endsWith(p))) {
      phrases.add(q.object.value.toLowerCase());
    }
  }

  // 3. Words of the law text (five letters or more).
  const law = readFileSync(LAW, "utf8");
  const words = new Set((law.match(/\p{L}{5,}/gu) ?? []).map((w) => w.toLowerCase()));

  // 4. Numbers: the values of the parameters, and the numbers of three or more digits in the law text.
  const numbers = new Set<string>();
  for (const q of quads) {
    if (q.predicate.value.endsWith("22-rdf-syntax-ns#value") && q.object.termType === "Literal") numbers.add(q.object.value);
  }
  for (const n of law.match(/\d{3,}/g) ?? []) numbers.add(n);

  return { ontology, localNames, phrases, words, numbers };
}

describe("no knowledge of the law in the generator and the app", () => {
  const files = codeFiles();
  const terms = lawTerms();

  test("there is code to check", () => {
    expect(files).toContain("generator/generate.ts");
    expect(files).toContain("app/src/engine.ts");
    expect(files).toContain("app/src/App.tsx");
    expect(terms.words.size).toBeGreaterThan(500);
    expect(terms.numbers).toContain("268");
  });

  /** Returns the terms of the law that the code contains. */
  function findLaw(code: string): string[] {
    const found: string[] = [];
    if (code.includes(terms.ontology)) found.push(`namespace ${terms.ontology}`);
    // IRIs of the W3C standards and of the vocabulary are not law; remove them before the search.
    const text = code.replace(/https?:\/\/[^\s"'`]+/g, "");
    const lower = text.toLowerCase();
    for (const name of terms.localNames) {
      if (new RegExp(`(?<![\\w-])${escape(name)}(?![\\w-])`).test(text)) found.push(`model term "${name}"`);
    }
    for (const phrase of terms.phrases) {
      if (lower.includes(phrase)) found.push(`model text "${phrase}"`);
    }
    for (const word of lower.match(/\p{L}{5,}/gu) ?? []) {
      if (terms.words.has(word)) found.push(`law word "${word}"`);
    }
    for (const n of terms.numbers) {
      if (new RegExp(`(?<![\\w.])${escape(n)}(?![\\w]|\\.\\d)`).test(text)) found.push(`number ${n}`);
    }
    return [...new Set(found)];
  }

  test("the check finds law in code", () => {
    expect(findLaw("const amount = 268;")).toEqual(["number 268"]);
    expect(findLaw("// Ausbildungszulage")).toContain('law word "ausbildungszulage"');
    expect(findLaw("if (age > 25) {}")).toEqual(["number 25"]);
    expect(findLaw("data.annualIncome")).toEqual(['model term "annualIncome"']);
    expect(findLaw("const x = 12.5; const y = 4096;")).toEqual([]);
  });

  for (const file of files) {
    test(file, () => {
      expect(findLaw(readFileSync(join(root, file), "utf8"))).toEqual([]);
    });
  }
});
