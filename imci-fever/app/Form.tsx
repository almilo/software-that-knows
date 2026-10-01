import { UPDATE_CORE, type JsonSchema, type Middleware, type UISchemaElement } from "@jsonforms/core";
import { JsonForms } from "@jsonforms/react";
import { vanillaCells, vanillaRenderers } from "@jsonforms/vanilla-renderers";
import { useCallback, useMemo, useRef, useState, type FocusEvent } from "react";
import schema from "../generated/schema.json";
import uischema from "../generated/uischema.json";
import type { Assessment } from "./classify";
import { changedFields, errorsFor } from "./validate";

// JSON Forms keeps the form state. Give it the start data only once: if the parent sends its
// copy back on each change, a quick second change can arrive before that copy and be lost.
const start: Assessment = {};

// A field is touched when the user changes it or leaves it. Only touched fields show their errors
// (validate.ts): JSON Forms' own validation is off, and the form passes it the errors to show.
export function Form({ onChange }: { onChange: (data: Assessment) => void }) {
  const [data, setData] = useState<Assessment>(start);
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const touch = (fields: string[]) => {
    if (fields.some((f) => !touched.has(f))) setTouched(new Set([...touched, ...fields]));
  };
  const errors = useMemo(() => errorsFor(data, touched), [data, touched]);
  // JSON Forms loads its `data` prop again whenever another prop changes, here the errors to show.
  // The form then keeps the user's data: the `data` prop counts only when it is a new object.
  const applied = useRef<unknown>(start);
  const keepData = useCallback<Middleware>((state, action, reducer) => {
    if (action.type === UPDATE_CORE) {
      if (action.data === applied.current) return reducer(state, { ...action, data: state.data });
      applied.current = action.data;
    }
    return reducer(state, action);
  }, []);
  // Each control's element has the field's scope as its id, for example "#/properties/malariaRisk".
  const left = (e: FocusEvent) => {
    const id = (e.target as HTMLElement).closest(".control")?.id;
    if (id) touch([id.replace("#/properties/", "")]);
  };

  return (
    <div onBlur={left}>
      <JsonForms
        schema={schema as JsonSchema}
        uischema={uischema as UISchemaElement}
        data={start}
        renderers={vanillaRenderers}
        cells={vanillaCells}
        validationMode="NoValidation"
        additionalErrors={errors}
        middleware={keepData}
        onChange={({ data: next }) => {
          touch(changedFields(data, next));
          setData(next);
          onChange(next);
        }}
      />
    </div>
  );
}
