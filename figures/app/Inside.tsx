import type { Engine } from "../engine/engine";
import { SourceRows } from "./FigurePanel";

// The steps of the engine for the month: the source table (the rows of the financial year to the
// end of the month) and the data frame of each entity type that a template is about.
export function Inside({ engine, period }: { engine: Engine; period: string }) {
  const types = engine.model.entityTypes.filter((t) => engine.model.templates.some((x) => x.about === t.id));
  const rows = engine.sourceTable.filter((r) => r.date.slice(0, 7) <= period).filter((r) => {
    const start = engine.model.domain.fiscalYearStart;
    const [y, m] = period.split("-").map(Number) as [number, number];
    const first = `${m >= start ? y : y - 1}-${String(start).padStart(2, "0")}`;
    return r.date.slice(0, 7) >= first;
  });
  return (
    <section className="inside">
      <h2>Inside the engine</h2>
      <h3>1. Source table: the rows of this financial year to the end of {engine.monthName(period)}</h3>
      <p className="hint">Each row with the entities it is about, from the master data: a customer gives its account manager.</p>
      <SourceRows engine={engine} rows={rows} />
      {types.map((t) => {
        const frame = engine.dataFrame(t.id, period);
        return (
          <div key={t.id}>
            <h3>2. Data frame: one row for each {t.label}, one column for each variable a template asks for</h3>
            <div className="table">
              <table>
                <thead><tr><th>{t.label}</th>{frame.columns.map((c) => <th key={c}><code>{c}</code></th>)}</tr></thead>
                <tbody>
                  {frame.rows.map((r) => (
                    <tr key={r.entity.id}><th>{r.entity.label}</th>{r.cells.map((c) => <td key={c.name} className="number">{c.shown}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
      <h3>3. Templates</h3>
      <ul className="templates">
        {engine.model.templates.map((t) => <li key={t.id}><strong>{t.label}:</strong> <code>{t.text}</code></li>)}
      </ul>
    </section>
  );
}
