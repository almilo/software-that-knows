// Checks the answers against the knowledge model with the SHACL engine.
//
// 1. The form data becomes an RDF node of the answer class.
// 2. The data graph is this node plus the sk:Parameter nodes of the model
//    (rules read their numbers from the parameters).
// 3. shacl-engine validates the data graph against the model (SHACL Core and
//    SHACL-SPARQL).
// 4. Results of sk:RelevanceRule shapes make questions relevant. Answers to
//    questions that are not relevant are removed, and the validation repeats
//    until the set of answers does not change.
// 5. Results of sk:Rule shapes are the results for the person. Violations of
//    question shapes are problems with the answers.

import rdf from "@rdfjs/data-model";
import datasetFactory from "@rdfjs/dataset";
import { Parser } from "n3";
import { Validator } from "shacl-engine";
import { targetResolvers, validations } from "shacl-engine/sparql.js";
import type { AppModel, Question, Rule } from "./app-model.ts";

const XSD = "http://www.w3.org/2001/XMLSchema#";
const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const SK_PARAMETER = "https://github.com/almilo/software-that-knows/vocabulary#Parameter";
const SH_VIOLATION = "http://www.w3.org/ns/shacl#Violation";
const NUMERIC = new Set(["decimal", "integer", "double", "float", "int", "long"].map((t) => XSD + t));

export type Answers = Record<string, unknown>;

export interface Binding {
  value: string;
  datatype?: string;
}

export interface Result {
  rule: Rule;
  message: string;
  args: Record<string, Binding>;
}

export interface Problem {
  question: Question;
  message: string;
}

export interface Evaluation {
  answers: Answers;
  relevant: Set<string>;
  results: Result[];
  problems: Problem[];
}

export function createEngine(appModel: AppModel, modelTurtle: string) {
  const modelQuads = new Parser().parse(modelTurtle);
  const validator = new Validator(datasetFactory.dataset(modelQuads as any), { factory: rdf, targetResolvers, validations });
  const parameters = new Set(
    modelQuads.filter((q) => q.predicate.value === RDF_TYPE && q.object.value === SK_PARAMETER).map((q) => q.subject.value),
  );
  const parameterQuads = modelQuads.filter((q) => parameters.has(q.subject.value));
  const focus = rdf.namedNode("urn:uuid:" + crypto.randomUUID());
  const rules = new Map(appModel.rules.map((r) => [r.iri, r]));
  const relevanceRules = new Map(appModel.relevanceRules.map((r) => [r.iri, r]));
  const questionsByShape = new Map(appModel.questions.map((q) => [q.iri, q]));

  function toQuads(answers: Answers) {
    const quads = [rdf.quad(focus, rdf.namedNode(RDF_TYPE), rdf.namedNode(appModel.answerClass))];
    for (const q of appModel.questions) {
      const value = answers[q.key];
      if (value === undefined || value === null || value === "") continue;
      const object =
        q.kind === "choice"
          ? rdf.namedNode(String(value))
          : rdf.literal(String(value), rdf.namedNode(q.datatype ?? XSD + "string"));
      quads.push(rdf.quad(focus, rdf.namedNode(q.path), object));
    }
    return quads;
  }

  async function validate(answers: Answers) {
    const dataset = datasetFactory.dataset([...parameterQuads, ...toQuads(answers)] as any);
    const report = await validator.validate({ dataset });
    const relevantShapes = new Set<string>();
    const results: Result[] = [];
    const problems: Problem[] = [];

    for (const r of report.results as any[]) {
      if (!r.focusNode?.term?.equals(focus)) continue;
      const shape: string = r.shape.ptr.term.value;
      const rule = rules.get(shape);
      const relevance = relevanceRules.get(shape);
      const args: Record<string, Binding> = {};
      for (const [name, term] of Object.entries(r.args ?? {}) as [string, any][]) {
        args[name] = { value: term.value, datatype: term.datatype?.value };
      }
      if (relevance) {
        relevantShapes.add(relevance.asks);
      } else if (rule) {
        results.push({ rule, args, message: fillMessage(rule.message, args) });
      } else if (r.severity?.value === SH_VIOLATION) {
        const question = questionsByShape.get(shape) ?? questionForPath(r.path);
        if (question) problems.push({ question, message: r.message?.[0]?.value || "" });
      }
    }

    const relevant = new Set(
      appModel.questions.filter((q) => q.relevanceRules.length === 0 || relevantShapes.has(q.iri)).map((q) => q.key),
    );
    return { relevant, results, problems };
  }

  function questionForPath(path: any): Question | undefined {
    const predicate = path?.[0]?.predicates?.[0]?.value;
    return appModel.questions.find((q) => q.path === predicate);
  }

  async function evaluate(input: Answers): Promise<Evaluation> {
    let answers = clean(input);
    for (let round = 0; round <= appModel.questions.length; round++) {
      const { relevant, results, problems } = await validate(answers);
      const kept = Object.fromEntries(Object.entries(answers).filter(([key]) => relevant.has(key)));
      if (Object.keys(kept).length === Object.keys(answers).length) {
        return { answers, relevant, results: sortResults(results), problems };
      }
      answers = kept;
    }
    throw new Error("The relevance of the questions does not become stable");
  }

  function clean(input: Answers): Answers {
    const keys = new Set(appModel.questions.map((q) => q.key));
    return Object.fromEntries(Object.entries(input).filter(([k, v]) => keys.has(k) && v !== undefined && v !== null && v !== ""));
  }

  function sortResults(results: Result[]): Result[] {
    const order = new Map(appModel.kinds.map((k) => [k.iri, k.order]));
    return results.sort(
      (a, b) => (order.get(a.rule.kind) ?? 0) - (order.get(b.rule.kind) ?? 0) || a.rule.iri.localeCompare(b.rule.iri),
    );
  }

  return { evaluate };
}

// SHACL message templates: {?name} and {$name} take the value of the binding.
export function fillMessage(template: string, args: Record<string, Binding>): string {
  return template.replace(/\{[?$](\w+)\}/g, (all, name) => (args[name] ? formatValue(args[name]) : all));
}

export function formatValue(binding: Binding): string {
  if (binding.datatype && NUMERIC.has(binding.datatype)) {
    return new Intl.NumberFormat("de-CH", { maximumFractionDigits: 2 }).format(Number(binding.value));
  }
  return binding.value;
}
