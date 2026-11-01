// The shape of the generated file (domains/<name>/generated/model.json), which the engine and the
// app read. The generator writes it from the knowledge model (generator/generate-model.ts).

// A concept of one of the five lists, of an entity type, or of a ranking. words: rdfs:label and
// skos:altLabel, in lower case, for the questions.
export type Concept = { id: string; code: string; label: string; words: string[]; definition?: string };

export type Measure = Concept & { sourceMeasure: string };
export type TimeBasis = Concept & { yearOffset: number };
export type SliceKind = "Month" | "YearToDate" | "FullYear";
export type TimeSlice = Concept & { kind: SliceKind };
export type Comparison = { of: string; against: string; inputSuffix: string; owner?: string; above: string; below: string; equal: string };
export type Scenario = Concept & { sourceVersion?: string; comparison?: Comparison };
export type Suffix = Concept & { format: "currency" | "percent" };

// The five lists, in the order of the parts of a name.
export type Parts = { measure: Measure[]; timeBasis: TimeBasis[]; timeSlice: TimeSlice[]; scenario: Scenario[]; suffix: Suffix[] };
export type PartKey = keyof Parts;

export type EntityType = Concept & { sourceColumn?: string; via?: string; whole: boolean };
export type Entity = { id: string; type: string; code?: string; label: string; words: string[]; roles: string[]; links: Record<string, string> };

export type Visibility = { role: string; scope: "All" | "Own" };
export type Template = { id: string; label: string; about: string; text: string; visibleTo: Visibility[] };
export type Ranking = Concept & { of: string; candidates: { label: string; variable: string }[]; decision?: string };

export type Period = { month: string; comment: string };

// A source row, as in the CSV file: the codes and the amount, nothing else.
export type SourceRow = { id: string; date: string; version: string; measure: string; amount: number; [column: string]: unknown };

export type FiguresModel = {
  domain: { title: string; intro: string; source: string; sourceTitle: string; currencySymbol: string; fiscalYearStart: number };
  periods: Period[];
  partOrder: { key: PartKey; label: string }[];
  parts: Parts;
  entityTypes: EntityType[];
  entities: Entity[];
  roles: { id: string; label: string }[];
  owners: { id: string; label: string }[];
  templates: Template[];
  rankings: Ranking[];
  rankingWords: string[];
};
