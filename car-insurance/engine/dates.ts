// The deadlines of the contract and of a claim: each one is a date of the user (the anchor) moved by
// an ISO 8601 duration of the model, for example -P3M1D: three months and one day before.
import type { Answers, Deadline, Policy } from "./model";

export type Dated = { deadline: Deadline; date: string };

export function deadlines(policy: Policy, dates: Answers): Dated[] {
  return policy.deadlines
    .filter((d) => typeof dates[d.anchor] === "string" && dates[d.anchor] !== "")
    .map((d) => ({ deadline: d, date: addOffset(String(dates[d.anchor]), d.offset) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// 2027-01-01 with -P3M1D → 2026-09-30. Months first, then weeks and days. A day that the target
// month does not have becomes its last day (2026-05-31 minus 3 months → 2026-02-28).
export function addOffset(date: string, offset: string): string {
  const m = /^(-)?P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?$/.exec(offset);
  if (!m) throw new Error(`Not an ISO 8601 duration of years, months, weeks and days: ${offset}`);
  const sign = m[1] ? -1 : 1;
  const [years, months, weeks, days] = m.slice(2).map((x) => Number(x ?? 0));
  const [y, mo, d] = date.split("-").map(Number) as [number, number, number];
  const target = (mo - 1) + sign * (years! * 12 + months!);
  const year = y + Math.floor(target / 12);
  const month = ((target % 12) + 12) % 12;
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const result = new Date(Date.UTC(year, month, Math.min(d, last)));
  result.setUTCDate(result.getUTCDate() + sign * (weeks! * 7 + days!));
  return result.toISOString().slice(0, 10);
}
