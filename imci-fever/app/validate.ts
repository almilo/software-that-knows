import { createAjv } from "@jsonforms/core";
import type { ErrorObject } from "ajv";
import schema from "../generated/schema.json";
import type { Assessment } from "./classify";

// The form validates the data against the generated schema itself, instead of JSON Forms, so that
// it can show an error only for a field the user has touched: a required question would otherwise
// show "is a required property" as soon as it appears, before the user could answer it.
const validate = createAjv().compile(schema);

// The field an error is about: the missing property of a "required" error, otherwise the first
// step of the error's path.
export function fieldOf(error: ErrorObject): string {
  return error.keyword === "required" ? String(error.params.missingProperty) : (error.instancePath.split("/")[1] ?? "");
}

export function errorsFor(data: Assessment, touched: ReadonlySet<string>): ErrorObject[] {
  return validate(data) ? [] : (validate.errors ?? []).filter((e) => touched.has(fieldOf(e)));
}

// The fields whose value differs between two versions of the data.
export function changedFields(before: Assessment, after: Assessment): string[] {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((f) => before[f] !== after[f]);
}
