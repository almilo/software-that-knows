// A domain: one process that the app can run, under one law or ordinance.
// Each domain has its own folder (domains/<name>/) with its model, the files generated from it,
// its tests and its entry page. This file turns those files into what the app needs; nothing else
// in the app depends on the domain.
import { createContext, useContext } from "react";
import { createSubmit } from "../core/submit";
import { createEngine, today, type Answers } from "../core/engine";
import { createSteps, type UiSchema } from "./steps";
import { createValidator } from "../core/validate";

export type DomainFiles = {
  model: string[]; // the Turtle files of the domain
  schema: { i18n: string } & Record<string, unknown>; // generated/schema.json
  uischema: UiSchema; // generated/uischema.json
  messages: Record<string, unknown>; // generated/messages.json: texts by language
  region: string; // from generated/domain.json: how dates and numbers are written
};

// The engine needs the WebAssembly of Oxigraph to be ready (core/rdf.ts).
export function createDomain(files: DomainFiles) {
  const engine = createEngine(files.model);
  const validator = createValidator(files.schema);
  function evaluate(answers: Answers, date = today()) {
    return engine.evaluate(answers, date);
  }
  const { $comment: _, ...messages } = files.messages as Record<string, Record<string, string>>;
  return {
    schema: files.schema,
    messages,
    languages: Object.keys(messages),
    region: files.region,
    steps: createSteps(files.uischema),
    validator,
    evaluate,
    submit: createSubmit(evaluate, validator),
  };
}

export type Domain = ReturnType<typeof createDomain>;
export const DomainContext = createContext<Domain | null>(null);
export function useDomain() {
  return useContext(DomainContext)!;
}
