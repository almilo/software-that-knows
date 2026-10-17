import { type Fact, NO, YES } from "../engine/model";
import { changeCertificate, chooseCertificate, useCertificate } from "./certificate-store";
import { cover, policy } from "./data";

const facts = policy.facts.filter((f) => f.group === "certificate");

// The panel "Your policy": the certificate to use, and its modules and options, which the user can
// change to see how the decision changes.
export function CertificatePanel() {
  const { id, answers } = useCertificate();
  const vehicle = String(answers.vehicleClass);
  const modules = facts.filter((f) => f.moduleOf);
  const options = facts.filter((f) => f.optionOf && cover(f.optionOf).availability[vehicle] === "option");
  // A detail of a module (the sums of the accident insurance) matters only when the policy has it.
  const hasModule = (id: string) => facts.some((f) => f.moduleOf === id && answers[f.id] === YES);
  const others = facts.filter((f) => !f.moduleOf && !f.optionOf && !f.required && (!f.detailOf || hasModule(f.detailOf)));
  const toggle = (f: Fact) => (
    <label key={f.id} className="check">
      <input type="checkbox" checked={answers[f.id] === YES} onChange={(e) => changeCertificate({ [f.id]: e.target.checked ? YES : NO })} />
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
        {others.filter((f) => f.kind === "yesno").map(toggle)}
      </fieldset>
      {others
        .filter((f) => f.kind !== "yesno")
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
