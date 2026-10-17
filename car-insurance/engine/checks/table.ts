import type { Policy } from "../model";
import type { Check, Finding } from "./index";

// The compensation table: one row per year, shares that never go up.
export function table(p: Policy): Check {
  const findings: Finding[] = [];
  p.compensation.forEach((r, i) => {
    if (r.year !== i + 1) findings.push({ status: "open", text: `The compensation table has no row for year ${i + 1}.`, sources: r.sources });
    if (r.toShare > r.fromShare) findings.push({ status: "open", text: `Year ${r.year}: the share goes up during the year.`, sources: r.sources });
    const before = p.compensation[i - 1];
    if (before && r.fromShare > before.toShare) findings.push({ status: "open", text: `Year ${r.year} starts higher than year ${before.year} ends.`, sources: r.sources });
  });
  if (!findings.length)
    findings.push({
      status: "ok",
      text: `${p.compensation.length} years, from ${p.compensation[0]!.fromShare * 100}% to ${p.compensation.at(-1)!.toShare * 100}%: the share never goes up, so a total loss never pays more for an older vehicle.`,
      sources: ["203.2"],
    });
  return {
    id: "table",
    title: "The compensation table is consistent",
    what: "The table has one row for each year of service, and the share of the catalogue price never goes up.",
    why: "The engine calculates every total loss from this table. One wrong row changes the payment of every claim in that year.",
    findings,
  };
}
