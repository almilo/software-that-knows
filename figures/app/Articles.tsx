import type { Engine, Figure, Viewer } from "../engine/engine";

// The articles that the person sees in the month. Each figure is a button: it shows where the
// number comes from.
export function Articles({ engine, period, viewer, selected, onSelect }: {
  engine: Engine; period: string; viewer: Viewer; selected?: Figure; onSelect: (f: Figure) => void;
}) {
  const articles = engine.articles(period, viewer);
  return (
    <section className="articles">
      <h2>Articles for {viewer.label}</h2>
      <p className="hint">The engine wrote these before anyone asked a question. Click a figure to see where it comes from.</p>
      {articles.length === 0 && <p>No articles this month.</p>}
      {articles.map((a) => (
        <article key={`${a.template} ${a.entity}`}>
          <h3>{a.entityLabel} <small>{a.templateLabel} template</small></h3>
          <p>
            {a.segments.map((s, i) =>
              "text" in s ? (
                <span key={i}>{s.text}</span>
              ) : (
                <button key={i} className={`figure ${s.figure.kind} ${s.figure.value === undefined ? "missing" : ""}`}
                  aria-pressed={selected?.name === s.figure.name && selected?.entity === s.figure.entity}
                  onClick={() => onSelect(s.figure)}>
                  {s.figure.display}
                </button>
              ),
            )}
          </p>
        </article>
      ))}
    </section>
  );
}
