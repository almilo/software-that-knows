// Generates rules.json: the classification tables, and the shownWhen condition of each field.
// Its shape is the contract in shared/rules-contract.ts.
import type { Term } from "n3";
import type { ConditionSchema, Rules } from "../shared/rules-contract";
import { compileCondition } from "./compile-condition";
import { fields } from "./generate-form";
import { IMCI, PROV, RDFS, local, type Ontology } from "./read-ontology";

// In the ontology, as in the chart, the first row that matches wins. In rules.json, each row
// condition also says "and no row above it matches", so the rows exclude each other and a
// program that reads rules.json does not need to know about the order.
function exclusive(own: ConditionSchema, above: ConditionSchema[]): ConditionSchema {
  return above.length === 0 ? own : { allOf: [own, { not: { anyOf: above } }] };
}

export function generateRules(o: Ontology): Rules {
  const condition = (node: Term, property: string) =>
    compileCondition(o, o.one(node, `${IMCI}${property}`)!);
  // The labels of the entities that a node was derived from (prov:wasDerivedFrom).
  const derivedFrom = (node: Term) =>
    o.all(node, `${PROV}wasDerivedFrom`).map((source) => o.text(source, `${RDFS}label`) ?? source.value);

  return {
    // The classifier removes the values of hidden fields, so it needs the same conditions as the form.
    shownWhen: Object.fromEntries(
      fields(o).fields.flatMap(({ name, node }) =>
        o.one(node, `${IMCI}shownWhen`) ? [[name, condition(node, "shownWhen")]] : [],
      ),
    ),
    tables: o.ofType(`${IMCI}ClassificationTable`).map((table) => ({
      id: local(table),
      label: o.text(table, `${RDFS}label`)!,
      source: derivedFrom(table).join("; "),
      usedWhen: condition(table, "usedWhen"),
      rows: o.list(o.one(table, `${IMCI}rows`)).map((row, i, rows) => ({
        id: local(row),
        label: o.text(row, `${RDFS}label`)!,
        severity: o.text(o.one(row, `${IMCI}severity`)!, `${RDFS}label`)!,
        matchesWhen: exclusive(condition(row, "matchesWhen"), rows.slice(0, i).map((above) => condition(above, "matchesWhen"))),
        qualifiers: o.list(o.one(row, `${IMCI}qualifiers`)).map((q) => ({
          label: o.text(q, `${RDFS}label`)!,
          givenWhen: condition(q, "givenWhen"),
          derivedFrom: derivedFrom(q),
        })),
        treatments: o.list(o.one(row, `${IMCI}treatments`)).map((t) => ({
          label: o.text(t, `${RDFS}label`)!,
          ...(o.one(t, `${IMCI}givenWhen`) ? { givenWhen: condition(t, "givenWhen") } : {}),
          derivedFrom: derivedFrom(t),
        })),
        derivedFrom: derivedFrom(row),
      })),
    })),
  };
}
