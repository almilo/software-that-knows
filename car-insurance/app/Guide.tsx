import { useState } from "react";
import { obligations } from "../engine/guide";
import { type Answers, NO, YES } from "../engine/model";
import { useCertificate } from "./certificate-store";
import { CertificatePanel } from "./CertificatePanel";
import { policy } from "./data";
import { Page, Sources } from "./ui";

const facts = policy.facts.filter((f) => f.group === "guide");

// The guide after an event: yes or no questions, and the checklist of the obligations whose
// conditions hold. An unanswered question counts as "no".
export function Guide() {
  const certificate = useCertificate().answers;
  const [answers, setAnswers] = useState<Answers>({});
  const list = obligations(policy, { ...certificate, ...answers });
  const toggle = (id: string, on: boolean) => setAnswers((a) => ({ ...a, [id]: on ? YES : NO }));

  return (
    <Page
      title="After an event"
      intro={<>What you must do after an accident, a theft or a breakdown, in order, and what happens if you do not. Mark what is true; the list changes. It also depends on the modules of your policy.</>}
    >
      <p className="emergency">
        Emergency: <a href="tel:0800808080">0800 80 80 80</a> · from abroad <a href="tel:+41446289898">+41 44 628 98 98</a>
      </p>
      <div className="columns">
        <section className="situation">
          <CertificatePanel />
          <h2>Your situation</h2>
          {facts.map((f) => (
            <label key={f.id} className="toggle">
              <input type="checkbox" checked={answers[f.id] === YES} onChange={(e) => toggle(f.id, e.target.checked)} />
              <span>{f.label}</span>
            </label>
          ))}
        </section>
        <section className="checklist">
          <h2>What to do ({list.length})</h2>
          <ol>
            {list.map((o) => (
              <li key={o.id}>
                <strong>{o.label}</strong>
                <p>{o.action}</p>
                {o.consequence && <p className="consequence">If not: {o.consequence}</p>}
                <Sources ids={o.sources} />
              </li>
            ))}
          </ol>
        </section>
      </div>
    </Page>
  );
}
