// Joins the DAK data dictionary (source/dak-data-dictionary.json) to the fields of the knowledge
// model, through the data elements that each field names with prov:wasDerivedFrom. The DAK text
// then reaches the app by code: each field gets the definition of its data element.
import type { Term } from "n3";
import type { DakDictionary, DakElement } from "./extract-dak";
import { fields } from "./generate-form";
import { PROV, SH, type Ontology } from "./read-ontology";

export const DAK = "https://example.org/dak-ccc#";

// The data element of a field. The DAK uses some IDs for more than one element (CHE.B11S1.DE02 is
// both "Fever reported" and "Diarrhoea for how long?"), so among the elements with the field's IDs
// the one whose label shares the most words with the field's sh:name wins; on a tie, the first.
export function dakElementOf(o: Ontology, node: Term, dictionary: DakDictionary): DakElement | undefined {
  const ids = o.all(node, `${PROV}wasDerivedFrom`).map((t) => t.value.replace(DAK, ""));
  const name = wordsIn(o.text(node, `${SH}name`) ?? "");
  const shared = (e: DakElement) => wordsIn(e.label).filter((w) => name.includes(w)).length;
  return dictionary.elements
    .filter((e) => ids.includes(e.id))
    .reduce<DakElement | undefined>((best, e) => (!best || shared(e) > shared(best) ? e : best), undefined);
}

// The definition of each field: the first paragraph of its data element's definition in the DAK.
export function dakDefinitions(o: Ontology, dictionary: DakDictionary): Record<string, string> {
  return Object.fromEntries(
    fields(o)
      .fields.map(({ name, node }) => [name, firstParagraph(dakElementOf(o, node, dictionary)?.definition ?? "")] as const)
      .filter(([, definition]) => definition !== ""),
  );
}

export const firstParagraph = (text: string) => text.split(/\n\s*\n/)[0]!.trim();

const wordsIn = (s: string): string[] => s.toLowerCase().match(/[a-z]{3,}/g) ?? [];
