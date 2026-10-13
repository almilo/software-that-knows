// The decision, from the answers and the generated rules: the option that the first choice rule
// that applies recommends, the additions, the cautions, and the tools of the additions that fit the
// answers. Answers may be missing or "not sure": the decision then holds all the outcomes that the
// open answers still allow, and knows which questions can change it. Nothing here knows a domain.
import type { Clause, DecisionModel, Rule } from "./model";

// Criterion key → answer code. A missing key is a question not answered yet.
export type Answers = Record<string, string>;
// choice: the id of the choice rule that decided; none when no choice rule applies, which only a
// model with a gap allows (verify.ts finds it).
export type Outcome = { choice?: string; additions: string[]; cautions: string[]; tools: string[] };
export type Decision = ReturnType<typeof createDecision>;

export function createDecision(model: DecisionModel) {
  const { criteria, options, rules, notSure } = model;
  const applies = (rule: Rule, answers: Answers) => rule.when.every((c) => clauseState(c, answers) === "met");

  // The outcome for answers that leave nothing open.
  function evaluate(answers: Answers): Outcome {
    const choice = rules.choice.find((r) => applies(r, answers))?.id;
    const additions = rules.additions.filter((r) => applies(r, answers)).map((r) => r.id);
    return {
      choice,
      additions,
      cautions: rules.cautions.filter((r) => applies(r, answers) && (!r.whenChosen || r.whenChosen === choice)).map((r) => r.id),
      tools: additionTools(additions, answers),
    };
  }

  // The options that an outcome uses: the chosen one, and the other options of its additions.
  function optionsOf(outcome: Outcome) {
    const chosen = rules.choice.find((r) => r.id === outcome.choice)?.recommends;
    const additions = rules.additions.filter((r) => outcome.additions.includes(r.id)).map((r) => r.recommends!);
    return { chosen, additions: [...new Set(additions)].filter((o) => o !== chosen) };
  }

  // Every outcome that the open answers (missing or "not sure") still allow, without repeats.
  function possibleOutcomes(answers: Answers) {
    const outcomes = completions(answers, open(answers)).map(evaluate);
    return [...new Map(outcomes.map((o) => [key(o), o])).values()];
  }

  // The questions not answered yet whose answer can still change the outcome, in the order of the
  // form. A "not sure" answer is open, but not asked again.
  function questionsThatMatter(answers: Answers) {
    const unknown = open(answers);
    return criteria.filter((c) => !(c.key in answers) && matters(c.key, answers, unknown));
  }

  // Whether the answers meet a clause, cannot meet it, or leave it open.
  function clauseState(clause: Clause, answers: Answers) {
    if (clause.some((atom) => atom.answers.includes(answers[atom.criterion]!))) return "met";
    if (clause.every((atom) => isAnswered(answers, atom.criterion))) return "unmet";
    return "open";
  }

  // A clause in words: "Expected scale: High, or Team size: Large"; "Operations maturity: Medium /
  // High"; "Is it your hardest problem? Yes".
  function describeClause(clause: Clause) {
    return clause
      .map((atom) => {
        const c = criteria.find((x) => x.key === atom.criterion)!;
        const answers = atom.answers.map((a) => c.answers.find((x) => x.code === a)!.label).join(" / ");
        return `${c.label}${c.label.endsWith("?") ? "" : ":"} ${answers}`;
      })
      .join(", or ");
  }

  // The label of an answer, "Not sure" included.
  function answerLabel(criterion: string, code: string) {
    if (code === notSure) return "Not sure";
    return criteria.find((c) => c.key === criterion)!.answers.find((a) => a.code === code)!.label;
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

  // The tools of the options of the additions: those that fit the answers, or all of them when
  // none does.
  function additionTools(additions: string[], answers: Answers) {
    const additionOptions = rules.additions.filter((r) => additions.includes(r.id)).map((r) => r.recommends);
    const tools = options.filter((o) => additionOptions.includes(o.id)).flatMap((o) => o.tools);
    const fitting = tools.filter((t) => t.availableWith && answers[t.availableWith.criterion] === t.availableWith.answer);
    return (fitting.length ? fitting : tools).map((t) => t.label);
  }

  return {
    model,
    ...model,
    evaluate,
    optionsOf,
    possibleOutcomes,
    questionsThatMatter,
    clauseState,
    describeClause,
    answerLabel,
    completions,
    option: (id: string) => options.find((o) => o.id === id)!,
  };
}

function key(o: Outcome) {
  return JSON.stringify(o);
}
