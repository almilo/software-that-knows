// The shape of the file that the generator writes (app-model.json).
// It describes questions, rules and sources in terms of the sk: vocabulary.

export type QuestionKind = "choice" | "date" | "boolean" | "number" | "text";

export interface Entry {
  iri: string;
  label: string;
  order: number;
}

export interface Choice extends Entry {
  definition?: string;
}

export interface Question {
  iri: string;
  key: string;
  path: string;
  kind: QuestionKind;
  datatype?: string;
  label: string;
  description?: string;
  order: number;
  group?: string;
  choices: Choice[];
  minimum?: number;
  maximum?: number;
  sources: string[];
  interpretations: string[];
  openPoints: string[];
  relevanceRules: string[];
}

export interface RelevanceRule {
  iri: string;
  asks: string;
}

export interface Rule {
  iri: string;
  label: string;
  kind: string;
  status: string;
  message: string;
  sources: string[];
  interpretations: string[];
  openPoints: string[];
}

export interface ResultKind extends Entry {
  definition?: string;
}

export interface Source {
  iri: string;
  label: string;
  url?: string;
  quote?: string;
  origin?: { iri: string; label: string; url?: string };
}

export interface Interpretation extends Entry {
  comment: string;
  sources: string[];
}

export interface OpenPoint extends Entry {
  comment: string;
}

export interface AppModel {
  title: string;
  description: string;
  answerClass: string;
  questionnaire: string;
  groups: Entry[];
  questions: Question[];
  relevanceRules: RelevanceRule[];
  rules: Rule[];
  kinds: ResultKind[];
  statuses: Record<string, Entry>;
  sources: Record<string, Source>;
  interpretations: Record<string, Interpretation>;
  openPoints: Record<string, OpenPoint>;
  schema: { type: "object"; properties: Record<string, Record<string, unknown>> };
}
