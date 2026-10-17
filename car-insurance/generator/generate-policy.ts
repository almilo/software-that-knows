// The knowledge model (ontology/*.ttl) → the policy that the engine and the app read
// (generated/policy.json). The generator stops with an error when the model misses a value that
// the engine needs, or names a resource that does not exist.
import type { Term } from "oxigraph";
import type {
  Article,
  Availability,
  Benefit,
  ClosedList,
  Comparison,
  CompensationRow,
  Concept,
  Condition,
  Cover,
  Deadline,
  Certificate,
  Fact,
  Module,
  Obligation,
  Parameter,
  Part,
  Policy,
  Precedence,
  Rule,
  RuleKind,
  VehicleClass,
} from "../engine/model";
import { DCTERMS, INS, local, type Model, RDF, RDFS } from "./rdf";

const ins = (name: string) => `${INS}${name}`;
const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;

export function generatePolicy(m: Model): Policy {
  const label = (t: Term) => m.required(t, `${RDFS}label`);
  const order = (t: Term) => m.number(t, ins("order")) ?? 0;
  const locals = (s: Term, p: string) => m.all(s, p).map(local);
  const sources = (t: Term) => locals(t, ins("source")).sort(byArticle);
  const optional = <K extends string, V>(key: K, value: V | undefined) => (value === undefined ? {} : ({ [key]: value } as Record<K, V>));

  const [policy] = m.ofType(ins("Policy"));
  if (!policy) throw new Error("The model has no ins:Policy");
  const [ontology] = m.ofType("http://www.w3.org/2002/07/owl#Ontology").filter((o) => m.text(o, `${DCTERMS}source`));

  const parts: (Part & { order: number })[] = m
    .ofType(ins("Part"))
    .map((t) => ({ id: local(t), label: label(t), modelled: m.text(t, ins("modelled")) === "true", order: order(t) }))
    .sort(byOrder);
  const vehicleClasses: (VehicleClass & { order: number })[] = m
    .ofType(ins("VehicleClass"))
    .map((t) => ({ id: local(t), label: label(t), ...optional("help", m.text(t, ins("help"))), order: order(t) }))
    .sort(byOrder);

  const modules: Module[] = m
    .ofType(ins("Module"))
    .map((t) => ({ id: local(t), label: label(t), part: local(m.one(t, ins("part"))!), mandatory: m.text(t, ins("mandatory")) === "true", sources: sources(t) }));

  const covers: Cover[] = m
    .ofType(ins("Cover"))
    .map((t) => {
      const availability: Record<string, Availability> = {};
      for (const [p, status] of [["basicFor", "basic"], ["optionFor", "option"], ["notInsurableFor", "none"]] as const) {
        for (const vc of locals(t, ins(p))) {
          if (availability[vc]) throw new Error(`${local(t)} has two statuses for ${vc}`);
          availability[vc] = status;
        }
      }
      return {
        id: local(t),
        label: label(t),
        part: local(m.one(t, ins("part"))!),
        module: local(m.one(t, ins("module")) ?? (() => { throw new Error(`${local(t)} has no ins:module`); })()),
        ...optional("group", m.text(t, ins("group"))),
        order: order(t),
        ...optional("calculation", m.text(t, ins("calculation")) as Cover["calculation"]),
        availability,
        ...optional("note", m.text(t, ins("note"))),
        noDeductible: m.text(t, ins("noDeductible")) === "true",
        reducibleDeductible: m.text(t, ins("reducibleDeductible")) === "true",
        sources: sources(t),
      };
    })
    .sort(byOrder);

  const condition = (t: Term): Condition => {
    const anyOf = m.one(t, ins("anyOf"));
    if (anyOf) return { anyOf: m.list(anyOf).map(condition) };
    const fact = m.one(t, ins("fact"));
    if (!fact) throw new Error(`A condition has no ins:fact or ins:anyOf`);
    return {
      fact: local(fact),
      ...optional("in", m.one(t, ins("in")) && m.list(m.one(t, ins("in"))).map(local)),
      ...optional("notIn", m.one(t, ins("notIn")) && m.list(m.one(t, ins("notIn"))).map(local)),
      ...optional("atLeast", m.number(t, ins("atLeast"))),
      ...optional("below", m.number(t, ins("below"))),
    };
  };
  const conditions = (t: Term, p = "when") => m.all(t, ins(p)).map(condition);

  const group = (t: Term): Fact["group"] | undefined => {
    const types = m.all(t, `${RDF}type`).map((x) => x.value);
    if (types.includes(ins("ClaimFact"))) return "claim";
    if (types.includes(ins("GuideFact"))) return "guide";
    if (types.includes(ins("DateFact"))) return "date";
    if (types.includes(ins("CertificateFact"))) return "certificate";
  };
  const facts: Fact[] = m
    .ofType(ins("Fact"))
    .map((t) => ({
      id: m.required(t, ins("key")),
      group: group(t)!,
      label: label(t),
      ...optional("help", m.text(t, ins("help"))),
      kind: m.required(t, ins("kind")) as Fact["kind"],
      ...optional("unit", m.text(t, ins("unit"))),
      values: (m.text(t, ins("kind")) === "yesno" ? [m.node(ins("Yes")), m.node(ins("No"))] : m.list(m.one(t, ins("value")))).map((v) => ({
        id: local(v),
        label: label(v),
        ...optional("help", m.text(v, ins("help"))),
        ...optional("totalLossBecause", m.text(v, ins("totalLossBecause"))),
        ...optional("addsDeductible", m.one(v, ins("addsDeductible")) && local(m.one(v, ins("addsDeductible"))!)),
      })),
      order: order(t),
      required: m.text(t, ins("required")) === "true",
      askWhen: conditions(t, "askWhen"),
      ...optional("optionOf", m.one(t, ins("optionOf")) && local(m.one(t, ins("optionOf"))!)),
      ...optional("moduleOf", m.one(t, ins("moduleOf")) && local(m.one(t, ins("moduleOf"))!)),
      ...optional("sumOf", m.one(t, ins("sumOf")) && local(m.one(t, ins("sumOf"))!)),
      ...optional("detailOf", m.one(t, ins("detailOf")) && local(m.one(t, ins("detailOf"))!)),
      neededFor: m.all(t, ins("neededFor")).map((x) => x.value).sort(),
      ...optional("closedList", m.one(t, ins("closedList")) && local(m.one(t, ins("closedList"))!)),
    }))
    .sort((a, b) => a.group.localeCompare(b.group) || a.order - b.order);

  const certificates: Certificate[] = m
    .ofType(ins("Certificate"))
    .map((t) => ({
      id: local(t),
      label: label(t),
      ...optional("comment", m.text(t, `${RDFS}comment`)),
      answers: Object.fromEntries(
        m.all(t, ins("answer")).map((a) => {
          const value = m.one(a, ins("is"));
          return [local(m.one(a, ins("fact"))!), value ? local(value) : Number(m.required(a, ins("amount")))];
        }).sort(([a], [b]) => String(a).localeCompare(String(b))),
      ),
      order: order(t),
    }))
    .sort(byOrder)
    .map(({ order: _, ...c }) => c);

  // A part in ins:appliesTo stands for all its covers.
  const coversOf = (id: string) => (parts.some((p) => p.id === id) ? covers.filter((c) => c.part === id).map((c) => c.id) : [id]);
  const kinds: [string, RuleKind][] = [
    ["CoverRule", "cover"],
    ["Exclusion", "exclusion"],
    ["Reduction", "reduction"],
    ["Waiver", "waiver"],
    ["TerritoryRule", "territory"],
  ];
  const rules: Rule[] = kinds.flatMap(([type, kind]) =>
    m
      .ofType(ins(type))
      .map((t) => {
        const covered = m.one(t, ins("covers")) && local(m.one(t, ins("covers"))!);
        const named = locals(t, ins("appliesTo"));
        return {
          id: local(t),
          kind,
          label: label(t),
          ...optional("covers", covered),
          appliesTo: covered ? [covered] : [...new Set(named.flatMap(coversOf))],
          appliesToNamed: covered ? [covered] : named,
          when: conditions(t),
          sources: sources(t),
          mentions: locals(t, ins("mentions")),
          order: order(t),
        };
      })
      .sort(byOrder),
  );

  const precedences: Precedence[] = m.ofType(ins("Precedence")).map((t) => ({
    id: local(t),
    winner: local(m.one(t, ins("winner"))!),
    loser: local(m.one(t, ins("loser"))!),
    basis: m.one(t, ins("basis"))!.value === ins("Text") ? "text" : "interpretation",
    comment: m.required(t, `${RDFS}comment`),
  }));

  const closedLists: ClosedList[] = m.ofType(ins("ClosedList")).map((t) => ({
    id: local(t),
    label: label(t),
    items: m.all(t, ins("item")).map((i) => i.value),
    sources: sources(t),
    ...optional("note", m.text(t, ins("note"))),
  }));
  const concepts: Concept[] = m
    .ofType(ins("Concept"))
    .map((t) => ({ id: local(t), label: label(t), order: order(t) }))
    .sort(byOrder);
  const parameters: Parameter[] = m.ofType(ins("Parameter")).map((t) => ({
    id: local(t),
    label: label(t),
    amount: Number(m.required(t, ins("amount"))),
    sources: sources(t),
    mentions: locals(t, ins("mentions")),
    ...optional("limitOf", m.one(t, ins("limitOf")) && local(m.one(t, ins("limitOf"))!)),
    ...optional("liftedBy", m.one(t, ins("liftedBy")) && local(m.one(t, ins("liftedBy"))!)),
  }));
  const benefits: Benefit[] = m.ofType(ins("Benefit")).map((t) => ({
    id: local(t),
    label: label(t),
    covers: locals(t, ins("benefitOf")),
    mentions: locals(t, ins("mentions")),
    ...optional("limit", m.number(t, ins("limit"))),
    ...optional("per", m.text(t, ins("per"))),
    ...optional("note", m.text(t, ins("note"))),
    sources: sources(t),
  }));
  const comparisons: Comparison[] = m
    .ofType(ins("Comparison"))
    .map((t) => ({ id: local(t), label: label(t), left: local(m.one(t, ins("left"))!), right: local(m.one(t, ins("right"))!), order: order(t) }))
    .sort(byOrder)
    .map(({ order: _, ...c }) => c);
  const compensation: CompensationRow[] = m
    .ofType(ins("CompensationRow"))
    .map((t) => ({
      year: m.number(t, ins("year"))!,
      fromShare: m.number(t, ins("fromShare"))!,
      toShare: m.number(t, ins("toShare"))!,
      sources: sources(t),
    }))
    .sort((a, b) => a.year - b.year);

  const obligations: Obligation[] = m
    .ofType(ins("Obligation"))
    .map((t) => ({
      id: local(t),
      label: label(t),
      action: m.required(t, ins("action")),
      ...optional("consequence", m.text(t, ins("consequence"))),
      when: conditions(t),
      sources: sources(t),
      order: order(t),
    }))
    .sort(byOrder)
    .map(({ order: _, ...o }) => o);
  const deadlines: Deadline[] = m
    .ofType(ins("Deadline"))
    .map((t) => ({
      id: local(t),
      label: label(t),
      anchor: local(m.one(t, ins("anchor"))!),
      offset: m.required(t, ins("offset")),
      who: m.required(t, ins("who")),
      meaning: m.required(t, ins("meaning")),
      sources: sources(t),
      order: order(t),
    }))
    .sort(byOrder)
    .map(({ order: _, ...d }) => d);

  const articles: Article[] = m
    .ofType(ins("Article"))
    .map((t) => ({
      id: local(t),
      number: m.required(t, ins("number")),
      title: label(t),
      ...optional("summary", m.text(t, ins("summary"))),
      ...optional("part", m.one(t, ins("part")) && local(m.one(t, ins("part"))!)),
      ...optional("within", m.one(t, ins("within")) && local(m.one(t, ins("within"))!)),
      refersTo: locals(t, ins("refersTo")).sort(byArticle),
      ...optional("page", m.number(t, ins("page"))),
    }))
    .sort((a, b) => byArticle(a.id, b.id));

  const result: Policy = {
    title: m.required(policy, `${DCTERMS}title`),
    publisher: m.required(policy, `${DCTERMS}publisher`),
    source: ontology ? m.required(ontology, `${DCTERMS}source`) : "",
    parts: parts.map(({ order: _, ...p }) => p),
    vehicleClasses: vehicleClasses.map(({ order: _, ...v }) => v),
    modules,
    certificates,
    covers,
    facts,
    rules,
    precedences,
    closedLists,
    concepts,
    parameters,
    benefits,
    comparisons,
    compensation,
    obligations,
    deadlines,
    articles,
  };
  checkNames(result);
  return result;
}

// Article numbers in reading order: 4.1 before 4.10, 202.3 before 202.3a before 202.4.
export function byArticle(a: string, b: string) {
  return a.localeCompare(b, "en", { numeric: true });
}

// Every id that one statement names must exist: a name that does not exist is a typing error in the
// model, and the generator stops. (The checks in engine/checks.ts look at the meaning of the model.)
function checkNames(p: Policy) {
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
