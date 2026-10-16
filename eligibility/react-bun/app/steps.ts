// The steps of the wizard: one for each category of the generated UI schema (one sh:PropertyGroup
// of the model), in their order, then the review. A step is complete when each question that it
// asks has an answer, and no answer has an error.
import type { Answers, Evaluation } from "../core/engine";
import { fieldOf, type Validator } from "../core/validate";

type Control = { type: string; scope: string };
export type UiSchema = { elements: { i18n: string; elements: Control[] }[] };
export type Step = { id: string; fields: string[]; controls: Control[] };

export function createSteps(uischema: UiSchema) {
  return uischema.elements.map((category) => ({
    id: category.i18n,
    fields: category.elements.map(fieldOfControl),
    controls: category.elements,
  }) satisfies Step);
}

// The questions of the step that the model asks for these answers.
export function asked(step: Step, e: Evaluation) {
  return step.fields.filter((f) => e.shown.includes(f));
}

// The UI schema of the step. A question that is not asked stays in it, hidden: JSON Forms keeps
// the element ids of the controls by their position, so the positions must not change.
export function layout(step: Step, e: Evaluation) {
  return {
    type: "VerticalLayout",
    elements: step.controls.map((c) => (e.shown.includes(fieldOfControl(c)) ? c : { ...c, rule: { effect: "HIDE", condition: always } })),
  };
}

// The questions of the step that still need an answer, or whose answer has an error.
export function open(step: Step, e: Evaluation, data: Answers, { errorsFor }: Validator) {
  const wrong = new Set(errorsFor(data, new Set(asked(step, e))).map(fieldOf));
  return asked(step, e).filter((f) => e.missing.includes(f) || wrong.has(f));
}

const always = { scope: "#", schema: {} };

function fieldOfControl(c: Control) {
  return c.scope.replace("#/properties/", "");
}
