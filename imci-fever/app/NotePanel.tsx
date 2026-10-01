import { useEffect, useState } from "react";
import { notes } from "../note/examples";
import type { Assessment } from "./classify";
import { answerText, fields } from "../note/fields";
import { apply, type Interpretation, type Proposal } from "../note/check";
import { interpretNote } from "../note/interpret";
import { cloudInterpreters, SETUP_URL, WORDS, type InterpreterInfo } from "../note/interpreters";

// What the server (server/main.ts) says about a cloud interpreter: whether its API key is set there.
type Availability = { id: string; available: boolean };
type Interpreting =
  | { state: "idle" }
  | { state: "interpreting" }
  | { state: "proposed"; result: Interpretation; by: string }
  | { state: "applied"; applied: Proposal[]; unused: Proposal[] }
  | { state: "failed"; error: string };

// A note in free text instead of the form. An interpreter turns it into proposed form answers, each
// with where it comes from, and the user confirms them. The words of the knowledge model interpret in
// the browser; the cloud interpreters (Jev, Claude Haiku 4.5, gpt-6-luna) run through the server. The
// classification still comes from the rules.
export function NotePanel({ data, onApply }: { data: Assessment; onApply: (next: Assessment) => void }) {
  const [text, setText] = useState("");
  const [state, setState] = useState<Interpreting>({ state: "idle" });
  // undefined while asking, null when there is no server (the static build).
  const [server, setServer] = useState<Availability[] | null>();
  const [interpreter, setInterpreter] = useState(WORDS.id);

  useEffect(() => {
    fetch("/api/interpreters")
      .then((r) => (r.ok ? (r.json() as Promise<Availability[]>) : null))
      .then(setServer)
      .catch(() => setServer(null));
  }, []);

  const available = (i: InterpreterInfo) => server?.find((a) => a.id === i.id)?.available ?? false;
  const unavailable = (i: InterpreterInfo) =>
    server === null ? (
      <>
        Not available here: it needs the app running on your computer, with an API key from {i.provider} (
        <code>{i.key}</code>). See <a href={SETUP_URL}>how to run it</a>.
      </>
    ) : (
      <>
        Not available: set an API key from {i.provider} in <code>{i.key}</code> and restart the app. See{" "}
        <a href={SETUP_URL}>how to run it</a>.
      </>
    );

  const interpret = async () => {
    const chosen = cloudInterpreters.find((c) => c.id === interpreter);
    if (!chosen) return setState({ state: "proposed", result: interpretNote(text, data), by: "the words of the knowledge model" });
    setState({ state: "interpreting" });
    try {
      const response = await fetch("/api/interpret", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ interpreter, text, data }) });
      const body = (await response.json()) as Interpretation & { model?: string; ms?: number; error?: string };
      if (!response.ok || body.error) return setState({ state: "failed", error: body.error ?? `${response.status} ${response.statusText}` });
      setState({ state: "proposed", result: body, by: `${chosen.name} (${body.model}) in ${((body.ms ?? 0) / 1000).toFixed(1)} s` });
    } catch {
      setState({ state: "failed", error: "The server does not answer. Is bun run dev still running?" });
    }
  };
  const confirm = (proposals: Proposal[]) => {
    const { data: next, unused } = apply(data, proposals);
    onApply(next);
    setState({ state: "applied", applied: proposals.filter((p) => !unused.includes(p)), unused });
  };

  return (
    <div className="note-panel">
      <h2>Or describe the child</h2>
      <p className="hint">
        Write a note as you would for a colleague. The chosen interpreter turns it into answers for the form, each with where
        it comes from. You confirm them. The classification comes from the WHO rules.
      </p>
      <div className="interpreters">
        <label>
          <input type="radio" checked={interpreter === WORDS.id} onChange={() => setInterpreter(WORDS.id)} /> <b>{WORDS.name}</b>{" "}
          ({WORDS.kind}): {WORDS.how}.
        </label>
        {cloudInterpreters.map((c) => (
          <label key={c.id} className={available(c) ? "" : "unavailable"}>
            <input type="radio" disabled={!available(c)} checked={interpreter === c.id} onChange={() => setInterpreter(c.id)} />{" "}
            <b>{c.name}</b> ({c.kind}, {c.provider}): {c.how}.{" "}
            {available(c) ? `The note is sent to ${c.provider}.` : unavailable(c)}
          </label>
        ))}
      </div>
      <div className="examples">
        {notes.map((n) => (
          <button key={n.text} onClick={() => setText(n.text)}>
            {n.text}
          </button>
        ))}
      </div>
      <textarea rows={4} value={text} placeholder="For example: fever for 3 days, very sleepy, does not drink" onChange={(e) => setText(e.target.value)} />
      <button className="primary" disabled={!text.trim() || state.state === "interpreting"} onClick={interpret}>
        Interpret the note
      </button>
      <Status state={state} onConfirm={confirm} onDiscard={() => setState({ state: "idle" })} />
    </div>
  );
}

function Status({ state, onConfirm, onDiscard }: { state: Interpreting; onConfirm: (p: Proposal[]) => void; onDiscard: () => void }) {
  if (state.state === "interpreting") return <p className="hint">Interpreting the note…</p>;
  if (state.state === "failed") return <p className="error">{state.error}</p>;
  if (state.state === "applied") {
    return (
      <p className="hint">
        Added {state.applied.length} answers to the form.
        {state.unused.length > 0 && ` Not added, because the form does not ask them with these answers: ${state.unused.map((p) => title(p.field)).join(", ")}.`}
      </p>
    );
  }
  if (state.state !== "proposed") return null;
  const { proposals, rejected } = state.result;
  return (
    <div className="understood">
      {proposals.length > 0 ? `Interpreted by ${state.by}:` : `No answer found by ${state.by}.`}
      <ul>
        {proposals.map((p) => (
          <li key={p.field}>
            {title(p.field)}: <b>{answerText(p.value)}</b> <q>{p.quote}</q>
          </li>
        ))}
        {rejected.map((x, i) => (
          <li key={`x${i}`} className="rejected">
            Not used: <Discarded proposal={x.proposal} /> {capitalize(x.reason)}.
          </li>
        ))}
      </ul>
      {proposals.length > 0 && (
        <div className="actions">
          <button className="primary" onClick={() => onConfirm(proposals)}>
            Add to the form
          </button>
          <button onClick={onDiscard}>Discard</button>
        </div>
      )}
    </div>
  );
}

const title = (field: string) => fields[field]?.title ?? field;

// A discarded answer, shown like a proposal when it names a known question: the question, the
// answer and its quote. A reply that is not a well-formed answer shows only the reason.
function Discarded({ proposal }: { proposal: unknown }) {
  const p = proposal as Partial<Proposal> | undefined;
  if (typeof p?.field !== "string" || !fields[p.field]) return null;
  return (
    <>
      {title(p.field)}: <b>{answerText(p.value)}</b>
      {typeof p.quote === "string" && (
        <>
          {" "}
          <q>{p.quote}</q>
        </>
      )}
      .
    </>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
