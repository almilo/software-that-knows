// Generates the two files that JSON Forms needs, from the SHACL shape:
//   schema.json    one property for each field (sh:property): its type and its limits
//   uischema.json  one category for each sh:PropertyGroup, with its questions in order
// The texts are in messages.json (generate-messages.ts). Which questions are asked, and which
// answers they need, the engine decides with the model (core/engine.ts).
import type { Field, Shape } from "../core/model";
import { XSD, local } from "../core/rdf";

const types: Record<string, Record<string, string>> = {
  [`${XSD}string`]: { type: "string" },
  [`${XSD}date`]: { type: "string", format: "date" },
  [`${XSD}integer`]: { type: "integer" },
  [`${XSD}decimal`]: { type: "number" },
  [`${XSD}boolean`]: { type: "boolean" },
};

function property(f: Field) {
  const type = f.choices ? { type: "string", enum: f.choices.map(local) } : types[f.datatype ?? ""];
  if (!type) throw new Error(`The field ${f.name} has no sh:in and no known sh:datatype`);
  return { ...type, ...(f.minimum !== undefined && { minimum: f.minimum }), ...(f.maximum !== undefined && { maximum: f.maximum }) };
}

export function generateForm(shape: Shape) {
  const schema = {
    type: "object",
    // The key of the title and description in messages.json.
    i18n: shape.name,
    properties: Object.fromEntries(shape.fields.map((f) => [f.name, property(f)])),
    additionalProperties: false,
  };

  const uischema = {
    type: "Categorization",
    elements: shape.groups.map((group) => ({
      type: "Category",
      label: group,
      i18n: group,
      elements: shape.fields
        .filter((f) => f.group === group)
        .map((f) => ({ type: "Control", scope: `#/properties/${f.name}` })),
    })),
  };

  return { schema, uischema };
}
