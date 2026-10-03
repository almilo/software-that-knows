import { createAjv } from "@jsonforms/core";
import type { ErrorObject } from "ajv";
import type { Answers } from "./engine";

// The answers are checked against the generated schema of the domain here, instead of in JSON
// Forms, so that the form can show an error only for a field the user has touched (Form.tsx). The
// submission (submit.ts) uses the same check.
export function createValidator(schema: object) {
  const validate = createAjv().compile(schema);
  function errorsFor(data: Answers, fields: ReadonlySet<string>) {
    return validate(data) ? [] : (validate.errors ?? []).filter((e) => fields.has(fieldOf(e)));
  }
  return { validate, errorsFor };
}

export type Validator = ReturnType<typeof createValidator>;

// The field an error is about: the first step of the error's path, or the extra property.
export function fieldOf(error: ErrorObject) {
  return error.keyword === "additionalProperties" ? String(error.params.additionalProperty) : (error.instancePath.split("/")[1] ?? "");
}
