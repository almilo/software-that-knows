// Generates lexicon.json: the words that state each field in a note. Its shape is the contract in
// shared/rules-contract.ts. Deterministic words come from code: the field's own label (sh:name).
// The words that need judgement come from part 6 of the ontology, extended with the extract-words
// skill (.claude/skills/extract-words): three LLM runs, then consensus and checks in code.
import { canMatch } from "../shared/clauses";
import type { Lexicon, ValueWords } from "../shared/rules-contract";
import { fields } from "./generate-form";
import { IMCI, SH, local, literal, type Ontology } from "./read-ontology";

export const SKOS = "http://www.w3.org/2004/02/skos/core#";

export function generateLexicon(o: Ontology, definitions: Record<string, string> = {}): Lexicon {
  const words = (node: Parameters<Ontology["all"]>[0], property: string) =>
    o.all(node, property).map((t) => t.value.toLowerCase());
  return {
    fields: Object.fromEntries(
      fields(o).fields.map(({ name, node }) => {
        const path = o.one(node, `${SH}path`)!;
        const allowed = o.list(o.one(node, `${SH}in`)).map(literal);
        const derived = labelWords(o.text(node, `${SH}name`) ?? "");
        const written = words(path, `${SKOS}altLabel`);
        const repeated = written.filter((w) => derived.includes(w));
        if (repeated.length > 0) throw new Error(`${name}: "${repeated.join('", "')}" is already derived from sh:name; remove it from part 6`);
        const labels = [...derived.filter(canMatch), ...written];
        const all = [...written, ...words(path, `${IMCI}absentLabel`), ...o.all(path, `${IMCI}valueLabel`).flatMap((v) => words(v, `${SKOS}altLabel`))];
        const unmatchable = all.filter((w) => !canMatch(w));
        if (unmatchable.length > 0) throw new Error(`${name}: "${unmatchable.join('", "')}" contains a comma, "and" or "but", where a note is split, so it can never match`);
        if (labels.length === 0) throw new Error(`The field ${name} has no words`);
        const values = mergeByValue(o.all(path, `${IMCI}valueLabel`).map((v) => ({
          value: allowedValue(literal(o.one(v, `${IMCI}value`)!), allowed, name),
          labels: words(v, `${SKOS}altLabel`),
          ...(o.number(v, `${IMCI}minDays`) !== undefined ? { minDays: o.number(v, `${IMCI}minDays`) } : {}),
          ...(o.number(v, `${IMCI}maxDays`) !== undefined ? { maxDays: o.number(v, `${IMCI}maxDays`) } : {}),
        })));
        return [
          local(path),
          {
            labels,
            absent: words(path, `${IMCI}absentLabel`),
            ...(values.length > 0 ? { values } : {}),
            ...(definitions[name] ? { definition: definitions[name] } : {}),
          },
        ];
      }),
    ),
  };
}

// The words that code derives from a field's label: the label in lower case, without the part in
// brackets and without a closing question mark. A label with a comma, "and" or "but" gives no word,
// because a note is split there (shared/clauses.ts). "Axillary temperature (°C)" gives "axillary
// temperature"; "Fever for how long?" gives "fever for how long".
export function labelWords(label: string): string[] {
  const word = label.replace(/\([^)]*\)/g, "").replace(/\?\s*$/, "").replace(/\s+/g, " ").trim().toLowerCase();
  return word ? [word] : [];
}

// Value labels for the same value (for example one from each run of the extract-words skill)
// become one entry, with all their words.
function mergeByValue(values: ValueWords[]): ValueWords[] {
  const merged = new Map<string, ValueWords>();
  for (const v of values) {
    const seen = merged.get(v.value);
    merged.set(v.value, seen ? { ...v, ...seen, labels: [...seen.labels, ...v.labels.filter((l) => !seen.labels.includes(l))] } : v);
  }
  return [...merged.values()];
}

// A value label must name one of the values that the field allows (sh:in), or it would never apply.
function allowedValue(value: unknown, allowed: unknown[], field: string): string {
  if (!allowed.includes(value)) throw new Error(`${field}: the value label "${value}" is not an allowed value`);
  return value as string;
}
