// Generates the two files that JSON Forms needs, from the SHACL shape:
//   schema.json    one property for each field (sh:property), and the required fields (sh:minCount)
//   uischema.json  one tab for each sh:PropertyGroup, with a SHOW rule for each imci:shownWhen
import type { Term } from "n3";
import { compileCondition } from "./compile-condition";
import { IMCI, RDFS, SH, XSD, literal, local, type Ontology } from "./read-ontology";

const datatypes: Record<string, string> = {
  [`${XSD}boolean`]: "boolean",
  [`${XSD}integer`]: "integer",
  [`${XSD}decimal`]: "number",
};

const byOrder = (a: { order: number }, b: { order: number }) => a.order - b.order;

export function fields(o: Ontology) {
  const shape = o.ofType(`${SH}NodeShape`)[0]!;
  return {
    title: o.text(shape, `${RDFS}label`),
    fields: o.all(shape, `${SH}property`).map((node) => ({
      name: local(o.one(node, `${SH}path`)!),
      tab: o.one(node, `${SH}group`)!,
      order: o.number(node, `${SH}order`) ?? 0,
      node,
    })),
  };
}

// definitions: the DAK definition of each field (join-dak.ts). A field's own sh:description wins.
export function generateForm(o: Ontology, definitions: Record<string, string> = {}) {
  const { title, fields: all } = fields(o);

  const schema = {
    type: "object",
    title,
    properties: Object.fromEntries(
      all.map(({ name, node }) => {
        const choices = o.one(node, `${SH}in`);
        const property: Record<string, unknown> = choices
          ? { type: "string", enum: o.list(choices).map(literal) }
          : { type: datatypes[o.text(node, `${SH}datatype`)!] };
        if (!property.type) throw new Error(`The field ${name} has no type`);
        property.title = o.text(node, `${SH}name`);
        const description = o.text(node, `${SH}description`) ?? definitions[name];
        if (description) property.description = description;
        if (o.one(node, `${SH}minInclusive`)) property.minimum = o.number(node, `${SH}minInclusive`);
        if (o.one(node, `${SH}maxInclusive`)) property.maximum = o.number(node, `${SH}maxInclusive`);
        return [name, property];
      }),
    ),
    // sh:minCount 1 means that the field must have a value. JSON Forms marks it as required.
    required: all.filter(({ node }) => (o.number(node, `${SH}minCount`) ?? 0) >= 1).map(({ name }) => name),
  };

  // A JSON Forms rule is an effect and a condition, like the rules in the ontology.
  const show = (node: Term) => {
    const when = o.one(node, `${IMCI}shownWhen`);
    return when ? { rule: { effect: "SHOW", condition: { scope: "#", schema: compileCondition(o, when) } } } : {};
  };

  const tabs = o
    .ofType(`${SH}PropertyGroup`)
    .map((node) => ({ node, order: o.number(node, `${SH}order`) ?? 0 }))
    .sort(byOrder);

  const uischema = {
    type: "Categorization",
    elements: tabs.map(({ node }) => ({
      type: "Category",
      label: o.text(node, `${RDFS}label`),
      ...show(node),
      elements: all
        .filter((f) => f.tab.equals(node))
        .sort(byOrder)
        .map((f) => ({ type: "Control", scope: `#/properties/${f.name}`, ...show(f.node) })),
    })),
  };

  return { schema, uischema };
}
