// The provenance of the fields: each field names the DAK entries it comes from (prov:wasDerivedFrom).
// A data element must exist in the DAK data dictionary and be about the same thing as the field;
// a row of the decision logic (CHE.DT...) is allowed for a field that has no data element.
import { expect, test } from "bun:test";
import { root } from "../generator/generate";
import type { DakDictionary } from "../generator/extract-dak";
import { fields } from "../generator/generate-form";
import { DAK, dakElementOf } from "../generator/join-dak";
import { PROV, SH, readOntology } from "../generator/read-ontology";

const ontology = await readOntology(`${root}ontology/imci-fever.ttl`);
const dictionary: DakDictionary = await Bun.file(`${root}source/dak-data-dictionary.json`).json();
const all = fields(ontology).fields;

test("every field names at least one DAK entry", () => {
  expect(all.filter(({ node }) => ontology.all(node, `${PROV}wasDerivedFrom`).length === 0).map((f) => f.name)).toEqual([]);
});

test("every data element that a field names exists in the DAK data dictionary", () => {
  const unknown = all.flatMap(({ name, node }) =>
    ontology
      .all(node, `${PROV}wasDerivedFrom`)
      .map((t) => t.value.replace(DAK, ""))
      .filter((id) => !id.startsWith("CHE.DT.") && !dictionary.elements.some((e) => e.id === id))
      .map((id) => `${name}: ${id}`),
  );
  expect(unknown).toEqual([]);
});

// A wrong link (a field pointing at an unrelated data element) shows as a label with no word in
// common with the field's label.
test("the data element of each field shares a word with the field's label", () => {
  const words = (s: string): string[] => s.toLowerCase().match(/[a-z]{3,}/g) ?? [];
  const unrelated = all.flatMap(({ name, node }) => {
    const element = dakElementOf(ontology, node, dictionary);
    const label = words(ontology.text(node, `${SH}name`) ?? "");
    return element && !words(element.label).some((w) => label.includes(w)) ? [`${name}: ${element.id} "${element.label}"`] : [];
  });
  expect(unrelated).toEqual([]);
});
