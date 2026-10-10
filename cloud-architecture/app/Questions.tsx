import { useState } from "react";
import { type Answers, criteria, notSure, questionsThatMatter } from "../decide/decide";

type Criterion = (typeof criteria)[number];

// The answered questions, one line each, then the next question that can change the
// recommendation. The questions that no answer can change any more are not asked; they are named
// at the end.
export function Questions({ answers, onChange }: { answers: Answers; onChange: (answers: Answers) => void }) {
  const [editing, setEditing] = useState<string>();
  const matter = questionsThatMatter(answers);
  const next = matter[0];
  const notNeeded = criteria.filter((c) => !(c.key in answers) && !matter.includes(c));
  const answer = (key: string, code: string) => {
    setEditing(undefined);
    onChange({ ...answers, [key]: code });
  };

  return (
    <section className="questions">
      <h2>Your situation</h2>
      {criteria
        .filter((c) => c.key in answers || c === next)
        .map((c) =>
          c === next || c.key === editing ? (
            <Question key={c.key} criterion={c} answer={answers[c.key]} next={c === next} onAnswer={(code) => answer(c.key, code)} />
          ) : (
            <Answered key={c.key} criterion={c} answer={answers[c.key]!} onChange={() => setEditing(c.key)} />
          ),
        )}
      {matter.length > 1 && <p className="hint">Up to {matter.length - 1} more {matter.length === 2 ? "question" : "questions"}.</p>}
      {notNeeded.length > 0 && Object.keys(answers).length > 0 && (
        <p className="not-needed">
          Not asked, because no answer can change the recommendation: {notNeeded.map((c) => c.label.toLowerCase()).join(", ")}.
        </p>
      )}
      {Object.keys(answers).length > 0 && (
        <button type="button" className="start-over" onClick={() => onChange({})}>
          Start over
        </button>
      )}
    </section>
  );
}

function Question({ criterion, answer, next, onAnswer }: { criterion: Criterion; answer?: string; next: boolean; onAnswer: (code: string) => void }) {
  return (
    <fieldset className={next ? "question next" : "question"}>
      <legend>{criterion.label}</legend>
      <p className="definition">{criterion.definition}</p>
      <div className="answers">
        {criterion.answers.map((a) => (
          <button key={a.code} type="button" aria-pressed={answer === a.code} onClick={() => onAnswer(a.code)}>
            <span>{a.label}</span>
            <small>{a.definition}</small>
          </button>
        ))}
        <button type="button" className="not-sure" aria-pressed={answer === notSure} onClick={() => onAnswer(notSure)}>
          <span>Not sure</span>
        </button>
      </div>
    </fieldset>
  );
}

function Answered({ criterion, answer, onChange }: { criterion: Criterion; answer: string; onChange: () => void }) {
  const label = answer === notSure ? "Not sure" : criterion.answers.find((a) => a.code === answer)!.label;
  return (
    <div className="answered">
      <span>{criterion.label}</span>
      <strong>{label}</strong>
      <button type="button" onClick={onChange}>
        Change
      </button>
    </div>
  );
}
