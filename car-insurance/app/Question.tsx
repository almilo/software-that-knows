import { useState } from "react";
import type { Fact } from "../engine/model";

// One question of the claim check: buttons for the answers of a choice, or a field for a number.
export function Question({ fact, value, next, onAnswer }: { fact: Fact; value?: string | number; next?: boolean; onAnswer: (v: string | number) => void }) {
  const [text, setText] = useState(value === undefined ? "" : String(value));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() !== "" && Number(text) >= 0) onAnswer(Number(text));
  };
  return (
    <fieldset className={next ? "question next" : "question"}>
      <legend>{fact.label}</legend>
      {fact.help && <p className="definition">{fact.help}</p>}
      {fact.kind === "number" ? (
        <form className="number" onSubmit={submit}>
          <input type="number" min="0" step="any" inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} aria-label={fact.label} autoFocus={next} />
          {fact.unit && <span>{fact.unit}</span>}
          <button type="submit">OK</button>
        </form>
      ) : (
        <div className="answers">
          {fact.values.map((v) => (
            <button key={v.id} type="button" aria-pressed={value === v.id} onClick={() => onAnswer(v.id)}>
              <span>{v.label}</span>
              {v.help && <small>{v.help}</small>}
            </button>
          ))}
        </div>
      )}
    </fieldset>
  );
}
