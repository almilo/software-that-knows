// The wef model as the generator reads it: its texts in four languages, and its sources.
import { describe, expect, test } from "bun:test";
import { generateMessages } from "../../../generator/generate-messages";
import { loadModel, readShape } from "../../../core/model";
import { select } from "../../../core/rdf";
import { wef } from "../domain";

const store = loadModel(wef.model);

describe("the wef model", () => {
  test("the texts exist in German, English, French and Italian", () => {
    const all = generateMessages(store, readShape(store));
    expect(Object.keys(all)).toEqual(["de", "en", "fr", "it"]);
    expect(all.de).toMatchObject({
      "requestedAmount.label": "Gewünschter Vorbezug (CHF)",
      "purpose.repayMortgage": "Hypothekardarlehen zurückzahlen",
      "BVG-30c-2.label": "BVG Art. 30c Abs. 2",
    });
  });

  test("one step for each group, in its order", () => {
    expect(wef.uischema.elements.map((c) => c.i18n)).toEqual(["you", "home", "pensionFund"]);
  });

  test("every source that the model cites has a label, so the app can show it", () => {
    const unlabelled = select(store, `SELECT ?source WHERE { ?node prov:wasDerivedFrom ?source FILTER NOT EXISTS { ?source rdfs:label ?label } }`);
    expect(unlabelled.map((r) => r.source!.value)).toEqual([]);
  });
});
