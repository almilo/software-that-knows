// The form fields, as the note interpreters need them: their definitions from schema.json, and their order
// from uischema.json (tab by tab, top to bottom). Both files are generated from the ontology.
import schema from "../generated/schema.json";
import uischema from "../generated/uischema.json";

export type Field = { type: string; title: string; description?: string; enum?: string[]; minimum?: number; maximum?: number };

export const fields: Record<string, Field> = schema.properties;

export const formOrder: string[] = uischema.elements.flatMap((tab) =>
  tab.elements.map((control) => control.scope.replace("#/properties/", "")),
);

export const answerText = (value: unknown) => (value === true ? "yes" : value === false ? "no" : String(value));
