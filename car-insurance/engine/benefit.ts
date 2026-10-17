// The amount of a claim, as steps from the loss to the payment, each with its articles. The numbers
// come from the model: the parameters, the compensation table, the limits of a cover
// (ins:limitOf), and the answers that make a total loss or add to the deductible. The order of the
// steps is code; it reads the facts of the amounts by their keys (calculationInputs), and a test
// makes sure that the model has them.
import { type Answers, type Cover, type Policy, YES } from "./model";
import { chf } from "./text";

// The facts that the calculation reads, by key.
export const calculationInputs = ["monthsOfService", "catalogPrice", "marketValue", "repairCost", "deductible", "claimFreeYears"];

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
  // The answers given, as values of the model.
  const answered = policy.facts.flatMap((f) => f.values.filter((v) => answers[f.id] === v.id));

  // Items and protective clothing: the cost of an equivalent item, no deductible.
  if (cover.calculation === "item") {
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

  const totalLossBecause = answered.find((v) => v.totalLossBecause)?.totalLossBecause;
  const early = months < value("earlyMonths");
  const total = totalLossBecause !== undefined || (repair !== undefined && (early ? repair >= value("totalLossShare") * tableValue : repair >= (market ?? Infinity)));
  let loss: Amount["loss"] = "partial";
  if (total) {
    loss = "total";
    const why = totalLossBecause
      ? totalLossBecause
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

  for (const limit of policy.parameters.filter((p) => p.limitOf === cover.id && !(p.liftedBy && answers[p.liftedBy] === YES))) {
    const current = sum(steps);
    const without = limit.liftedBy && policy.facts.find((f) => f.id === limit.liftedBy)?.label;
    if (current > limit.amount) steps.push({ label: `${limit.label}${without ? `, without ${without}` : ""}`, amount: limit.amount - current, sources: limit.sources });
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
    for (const v of answered.filter((v) => v.addsDeductible)) {
      const extra = parameter(v.addsDeductible!);
      steps.push({ label: extra.label, amount: -extra.amount, sources: extra.sources });
    }
  }
  notes.push({ text: "If you can deduct input tax, Zurich deducts the VAT. Without a repair, it pays the costs without VAT.", sources: ["203.1", "203.2"] });
  return finish(loss);

  function finish(kind: Amount["loss"]): Amount {
    return { loss: kind, steps, payment: Math.max(0, sum(steps)), notes };
  }
}

const sum = (steps: Step[]) => steps.reduce((s, x) => s + x.amount, 0);
const percent = (x: number) => `${Math.round(x * 1000) / 10}%`;
