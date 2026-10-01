import { UPDATE_CORE, type JsonSchema, type Middleware, type UISchemaElement } from "@jsonforms/core";
import { JsonForms } from "@jsonforms/react";
import { vanillaCells, vanillaRenderers } from "@jsonforms/vanilla-renderers";
import { useCallback, useMemo, useRef, useState, type FocusEvent } from "react";
import schema from "../generated/schema.json";
import uischema from "../generated/uischema.json";
import type { Assessment } from "./classify";
import { tabsRenderer } from "./Tabs";
import { changedFields, errorsFor } from "./validate";

// The vanilla renderers, with our own tabs (Tabs.tsx): they show how many answers each tab has.
const renderers = [...vanillaRenderers, tabsRenderer];

// JSON Forms keeps the form state, and it loads `data` again only when it gets a new object.
// So the parent sends a new object only when the data changes outside the form (from a note).
// If the parent sent its copy back on each change, a quick second change could arrive before
// that copy and be lost.
// A field is touched when the user changes it or leaves it. Only touched fields show their errors
// (validate.ts): JSON Forms' own validation is off, and the form passes it the errors to show.
// New data from outside starts with no field touched.
export function Form({ data, onChange }: { data: Assessment; onChange: (data: Assessment) => void }) {
  const [source, setSource] = useState(data);
  const [current, setCurrent] = useState(data);
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  if (data !== source) {
    setSource(data);
    setCurrent(data);
    setTouched(new Set());
  }
  const touch = (fields: string[]) => {
    if (fields.some((f) => !touched.has(f))) setTouched(new Set([...touched, ...fields]));
  };
  const errors = useMemo(() => errorsFor(current, touched), [current, touched]);
  // JSON Forms loads its `data` prop again whenever another prop changes, here the errors to show.
  // The form then keeps the user's data: the `data` prop counts only when it is a new object.
  const applied = useRef<unknown>(data);
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
        data={data}
        renderers={renderers}
        cells={vanillaCells}
        validationMode="NoValidation"
        additionalErrors={errors}
        middleware={keepData}
        onChange={(event) => {
          const next: Assessment = event.data ?? {};
          touch(changedFields(current, next));
          setCurrent(next);
          onChange(next);
        }}
      />
    </div>
  );
}
