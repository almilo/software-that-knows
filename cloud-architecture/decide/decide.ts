// The decision, from the team's answers and the generated rules (generated/decision.json): the
// style of the system, the parts that are better in another style, the cautions, and the tools of
// those parts that fit the team's platform. Answers may be missing or "not sure": the decision then holds all
// the outcomes that the open answers still allow, and knows which questions can change it.
import decision from "../generated/decision.json";

// Criterion key → answer code. A missing key is a question not answered yet.
export type Answers = Record<string, string>;
export type Clause = (typeof decision.rules.style)[number]["when"][number];
export type Outcome = { style: string; parts: string[]; cautions: string[]; tools: string[] };

export const { criteria, styles, rules, notSure } = decision;

// The outcome for answers that leave nothing open.
export function evaluate(answers: Answers): Outcome {
  const applies = (rule: { when: Clause[] }) => rule.when.every((c) => clauseState(c, answers) === "met");
  const parts = rules.parts.filter(applies).map((r) => r.id);
  return {
    style: rules.style.find(applies)!.id,
    parts,
    cautions: rules.cautions.filter(applies).map((r) => r.id),
    tools: partTools(parts, answers.platform),
  };
}

// Every outcome that the open answers (missing or "not sure") still allow, without repeats.
export function possibleOutcomes(answers: Answers) {
  const outcomes = completions(answers, open(answers)).map(evaluate);
  return [...new Map(outcomes.map((o) => [key(o), o])).values()];
}

// The questions not answered yet whose answer can still change the outcome, in the order of the
// form. A "not sure" answer is open, but not asked again.
export function questionsThatMatter(answers: Answers) {
  const unknown = open(answers);
  return criteria.filter((c) => !(c.key in answers) && matters(c.key, answers, unknown));
}

// Whether the answers meet a clause, cannot meet it, or leave it open.
export function clauseState(clause: Clause, answers: Answers) {
  if (clause.some((atom) => atom.answers.includes(answers[atom.criterion]!))) return "met";
  if (clause.every((atom) => isAnswered(answers, atom.criterion))) return "unmet";
  return "open";
}

// A clause in words: "Expected scale: High, or Team size: Large"; "Operations maturity: Medium / High".
export function describeClause(clause: Clause) {
  return clause
    .map((atom) => {
      const c = criteria.find((x) => x.key === atom.criterion)!;
      return `${c.label}: ${atom.answers.map((a) => c.answers.find((x) => x.code === a)!.label).join(" / ")}`;
    })
    .join(", or ");
}

function matters(criterion: string, answers: Answers, unknown: string[]) {
  const others = unknown.filter((k) => k !== criterion);
  const values = criteria.find((c) => c.key === criterion)!.answers.map((a) => a.code);
  return completions(answers, others).some((completion) => {
    const outcomes = values.map((v) => key(evaluate({ ...completion, [criterion]: v })));
    return outcomes.some((o) => o !== outcomes[0]);
  });
}

// Every way to answer the given open questions, on top of the answers.
function completions(answers: Answers, keys: string[]): Answers[] {
  return keys.reduce(
    (partial, k) => partial.flatMap((a) => criteria.find((c) => c.key === k)!.answers.map((x) => ({ ...a, [k]: x.code }))),
    [Object.fromEntries(Object.entries(answers).filter(([k]) => isAnswered(answers, k)))],
  );
}

function open(answers: Answers) {
  return criteria.map((c) => c.key).filter((k) => !isAnswered(answers, k));
}

function isAnswered(answers: Answers, criterion: string) {
  return criterion in answers && answers[criterion] !== notSure;
}

// The diagram's tools for the styles of the parts: those on the team's platform, or all of them
// when none is.
function partTools(parts: string[], platform: string | undefined) {
  const partStyles = rules.parts.filter((r) => parts.includes(r.id)).map((r) => r.recommends);
  const tools = styles.filter((s) => partStyles.includes(s.id)).flatMap((s) => s.tools);
  const onPlatform = tools.filter((t) => "platform" in t && t.platform === platform);
  return (onPlatform.length ? onPlatform : tools).map((t) => t.label);
}

function key(o: Outcome) {
  return JSON.stringify(o);
}
