import { UPDATE_CORE, type JsonSchema, type Middleware, type Translator, type UISchemaElement } from "@jsonforms/core";
import { JsonForms } from "@jsonforms/react";
import { vanillaCells, vanillaRenderers } from "@jsonforms/vanilla-renderers";
import type { ErrorObject } from "ajv";
import { useCallback, useMemo, useRef, useState, type FocusEvent } from "react";
import { useDomain } from "./domain";
import type { Answers } from "../core/engine";
import { useI18n } from "./i18n";
import { fieldOf } from "../core/validate";

// The questions of one wizard step (Wizard.tsx gives its part of the generated UI schema).
// JSON Forms keeps the form state, and loads `data` again only when it gets a new object, so the
// wizard sends a new object only when the step changes.
// A field is touched when the user changes it or leaves it, or when the wizard reveals it (the user
// pressed Next with it open). Only touched fields show their errors.
type Props = { data: Answers; uischema: unknown; revealed: ReadonlySet<string>; onChange: (data: Answers) => void };

export function Form({ data, uischema, revealed, onChange }: Props) {
  const { language, text, t } = useI18n();
  const { schema, validator } = useDomain();
  const [current, setCurrent] = useState(data);
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  function touch(fields: string[]) {
    if (fields.some((f) => !touched.has(f))) setTouched(new Set([...touched, ...fields]));
  }
  const errors = useMemo(() => {
    const shown = validator.errorsFor(current, new Set([...touched, ...revealed]));
    const unanswered = [...revealed]
      .filter((f) => current[f] === undefined && !shown.some((e) => fieldOf(e) === f))
      .map((f): ErrorObject => ({ instancePath: `/${f}`, schemaPath: "", keyword: "answer", params: {} }));
    return [...shown, ...unanswered];
  }, [current, touched, revealed]);
  // The texts of the model and the app, in the language of the app (https://jsonforms.io/docs/i18n).
  const i18n = useMemo(
    () => ({
      locale: language,
      translate: ((key: string, fallback?: string) => text(key === "enum.none" ? "choose.label" : key) ?? fallback) as Translator,
      translateError: (error: ErrorObject) => t(`${error.keyword}Error.label`, error.params),
    }),
    [language],
  );
  // JSON Forms loads its `data` prop again whenever another prop changes: the errors, the visible
  // questions, the language. The form then keeps the user's data: `data` counts only when it is a
  // new object.
  const applied = useRef<unknown>(data);
  const keepData = useCallback<Middleware>((state, action, reducer) => {
    if (action.type === UPDATE_CORE) {
      if (action.data === applied.current) return reducer(state, { ...action, data: state.data });
      applied.current = action.data;
    }
    return reducer(state, action);
  }, []);
  // Each control's element has the field's scope as its id, for example "#/properties/birthDate".
  function left(e: FocusEvent) {
    const id = (e.target as HTMLElement).closest(".control")?.id;
    if (id) touch([id.replace("#/properties/", "")]);
  }

  return (
    <div onBlur={left}>
      <JsonForms
        schema={schema as JsonSchema}
        uischema={uischema as UISchemaElement}
        data={data}
        renderers={vanillaRenderers}
        cells={vanillaCells}
        i18n={i18n}
        validationMode="NoValidation"
        // Descriptions stay visible: if they appeared only on focus, leaving a field would move the
        // Next button away under the pointer, and the click would be lost.
        config={{ showUnfocusedDescription: true }}
        additionalErrors={errors}
        middleware={keepData}
        onChange={(event) => {
          const next: Answers = event.data ?? {};
          touch(changedFields(current, next));
          setCurrent(next);
          onChange(next);
        }}
      />
    </div>
  );
}

// The fields whose value differs between two versions of the data.
function changedFields(before: Answers, after: Answers) {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((f) => before[f] !== after[f]);
}
