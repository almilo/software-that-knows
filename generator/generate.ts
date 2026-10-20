// Deterministic generator: knowledge model (Turtle) -> files for the app.
//
// The generator knows the W3C standards (RDF, RDFS, SHACL, SKOS, PROV-O, XSD)
// and the sk: vocabulary. It does not know the domain of the model.
//
// Usage: bun generator/generate.ts <model.ttl> <output directory>

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Parser, Store, type Term } from "n3";
import { OWL, PROV, RDF, RDFS, SH, SK, SKOS, XSD } from "./namespaces.ts";
import type { AppModel, Choice, Entry, Question, QuestionKind, RelevanceRule, ResultKind, Rule, Source } from "../app/src/app-model.ts";

const VOCABULARY = new URL("../vocabulary/sk.ttl", import.meta.url);
const LANGUAGE = "en";

export function generate(modelTurtle: string, vocabularyTurtle: string): AppModel {
  const modelQuads = new Parser().parse(modelTurtle);
  const store = new Store();
  store.addQuads(new Parser().parse(vocabularyTurtle));
  store.addQuads(modelQuads);

  const one = (s: Term, p: string): Term | undefined => store.getObjects(s, p, null)[0];
  const all = (s: Term, p: string): Term[] => store.getObjects(s, p, null);
  const subjects = (p: string, o: string): Term[] => store.getSubjects(p, o, null);
  const text = (s: Term, p: string): string | undefined => {
    const literals = all(s, p).filter((t) => t.termType === "Literal");
    const preferred = literals.find((t) => (t as any).language === LANGUAGE) ?? literals.find((t) => !(t as any).language) ?? literals[0];
    return preferred?.value;
  };
  const number = (s: Term, p: string): number | undefined => {
    const t = one(s, p);
    return t ? Number(t.value) : undefined;
  };
  const list = (head: Term | undefined): Term[] => {
    const items: Term[] = [];
    while (head && head.value !== RDF.nil) {
      const first = one(head, RDF.first);
      if (first) items.push(first);
      head = one(head, RDF.rest);
    }
    return items;
  };
  const iris = (terms: Term[]): string[] => terms.filter((t) => t.termType === "NamedNode").map((t) => t.value).sort();
  const byOrder = <T extends { order: number; iri: string }>(a: T, b: T) => a.order - b.order || a.iri.localeCompare(b.iri);

  // --- Questionnaire and questions ---------------------------------------
  const questionnaires = subjects(RDF.type, SK.Questionnaire);
  if (questionnaires.length !== 1) throw new Error(`Expected one sk:Questionnaire, found ${questionnaires.length}`);
  const questionnaire = questionnaires[0];
  const answerClass = one(questionnaire, SH.targetClass);
  if (!answerClass) throw new Error("The sk:Questionnaire has no sh:targetClass");

  const relevanceRules: RelevanceRule[] = subjects(RDF.type, SK.RelevanceRule)
    .map((rule) => {
      const asks = one(rule, SK.asks);
      if (!asks) throw new Error(`Relevance rule ${rule.value} has no sk:asks`);
      return { iri: rule.value, asks: asks.value };
    })
    .sort((a, b) => a.iri.localeCompare(b.iri));

  const questions: Question[] = all(questionnaire, SH.property)
    .map((shape): Question => {
      const path = one(shape, SH.path);
      if (!path || path.termType !== "NamedNode") throw new Error(`Question ${shape.value} needs an IRI as sh:path`);
      const datatype = one(shape, SH.datatype)?.value;
      const choices = list(one(shape, SH.in)).map(
        (choice): Choice => ({
          iri: choice.value,
          label: text(choice, RDFS.label) ?? choice.value,
          definition: text(choice, SKOS.definition),
          order: number(choice, SH.order) ?? 0,
        }),
      );
      choices.sort(byOrder);
      const kind = questionKind(datatype, choices.length > 0);
      return {
        iri: shape.value,
        key: localName(path.value),
        path: path.value,
        kind,
        datatype: kind === "choice" ? undefined : datatype,
        label: text(shape, SH.name) ?? localName(path.value),
        description: text(shape, SH.description),
        order: number(shape, SH.order) ?? 0,
        group: one(shape, SH.group)?.value,
        choices,
        minimum: number(shape, SH.minInclusive),
        maximum: number(shape, SH.maxInclusive),
        sources: iris(all(shape, PROV.wasDerivedFrom)),
        interpretations: iris(all(shape, SK.interpretation)),
        openPoints: iris(all(shape, SK.openPoint)),
        relevanceRules: relevanceRules.filter((r) => r.asks === shape.value).map((r) => r.iri),
      };
    })
    .sort(byOrder);

  const keys = new Set<string>();
  for (const q of questions) {
    if (keys.has(q.key)) throw new Error(`Two questions use the key ${q.key}`);
    keys.add(q.key);
  }

  const groups: Entry[] = [...new Set(questions.map((q) => q.group).filter(Boolean) as string[])]
    .map((iri) => entry(iri))
    .sort(byOrder);

  // --- Rules --------------------------------------------------------------
  const rules: Rule[] = subjects(RDF.type, SK.Rule)
    .map((rule): Rule => {
      const constraint = one(rule, SH.sparql);
      if (!constraint) throw new Error(`Rule ${rule.value} has no sh:sparql`);
      const kind = one(rule, SK.resultKind);
      if (!kind) throw new Error(`Rule ${rule.value} has no sk:resultKind`);
      const message = text(constraint, SH.message) ?? text(rule, SH.message);
      if (!message) throw new Error(`Rule ${rule.value} has no sh:message`);
      const sources = iris([...all(rule, PROV.wasDerivedFrom), ...all(constraint, PROV.wasDerivedFrom)]);
      if (sources.length === 0) throw new Error(`Rule ${rule.value} has no source (prov:wasDerivedFrom)`);
      return {
        iri: rule.value,
        label: text(rule, RDFS.label) ?? localName(rule.value),
        kind: kind.value,
        status: one(rule, SK.status)?.value ?? SK.Settled,
        message,
        sources: [...new Set(sources)],
        interpretations: iris(all(rule, SK.interpretation)),
        openPoints: iris(all(rule, SK.openPoint)),
      };
    })
    .sort((a, b) => a.iri.localeCompare(b.iri));

  const kinds: ResultKind[] = subjects(RDF.type, SK.ResultKind)
    .map((k) => ({ ...entry(k.value), definition: text(k, SKOS.definition) }))
    .sort(byOrder);

  // --- Sources, interpretations, open points, parameters ------------------
  const referenced = new Set<string>();
  for (const thing of [...questions, ...rules]) thing.sources.forEach((s) => referenced.add(s));
  const parameters = new Set<string>();
  for (const t of subjects(RDF.type, SK.Parameter)) parameters.add(t.value);
  for (const p of parameters) all({ termType: "NamedNode", value: p } as Term, PROV.wasDerivedFrom).forEach((s) => referenced.add(s.value));

  const interpretationIris = iris(subjects(RDF.type, SK.Interpretation));
  for (const i of interpretationIris) all(named(i), PROV.wasDerivedFrom).forEach((s) => referenced.add(s.value));

  const sources: Record<string, Source> = {};
  for (const iri of [...referenced].sort()) {
    const node = named(iri);
    const origin = one(node, PROV.wasQuotedFrom);
    sources[iri] = {
      iri,
      label: text(node, RDFS.label) ?? localName(iri),
      url: one(node, RDFS.seeAlso)?.value,
      quote: text(node, PROV.value),
      origin: origin ? { iri: origin.value, label: text(origin, RDFS.label) ?? localName(origin.value), url: one(origin, RDFS.seeAlso)?.value } : undefined,
    };
  }

  const interpretations = Object.fromEntries(
    interpretationIris.map((iri) => [iri, { ...entry(iri), comment: text(named(iri), RDFS.comment) ?? "", sources: iris(all(named(iri), PROV.wasDerivedFrom)) }]),
  );
  const openPoints = Object.fromEntries(
    iris(subjects(RDF.type, SK.OpenPoint)).map((iri) => [iri, { ...entry(iri), comment: text(named(iri), RDFS.comment) ?? "" }]),
  );
  const statuses = Object.fromEntries(iris(subjects(RDF.type, SK.Status)).map((iri) => [iri, entry(iri)]));

  // --- Form ---------------------------------------------------------------
  const schema: AppModel["schema"] = {
    type: "object",
    properties: Object.fromEntries(questions.map((q) => [q.key, jsonSchema(q)])),
  };

  const ontology = modelQuads.find((q) => q.predicate.value === RDF.type && q.object.value === OWL.Ontology)?.subject;

  return {
    title: (ontology && text(ontology, RDFS.label)) ?? text(questionnaire, RDFS.label) ?? "",
    description: (ontology && text(ontology, RDFS.comment)) ?? "",
    answerClass: answerClass.value,
    questionnaire: questionnaire.value,
    groups,
    questions,
    relevanceRules,
    rules,
    kinds,
    statuses,
    sources,
    interpretations,
    openPoints,
    schema,
  };

  function named(iri: string): Term {
    return { termType: "NamedNode", value: iri } as Term;
  }

  function entry(iri: string): Entry {
    const node = named(iri);
    return { iri, label: text(node, RDFS.label) ?? localName(iri), order: number(node, SH.order) ?? 0 };
  }
}

function questionKind(datatype: string | undefined, hasChoices: boolean): QuestionKind {
  if (hasChoices) return "choice";
  switch (datatype) {
    case XSD.date:
      return "date";
    case XSD.boolean:
      return "boolean";
    case XSD.decimal:
    case XSD.integer:
    case XSD.double:
      return "number";
    default:
      return "text";
  }
}

function jsonSchema(q: Question): Record<string, unknown> {
  const base: Record<string, unknown> = { title: q.label };
  if (q.description) base.description = q.description;
  switch (q.kind) {
    case "choice":
      return { ...base, type: "string", oneOf: q.choices.map((c) => ({ const: c.iri, title: c.label })) };
    case "date":
      return { ...base, type: "string", format: "date" };
    case "boolean":
      return { ...base, type: "boolean" };
    case "number":
      return {
        ...base,
        type: q.datatype === XSD.integer ? "integer" : "number",
        ...(q.minimum !== undefined ? { minimum: q.minimum } : {}),
        ...(q.maximum !== undefined ? { maximum: q.maximum } : {}),
      };
    default:
      return { ...base, type: "string" };
  }
}

function localName(iri: string): string {
  return iri.replace(/^.*[#/]/, "");
}

if (import.meta.main) {
  const [modelPath, outDir] = process.argv.slice(2);
  if (!modelPath || !outDir) {
    console.error("Usage: bun generator/generate.ts <model.ttl> <output directory>");
    process.exit(1);
  }
  const modelTurtle = readFileSync(modelPath, "utf8");
  const appModel = generate(modelTurtle, readFileSync(VOCABULARY, "utf8"));
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "app-model.json"), JSON.stringify(appModel, null, 2) + "\n");
  writeFileSync(join(outDir, "model.ts"), `// Generated from ${modelPath}. Do not edit.\nexport const modelTurtle = ${JSON.stringify(modelTurtle)};\n`);
  console.log(`Generated ${appModel.questions.length} questions, ${appModel.relevanceRules.length} relevance rules and ${appModel.rules.length} rules in ${outDir}`);
}
