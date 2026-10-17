import type { Condition, Policy } from "../engine/model";

// Every id that one statement names must exist: a name that does not exist is a typing error in the
// model, and the generator stops. (The checks in engine/checks/ look at the meaning of the model.)
export function checkNames(p: Policy) {
  const errors: string[] = [];
  const ids = (xs: { id: string }[]) => new Set(xs.map((x) => x.id));
  const covers = ids(p.covers);
  const facts = ids(p.facts);
  const rules = new Set([...ids(p.rules), ...ids(p.benefits)]);
  const concepts = ids(p.concepts);
  const lists = ids(p.closedLists);
  const parts = ids(p.parts);
  const vehicleClasses = ids(p.vehicleClasses);
  const expect = (set: Set<string>, id: string | undefined, where: string) => {
    if (id !== undefined && !set.has(id)) errors.push(`${where}: unknown ${id}`);
  };
  const values = new Map(p.facts.map((f) => [f.id, new Set(f.values.map((v) => v.id))]));
  const condition = (c: Condition, where: string) => {
    if ("anyOf" in c) return c.anyOf.forEach((x) => condition(x, where));
    expect(facts, c.fact, where);
    for (const v of [...(c.in ?? []), ...(c.notIn ?? [])]) expect(values.get(c.fact) ?? new Set(), v, `${where}, ${c.fact}`);
  };
  const modules = ids(p.modules);
  for (const c of p.covers) {
    expect(parts, c.part, c.id);
    expect(modules, c.module, c.id);
    for (const vc of Object.keys(c.availability)) expect(vehicleClasses, vc, c.id);
  }
  for (const f of p.facts) {
    f.askWhen.forEach((c) => condition(c, f.id));
    expect(covers, f.optionOf, f.id);
    expect(covers, f.sumOf, f.id);
    expect(modules, f.moduleOf, f.id);
    expect(modules, f.detailOf, f.id);
    expect(lists, f.closedList, f.id);
  }
  for (const r of p.rules) {
    r.when.forEach((c) => condition(c, r.id));
    r.appliesTo.forEach((c) => expect(covers, c, r.id));
    r.mentions.forEach((c) => expect(concepts, c, r.id));
  }
  for (const x of p.precedences) [x.winner, x.loser].forEach((id) => expect(rules, id, x.id));
  for (const b of p.benefits) {
    b.covers.forEach((c) => expect(covers, c, b.id));
    b.mentions.forEach((c) => expect(concepts, c, b.id));
  }
  const parameters = ids(p.parameters);
  for (const f of p.facts) for (const v of f.values) expect(parameters, v.addsDeductible, `${f.id}, ${v.id}`);
  for (const x of p.parameters) {
    expect(covers, x.limitOf, x.id);
    expect(facts, x.liftedBy, x.id);
  }
  for (const c of p.comparisons) [c.left, c.right].forEach((id) => expect(covers, id, c.id));
  for (const o of p.obligations) o.when.forEach((c) => condition(c, o.id));
  for (const d of p.deadlines) expect(facts, d.anchor, d.id);
  for (const c of p.certificates) {
    for (const [fact, value] of Object.entries(c.answers)) {
      expect(facts, fact, c.id);
      if (typeof value === "string") expect(values.get(fact) ?? new Set(), value, `${c.id}, ${fact}`);
    }
  }
  if (errors.length) throw new Error(`The model names resources that do not exist:\n${errors.join("\n")}`);
}
