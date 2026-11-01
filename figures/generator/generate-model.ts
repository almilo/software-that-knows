// The model, in the shape the engine and the app use (engine/model.ts), from the figures words
// (ontology/figures.ttl): the page, the periods, the five lists, the master data, the roles, the
// templates and the rankings. It checks nothing about the meaning; the checks are in
// engine/verify.ts.
import type { Term } from "oxigraph";
import type { Concept, FiguresModel, PartKey, SliceKind } from "../engine/model";
import { DCTERMS, FV, local, type Model, RDF, RDFS, SKOS } from "./rdf";

// The classes of the five parts, by the key the engine uses.
const partKeys: Record<string, PartKey> = { Measure: "measure", TimeBasis: "timeBasis", TimeSlice: "timeSlice", Scenario: "scenario", Suffix: "suffix" };

export function generateModel(model: Model): FiguresModel {
  const domain = model.ofType(`${FV}Domain`)[0];
  if (!domain) throw new Error("The model has no fv:Domain");
  const ontology = model.select(`SELECT ?o WHERE { ?o fv:variableParts ?parts }`)[0]!.o!;

  const parts = {
    measure: model.ofType(`${FV}Measure`).map((c) => ({ ...concept(model, c), sourceMeasure: model.required(c, `${FV}sourceMeasure`) })).sort(byCode),
    timeBasis: model.ofType(`${FV}TimeBasis`).map((c) => ({ ...concept(model, c), yearOffset: Number(model.required(c, `${FV}yearOffset`)) })).sort(byCode),
    timeSlice: model.ofType(`${FV}TimeSlice`).map((c) => ({ ...concept(model, c), kind: local(model.one(c, `${FV}sliceKind`)!) as SliceKind })).sort(byCode),
    scenario: model.ofType(`${FV}Scenario`).map((c) => scenario(model, c)).sort(byCode),
    suffix: model.ofType(`${FV}Suffix`).map((c) => ({ ...concept(model, c), format: model.required(c, `${FV}format`) as "currency" | "percent" })).sort(byCode),
  };

  const entityTypes = model.ofType(`${FV}EntityType`).map((t) => {
    const column = model.text(t, `${FV}sourceColumn`);
    const via = model.one(t, `${FV}via`);
    return { ...concept(model, t), ...(column && { sourceColumn: column }), ...(via && { via: local(via) }), whole: model.text(t, `${FV}whole`) === "true" };
  });
  const typeIds = new Set(entityTypes.map((t) => t.id));

  return {
    domain: {
      title: model.required(domain, `${RDFS}label`),
      intro: model.required(domain, `${FV}intro`),
      source: model.required(domain, `${DCTERMS}source`),
      sourceTitle: model.required(domain, `${FV}sourceTitle`),
      currencySymbol: model.required(domain, `${FV}currencySymbol`),
      fiscalYearStart: Number(model.required(domain, `${FV}fiscalYearStart`)),
    },
    periods: model
      .all(domain, `${FV}period`)
      .map((p) => ({ month: model.required(p, `${FV}month`), comment: model.required(p, `${RDFS}comment`) }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    partOrder: model.list(model.one(ontology, `${FV}variableParts`)).map((c) => ({ key: partKeys[local(c)]!, label: model.required(c, `${RDFS}label`) })),
    parts,
    entityTypes: entityTypes.sort((a, b) => a.id.localeCompare(b.id)),
    entities: model
      .select(`SELECT DISTINCT ?e ?type WHERE { ?e a ?type . ?type a fv:EntityType }`)
      .filter((row) => typeIds.has(local(row.type!)))
      .map((row) => {
        const e = row.e!;
        const code = model.text(e, `${SKOS}notation`);
        // Links to other entities: every statement whose object is an entity, in the domain's own words.
        const links = model
          .select(`SELECT ?p ?o WHERE { <${e.value}> ?p ?o . ?o a ?t . ?t a fv:EntityType }`)
          .map((r) => [local(r.p!), local(r.o!)] as const);
        return {
          id: local(e),
          type: local(row.type!),
          ...(code && { code }),
          label: model.required(e, `${RDFS}label`),
          words: [model.required(e, `${RDFS}label`).toLowerCase()],
          roles: model.all(e, `${FV}hasRole`).map(local).sort(),
          links: Object.fromEntries(links),
        };
      })
      .sort((a, b) => a.id.localeCompare(b.id)),
    roles: model.ofType(`${FV}Role`).map((r) => ({ id: local(r), label: model.required(r, `${RDFS}label`) })).sort((a, b) => a.id.localeCompare(b.id)),
    owners: model.ofType(`${FV}Owner`).map((o) => ({ id: local(o), label: model.required(o, `${RDFS}label`) })).sort((a, b) => a.id.localeCompare(b.id)),
    templates: model
      .ofType(`${FV}Template`)
      .map((t) => ({
        id: local(t),
        label: model.required(t, `${RDFS}label`),
        about: local(model.one(t, `${FV}about`)!),
        text: model.required(t, `${FV}text`),
        visibleTo: model
          .all(t, `${FV}visibleTo`)
          .map((v) => ({ role: local(model.one(v, `${FV}role`)!), scope: local(model.one(v, `${FV}scope`)!) as "All" | "Own" }))
          .sort((a, b) => a.role.localeCompare(b.role)),
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    rankings: model
      .ofType(`${FV}Ranking`)
      .map((r) => {
        const decision = model.text(r, `${FV}decision`);
        return {
          ...concept(model, r),
          of: local(model.one(r, `${FV}rankingOf`)!),
          candidates: model
            .all(r, `${FV}candidate`)
            .map((c) => ({ label: model.required(c, `${RDFS}label`), variable: model.required(c, `${FV}variable`) }))
            .sort((a, b) => a.variable.localeCompare(b.variable)),
          ...(decision && { decision }),
        };
      })
      .sort((a, b) => a.id.localeCompare(b.id)),
    rankingWords: model.all(ontology, `${FV}rankingWords`).map((w) => w.value).sort(),
  };
}

function concept(model: Model, c: Term): Concept {
  const label = model.required(c, `${RDFS}label`);
  const definition = model.text(c, `${SKOS}definition`);
  return {
    id: local(c),
    code: model.text(c, `${SKOS}notation`) ?? local(c),
    label,
    words: [label, ...model.all(c, `${SKOS}altLabel`).map((w) => w.value)].map((w) => w.toLowerCase()).filter(unique).sort(),
    ...(definition && { definition }),
  };
}

function scenario(model: Model, c: Term) {
  const version = model.text(c, `${FV}sourceVersion`);
  const isComparison = model.all(c, `${RDF}type`).some((t) => t.value === `${FV}Comparison`);
  if (!isComparison) return { ...concept(model, c), ...(version && { sourceVersion: version }) };
  const owner = model.one(c, `${FV}owner`);
  const code = (p: string) => model.required(model.one(c, `${FV}${p}`)!, `${SKOS}notation`);
  return {
    ...concept(model, c),
    comparison: {
      of: code("of"),
      against: code("against"),
      inputSuffix: code("inputSuffix"),
      ...(owner && { owner: local(owner) }),
      above: model.required(c, `${FV}aboveWords`),
      below: model.required(c, `${FV}belowWords`),
      equal: model.required(c, `${FV}equalWords`),
    },
  };
}

const unique = <T,>(v: T, i: number, a: T[]) => a.indexOf(v) === i;
const byCode = (a: Concept, b: Concept) => a.code.localeCompare(b.code);
