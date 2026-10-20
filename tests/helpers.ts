import appModelJson from "../app/src/generated/app-model.json";
import { modelTurtle } from "../app/src/generated/model.ts";
import type { AppModel } from "../app/src/app-model.ts";
import { createEngine, type Evaluation } from "../app/src/engine.ts";

export const appModel = appModelJson as unknown as AppModel;
export const engine = createEngine(appModel, modelTurtle);

export const FZ = "https://github.com/almilo/software-that-knows/model/famzg#";
export const SK = "https://github.com/almilo/software-that-knows/vocabulary#";

// The form data uses the IRIs of the choices as values (see the JSON schema).
export function choice(questionKey: string, label: string): string {
  const options = (appModel.schema.properties[questionKey].oneOf ?? []) as { const: string; title: string }[];
  const option = options.find((o) => o.title === label);
  if (!option) throw new Error(`No option "${label}" for ${questionKey}`);
  return option.const;
}

export const kinds = (e: Evaluation) => e.results.map((r) => r.rule.kind.replace(SK, ""));
export const rulesOf = (e: Evaluation) => e.results.map((r) => r.rule.iri.replace(FZ, ""));
export const resultOf = (e: Evaluation, rule: string) => e.results.find((r) => r.rule.iri === FZ + rule);
