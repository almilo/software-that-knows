// The same checks for every domain, whatever its process: they hold for each folder in domains/.
import { describe, expect, test } from "bun:test";
import type { DomainFiles } from "../app/domain";
import { loadModel, readShape } from "../core/model";
import { select } from "../core/rdf";
import { domains, knowledge } from "../generator/generate";
import { reuse } from "../generator/reuse";

const all = await domains();

describe.each([...all.keys()])("the domain %s", async (name) => {
  const files = all.get(name)!;
  const entry = Object.values(await import(`../domains/${name}/domain.ts`))[0] as DomainFiles;
  const store = loadModel(entry.model);

  test("its entry (domain.ts) loads exactly the files that the generator reads: its model and the modules it imports", async () => {
    const texts = await Promise.all(files.map((f) => Bun.file(`${knowledge}${f}`).text()));
    expect(new Set(entry.model)).toEqual(new Set(texts));
  });

  test("its texts exist in German, English, French and Italian", () => {
    expect(Object.keys(entry.messages).filter((k) => k !== "$comment")).toEqual(["de", "en", "fr", "it"]);
  });

  test("every field belongs to a group, and every group has a step", () => {
    const shape = readShape(store);
    expect(entry.uischema.elements.map((c) => c.i18n)).toEqual(shape.groups);
    expect(shape.fields.every((f) => shape.groups.includes(f.group))).toBe(true);
  });

  // A plausibility check of the answers, such as wef:CheckDates, is not a rule of the law and has no
  // source; a refusal always says which law refuses.
  test("every refusal, next step and value names its sources, and every source has a label", () => {
    const unsourced = select(
      store,
      `SELECT ?x WHERE {
         { ?x a form:Finding ; form:severity form:Refusal } UNION { VALUES ?type { form:NextStep form:Value } ?x a ?type }
         FILTER NOT EXISTS { ?x prov:wasDerivedFrom ?s } }`,
    );
    expect(unsourced.map((r) => r.x!.value)).toEqual([]);
    const unlabelled = select(store, `SELECT ?source WHERE { ?node prov:wasDerivedFrom ?source FILTER NOT EXISTS { ?source rdfs:label ?label } }`);
    expect(unlabelled.map((r) => r.source!.value)).toEqual([]);
  });

  test("every finding has a severity", () => {
    expect(select(store, `SELECT ?f WHERE { ?f a form:Finding FILTER NOT EXISTS { ?f form:severity ?s } }`)).toEqual([]);
  });
});

describe("loadModel()", () => {
  test("refuses a domain that misses a module it imports, or loads one that it does not import", async () => {
    const [wef, person, pension, bvg, wefv, eog] = await Promise.all(
      ["domains/wef/ontology/wef.ttl", "modules/person.ttl", "modules/pension.ttl", "modules/law/bvg.ttl", "modules/law/wefv.ttl", "modules/law/eog.ttl"].map((f) =>
        Bun.file(`${knowledge}${f}`).text(),
      ),
    );
    expect(() => loadModel([wef!, person!, bvg!, wefv!])).toThrow("Not loaded: https://example.org/pension#");
    expect(() => loadModel([wef!, person!, pension!, bvg!, wefv!, eog!])).toThrow("Not imported: https://example.org/ch-law/eog");
  });
});

describe("reuse", async () => {
  const rows = Object.fromEntries((await reuse()).map((r) => [r.name, r]));

  test("wef and vested-benefits share the fields, rules and texts of the person and pension modules", () => {
    expect(rows.wef!.shared).toEqual(rows["vested-benefits"]!.shared);
    expect(rows.wef!.shared.fields).toBe(6);
    expect(rows["vested-benefits"]!.modules).toEqual(expect.arrayContaining(["person", "pension"]));
  });

  test("parental-allowance shares no knowledge with them, only the app and the form vocabulary", () => {
    expect(rows["parental-allowance"]!.shared).toEqual({ fields: 0, rules: 0, outcomes: 0, texts: 0 });
    expect(rows["parental-allowance"]!.modules).toEqual(["law/eog"]);
  });
});
