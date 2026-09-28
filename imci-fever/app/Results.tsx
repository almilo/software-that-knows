import type { Result } from "./classify";

// One card for each classification table that is used. The CSS class sets the IMCI colour.
export function Results({ results }: { results: Result[] }) {
  if (results.length === 0) return <p>No fever. Enter the signs of the child.</p>;
  return results.map(({ table, source, classification: c }) => (
    <article key={table} className={c?.severity ?? "pending"}>
      {c ? (
        <>
          <h2>{c.label}</h2>
          {c.qualifiers.map((q) => (
            <p key={q} className="qualifier">
              {q}
            </p>
          ))}
          <ul>
            {c.treatments.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </>
      ) : (
        <h2>{table}: complete the assessment</h2>
      )}
      <small>
        {source}
        {c && c.derivedFrom.length > 0 && <>: {c.derivedFrom.join(", ")}</>}
      </small>
    </article>
  ));
}
