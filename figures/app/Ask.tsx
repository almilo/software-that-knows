import { useState } from "react";
import { ask } from "../engine/ask";
import type { Engine, Viewer } from "../engine/engine";

const examples = [
  "Who was our top account manager in August and how did they go against budget?",
  "Who was our top account manager in September?",
  "How did Anna do year to date?",
  "What was our margin in August?",
  "Which product sold most at Cafe Uno?",
];

// A question: the concepts of the model that its words match, and the articles that an LLM would
// read, or "I do not know" and why.
export function Ask({ engine, period, viewer }: { engine: Engine; period: string; viewer: Viewer }) {
  const [question, setQuestion] = useState(examples[0]!);
  const r = ask(engine, question, viewer, period);
  return (
    <section className="ask">
      <h2>Ask a question</h2>
      <p className="hint">
        The words of the question are matched to the concepts of the model. This demo does not call an LLM: it shows what an
        LLM would read, as {viewer.label}.
      </p>
      <input value={question} onChange={(e) => setQuestion(e.target.value)} aria-label="Question" />
      <div className="examples">
        {examples.map((q) => <button key={q} onClick={() => setQuestion(q)}>{q}</button>)}
      </div>
      <p className="matches">
        {r.matches.length ? r.matches.map((m) => <span key={`${m.kind} ${m.id}`} className="chip">{m.kind}: <strong>{m.label}</strong></span>) : "No concept of the model in the question."}
      </p>
      {r.notes.map((n) => <p key={n} className="caution">{n}</p>)}
      {r.unknown ? (
        <p className="unknown"><strong>I do not know.</strong> {r.unknown}</p>
      ) : (
        <>
          <h3>What the LLM reads ({engine.monthName(r.period)})</h3>
          <ul>{r.articles.map((a) => <li key={`${a.template} ${a.entity}`}>{a.text}</li>)}</ul>
        </>
      )}
    </section>
  );
}
