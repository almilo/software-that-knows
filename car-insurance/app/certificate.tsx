import { useSyncExternalStore } from "react";
import type { Answers, Fact } from "../engine/model";
import { cover, policy } from "./data";

// The certificate of the policy that the views use: one of the certificates of the model, or one
// that the user changed. The claim check and the guide read it; they do not ask about it.
type State = { id: string; answers: Answers };
let state: State = { id: policy.certificates[0]!.id, answers: policy.certificates[0]!.answers };
const listeners = new Set<() => void>();
const set = (next: State) => {
  state = next;
  listeners.forEach((l) => l());
};

export function useCertificate() {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => state,
  );
}
export const chooseCertificate = (id: string) => set({ id, answers: policy.certificates.find((c) => c.id === id)!.answers });
export const changeCertificate = (changes: Answers) => set({ id: "custom", answers: { ...state.answers, ...changes } });

const facts = policy.facts.filter((f) => f.group === "certificate");
export const isCertificateFact = (id: string) => facts.some((f) => f.id === id);
const yes = (f: Fact) => f.values[0]!.id;
const no = (f: Fact) => f.values[1]!.id;

// The panel "Your policy": the certificate to use, and its modules and options, which the user can
// change to see how the decision changes.
export function CertificatePanel() {
  const { id, answers } = useCertificate();
  const vehicle = String(answers.vehicleClass);
  const modules = facts.filter((f) => f.moduleOf);
  const options = facts.filter((f) => f.optionOf && cover(f.optionOf).availability[vehicle] === "option");
  const others = facts.filter((f) => !f.moduleOf && !f.optionOf && f.id !== "vehicleClass" && (!f.sumOf || answers.hasAccident === "Yes") && (f.id !== "accidentPersons" || answers.hasAccident === "Yes"));
  const toggle = (f: Fact) => (
    <label key={f.id} className="check">
      <input type="checkbox" checked={answers[f.id] === yes(f)} onChange={(e) => changeCertificate({ [f.id]: e.target.checked ? yes(f) : no(f) })} />
      {f.label}
    </label>
  );
  const label = policy.certificates.find((c) => c.id === id)?.label ?? "Changed by you";

  return (
    <details className="certificate">
      <summary>
        <strong>Your policy:</strong> {label}
      </summary>
      <p className="hint">The certificate of the policy says which modules and options it includes. The checks read it and do not ask about it.</p>
      <label className="row">
        <span>Certificate</span>
        <select value={id} onChange={(e) => chooseCertificate(e.target.value)}>
          {policy.certificates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
          {id === "custom" && <option value="custom">Changed by you</option>}
        </select>
      </label>
      <label className="row">
        <span>Vehicle</span>
        <select value={vehicle} onChange={(e) => changeCertificate({ vehicleClass: e.target.value })}>
          {policy.vehicleClasses.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend>Modules</legend>
        {policy.modules
          .filter((m) => m.mandatory)
          .map((m) => (
            <label key={m.id} className="check">
              <input type="checkbox" checked disabled /> {m.label} (by law)
            </label>
          ))}
        {modules.map(toggle)}
      </fieldset>
      <fieldset>
        <legend>Options</legend>
        {options.map(toggle)}
        {others.filter((f) => f.kind === "choice" && f.values.length === 2 && f.values[0]!.label === "Yes").map(toggle)}
      </fieldset>
      {others
        .filter((f) => !(f.kind === "choice" && f.values[0]!.label === "Yes"))
        .map((f) => (
          <label key={f.id} className="row">
            <span>{f.label}</span>
            {f.kind === "choice" ? (
              <select value={String(answers[f.id] ?? "")} onChange={(e) => changeCertificate({ [f.id]: e.target.value })}>
                {f.values.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            ) : (
              <input type="number" min="0" value={String(answers[f.id] ?? "")} onChange={(e) => changeCertificate({ [f.id]: Number(e.target.value) })} />
            )}
          </label>
        ))}
    </details>
  );
}
