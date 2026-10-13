// The shape of a generated decision (domains/<name>/generated/decision.json, written by
// generator/generate-decision.ts). The decision code and the app know only this shape.
export type Atom = { criterion: string; answers: string[] };
export type Clause = Atom[];

export type Rule = {
  id: string;
  label: string;
  recommends?: string;
  part?: string;
  quote: string;
  explanation: string;
  when: Clause[];
  whenChosen?: string;
};

export type Criterion = {
  key: string;
  label: string;
  definition: string;
  answers: { code: string; label: string; definition?: string }[];
};

export type Option = {
  id: string;
  label: string;
  dimensions: { label: string; inRecommendation: boolean; characteristics: string[] }[];
  tools: { label: string; availableWith?: { criterion: string; answer: string } }[];
};

export type Step = { id: string; option: string; level: string; levelOrder: number; explanation: string };

export type DecisionModel = {
  domain: {
    title: string;
    intro: string;
    author: string;
    source: string;
    sourceTitle: string;
    optionsTitle: string;
    additionsTitle?: string;
    ladderTitle?: string;
    ladderQuote?: string;
    recordTitle: string;
    recordName: string;
    recordFile: string;
    recordAppendix?: string;
  };
  notSure: string;
  criteria: Criterion[];
  options: Option[];
  rules: { choice: Rule[]; additions: Rule[]; cautions: Rule[] };
  ladder: Step[];
};
