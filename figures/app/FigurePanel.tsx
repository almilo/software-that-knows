import type { Engine, Figure } from "../engine/engine";

// One figure: its name in five parts, the rule that calculates it and its owner, and the source rows
// it comes from.
export function FigurePanel({ engine, period, figure }: { engine: Engine; period: string; figure?: Figure }) {
  const { model } = engine;
  if (!figure) {
    return (
      <section className="figure-panel">
        <h2>A figure</h2>
        <p className="hint">Click a figure in an article.</p>
      </section>
    );
  }
  const parsed = figure.kind === "variable" ? engine.parse(figure.name) : undefined;
  const v = parsed && "variable" in parsed ? parsed.variable : undefined;
  const comparison = v?.scenario.comparison;
  const owner = comparison?.owner && model.owners.find((o) => o.id === comparison.owner)?.label;
  const entity = model.entities.find((e) => e.id === figure.entity);
  const rows = engine.sourceTable.filter((r) => figure.rows.includes(r.id));

  return (
    <section className="figure-panel">
      <h2>{figure.display} <small>{entity?.label}, {engine.monthName(period)}</small></h2>
      {v ? (
        <>
          <p><code>{figure.name}</code></p>
          <dl>
            {model.partOrder.map((p) => (
              <div key={p.key}>
                <dt>{p.label}</dt>
                <dd><code>{v[p.key].code}</code> {v[p.key].label}{v[p.key].definition && <small> — {v[p.key].definition}</small>}</dd>
              </div>
            ))}
          </dl>
          <h3>Rule</h3>
          {comparison ? (
            <p>({comparison.of} − {comparison.against}) / {comparison.against}, with the other four parts the same. Owner: <strong>{owner ?? "nobody"}</strong>.</p>
          ) : (
            <p>The sum of the {v.scenario.label} {v.measure.label} rows of {entity?.label} in the {v.timeSlice.label} of {v.timeBasis.label}.</p>
          )}
        </>
      ) : (
        <>
          <p><code>{figure.name}</code></p>
          <p className="warning">A calculation in the template: it has no name, no owner and no definition, and no other template can use it.</p>
        </>
      )}
      {figure.reason && <p className="warning">No value: {figure.reason}.</p>}
      <h3>Source rows: {rows.length}</h3>
      <SourceRows engine={engine} rows={rows} />
    </section>
  );
}

export function SourceRows({ engine, rows }: { engine: Engine; rows: Engine["sourceTable"] }) {
  const types = engine.model.entityTypes.filter((t) => !t.whole);
  const label = (id?: string) => engine.model.entities.find((e) => e.id === id)?.label ?? "";
  return (
    <div className="table">
      <table>
        <thead>
          <tr><th>row</th><th>date</th>{types.map((t) => <th key={t.id}>{t.label}</th>)}<th>version</th><th>measure</th><th>amount</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.id}</td><td>{r.date}</td>
              {types.map((t) => <td key={t.id}>{label(r.entities[t.id])}</td>)}
              <td>{r.version}</td><td>{r.measure}</td><td className="number">{r.amount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
