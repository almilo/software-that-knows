// The shape of the generated policy (generated/policy.json, written by generator/generate.ts from
// the Turtle files in ontology/). The engine and the app know only this shape. Every id is the
// local name of the resource in the model; an article id is its number without spaces ("202.3a").

// A condition on one fact, or several conditions of which one is enough.
export type Condition = { fact: string; in?: string[]; notIn?: string[]; atLeast?: number; below?: number } | { anyOf: Condition[] };

export type Value = { id: string; label: string; help?: string };

export type Fact = {
  id: string;
  // claim, guide and date facts are asked; certificate facts come from the certificate of a policy.
  group: "claim" | "guide" | "date" | "certificate";
  label: string;
  help?: string;
  kind: "choice" | "number" | "date";
  unit?: string;
  values: Value[];
  order: number;
  // Always asked.
  required: boolean;
  // Asked only when these conditions hold; for the facts that no rule uses, such as amounts.
  askWhen: Condition[];
  // The optional cover, or the module, that the answer says is in the policy (first answer) or not.
  optionOf?: string;
  moduleOf?: string;
  // The cover that this number is a sum insured of.
  sumOf?: string;
  // The calculations of an amount that need this answer.
  neededFor: string[];
  closedList?: string;
};

export type Availability = "basic" | "option" | "none";

export type Cover = {
  id: string;
  label: string;
  part: string;
  module: string;
  group?: string;
  order: number;
  // How the engine calculates an amount: vehicle (repair or total loss) or item. Without it, the
  // claim check shows the benefits of the cover.
  calculation?: "vehicle" | "item";
  // By vehicle class: the product overview. Basic: in the policy when its module is.
  availability: Record<string, Availability>;
  note?: string;
  noDeductible: boolean;
  reducibleDeductible: boolean;
  sources: string[];
};

export type RuleKind = "cover" | "exclusion" | "reduction" | "waiver" | "territory";

export type Rule = {
  id: string;
  kind: RuleKind;
  label: string;
  // The cover that a cover rule (or a territory rule that gives cover) gives.
  covers?: string;
  // The covers that the rule is about, with the parts expanded to their covers.
  appliesTo: string[];
  // The covers and parts as the model names them, for display.
  appliesToNamed: string[];
  when: Condition[];
  sources: string[];
  mentions: string[];
  order: number;
};

export type Precedence = { id: string; winner: string; loser: string; basis: "text" | "interpretation"; comment: string };

export type ClosedList = { id: string; label: string; items: string[]; sources: string[]; note?: string };
export type Concept = { id: string; label: string; order: number };
export type Parameter = { id: string; label: string; amount: number; sources: string[]; mentions: string[] };
export type Benefit = { id: string; label: string; covers: string[]; mentions: string[]; limit?: number; per?: string; note?: string; sources: string[] };
export type Comparison = { id: string; label: string; left: string; right: string };
export type CompensationRow = { year: number; fromShare: number; toShare: number; sources: string[] };

export type Obligation = { id: string; label: string; action: string; consequence?: string; when: Condition[]; sources: string[] };
export type Deadline = { id: string; label: string; anchor: string; offset: string; who: string; meaning: string; sources: string[] };

export type Article = {
  id: string;
  number: string;
  title: string;
  summary?: string;
  part?: string;
  within?: string;
  refersTo: string[];
  page?: number;
};

export type Part = { id: string; label: string; modelled: boolean };
export type Module = { id: string; label: string; part: string; mandatory: boolean; sources: string[] };
// What one policy includes: its answers to the certificate facts.
export type Certificate = { id: string; label: string; comment?: string; answers: Answers };
export type VehicleClass = { id: string; label: string; help?: string };

export type Policy = {
  title: string;
  publisher: string;
  source: string;
  parts: Part[];
  vehicleClasses: VehicleClass[];
  modules: Module[];
  certificates: Certificate[];
  covers: Cover[];
  facts: Fact[];
  rules: Rule[];
  precedences: Precedence[];
  closedLists: ClosedList[];
  concepts: Concept[];
  parameters: Parameter[];
  benefits: Benefit[];
  comparisons: Comparison[];
  compensation: CompensationRow[];
  obligations: Obligation[];
  deadlines: Deadline[];
  articles: Article[];
};

// The answers of a user: a value id for a choice, a number, or a date as YYYY-MM-DD.
export type Answers = Record<string, string | number>;
