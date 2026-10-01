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

// The shape of generated/lexicon.json: how a note in free text states each field. Two sources:
// code derives words from the field's own label (sh:name), and part 6 of the ontology adds the
// words that need judgement (extended with .claude/skills/extract-words). The words interpreter in note/ uses it to find the fields that a note mentions and to
// check the evidence that the language model quotes. All words are in lower case.
export type ValueWords = { value: string; labels: string[]; minDays?: number; maxDays?: number };
export type FieldWords = {
  labels: string[]; // the field's label (sh:name) and skos:altLabel: the words that state the field (for yes/no: that the sign is present)
  absent: string[]; // imci:absentLabel: the words that state that a yes/no sign is absent
  values?: ValueWords[]; // imci:valueLabel: the words for each allowed value
  definition?: string; // the definition of the field's DAK data element (source/dak-data-dictionary.json)
};
export type Lexicon = { fields: Record<string, FieldWords> };
