import type { Decision, Outcome } from "../decide/decision";
import { explain } from "../decide/explain";

// The ladder of the diagram, in order, with the step to start at marked, and the next one.
export function Ladder({ d, outcome }: { d: Decision; outcome?: Outcome }) {
  const ladder = outcome?.choice ? explain(d, {}, outcome).ladder : undefined;
  const role = (id: string) => (id === ladder?.start.id ? "start" : id === ladder?.next?.id ? "next" : undefined);
  return (
    <section className="ladder">
      <h2>{d.domain.ladderTitle}</h2>
      {d.domain.ladderQuote && (
        <blockquote>
          “{d.domain.ladderQuote}” <cite>{d.domain.author}</cite>
        </blockquote>
      )}
      <ol>
        {d.ladder.map((s) => (
          <li key={s.id} className={role(s.id)}>
            <strong>{d.option(s.option).label}</strong> <span className="level">{s.level}</span>
            <span>{s.explanation}</span>
            {role(s.id) && <small>{role(s.id) === "start" ? "start here" : "if it falls short"}</small>}
          </li>
        ))}
      </ol>
    </section>
  );
}
