import { useEffect, useMemo, useRef, useState } from "react";
import { JsonForms } from "@jsonforms/react";
import { vanillaCells, vanillaRenderers } from "@jsonforms/vanilla-renderers";
import type { ErrorObject } from "ajv";
import { createEngine, schema, uischema } from "./model";
import type { Answers, Evaluation, Outcome } from "./engine";
import { OUTCOME } from "./engine";

const engine = createEngine();
const catalog = engine.catalog;

type UiElement = { type: string; scope?: string; label?: string; elements?: UiElement[] };

/** Keeps only the controls of the relevant questions, and drops empty groups. */
export function visibleUischema(element: UiElement, visible: Set<string>): UiElement | null {
  if (element.scope) {
    const key = element.scope.split("/").pop()!;
    return visible.has(key) ? element : null;
  }
  if (!element.elements) return element;
  const elements = element.elements
    .map((e) => visibleUischema(e, visible))
    .filter((e): e is UiElement => e !== null);
  if (elements.length === 0 && element.type === "Group") return null;
  return { ...element, elements };
}

function formatValue(value: string, datatype?: string): string {
  if (datatype && /#(decimal|integer|double|float)$/.test(datatype)) {
    return Number(value).toLocaleString("de-CH");
  }
  return value;
}

const kindClass: Record<string, string> = {
  [OUTCOME.refusal]: "refusal",
  [OUTCOME.value]: "value",
  [OUTCOME.nextStep]: "next",
};

function OutcomeCard({ outcome }: { outcome: Outcome }) {
  return (
    <article className={`outcome ${kindClass[outcome.kind] ?? ""}`} data-testid="outcome" data-kind={outcome.kind}>
      <header>
        <span className="badge">{outcome.kindLabel}</span>
        <h3>{outcome.title}</h3>
      </header>
      <p>{outcome.message}</p>
      {outcome.values.length > 0 && (
        <dl className="values">
          {outcome.values.map((v) => (
            <div key={v.property} data-property={v.property}>
              <dt>{v.label}</dt>
              <dd>{v.datatype ? formatValue(v.value, v.datatype) : v.display}</dd>
            </div>
          ))}
        </dl>
      )}
      {outcome.sources.length > 0 && (
        <div className="sources">
          <h4>Sources</h4>
          <ul>
            {outcome.sources.map((s) => (
              <li key={s.iri} title={s.description}>
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.label}
                  </a>
                ) : (
                  s.label
                )}
                {s.description && <q lang="de">{s.description}</q>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {outcome.interpretations.length > 0 && (
        <details className="interpretations">
          <summary>Interpretations used ({outcome.interpretations.length})</summary>
          <ul>
            {outcome.interpretations.map((i) => (
              <li key={i.iri}>
                <strong>{i.label}:</strong> {i.comment}
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}

export function App() {
  const [data, setData] = useState<Answers>({});
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [busy, setBusy] = useState(true);
  const run = useRef(0);

  useEffect(() => {
    const id = ++run.current;
    setBusy(true);
    engine
      .evaluate(data)
      .then((result) => {
        if (id === run.current) setEvaluation(result);
      })
      .catch((error) => console.error(error))
      .finally(() => {
        if (id === run.current) setBusy(false);
      });
  }, [data]);

  const visible = useMemo(() => new Set(evaluation?.visible ?? []), [evaluation]);
  const ui = useMemo(
    () => visibleUischema(uischema as UiElement, visible) ?? { type: "VerticalLayout", elements: [] },
    [visible],
  );
  const additionalErrors: ErrorObject[] = useMemo(
    () =>
      (evaluation?.inputErrors ?? [])
        .filter((e) => e.key)
        .map((e) => ({
          instancePath: `/${e.key}`,
          schemaPath: "",
          keyword: "shacl",
          params: {},
          message: e.message,
        })),
    [evaluation],
  );

  return (
    <div className="layout">
      <header className="top">
        <h1>{catalog.title}</h1>
      </header>
      <main>
        <section className="form" aria-label="Questions">
          {evaluation && (
            <JsonForms
              schema={schema as any}
              uischema={ui as any}
              data={data}
              renderers={vanillaRenderers}
              cells={vanillaCells}
              additionalErrors={additionalErrors}
              onChange={({ data: next }) => setData(next ?? {})}
            />
          )}
        </section>
        <section className="results" aria-label="Results" aria-busy={busy}>
          <h2>Results {busy && <span className="busy">(checking …)</span>}</h2>
          {evaluation?.inputErrors
            .filter((e) => !e.key)
            .map((e, i) => (
              <p className="input-error" key={i}>
                {e.message}
              </p>
            ))}
          {evaluation?.outcomes.map((o) => <OutcomeCard key={o.id} outcome={o} />)}
        </section>
      </main>
      <footer>
        <details>
          <summary>Open points of the model ({catalog.openPoints.length})</summary>
          <ul>
            {catalog.openPoints.map((p) => (
              <li key={p.iri}>
                <strong>{p.label}:</strong> {p.comment}{" "}
                <em>({p.sources.map((s) => catalog.sources[s]?.label ?? s).join(", ")})</em>
              </li>
            ))}
          </ul>
        </details>
        <details>
          <summary>Interpretations of the model ({Object.keys(catalog.interpretations).length})</summary>
          <ul>
            {Object.entries(catalog.interpretations).map(([iri, i]) => (
              <li key={iri}>
                <strong>{i.label}:</strong> {i.comment}
              </li>
            ))}
          </ul>
        </details>
        <details>
          <summary>Values of the model ({catalog.parameters.length})</summary>
          <ul>
            {catalog.parameters.map((p) => (
              <li key={p.iri}>
                {p.label}: <strong>{p.value}</strong>{" "}
                <em>({p.sources.map((s) => catalog.sources[s]?.label ?? s).join(", ")})</em>
              </li>
            ))}
          </ul>
        </details>
      </footer>
    </div>
  );
}
