import { useMemo, useState } from "react";
import { Apply } from "./Apply";
import { useDomain } from "./domain";
import type { Answers, Evaluation } from "../core/engine";
import { Form } from "./Form";
import { useI18n } from "./i18n";
import { Outcome } from "./Outcome";
import { asked, layout, open } from "./steps";

// The wizard: one step for each group of questions of the model, then the review, where the person
// sees the outcome and submits the application. The engine decides after each change which
// questions are asked and which answers are missing.
export function Wizard() {
  const { t } = useI18n();
  const { evaluate, steps, validator } = useDomain();
  const [data, setData] = useState<Answers>({});
  // The data that the form loads: a copy taken when the step changes, never while the person types
  // (see Form.tsx). It also brings the answers back when the person returns from the review.
  const [formData, setFormData] = useState<Answers>({});
  const [at, setAt] = useState(0);
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(new Set());
  const evaluation = useMemo(() => evaluate(data), [data]);
  const review = at === steps.length;
  // A new UI schema only when the questions of the step change, not on each key press.
  const shownHere = review ? "" : asked(steps[at]!, evaluation).join();
  const uischema = useMemo(() => (review ? undefined : layout(steps[at]!, evaluation)), [at, shownHere]);

  function go(step: number) {
    setFormData(data);
    setRevealed(new Set());
    setAt(step);
    window.scrollTo(0, 0);
  }
  function next() {
    const missing = open(steps[at]!, evaluation, data, validator);
    if (missing.length > 0) setRevealed(new Set(missing));
    else go(at + 1);
  }
  // A step can be opened when all the steps before it are complete.
  function reachable(step: number) {
    return steps.slice(0, step).every((s) => open(s, evaluation, data, validator).length === 0);
  }

  return (
    <>
      <ol className="steps">
        {[...steps.map((s) => t(`${s.id}.label`)), t("review.label")].map((label, i) => (
          <li key={i} aria-current={i === at ? "step" : undefined}>
            <button onClick={() => go(i)} disabled={i !== at && !reachable(i)}>
              {i + 1}. {label}
            </button>
          </li>
        ))}
      </ol>

      {review ? (
        <Review evaluation={evaluation} onChange={go} />
      ) : (
        <section className="step">
          <h2>{t(`${steps[at]!.id}.label`)}</h2>
          {/* A new form for each step: JSON Forms would otherwise keep the element ids of the step before. */}
          <Form key={at} data={formData} uischema={uischema} revealed={revealed} onChange={setData} />
          {revealed.size > 0 && <p className="error">{t("openQuestions.label")}</p>}
          <div className="nav">
            {at > 0 && <button onClick={() => go(at - 1)}>{t("back.label")}</button>}
            <button className="primary" onClick={next}>
              {t("next.label")}
            </button>
          </div>
        </section>
      )}
    </>
  );
}

function Review({ evaluation: e, onChange }: { evaluation: Evaluation; onChange: (step: number) => void }) {
  const { t, value } = useI18n();
  const { steps } = useDomain();
  return (
    <section className="step">
      <h2>{t("review.label")}</h2>
      {steps.map((step, i) => (
        <div key={step.id} className="summary">
          <h3>
            {t(`${step.id}.label`)} <button onClick={() => onChange(i)}>{t("change.label")}</button>
          </h3>
          <dl>
            {asked(step, e).filter((f) => f in e.answers).map((f) => (
              <div key={f}>
                <dt>{t(`${f}.label`)}</dt>
                <dd>{value(e.answers[f], f)}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
      <h3>{t("outcome.label")}</h3>
      <Outcome {...e} />
      {e.allowed && <Apply key={JSON.stringify(e.answers)} answers={e.answers} />}
      <div className="nav">
        <button onClick={() => onChange(steps.length - 1)}>{t("back.label")}</button>
      </div>
    </section>
  );
}
