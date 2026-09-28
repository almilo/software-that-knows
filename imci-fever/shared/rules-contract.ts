// The shape of generated/rules.json, which both sides agree to.
// generator/generate-rules.ts writes it, and app/classify.ts reads it.
// The keys have the same names as the ontology terms (imci:usedWhen, imci:matchesWhen, ...).

// A condition, compiled to a JSON Schema. The form data matches the condition when it is valid.
export type ConditionSchema = Record<string, unknown>;

export type Treatment = {
  label: string;
  givenWhen?: ConditionSchema;
  // The source entities that the treatment was derived from (prov:wasDerivedFrom).
  derivedFrom: string[];
};

// A qualifier adds detail to a classification, for example "Malaria unconfirmed".
export type Qualifier = {
  label: string;
  givenWhen: ConditionSchema;
  derivedFrom: string[];
};

// One row of a classification table.
export type Classification = {
  id: string;
  label: string;
  severity: string;
  matchesWhen: ConditionSchema;
  qualifiers: Qualifier[];
  treatments: Treatment[];
  derivedFrom: string[];
};

export type ClassificationTable = {
  id: string;
  label: string;
  // The source documents of the table (prov:wasDerivedFrom), as one line of text.
  source: string;
  usedWhen: ConditionSchema;
  // At most one row matches: each row condition excludes the rows above it.
  rows: Classification[];
};

export type Rules = {
  // For each field that is not always shown: the condition that shows it.
  shownWhen: Record<string, ConditionSchema>;
  tables: ClassificationTable[];
};
