import { createAjv } from "@jsonforms/core";
import generatedRules from "../generated/rules.json";
import type { ConditionSchema, Rules } from "../shared/rules-contract";

export type Assessment = Record<string, unknown>;
export type Result = {
  table: string;
  source: string;
  // undefined when the table is used but no row matches yet, for example before the malaria test
  classification?: {
    label: string;
    severity: string;
    qualifiers: string[];
    treatments: string[];
    // The source entities of the row, and of the qualifiers and treatments that apply
    derivedFrom: string[];
  };
};

const rules: Rules = generatedRules;

const ajv = createAjv();
const matches = (condition: ConditionSchema, data: Assessment) => ajv.validate(condition, data) as boolean;

// Remove the values of hidden fields. One field can hide another, so repeat until nothing changes.
export function visibleOnly(data: Assessment): Assessment {
  const visible = { ...data };
  let changed = true;
  while (changed) {
    changed = false;
    for (const [field, condition] of Object.entries(rules.shownWhen)) {
      if (field in visible && !matches(condition, visible)) {
        delete visible[field];
        changed = true;
      }
    }
  }
  return visible;
}

// Sorts IDs like CHE.DT.01.CL84 by their numbers, so CL84 comes before CL100.
const byId = new Intl.Collator("en", { numeric: true });

const rank = (r: Result) => {
  const i = ["pink", "yellow", "green"].indexOf(r.classification?.severity ?? "");
  return i < 0 ? 3 : i;
};

// For each table that is used, the one row that matches. The most severe result comes first.
export function classify(data: Assessment): Result[] {
  const input = visibleOnly(data);
  return rules.tables
    .filter((table) => matches(table.usedWhen, input))
    .map((table) => {
      const rows = table.rows.filter((r) => matches(r.matchesWhen, input));
      // The rows exclude each other (see shared/rules-contract.ts), so more than one is a generator error.
      if (rows.length > 1) throw new Error(`${table.label}: more than one row matches: ${rows.map((r) => r.label)}`);
      const row = rows[0];
      if (!row) return { table: table.label, source: table.source };
      const qualifiers = row.qualifiers.filter((q) => matches(q.givenWhen, input));
      const treatments = row.treatments.filter((t) => !t.givenWhen || matches(t.givenWhen, input));
      const derivedFrom = [row, ...qualifiers, ...treatments].flatMap((part) => part.derivedFrom).sort(byId.compare);
      return {
        table: table.label,
        source: table.source,
        classification: {
          label: row.label,
          severity: row.severity,
          qualifiers: qualifiers.map((q) => q.label),
          treatments: treatments.map((t) => t.label),
          derivedFrom: [...new Set(derivedFrom)],
        },
      };
    })
    .sort((a, b) => rank(a) - rank(b));
}
