import { Renderer } from "@openuidev/react-lang";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { policy } from "../../app/data";
import { fixtures } from "../fixtures";
import { CertificateContext, library } from "../library";

// The assistant: the policy (its certificate), a question in the person's own words, and the screen
// that the language model builds for it while the answer streams in.
function App() {
  const [certificate, setCertificate] = useState(policy.certificates[0]!.id);
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [source, setSource] = useState<string>();
  const [error, setError] = useState<string>();
  // A new answer remounts the renderer, so the answers given to the previous one are gone.
  const [round, setRound] = useState(0);

  const ask = async (text: string) => {
    setQuestion(text);
    setResponse("");
    setError(undefined);
    setRound((r) => r + 1);
    setStreaming(true);
    try {
      const res = await fetch("/api/answer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: text }) });
      if (!res.ok || !res.body) throw new Error(await res.text());
      setSource(res.headers.get("x-answer-source") ?? undefined);
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) setResponse((r) => (r ?? "") + chunk.value);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStreaming(false);
    }
  };

  return (
    <main className="page wide assistant">
      <header className="page-header">
        <h1>Claim assistant</h1>
        <p className="intro">
          Describe what happened, in your own words. A language model chooses what to show and fills in the facts you
          stated; the knowledge model of the conditions decides, asks what it still needs, and gives the articles.
        </p>
      </header>
      <form
        className="ask"
        onSubmit={(e) => {
          e.preventDefault();
          if (question.trim()) ask(question.trim());
        }}
      >
        <label>
          Your policy
          <select value={certificate} onChange={(e) => setCertificate(e.target.value)}>
            {policy.certificates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={3} placeholder="What happened?" aria-label="Your question" />
        <button type="submit" disabled={streaming}>
          Ask
        </button>
      </form>
      <div className="examples">
        <span>Examples:</span>
        {fixtures.map((f) => (
          <button key={f.question} type="button" disabled={streaming} onClick={() => ask(f.question)}>
            {f.question}
          </button>
        ))}
      </div>
      {error && <p className="rejected">{error}</p>}
      {source === "replay" && <p className="hint">No API key is set: this is the hand-written answer to an example question, not the answer of a language model.</p>}
      <CertificateContext.Provider value={policy.certificates.find((c) => c.id === certificate)!.answers}>
        <Renderer key={round} response={response} library={library} isStreaming={streaming} onError={(errors) => errors.length && console.warn(errors)} />
      </CertificateContext.Provider>
      <footer>
        Demonstration only. Not insurance advice, and not made or checked by Zurich. The decisions are our reading of the
        General Conditions of Insurance, edition 01/2015; your policy and the German text of the conditions decide.
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
