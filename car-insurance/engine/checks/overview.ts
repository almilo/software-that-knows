import type { Policy } from "../model";
import type { Check, Finding } from "./index";

// The product overview has one status for every cover and every vehicle class.
export function overview(p: Policy): Check {
  const findings: Finding[] = [];
  for (const c of p.covers) {
    const missing = p.vehicleClasses.filter((v) => !c.availability[v.id]);
    if (missing.length) findings.push({ status: "open", text: `${c.label}: no status for ${missing.map((v) => v.label.toLowerCase()).join(", ")}.`, sources: c.sources });
  }
  if (!findings.length) findings.push({ status: "ok", text: `${p.covers.length} covers × ${p.vehicleClasses.length} vehicle classes: each has exactly one status (basic, option or not insurable).`, sources: [] });
  return {
    id: "overview",
    title: "The product overview is complete",
    what: "For every cover and every vehicle class, the model says whether the cover is basic, an option, or not insurable.",
    why: "A gap in the overview is a claim that nobody can decide: is the cover in the policy or not?",
    findings,
  };
}
