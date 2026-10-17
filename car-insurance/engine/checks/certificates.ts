import { type Policy, YES } from "../model";
import type { Check, Finding } from "./index";

// Each certificate answers every certificate fact, and includes only options that the product
//     overview offers for its vehicle class.
export function certificates(p: Policy): Check {
  const findings: Finding[] = [];
  const facts = p.facts.filter((f) => f.group === "certificate");
  for (const c of p.certificates) {
    const missing = facts.filter((f) => c.answers[f.id] === undefined);
    if (missing.length) findings.push({ status: "open", text: `${c.label}: no answer for ${missing.map((f) => f.label.toLowerCase()).join(", ")}.`, sources: [] });
    const vehicle = String(c.answers.vehicleClass);
    for (const f of facts.filter((f) => f.optionOf && c.answers[f.id] === YES)) {
      const cover = p.covers.find((x) => x.id === f.optionOf)!;
      const status = cover.availability[vehicle];
      if (status !== "option") findings.push({ status: "open", text: `${c.label}: includes ${cover.label}, which is ${status === "basic" ? "basic, not an option," : "not insurable"} for this vehicle class.`, sources: cover.sources });
      const module = facts.find((m) => m.moduleOf === cover.module);
      if (module && c.answers[module.id] !== YES) findings.push({ status: "open", text: `${c.label}: includes ${cover.label}, but not its module.`, sources: cover.sources });
    }
    if (!findings.some((x) => x.text.startsWith(`${c.label}:`))) {
      const modules = p.modules.filter((m) => m.mandatory || facts.some((f) => f.moduleOf === m.id && c.answers[f.id] === YES));
      findings.push({ status: "ok", text: `${c.label}: complete. Modules: ${modules.map((m) => m.label.toLowerCase()).join(", ")}.`, sources: [] });
    }
  }
  return {
    id: "certificates",
    title: "The certificates agree with the product",
    what: "Each certificate answers every fact of a certificate, and includes an option only where the product overview offers it, with its module.",
    why: "The General Conditions say what each module covers; the certificate says what one policy has. A decision is wrong when it reads one as the other.",
    findings,
  };
}
