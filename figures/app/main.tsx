import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { createEngine, type Figure } from "../engine/engine";
import type { FiguresModel, SourceRow } from "../engine/model";
import { verifyPeriod, verifyStructure } from "../engine/verify";
import { Articles } from "./Articles";
import { Ask } from "./Ask";
import { FigurePanel } from "./FigurePanel";
import { Inside } from "./Inside";

const repository = "https://github.com/almilo/software-that-knows/tree/main/figures";

// The page of a domain: its main.tsx calls this with its generated files.
export function start(name: string, model: FiguresModel, asShown: FiguresModel, rows: SourceRow[]) {
  createRoot(document.getElementById("root")!).render(<App name={name} model={model} asShown={asShown} rows={rows} />);
}

// The controls on top: the month, who reads, and which templates. Then the articles that the person
// sees, with the figure that the person clicked; a question; the checks; the engine's tables.
function App({ name, model, asShown, rows }: { name: string; model: FiguresModel; asShown: FiguresModel; rows: SourceRow[] }) {
  const [variant, setVariant] = useState<"model" | "as-shown">("model");
  const engine = useMemo(() => createEngine(variant === "model" ? model : asShown, rows), [variant, model, asShown, rows]);
  const [period, setPeriod] = useState(model.periods[0]!.month);
  const [viewerId, setViewerId] = useState(engine.viewers[0]!.id);
  const [figure, setFigure] = useState<Figure>();
  const viewer = engine.viewers.find((v) => v.id === viewerId) ?? engine.viewers[0]!;
  const { domain } = model;
  const findings = [...verifyStructure(engine), ...verifyPeriod(engine, period).map((f) => `${engine.monthName(period)}: ${f}`)];

  return (
    <main>
      <header>
        <h1>{domain.title}</h1>
        <p className="intro">
          {domain.intro} Example: <a href={domain.source}>{domain.sourceTitle}</a>, written down as an{" "}
          <a href={`${repository}/domains/${name}/ontology`}>ontology</a>. <a href={repository}>Code on GitHub</a>
        </p>
      </header>

      <section className="controls" aria-label="Settings">
        <Choice label="Month" value={period} onChange={(p) => (setPeriod(p), setFigure(undefined))}
          options={model.periods.map((p) => ({ value: p.month, label: engine.monthName(p.month) }))} />
        <Choice label="Templates" value={variant} onChange={(v) => (setVariant(v as typeof variant), setFigure(undefined))}
          options={[{ value: "model", label: "The model" }, { value: "as-shown", label: "As in the video" }]} />
        <label>
          Who reads{" "}
          <select value={viewer.id} onChange={(e) => (setViewerId(e.target.value), setFigure(undefined))}>
            {engine.viewers.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
        </label>
        <p className="hint">{model.periods.find((p) => p.month === period)!.comment}</p>
      </section>

      <Articles engine={engine} period={period} viewer={viewer} selected={figure} onSelect={setFigure} />
      <FigurePanel engine={engine} period={period} figure={figure} />
      <Ask engine={engine} period={period} viewer={viewer} />

      <section className="checks">
        <h2>Checks: {findings.length} findings</h2>
        <p className="hint">The same checks as <code>bun run verify</code>, for the templates and the month on this page.</p>
        <ul>{findings.map((f) => <li key={f}>{f}</li>)}</ul>
      </section>

      <Inside engine={engine} period={period} />
    </main>
  );
}

function Choice({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <div className="choice" role="group" aria-label={label}>
      <span>{label}</span>
      {options.map((o) => (
        <button key={o.value} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}
