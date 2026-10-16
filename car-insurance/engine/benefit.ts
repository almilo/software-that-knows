// The amount of a claim, as steps from the loss to the payment, each with its articles. The numbers
// come from the model (the parameters and the compensation table), not from this code. The order of
// the steps is code: it names the facts of the amounts and a few answers of the model (a theft not
// found, Help Point PLUS not followed, Parking damage PLUS), so a test of every claim keeps the two
// in step (test/cases.ts).
import type { Answers, Cover, Policy } from "./model";

export type Step = { label: string; amount: number; sources: string[] };
export type Amount = { loss: "partial" | "total" | "item"; steps: Step[]; payment: number; notes: { text: string; sources: string[] }[] };

export function calculate(policy: Policy, cover: Cover, answers: Answers): Amount {
  const parameter = (id: string) => {
    const p = policy.parameters.find((x) => x.id === id);
    if (!p) throw new Error(`The model has no parameter ${id}`);
    return p;
  };
  const value = (id: string) => parameter(id).amount;
  const n = (key: string) => (answers[key] === undefined ? undefined : Number(answers[key]));
  const steps: Step[] = [];
  const notes: Amount["notes"] = [];

  // Items and protective clothing: the cost of an equivalent item, no deductible.
  if (n("catalogPrice") === undefined) {
    steps.push({ label: "Cost of an equivalent item, or of the repair", amount: n("repairCost") ?? 0, sources: ["203.5"] });
    notes.push({ text: "No deductible applies to items transported and protective clothing.", sources: ["6.5"] });
    notes.push({ text: "Zurich pays up to the sum insured in the policy.", sources: ["203.5"] });
    return finish("item");
  }

  const months = n("monthsOfService")!;
  const catalog = n("catalogPrice")!;
  const market = n("marketValue");
  const repair = n("repairCost");
  const row = months < value("tableMonths") ? policy.compensation.find((r) => r.year === Math.floor(months / 12) + 1) : undefined;
  const share = row ? row.fromShare + (row.toShare - row.fromShare) * ((months % 12) / 12) : undefined;
  const tableValue = share !== undefined ? Math.round(catalog * share) : (market ?? 0);

  const notFound = answers.theftRecovered === "NotRecovered";
  const early = months < value("earlyMonths");
  const total = notFound || (repair !== undefined && (early ? repair >= value("totalLossShare") * tableValue : repair >= (market ?? Infinity)));
  let loss: Amount["loss"] = "partial";
  if (total) {
    loss = "total";
    const why = notFound
      ? `the vehicle was not found within ${value("theftRecoveryDays")} days`
      : early
        ? `the repair costs reach ${percent(value("totalLossShare"))} of the table value in the first two years`
        : "the repair costs reach the replacement value";
    steps.push(
      share !== undefined
        ? { label: `Total loss, because ${why}: ${percent(share)} of the catalogue price of CHF ${chf(catalog)} in year ${row!.year} of service`, amount: tableValue, sources: ["203.2"] }
        : { label: `Total loss, because ${why}: the replacement value after ${value("tableMonths") / 12} years of service`, amount: tableValue, sources: ["203.2"] },
    );
    notes.push({ text: "The wreck becomes the property of Zurich. Unrepaired earlier damage is deducted.", sources: ["203.2"] });
  } else {
    steps.push({ label: "Reasonable costs of the repair", amount: repair ?? 0, sources: ["203.1"] });
  }

  if (cover.id === "ParkingDamage" && answers.hasParkingDamagePlus !== "Yes") {
    const limit = value("parkingLimit");
    const current = sum(steps);
    if (current > limit) steps.push({ label: `Limit per parking damage, without Parking damage PLUS`, amount: limit - current, sources: parameter("parkingLimit").sources });
  }

  if (!cover.noDeductible) {
    const agreed = n("deductible") ?? 0;
    steps.push({ label: "Deductible of the policy", amount: -agreed, sources: ["6"] });
    if (cover.reducibleDeductible) {
      const years = n("claimFreeYears") ?? 0;
      const reductions = Math.min(value("deductibleSteps"), Math.floor(years / value("claimFreeYearsPerStep")));
      const back = Math.min(agreed, reductions * value("deductibleStep"));
      if (back > 0) steps.push({ label: `Reduction of the deductible after ${years} full years without claims`, amount: back, sources: parameter("deductibleStep").sources });
    }
    if (answers.helpPoint === "HelpPointNotFollowed") {
      steps.push({ label: "Additional deductible: the rules of Help Point PLUS were not followed", amount: -value("helpPointPenalty"), sources: parameter("helpPointPenalty").sources });
    }
  }
  notes.push({ text: "If you can deduct input tax, Zurich deducts the VAT. Without a repair, it pays the costs without VAT.", sources: ["203.1", "203.2"] });
  return finish(loss);

  function finish(kind: Amount["loss"]): Amount {
    return { loss: kind, steps, payment: Math.max(0, sum(steps)), notes };
  }
}

const sum = (steps: Step[]) => steps.reduce((s, x) => s + x.amount, 0);
export const chf = (x: number) => Math.round(x).toLocaleString("en-CH").replace(/,/g, "'");
const percent = (x: number) => `${Math.round(x * 1000) / 10}%`;
