// The knowledge model (ontology/*.ttl) → the policy that the engine and the app read
// (generated/policy.json). The generator stops with an error when the model misses a value that
// the engine needs, or names a resource that does not exist (check-names.ts).
import type { Term } from "oxigraph";
import type { Availability, Condition, Cover, Fact, Policy, RuleKind } from "../engine/model";
import { byArticle } from "../engine/text";
import { checkNames } from "./check-names";
import { DCTERMS, INS, local, type Model, RDF, RDFS } from "./rdf";

const ins = (name: string) => `${INS}${name}`;

export function generatePolicy(m: Model): Policy {
  const read = reader(m);
  const product = readProduct(read);
  const policy: Policy = {
    ...readSource(read),
    ...product,
    facts: readFacts(read),
    certificates: readCertificates(read),
    ...readRules(read, product),
    ...readNumbers(read),
    ...readObligations(read),
    articles: readArticles(read),
  };
  checkNames(policy);
  return policy;
}

type Reader = ReturnType<typeof reader>;

// Small helpers to read the graph: values that the model must have, and values that it may have.
function reader(m: Model) {
  const optional = <K extends string, V>(key: K, value: V | undefined) => (value === undefined ? {} : ({ [key]: value } as Record<K, V>));
  return {
    m,
    optional,
    label: (t: Term) => m.required(t, `${RDFS}label`),
    text: (t: Term, name: string) => m.text(t, ins(name)),
    flag: (t: Term, name: string) => m.text(t, ins(name)) === "true",
    // The local name of a resource that the subject must have, or may have.
    resource(t: Term, name: string) {
      const value = m.one(t, ins(name));
      if (!value) throw new Error(`${local(t)} has no ins:${name}`);
      return local(value);
    },
    maybe: (t: Term, name: string) => {
      const value = m.one(t, ins(name));
      return value && local(value);
    },
    locals: (t: Term, name: string) => m.all(t, ins(name)).map(local),
    sources: (t: Term) => m.all(t, ins("source")).map(local).sort(byArticle),
    // The resources of a type, in the order of ins:order.
    ordered: (type: string) => m.ofType(ins(type)).sort((a, b) => (m.number(a, ins("order")) ?? 0) - (m.number(b, ins("order")) ?? 0)),
    all: (type: string) => m.ofType(ins(type)),
  };
}

function readSource({ m }: Reader) {
  const [policy] = m.ofType(ins("Policy"));
  if (!policy) throw new Error("The model has no ins:Policy");
  const [ontology] = m.ofType("http://www.w3.org/2002/07/owl#Ontology").filter((o) => m.text(o, `${DCTERMS}source`));
  return {
    title: m.required(policy, `${DCTERMS}title`),
    publisher: m.required(policy, `${DCTERMS}publisher`),
    source: ontology ? m.required(ontology, `${DCTERMS}source`) : "",
  };
}

// The parts, the vehicle classes, the modules and the covers of the product overview.
function readProduct(r: Reader) {
  const statuses = [["basicFor", "basic"], ["optionFor", "option"], ["notInsurableFor", "none"]] as const;
  const availability = (t: Term) => {
    const result: Record<string, Availability> = {};
    for (const [property, status] of statuses) {
      for (const vehicle of r.locals(t, property)) {
        if (result[vehicle]) throw new Error(`${local(t)} has two statuses for ${vehicle}`);
        result[vehicle] = status;
      }
    }
    return result;
  };
  return {
    parts: r.ordered("Part").map((t) => ({ id: local(t), label: r.label(t), modelled: r.flag(t, "modelled") })),
    vehicleClasses: r.ordered("VehicleClass").map((t) => ({ id: local(t), label: r.label(t), ...r.optional("help", r.text(t, "help")) })),
    modules: r.all("Module").map((t) => ({ id: local(t), label: r.label(t), part: r.resource(t, "part"), mandatory: r.flag(t, "mandatory"), sources: r.sources(t) })),
    covers: r.ordered("Cover").map(
      (t): Cover => ({
        id: local(t),
        label: r.label(t),
        part: r.resource(t, "part"),
        module: r.resource(t, "module"),
        ...r.optional("group", r.text(t, "group")),
        order: r.m.number(t, ins("order")) ?? 0,
        ...r.optional("calculation", r.text(t, "calculation") as Cover["calculation"]),
        availability: availability(t),
        ...r.optional("note", r.text(t, "note")),
        noDeductible: r.flag(t, "noDeductible"),
        reducibleDeductible: r.flag(t, "reducibleDeductible"),
        sources: r.sources(t),
      }),
    ),
  };
}

function condition(r: Reader, t: Term): Condition {
  const anyOf = r.m.one(t, ins("anyOf"));
  if (anyOf) return { anyOf: r.m.list(anyOf).map((x) => condition(r, x)) };
  const list = (name: string) => {
    const head = r.m.one(t, ins(name));
    return head && r.m.list(head).map(local);
  };
  return {
    fact: r.resource(t, "fact"),
    ...r.optional("in", list("in")),
    ...r.optional("notIn", list("notIn")),
    ...r.optional("atLeast", r.m.number(t, ins("atLeast"))),
    ...r.optional("below", r.m.number(t, ins("below"))),
  };
}
const conditions = (r: Reader, t: Term, name = "when") => r.m.all(t, ins(name)).map((x) => condition(r, x));

// The facts, in the order of the question lists (ins:QuestionOrder): every fact is in one list.
function readFacts(r: Reader): Fact[] {
  const position = new Map<string, number>();
  for (const order of r.all("QuestionOrder")) {
    r.m.list(r.m.one(order, ins("facts"))).forEach((f, i) => {
      if (position.has(f.value)) throw new Error(`${local(f)} is in two question lists`);
      position.set(f.value, i);
    });
  }
  const groups = [["ClaimFact", "claim"], ["GuideFact", "guide"], ["DateFact", "date"], ["CertificateFact", "certificate"]] as const;
  const group = (t: Term) => {
    const types = r.m.all(t, `${RDF}type`).map((x) => x.value);
    return groups.find(([type]) => types.includes(ins(type)))![1];
  };
  const values = (t: Term) =>
    (r.text(t, "kind") === "yesno" ? [r.m.node(ins("Yes")), r.m.node(ins("No"))] : r.m.list(r.m.one(t, ins("value")))).map((v) => ({
      id: local(v),
      label: r.label(v),
      ...r.optional("help", r.text(v, "help")),
      ...r.optional("totalLossBecause", r.text(v, "totalLossBecause")),
      ...r.optional("addsDeductible", r.maybe(v, "addsDeductible")),
    }));
  return r
    .all("Fact")
    .map((t) => {
      if (!position.has(t.value)) throw new Error(`${local(t)} is in no question list`);
      return {
        id: r.m.required(t, ins("key")),
        group: group(t),
        label: r.label(t),
        ...r.optional("help", r.text(t, "help")),
        kind: r.m.required(t, ins("kind")) as Fact["kind"],
        ...r.optional("unit", r.text(t, "unit")),
        values: values(t),
        order: position.get(t.value)!,
        required: r.flag(t, "required"),
        askWhen: conditions(r, t, "askWhen"),
        ...r.optional("optionOf", r.maybe(t, "optionOf")),
        ...r.optional("moduleOf", r.maybe(t, "moduleOf")),
        ...r.optional("sumOf", r.maybe(t, "sumOf")),
        ...r.optional("detailOf", r.maybe(t, "detailOf")),
        neededFor: r.m.all(t, ins("neededFor")).map((x) => x.value).sort(),
        ...r.optional("closedList", r.maybe(t, "closedList")),
      };
    })
    .sort((a, b) => a.group.localeCompare(b.group) || a.order - b.order);
}

function readCertificates(r: Reader) {
  const answer = (a: Term) => {
    const value = r.maybe(a, "is");
    return [r.resource(a, "fact"), value ?? Number(r.m.required(a, ins("amount")))] as const;
  };
  return r.ordered("Certificate").map((t) => ({
    id: local(t),
    label: r.label(t),
    ...r.optional("comment", r.m.text(t, `${RDFS}comment`)),
    answers: Object.fromEntries(r.m.all(t, ins("answer")).map(answer).sort(([a], [b]) => a.localeCompare(b))),
  }));
}

// The rules, the precedences between them, the closed lists and the concepts that they name.
function readRules(r: Reader, product: ReturnType<typeof readProduct>) {
  // A part in ins:appliesTo stands for all its covers.
  const coversOf = (id: string) => (product.parts.some((p) => p.id === id) ? product.covers.filter((c) => c.part === id).map((c) => c.id) : [id]);
  const kinds: [string, RuleKind][] = [
    ["CoverRule", "cover"],
    ["Exclusion", "exclusion"],
    ["Reduction", "reduction"],
    ["Waiver", "waiver"],
    ["TerritoryRule", "territory"],
  ];
  const rule = (kind: RuleKind) => (t: Term) => {
    const covers = r.maybe(t, "covers");
    const named = r.locals(t, "appliesTo");
    return {
      id: local(t),
      kind,
      label: r.label(t),
      ...r.optional("covers", covers),
      appliesTo: covers ? [covers] : [...new Set(named.flatMap(coversOf))],
      appliesToNamed: covers ? [covers] : named,
      when: conditions(r, t),
      sources: r.sources(t),
      mentions: r.locals(t, "mentions"),
      order: r.m.number(t, ins("order")) ?? 0,
    };
  };
  return {
    rules: kinds.flatMap(([type, kind]) => r.ordered(type).map(rule(kind))),
    precedences: r.all("Precedence").map((t) => ({
      id: local(t),
      winner: r.resource(t, "winner"),
      loser: r.resource(t, "loser"),
      basis: r.resource(t, "basis") === "Text" ? ("text" as const) : ("interpretation" as const),
      comment: r.m.required(t, `${RDFS}comment`),
    })),
    closedLists: r.all("ClosedList").map((t) => ({
      id: local(t),
      label: r.label(t),
      items: r.m.all(t, ins("item")).map((i) => i.value),
      sources: r.sources(t),
      ...r.optional("note", r.text(t, "note")),
    })),
    concepts: r.ordered("Concept").map((t) => ({ id: local(t), label: r.label(t), order: r.m.number(t, ins("order")) ?? 0 })),
  };
}

// The numbers: parameters, benefits with their limits, comparisons, the compensation table.
function readNumbers(r: Reader) {
  return {
    parameters: r.all("Parameter").map((t) => ({
      id: local(t),
      label: r.label(t),
      amount: Number(r.m.required(t, ins("amount"))),
      sources: r.sources(t),
      mentions: r.locals(t, "mentions"),
      ...r.optional("limitOf", r.maybe(t, "limitOf")),
      ...r.optional("liftedBy", r.maybe(t, "liftedBy")),
    })),
    benefits: r.all("Benefit").map((t) => ({
      id: local(t),
      label: r.label(t),
      covers: r.locals(t, "benefitOf"),
      mentions: r.locals(t, "mentions"),
      ...r.optional("limit", r.m.number(t, ins("limit"))),
      ...r.optional("per", r.text(t, "per")),
      ...r.optional("note", r.text(t, "note")),
      sources: r.sources(t),
    })),
    comparisons: r.ordered("Comparison").map((t) => ({ id: local(t), label: r.label(t), left: r.resource(t, "left"), right: r.resource(t, "right") })),
    compensation: r
      .all("CompensationRow")
      .map((t) => ({ year: r.m.number(t, ins("year"))!, fromShare: r.m.number(t, ins("fromShare"))!, toShare: r.m.number(t, ins("toShare"))!, sources: r.sources(t) }))
      .sort((a, b) => a.year - b.year),
  };
}

function readObligations(r: Reader) {
  return {
    obligations: r.ordered("Obligation").map((t) => ({
      id: local(t),
      label: r.label(t),
      action: r.m.required(t, ins("action")),
      ...r.optional("consequence", r.text(t, "consequence")),
      when: conditions(r, t),
      sources: r.sources(t),
    })),
    deadlines: r.ordered("Deadline").map((t) => ({
      id: local(t),
      label: r.label(t),
      anchor: r.resource(t, "anchor"),
      offset: r.m.required(t, ins("offset")),
      who: r.m.required(t, ins("who")),
      meaning: r.m.required(t, ins("meaning")),
      sources: r.sources(t),
    })),
  };
}

function readArticles(r: Reader) {
  return r
    .all("Article")
    .map((t) => ({
      id: local(t),
      number: r.m.required(t, ins("number")),
      title: r.label(t),
      ...r.optional("summary", r.text(t, "summary")),
      ...r.optional("part", r.maybe(t, "part")),
      ...r.optional("within", r.maybe(t, "within")),
      refersTo: r.locals(t, "refersTo").sort(byArticle),
      ...r.optional("page", r.m.number(t, ins("page"))),
    }))
    .sort((a, b) => byArticle(a.id, b.id));
}
