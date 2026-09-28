// Changes a condition from the ontology into a JSON Schema. The form data matches the condition
// when it is valid against the schema. JSON Forms uses these schemas to show fields, and the
// classifier uses them to select rows and treatments.
import type { Term } from "n3";
import type { ConditionSchema } from "../shared/rules-contract";
import { IMCI, literal, local, type Ontology } from "./read-ontology";

export function compileCondition(o: Ontology, c: Term): ConditionSchema {
  if (c.termType === "NamedNode" && !o.isA(c, `${IMCI}Condition`)) {
    throw new Error(`${local(c)} is used as a condition, but it is not an imci:Condition`);
  }

  const field = o.one(c, `${IMCI}field`);
  if (field) {
    const name = local(field);
    // A condition on a field that the form does not have is never true, so the error would be silent.
    if (!o.isField(field)) throw new Error(`The condition uses ${name}, but no field in the form has this name`);
    const equals = o.one(c, `${IMCI}equals`);
    const atLeast = o.number(c, `${IMCI}atLeast`);
    const test = equals ? { const: literal(equals) } : { minimum: atLeast };
    if (!equals && atLeast === undefined) throw new Error(`The condition on ${name} has no imci:equals or imci:atLeast`);
    // "required" is necessary: without it, a field with no value is valid against any test.
    return { properties: { [name]: test }, required: [name] };
  }

  for (const op of ["allOf", "anyOf"]) {
    const items = o.one(c, `${IMCI}${op}`);
    if (items) return { [op]: o.list(items).map((item) => compileCondition(o, item)) };
  }

  const not = o.one(c, `${IMCI}not`);
  if (not) return { not: compileCondition(o, not) };

  throw new Error(`Not a condition: ${c.value}`);
}
