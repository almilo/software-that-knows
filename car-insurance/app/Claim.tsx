import { useState } from "react";
import { chf } from "../engine/benefit";
import { type Applied, type ClaimResult, createClaim, keep } from "../engine/claim";
import type { Answers, Fact } from "../engine/model";
import { record, statusWords } from "../engine/record";
import { policy } from "./data";
import { Badge, basisWords, Page, Sources } from "./ui";

const claim = createClaim(policy);

// The claim check: the answered questions, one line each, then the next question that the
// decision needs. On the right, the decision as it builds up.
export function Claim() {
  const [answers, setAnswers] = useState<Answers>({});
  const [editing, setEditing] = useState<string>();
  const asked = claim.asked(answers);
  const next = claim.next(answers);
  const result = claim.evaluate(answers);

  const answer = (id: string, value: string | number) => {
    setEditing(undefined);
    // After a change, the answers that the questions no longer need are dropped.
    setAnswers((a) => keep(claim, { ...a, [id]: value }));
  };

  return (
    <Page
      title="Claim check"
      intro={
        <>
          Accidental damage insurance (Art. 201 to 204): collision, theft, fire, natural hazards, glass, animals, vandalism
          and the options. The check asks only the questions that a rule which can still apply needs: here {asked.length} so
          far, of the {claim.facts.length} questions of the model.
        </>
      }
      wide
    >
      <div className="columns">
        <section className="questions">
          <h2>Your claim</h2>
          {asked.length === 0 && <Examples onPick={(a) => setAnswers(keep(claim, a))} />}
          {asked.map((f) =>
            f.id === editing ? (
              <Question key={f.id} fact={f} value={answers[f.id]} onAnswer={(v) => answer(f.id, v)} />
            ) : (
              <div key={f.id} className="answered">
                <span>{f.label}</span>
                <strong>{answerLabel(f, answers[f.id]!)}</strong>
                <button type="button" onClick={() => setEditing(f.id)}>
                  Change
                </button>
              </div>
            ),
          )}
          {next && <Question key={next.id} fact={next} next onAnswer={(v) => answer(next.id, v)} />}
          {asked.length > 0 && (
            <button type="button" className="start-over" onClick={() => setAnswers({})}>
              Start over
            </button>
          )}
          {asked.length > 0 && <Examples onPick={(a) => setAnswers(keep(claim, a))} />}
        </section>
        <Decision result={result} answers={answers} done={!next} />
      </div>
    </Page>
  );
}

function Question({ fact, value, next, onAnswer }: { fact: Fact; value?: string | number; next?: boolean; onAnswer: (v: string | number) => void }) {
  const [text, setText] = useState(value === undefined ? "" : String(value));
  return (
    <fieldset className={next ? "question next" : "question"}>
      <legend>{fact.label}</legend>
      {fact.help && <p className="definition">{fact.help}</p>}
      {fact.kind === "choice" ? (
        <div className="answers">
          {fact.values.map((v) => (
            <button key={v.id} type="button" aria-pressed={value === v.id} onClick={() => onAnswer(v.id)}>
              <span>{v.label}</span>
              {v.help && <small>{v.help}</small>}
            </button>
          ))}
        </div>
      ) : (
        <form
          className="number"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim() !== "" && Number(text) >= 0) onAnswer(Number(text));
          }}
        >
          <input type="number" min="0" step="any" inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} aria-label={fact.label} autoFocus={next} />
          {fact.unit && <span>{fact.unit}</span>}
          <button type="submit">OK</button>
        </form>
      )}
    </fieldset>
  );
}

function answerLabel(f: Fact, v: string | number) {
  if (f.kind === "choice") return f.values.find((x) => x.id === v)?.label ?? String(v);
  return f.unit === "CHF" ? `CHF ${chf(Number(v))}` : `${v} ${f.unit ?? ""}`;
}

function Decision({ result, answers, done }: { result: ClaimResult; answers: Answers; done: boolean }) {
  const decided = result.status !== "open";
  const tone = result.status === "covered" ? "covered" : result.status === "reduced" ? "reduced" : decided ? "excluded" : "neutral";
  const decisive = result.applied.filter((a) => a.role !== "overridden");
  const setAside = result.applied.filter((a) => a.role === "overridden");
  const download = () => {
    const text = record(policy, claim, answers, result, new Date().toISOString().slice(0, 10));
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([text], { type: "text/markdown" }));
    link.download = "claim-record.md";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <section className="decision">
      <h2>Decision</h2>
      <article className={`verdict ${tone}`}>
        <h3>{statusWords[result.status]}</h3>
        {result.cover && (
          <p>
            Cover: <strong>{result.cover.label}</strong> <Sources ids={result.cover.sources} />
          </p>
        )}
        {!decided && <p className="hint">{result.cover ? "The next answers can still change the decision." : "Answer the questions to find the cover."}</p>}
        {result.status === "notAgreed" && <p>This cover is an option, and your policy does not include it.</p>}
        {result.status === "notInsurable" && <p>The product overview says that this cover is not insurable for this vehicle class.</p>}
        {result.status === "reduced" && (
          <p className="caution">The amount of the reduction depends on the degree of fault. The model cannot decide it: a person at Zurich decides it.</p>
        )}
      </article>

      {decisive.length > 0 && (
        <>
          <h4>Why</h4>
          <ul className="why">
            {decisive.map((a) => (
              <Reason key={a.rule.id} a={a} />
            ))}
          </ul>
        </>
      )}
      {setAside.length > 0 && (
        <>
          <h4>Set aside</h4>
          <ul className="why">
            {setAside.map((a) => (
              <li key={a.rule.id} className="overridden">
                <span className="role">{a.rule.kind === "reduction" ? "Reduction" : "Exclusion"}</span> <s>{a.rule.label}</s> <Sources ids={a.rule.sources} />
                <p>
                  “{a.by!.rule.label}” wins <Sources ids={a.by!.rule.sources} />,{" "}
                  <Badge status={a.by!.precedence.basis === "text" ? "ok" : "resolved"}>{basisWords[a.by!.precedence.basis]}</Badge>
                </p>
                <p className="comment">{a.by!.precedence.comment}</p>
              </li>
            ))}
          </ul>
        </>
      )}

      {result.amount ? (
        <>
          <h4>Amount</h4>
          <table className="amount">
            <tbody>
              {result.amount.steps.map((s, i) => (
                <tr key={i}>
                  <td>
                    {s.label} <Sources ids={s.sources} />
                  </td>
                  <td className="chf">{chf(s.amount)}</td>
                </tr>
              ))}
              <tr className="total">
                <td>{result.status === "reduced" ? "Payment, before the reduction" : "Payment"}</td>
                <td className="chf">CHF {chf(result.amount.payment)}</td>
              </tr>
            </tbody>
          </table>
          <ul className="notes">
            {result.amount.notes.map((n) => (
              <li key={n.text}>
                {n.text} <Sources ids={n.sources} />
              </li>
            ))}
          </ul>
        </>
      ) : (
        decided &&
        (result.status === "covered" || result.status === "reduced") && <p className="hint">Answer the questions about the amounts to see the payment.</p>
      )}
      {decided && done && (
        <button type="button" className="download" onClick={download}>
          Download the record of the decision
        </button>
      )}
    </section>
  );
}

function Reason({ a }: { a: Applied }) {
  const role = { covers: "Cover", excludes: "Exclusion", reduces: "Reduction", overridden: "" }[a.role];
  return (
    <li className={a.role}>
      <span className="role">{role}</span> {a.rule.label} <Sources ids={a.rule.sources} />
    </li>
  );
}

// Example claims that show the special cases of the model: they fill the answers, and the user can
// change any of them.
const normal: Answers = { place: "CHFL", use: "NormalUse", driver: "Licensed", journey: "Permitted", alcohol: "Sober", crime: "NoCrime", emergency: "NoEmergency", operation: "NotOperation", fault: "NoFault" };
const examples: { label: string; answers: Answers }[] = [
  {
    label: "A collision in year 2: total loss",
    answers: { vehicleClass: "PassengerCar", event: "CollisionEvent", ...normal, monthsOfService: 18, catalogPrice: 50000, repairCost: 30000, deductible: 1000, claimFreeYears: 3, helpPoint: "NoHelpPoint" },
  },
  {
    label: "Tyres punctured by a vandal",
    answers: { vehicleClass: "PassengerCar", event: "VandalismEvent", vandalismKind: "PuncturedTyres", ...normal, operation: "TyresOrBatteryOnly", monthsOfService: 10, catalogPrice: 30000, repairCost: 800, deductible: 200, helpPoint: "NoHelpPoint" },
  },
  { label: "Paintwork scratched", answers: { vehicleClass: "PassengerCar", event: "VandalismEvent", vandalismKind: "Scratched" } },
  { label: "A motorcycle stolen outside", answers: { vehicleClass: "Motorcycle", event: "TheftEvent", theftKind: "VehicleStolen", motorcycleSecured: "NotSecured" } },
  { label: "Gross negligence, without the option", answers: { vehicleClass: "PassengerCar", event: "CollisionEvent", ...normal, fault: "GrossNegligence", hasCollisionGrossNegligence: "No" } },
];

function Examples({ onPick }: { onPick: (a: Answers) => void }) {
  return (
    <div className="examples">
      <span>Examples:</span>
      {examples.map((e) => (
        <button key={e.label} type="button" onClick={() => onPick(e.answers)}>
          {e.label}
        </button>
      ))}
    </div>
  );
}
