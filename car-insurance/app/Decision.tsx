import type { Applied, Claim, ClaimResult } from "../engine/claim";
import type { Answers } from "../engine/model";
import { record } from "../engine/record";
import { chf, statusWords } from "../engine/text";
import { policy } from "./data";
import { Badge, basisWords, Sources } from "./ui";

// The decision as it builds up: the status, the cover, the rules that decide, the statements that a
// precedence sets aside, and the amount or the benefits. A record to download at the end.
export function Decision({ claim, result, answers, done }: { claim: Claim; result: ClaimResult; answers: Answers; done: boolean }) {
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
        <h3>{statusWords[result.status].title}</h3>
        {result.cover && (
          <p>
            Cover: <strong>{result.cover.label}</strong> <Sources ids={result.cover.sources} />
          </p>
        )}
        {!decided && <p className="hint">{result.cover ? "The next answers can still change the decision." : "Answer the questions to find the cover."}</p>}
        {result.status === "notAgreed" && <p>This cover is an option, and the certificate of your policy does not include it.</p>}
        {result.status === "moduleNotActive" && result.cover && (
          <p>
            This cover belongs to the module <strong>{policy.modules.find((m) => m.id === result.cover!.module)!.label}</strong>, and the
            certificate of your policy does not include it.
          </p>
        )}
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

      {result.benefits && result.benefits.length > 0 && (
        <>
          <h4>{result.status === "moduleNotActive" || result.status === "notAgreed" ? "What the cover would pay" : "What the cover pays"}</h4>
          <ul className="notes benefits">
            {result.benefits.map((b) => (
              <li key={b.label}>
                {b.label}
                {b.amount !== undefined && (
                  <strong>
                    {" "}
                    CHF {chf(b.amount)}
                    {b.per ? ` per ${b.per}` : ""}
                  </strong>
                )}{" "}
                <Sources ids={b.sources} />
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
        (result.status === "covered" || result.status === "reduced") &&
        result.cover?.calculation && <p className="hint">Answer the questions about the amounts to see the payment.</p>
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
