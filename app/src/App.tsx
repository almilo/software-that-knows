import type { UISchemaElement } from "@jsonforms/core";
import { JsonForms } from "@jsonforms/react";
import { vanillaCells, vanillaRenderers } from "@jsonforms/vanilla-renderers";
import { useEffect, useMemo, useState } from "react";
import type { AppModel } from "./app-model.ts";
import { booleanControlEntry } from "./BooleanControl.tsx";
import type { Answers, Evaluation, Result, createEngine } from "./engine.ts";

const renderers = [...vanillaRenderers, booleanControlEntry];
const same = (a: Answers, b: Answers) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
const sorted = (a: Answers) => Object.fromEntries(Object.entries(a).sort(([x], [y]) => x.localeCompare(y)));

interface Props {
  appModel: AppModel;
  engine: ReturnType<typeof createEngine>;
}

export function App({ appModel, engine }: Props) {
  const [answers, setAnswers] = useState<Answers>({});
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let current = true;
    setBusy(true);
    engine.evaluate(answers).then((result) => {
      if (!current) return;
      setEvaluation(result);
      setBusy(false);
      if (!same(result.answers, answers)) setAnswers(result.answers);
    });
    return () => {
      current = false;
    };
  }, [answers, engine]);

  const relevant = evaluation?.relevant ?? new Set<string>();
  const uischema = useMemo(() => uiSchema(appModel, relevant), [appModel, [...relevant].join()]);
  const additionalErrors = (evaluation?.problems ?? []).map((p) => ({
    instancePath: "/" + p.question.key,
    message: p.message || "The answer is not valid.",
    schemaPath: "",
    keyword: "shacl",
    params: {},
  }));

  return (
    <div className="page">
      <header>
        <h1>{appModel.title}</h1>
        <p>{appModel.description}</p>
      </header>
      <main>
        <section className="questions" aria-label="Questions">
          <h2>Questions</h2>
          <JsonForms
            schema={appModel.schema as any}
            uischema={uischema}
            data={answers}
            renderers={renderers}
            cells={vanillaCells}
            config={{ showUnfocusedDescription: true }}
            additionalErrors={additionalErrors as any}
            onChange={({ data }) => {
              if (!same(data ?? {}, answers)) setAnswers({ ...(data ?? {}) });
            }}
          />
          <button type="button" className="reset" onClick={() => setAnswers({})}>
            Start again
          </button>
        </section>
        <section className="results" aria-label="Results" aria-busy={busy}>
          <h2>Results {busy && <span className="busy">(checking)</span>}</h2>
          <Results appModel={appModel} results={evaluation?.results ?? []} />
        </section>
      </main>
      <ModelNotes appModel={appModel} />
    </div>
  );
}

function uiSchema(appModel: AppModel, relevant: Set<string>): UISchemaElement {
  const control = (key: string, kind: string) => ({
    type: "Control",
    scope: `#/properties/${key}`,
    ...(kind === "choice" ? { options: { format: "radio", orientation: "vertical" } } : {}),
  });
  const shown = appModel.questions.filter((q) => relevant.has(q.key));
  const groups = appModel.groups
    .map((g) => ({
      type: "Group",
      label: g.label,
      elements: shown.filter((q) => q.group === g.iri).map((q) => control(q.key, q.kind)),
    }))
    .filter((g) => g.elements.length > 0);
  const ungrouped = shown.filter((q) => !q.group).map((q) => control(q.key, q.kind));
  return { type: "VerticalLayout", elements: [...groups, ...ungrouped] } as UISchemaElement;
}

function Results({ appModel, results }: { appModel: AppModel; results: Result[] }) {
  if (results.length === 0) {
    return <p className="empty">Answer the questions. The results show here after each answer.</p>;
  }
  return (
    <>
      {appModel.kinds.map((kind) => {
        const ofKind = results.filter((r) => r.rule.kind === kind.iri);
        if (ofKind.length === 0) return null;
        return (
          <div key={kind.iri} className="kind">
            <h3 title={kind.definition}>{kind.label}</h3>
            {ofKind.map((r, i) => (
              <ResultCard key={r.rule.iri + i} appModel={appModel} result={r} kindIri={kind.iri} />
            ))}
          </div>
        );
      })}
    </>
  );
}

function ResultCard({ appModel, result, kindIri }: { appModel: AppModel; result: Result; kindIri: string }) {
  const { rule } = result;
  const status = appModel.statuses[rule.status];
  const isOpen = rule.status.endsWith("#Open");
  return (
    <article className={`result ${kindIri.replace(/^.*#/, "").toLowerCase()}`} data-rule={rule.iri}>
      <p className="message">{result.message}</p>
      {isOpen && status && <p className="status">Status: {status.label}. The result is provisional.</p>}
      <div className="sources">
        <span className="caption">Sources:</span>
        <ul>
          {rule.sources.map((iri) => (
            <SourceItem key={iri} appModel={appModel} iri={iri} />
          ))}
        </ul>
      </div>
      {(rule.interpretations.length > 0 || rule.openPoints.length > 0) && (
        <details>
          <summary>Interpretations and open points</summary>
          <ul>
            {rule.interpretations.map((iri) => (
              <li key={iri}>
                <strong>Interpretation: {appModel.interpretations[iri]?.label}.</strong> {appModel.interpretations[iri]?.comment}
              </li>
            ))}
            {rule.openPoints.map((iri) => (
              <li key={iri}>
                <strong>Open point: {appModel.openPoints[iri]?.label}.</strong> {appModel.openPoints[iri]?.comment}
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}

function SourceItem({ appModel, iri }: { appModel: AppModel; iri: string }) {
  const source = appModel.sources[iri];
  if (!source) return <li>{iri}</li>;
  return (
    <li className="source">
      {source.url ? (
        <a href={source.url} target="_blank" rel="noreferrer">
          {source.label}
        </a>
      ) : (
        source.label
      )}
      {source.quote && (
        <details>
          <summary>Original text</summary>
          <blockquote lang="de">{source.quote}</blockquote>
          {source.origin && <p className="origin">{source.origin.label}</p>}
        </details>
      )}
    </li>
  );
}

function ModelNotes({ appModel }: { appModel: AppModel }) {
  const interpretations = Object.values(appModel.interpretations);
  const openPoints = Object.values(appModel.openPoints);
  return (
    <footer>
      <details>
        <summary>All interpretations of the model ({interpretations.length})</summary>
        <ul>
          {interpretations.map((i) => (
            <li key={i.iri}>
              <strong>{i.label}.</strong> {i.comment}
            </li>
          ))}
        </ul>
      </details>
      <details>
        <summary>All open points of the model ({openPoints.length})</summary>
        <ul>
          {openPoints.map((o) => (
            <li key={o.iri}>
              <strong>{o.label}.</strong> {o.comment}
            </li>
          ))}
        </ul>
      </details>
    </footer>
  );
}
