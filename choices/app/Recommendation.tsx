import type { Answers, Decision, Outcome } from "../decide/decision";
import { explain } from "../decide/explain";
import { ladderStep, record } from "../decide/record";

// One outcome: the full recommendation. Several: the options still possible, and what decides
// between them, the questions still to answer or the answers that were "not sure".
export function Recommendation({ d, answers }: { d: Decision; answers: Answers }) {
  const outcomes = d.possibleOutcomes(answers);
  const open = d.questionsThatMatter(answers);
  const unsure = d.criteria.filter((c) => answers[c.key] === d.notSure);

  return (
    <section className="recommendation">
      <h2>Recommendation</h2>
      {outcomes.length === 1 && outcomes[0]!.choice ? (
        <Decided d={d} answers={answers} outcome={outcomes[0]!} />
      ) : (
        <div className="undecided">
          <p>
            Still possible: <strong>{[...new Set(outcomes.map((o) => optionLabel(d, o)))].join(", ")}</strong>.
          </p>
          <p className="hint">
            {open.length
              ? `Answer ${open.length === 1 ? "the next question" : `up to ${open.length} questions`} to decide.`
              : `It depends on what you answered "not sure": ${unsure.map((c) => c.label).join("; ")}`}
          </p>
        </div>
      )}
    </section>
  );
}

function Decided({ d, answers, outcome }: { d: Decision; answers: Answers; outcome: Outcome }) {
  const e = explain(d, answers, outcome);
  return (
    <article>
      <h3>{e.option.label}</h3>
      <blockquote>
        “{e.rule.quote}” <cite>{d.domain.author}</cite>
      </blockquote>
      <h4>Because</h4>
      <ul>
        {e.because.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
      {e.additions.length > 0 && (
        <>
          <h4>{d.domain.additionsTitle}</h4>
          <ul>
            {e.additions.map((a) => (
              <li key={a.id}>
                {a.option} for {a.part}: <span className="quote">“{a.quote}”</span>
              </li>
            ))}
          </ul>
          <p className="tools">{e.tools.length === 1 ? `Fits your answers: ${e.tools[0]}` : `For example: ${e.tools.join(", ")}`}</p>
        </>
      )}
      {e.cautions.map((c) => (
        <p key={c.id} className="caution">
          <strong>{c.label}.</strong> {c.explanation}
        </p>
      ))}
      {e.ladder && (
        <>
          <h4>Start with</h4>
          <p className="step">{ladderStep(d, e.ladder.start)}.</p>
          {e.ladder.next && <p className="step-up">If the result falls short: {ladderStep(d, e.ladder.next)}.</p>}
        </>
      )}
      <h4>What comes with it</h4>
      <dl>
        {e.option.dimensions
          .filter((dim) => dim.inRecommendation && dim.characteristics.length)
          .map((dim) => (
            <div key={dim.label}>
              <dt>{dim.label}</dt>
              <dd>{dim.characteristics.join("; ")}</dd>
            </div>
          ))}
      </dl>
      {e.revisit.map((r) => (
        <div key={r.option.id} className="revisit">
          <h4>Reconsider {r.option.label} when</h4>
          <ul>
            {r.when.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ))}
      <button type="button" className="download" onClick={() => download(d.domain.recordFile, record(d, answers, e, new Date().toISOString().slice(0, 10)))}>
        Download as {d.domain.recordName}
      </button>
    </article>
  );
}

function download(file: string, markdown: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([markdown], { type: "text/markdown" }));
  link.download = file;
  link.click();
  URL.revokeObjectURL(link.href);
}

function optionLabel(d: Decision, o: Outcome) {
  const rule = d.rules.choice.find((r) => r.id === o.choice);
  return rule ? d.option(rule.recommends!).label : "no recommendation";
}
