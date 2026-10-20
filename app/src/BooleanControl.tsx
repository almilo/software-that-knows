// A JSON Forms control for booleans with "Yes" and "No". A checkbox cannot
// show the difference between "No" and "not answered".
import { type ControlProps, isBooleanControl, rankWith } from "@jsonforms/core";
import { withJsonFormsControlProps } from "@jsonforms/react";

function BooleanControl({ data, handleChange, path, label, description, errors, visible, enabled, id }: ControlProps) {
  if (!visible) return null;
  const option = (value: boolean, text: string) => (
    <label className="option">
      <input type="radio" name={id} checked={data === value} disabled={!enabled} onChange={() => handleChange(path, value)} />
      {text}
    </label>
  );
  return (
    <fieldset className="control boolean" id={id}>
      <legend>{label}</legend>
      {description && <div className="input-description">{description}</div>}
      <div className="options">
        {option(true, "Yes")}
        {option(false, "No")}
      </div>
      {errors && <div className="validation validation_error">{errors}</div>}
    </fieldset>
  );
}

export const booleanControlEntry = {
  tester: rankWith(3, isBooleanControl),
  renderer: withJsonFormsControlProps(BooleanControl),
};
