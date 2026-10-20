// Evaluates form answers against the generated model with the SHACL engine.
// This file is generic: it knows SHACL, RDF and the stk vocabulary, not the law.
import rdf from "rdf-ext";
import { Parser } from "n3";
import { Validator } from "shacl-engine";
import { targetResolvers, validations } from "shacl-engine/sparql.js";
import type { Catalog, Question } from "../../generator/generate";

const SH = "http://www.w3.org/ns/shacl#";
const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const STK = "https://software-that-knows.example/vocab#";

export const OUTCOME = {
  refusal: STK + "Refusal",
  value: STK + "Value",
  nextStep: STK + "NextStep",
};

export type Answers = Record<string, unknown>;

export interface ModelFiles {
  catalog: Catalog;
  context: { "@context": Record<string, { "@id": string; "@type": string }> };
  shapes: string;
  parameters: string;
}

export interface ResultValue {
  property: string;
  label: string;
  value: string;
  datatype?: string;
  display: string;
}

export interface SourceRef {
  iri: string;
  label: string;
  url?: string;
  description?: string;
}

export interface InterpretationRef {
  iri: string;
  label: string;
  comment: string;
}

export interface Outcome {
  id: string;
  kind: string;
  kindLabel: string;
  title: string;
  message: string;
  values: ResultValue[];
  sources: SourceRef[];
  interpretations: InterpretationRef[];
}

export interface InputError {
  key?: string;
  message: string;
}

export interface Evaluation {
  /** Keys of the questions to show, in order. */
  visible: string[];
  /** Keys of the relevant questions that have no answer. */
  open: string[];
  /** The answers that the evaluation used (answers to irrelevant questions removed). */
  answers: Answers;
  outcomes: Outcome[];
  inputErrors: InputError[];
  /** True when no question is open, or a refusal ends the process. */
  complete: boolean;
}

function parseTurtle(text: string) {
  return rdf.dataset(new Parser().parse(text) as any);
}

const isAnswered = (v: unknown) => v !== undefined && v !== null && v !== "";

export class Engine {
  readonly catalog: Catalog;
  private readonly context: ModelFiles["context"]["@context"];
  private readonly shapes;
  private readonly parameters;
  private readonly validator;
  private readonly focus = rdf.namedNode("urn:answers:focus");

  constructor(files: ModelFiles) {
    this.catalog = files.catalog;
    this.context = files.context["@context"];
    this.shapes = parseTurtle(files.shapes);
    this.parameters = parseTurtle(files.parameters);
    this.validator = new Validator(this.shapes, { factory: rdf, targetResolvers, validations });
  }

  /** Converts form data to RDF with the JSON-LD context, and adds the parameters of the model. */
  toDataset(answers: Answers) {
    const dataset = rdf.dataset([...this.parameters]);
    dataset.add(rdf.quad(this.focus, rdf.namedNode(RDF + "type"), rdf.namedNode(this.catalog.focusClass)));
    for (const [key, value] of Object.entries(answers)) {
      const term = this.context[key];
      if (!term || !isAnswered(value)) continue;
      const object =
        term["@type"] === "@id"
          ? rdf.namedNode(String(value))
          : rdf.literal(String(value), rdf.namedNode(term["@type"]));
      dataset.add(rdf.quad(this.focus, rdf.namedNode(term["@id"]), object));
    }
    return dataset;
  }

  private async conforms(dataset: any, shape: string): Promise<boolean> {
    const report = await this.validator.validate({ dataset, terms: [this.focus] }, [
      { terms: [rdf.namedNode(shape)] },
    ]);
    return report.conforms;
  }

  /** The relevant questions: a fixpoint, because answers to irrelevant questions do not count. */
  async relevance(answers: Answers): Promise<{ relevant: Question[]; answers: Answers }> {
    let current: Answers = { ...answers };
    for (let round = 0; round <= this.catalog.questions.length; round++) {
      const dataset = this.toDataset(current);
      const cache = new Map<string, boolean>();
      const relevant: Question[] = [];
      for (const q of this.catalog.questions) {
        if (q.askWhen && !cache.has(q.askWhen)) cache.set(q.askWhen, await this.conforms(dataset, q.askWhen));
        if (!q.askWhen || cache.get(q.askWhen)) relevant.push(q);
      }
      const keys = new Set(relevant.map((q) => q.key));
      const next = Object.fromEntries(Object.entries(current).filter(([k]) => keys.has(k)));
      if (Object.keys(next).length === Object.keys(current).length) return { relevant, answers: current };
      current = next;
    }
    throw new Error("The relevance of the questions does not become stable");
  }

  private sourceRefs(iris: string[]): SourceRef[] {
    return iris.map((iri) => ({ iri, ...(this.catalog.sources[iri] ?? { label: iri }) }));
  }

  private interpretationRefs(iris: string[]): InterpretationRef[] {
    return iris.map((iri) => ({ iri, ...(this.catalog.interpretations[iri] ?? { label: iri, comment: "" }) }));
  }

  private display(term: any): string {
    if (term.termType === "NamedNode") return this.catalog.labels[term.value] ?? term.value;
    return term.value;
  }

  async evaluate(input: Answers): Promise<Evaluation> {
    const { relevant, answers } = await this.relevance(input);
    const dataset = this.toDataset(answers);
    const report = await this.validator.validate({ dataset });

    const keyOfPath = new Map(this.catalog.questions.map((q) => [q.path, q.key]));
    const byRule = new Map<string, Outcome>();
    const inputErrors: InputError[] = [];

    for (const result of report.results as any[]) {
      const shape: string = result.shape.ptr.term.value;
      const message: string = result.message?.[0]?.value ?? "";
      const rule = this.catalog.rules[shape];
      const path: string | undefined = result.path?.[0]?.predicates?.[0]?.value;
      if (!rule) {
        // A result of a core constraint on the answers.
        inputErrors.push({ key: path ? keyOfPath.get(path) : undefined, message });
        continue;
      }
      let outcome = byRule.get(shape);
      if (!outcome) {
        outcome = {
          id: shape,
          kind: rule.outcome,
          kindLabel: this.catalog.outcomes[rule.outcome]?.label ?? rule.outcome,
          title: rule.label,
          message,
          values: [],
          sources: this.sourceRefs(rule.sources),
          interpretations: this.interpretationRefs(rule.interpretations),
        };
        byRule.set(shape, outcome);
      }
      const value = result.value?.term;
      if (path && value && !value.equals(this.focus)) {
        outcome.values.push({
          property: path,
          label: this.catalog.labels[path] ?? path,
          value: value.value,
          datatype: value.datatype?.value,
          display: this.display(value),
        });
      }
    }

    const order = (kind: string) => this.catalog.outcomes[kind]?.order ?? 99;
    let outcomes = [...byRule.values()].sort((a, b) => order(a.kind) - order(b.kind) || a.title.localeCompare(b.title));
    for (const o of outcomes) o.values.sort((a, b) => a.property.localeCompare(b.property));

    const open = relevant.filter((q) => !isAnswered(answers[q.key])).map((q) => q.key);
    let visible = relevant.map((q) => q.key);
    const refused = outcomes.some((o) => o.kind === OUTCOME.refusal);
    if (refused) {
      // A refusal ends the process: no new questions, only the refusals.
      visible = visible.filter((k) => !open.includes(k));
      outcomes = outcomes.filter((o) => o.kind === OUTCOME.refusal);
    } else if (open.length > 0) {
      const next = relevant.find((q) => q.key === open[0])!;
      outcomes.push({
        id: "next-question:" + next.key,
        kind: OUTCOME.nextStep,
        kindLabel: this.catalog.outcomes[OUTCOME.nextStep]?.label ?? "",
        title: "Answer the next question",
        message: next.label,
        values: [],
        sources: this.sourceRefs(next.sources),
        interpretations: this.interpretationRefs(next.interpretations),
      });
    }

    return {
      visible,
      open,
      answers,
      outcomes,
      inputErrors,
      complete: refused || open.length === 0,
    };
  }
}
