import type { JsonSchema, UISchemaElement } from "@jsonforms/core";
import { JsonForms } from "@jsonforms/react";
import { vanillaCells, vanillaRenderers } from "@jsonforms/vanilla-renderers";
import schema from "../generated/schema.json";
import uischema from "../generated/uischema.json";
import type { Assessment } from "./classify";

// JSON Forms keeps the form state. Give it the start data only once: if the parent sends its
// copy back on each change, a quick second change can arrive before that copy and be lost.
const start: Assessment = {};

export function Form({ onChange }: { onChange: (data: Assessment) => void }) {
  return (
    <JsonForms
      schema={schema as JsonSchema}
      uischema={uischema as UISchemaElement}
      data={start}
      renderers={vanillaRenderers}
      cells={vanillaCells}
      onChange={({ data }) => onChange(data)}
    />
  );
}
