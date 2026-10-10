import { type Answers, criteria, notSure, type Outcome, possibleOutcomes, questionsThatMatter, rules, styles } from "../decide/decide";
import { adr } from "../decide/adr";
import { explain } from "../decide/explain";

// The dimensions of the diagram that say what a team takes on with a style.
const tradeOffs = ["Scalability", "Complexity", "Cost model", "Security level"];

// One outcome: the full recommendation. Several: the styles still possible, and what decides
// between them, the questions still to answer or the answers that were "not sure".
export function Recommendation({ answers }: { answers: Answers }) {
  const outcomes = possibleOutcomes(answers);
  const open = questionsThatMatter(answers);
  const unsure = criteria.filter((c) => answers[c.key] === notSure);

  return (
    <section className="recommendation">
      <h2>Recommendation</h2>
      {outcomes.length === 1 ? (
        <Decided answers={answers} outcome={outcomes[0]!} />
      ) : (
        <div className="undecided">
          <p>
            Still possible: <strong>{[...new Set(outcomes.map(styleLabel))].join(", ")}</strong>.
          </p>
          <p className="hint">
            {open.length
              ? `Answer ${open.length === 1 ? "the next question" : `up to ${open.length} questions`} to decide.`
              : `It depends on what you answered "not sure": ${unsure.map((c) => c.label.toLowerCase()).join(", ")}.`}
          </p>
        </div>
      )}
    </section>
  );
}

function Decided({ answers, outcome }: { answers: Answers; outcome: Outcome }) {
  const e = explain(answers, outcome);
  return (
    <article>
      <h3>{e.style.label}</h3>
      <blockquote>
        “{e.rule.quote}” <cite>Alok Sharan</cite>
      </blockquote>
      <h4>Because</h4>
      <ul>
        {e.because.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
      {e.parts.length > 0 && (
        <>
          <h4>For parts of the system</h4>
          <ul>
            {e.parts.map((p) => (
              <li key={p.id}>
                {p.style} for {p.part}: <span className="quote">“{p.quote}”</span>
              </li>
            ))}
          </ul>
          <p className="tools">
            {e.tools.length === 1 ? `On your platform: ${e.tools[0]}` : `For example: ${e.tools.join(", ")}`}
          </p>
        </>
      )}
      {e.cautions.map((c) => (
        <p key={c.id} className="caution">
          <strong>{c.label}.</strong> {c.explanation}
        </p>
      ))}
      <h4>What comes with it</h4>
      <dl>
        {e.style.dimensions
          .filter((d) => tradeOffs.includes(d.label))
          .map((d) => (
            <div key={d.label}>
              <dt>{d.label}</dt>
              <dd>{d.characteristics.join("; ")}</dd>
            </div>
          ))}
      </dl>
      {e.revisit.map((r) => (
        <div key={r.style.id} className="revisit">
          <h4>Reconsider {r.style.label.toLowerCase()} when</h4>
          <ul>
            {r.when.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ))}
      <button type="button" className="download" onClick={() => download(adr(answers, e, new Date().toISOString().slice(0, 10)))}>
        Download as an architecture decision record
      </button>
    </article>
  );
}

function download(markdown: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([markdown], { type: "text/markdown" }));
  link.download = "architecture-decision.md";
  link.click();
  URL.revokeObjectURL(link.href);
}

function styleLabel(o: Outcome) {
  const rule = rules.style.find((r) => r.id === o.style)!;
  return styles.find((s) => s.id === rule.recommends)!.label;
}
