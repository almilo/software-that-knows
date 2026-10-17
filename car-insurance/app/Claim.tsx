import { useState } from "react";
import { createClaim, keep, type TestClaim } from "../engine/claim";
import type { Answers } from "../engine/model";
import { answerText } from "../engine/text";
import { testClaims } from "../claims/test-claims";
import { CertificatePanel } from "./CertificatePanel";
import { changeCertificate, chooseCertificate, isCertificateFact, onlyCertificate, useCertificate, withoutCertificate } from "./certificate-store";
import { policy } from "./data";
import { Decision } from "./Decision";
import { Question } from "./Question";
import { Page } from "./ui";

const claim = createClaim(policy);
const questionCount = claim.facts.filter((f) => !isCertificateFact(f.id)).length;
// The examples are the test claims with an example label: the same claims that the checks run.
const examples = testClaims.filter((c) => c.example);

// The claim check: your policy, the answered questions, one line each, then the next question that
// the decision needs. On the right, the decision as it builds up.
export function Claim() {
  const certificate = useCertificate().answers;
  // The answers of the user; the certificate comes before them.
  const [own, setOwn] = useState<Answers>({});
  const [editing, setEditing] = useState<string>();
  const answers = { ...certificate, ...own };
  const asked = claim.asked(answers).filter((f) => !isCertificateFact(f.id));
  const next = claim.next(answers);
  const result = claim.evaluate(answers);

  const answer = (id: string, value: string | number) => {
    setEditing(undefined);
    // After a change, the answers that the questions no longer need are dropped.
    setOwn(withoutCertificate(keep(claim, { ...answers, [id]: value })));
  };
  const pick = (example: TestClaim) => {
    if (example.certificate) chooseCertificate(example.certificate);
    const changes = onlyCertificate(example.answers);
    if (Object.keys(changes).length) changeCertificate(changes);
    setOwn(withoutCertificate(example.answers));
  };

  return (
    <Page
      title="Claim check"
      intro={
        <>
          Is it covered, by which module of your policy, and how much does the insurer pay? Accidental damage (Art. 201 to
          204) is decided rule by rule, with the amount; a breakdown, an injury or a legal case goes to its module. The check
          reads your policy from its certificate, and asks only the questions that a rule which can still apply needs: here{" "}
          {asked.length} so far, of the {questionCount} questions of the model.
        </>
      }
      wide
    >
      <div className="columns">
        <section className="questions">
          <CertificatePanel />
          <h2>Your claim</h2>
          {asked.length === 0 && <Examples onPick={pick} />}
          {asked.map((f) =>
            f.id === editing ? (
              <Question key={f.id} fact={f} value={answers[f.id]} onAnswer={(v) => answer(f.id, v)} />
            ) : (
              <div key={f.id} className="answered">
                <span>{f.label}</span>
                <strong>{answerText(f, answers[f.id]!)}</strong>
                <button type="button" onClick={() => setEditing(f.id)}>
                  Change
                </button>
              </div>
            ),
          )}
          {next && <Question key={next.id} fact={next} next onAnswer={(v) => answer(next.id, v)} />}
          {asked.length > 0 && (
            <>
              <button type="button" className="start-over" onClick={() => setOwn({})}>
                Start over
              </button>
              <Examples onPick={pick} />
            </>
          )}
        </section>
        <Decision claim={claim} result={result} answers={answers} done={!next} />
      </div>
    </Page>
  );
}

function Examples({ onPick }: { onPick: (example: TestClaim) => void }) {
  return (
    <div className="examples">
      <span>Examples:</span>
      {examples.map((e) => (
        <button key={e.name} type="button" onClick={() => onPick(e)} title={e.question}>
          {e.example}
        </button>
      ))}
    </div>
  );
}
