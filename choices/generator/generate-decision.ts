// The decision, in the shape the app uses, from the choice words (ontology/choice.ttl): the words of
// the page, the questions, the options with their characteristics per dimension and their tools,
// the rules, and the ladder. A rule's condition is a list of clauses that must all hold; a clause
// holds when one of its atoms does, and an atom holds when the criterion has one of its answers.
// The conditions of a choice rule are written as such (part 7), or come from its path in a
// decision tree (readTree).
import type { Term } from "oxigraph";
import { CHOICE, DCTERMS, local, type Model, RDFS, SH, SKOS } from "./rdf";

// Every question accepts this answer, added here rather than in the model.
export const notSure = "not_sure";

type Atom = { criterion: string; answers: string[] };

// strict: stop at the first finding in the structure of the tree. Without it, the findings come
// back with the decision, for the tests of a tree as drawn.
export function generateDecision(model: Model, { strict = true } = {}) {
  const tree = readTree(model);
  if (strict && tree.findings.length) throw new Error(`The decision tree is not complete:\n${tree.findings.join("\n")}`);
  const decision = {
    domain: readDomain(model),
    notSure,
    criteria: readCriteria(model),
    options: readOptions(model),
    rules: {
      choice: readRules(model, "ChoiceRule", tree.paths),
      additions: readRules(model, "AdditionRule", tree.paths),
      cautions: readRules(model, "Caution", tree.paths),
    },
    ladder: readLadder(model),
  };
  return strict ? decision : { ...decision, findings: tree.findings };
}

function readDomain(model: Model) {
  const domain = model.ofType(`${CHOICE}Domain`)[0];
  if (!domain) throw new Error("The model has no choice:Domain");
  const optional = (p: string) => model.text(domain, `${CHOICE}${p}`);
  return {
    title: model.required(domain, `${RDFS}label`),
    intro: model.required(domain, `${CHOICE}intro`),
    author: model.required(domain, `${CHOICE}author`),
    source: model.required(domain, `${DCTERMS}source`),
    sourceTitle: model.required(domain, `${CHOICE}sourceTitle`),
    optionsTitle: model.required(domain, `${CHOICE}optionsTitle`),
    additionsTitle: optional("additionsTitle"),
    ladderTitle: optional("ladderTitle"),
    ladderQuote: optional("ladderQuote"),
    recordTitle: model.required(domain, `${CHOICE}recordTitle`),
    recordName: model.required(domain, `${CHOICE}recordName`),
    recordFile: model.required(domain, `${CHOICE}recordFile`),
    recordAppendix: optional("recordAppendix"),
  };
}

function readCriteria(model: Model) {
  return byOrder(
    model.ofType(`${CHOICE}Criterion`).map((criterion) => ({
      order: Number(model.required(criterion, `${SH}order`)),
      key: model.required(criterion, `${SKOS}notation`),
      label: model.required(criterion, `${RDFS}label`),
      definition: model.required(criterion, `${SKOS}definition`),
      answers: model.list(model.one(criterion, `${CHOICE}answers`)).map((answer) => {
        const definition = model.text(answer, `${SKOS}definition`);
        return {
          code: model.required(answer, `${SKOS}notation`),
          label: model.required(answer, `${RDFS}label`),
          ...(definition && { definition }),
        };
      }),
    })),
  );
}

function readOptions(model: Model) {
  // The subproperties of choice:hasCharacteristic, at any depth, that have a place:
  // arch:hasCharacteristic, which only groups the dimensions of part 7, has none.
  const dimensions = byOrder(
    model.select(`SELECT ?property ?order WHERE { ?property rdfs:subPropertyOf+ choice:hasCharacteristic ; sh:order ?order }`).map((row) => {
      const property = row.property!;
      const range = model.one(property, `${RDFS}range`);
      return {
        order: Number(row.order!.value),
        property: property.value,
        label: (range && model.text(range, `${RDFS}label`)) ?? model.required(property, `${RDFS}label`),
        inRecommendation: model.text(property, `${CHOICE}inRecommendation`) === "true",
      };
    }),
  );
  return byOrder(
    model.ofType(`${CHOICE}Option`).map((option) => ({
      order: Number(model.required(option, `${SH}order`)),
      id: local(option),
      label: model.required(option, `${RDFS}label`),
      dimensions: dimensions.map((d) => ({
        label: d.label,
        inRecommendation: d.inRecommendation,
        characteristics: model
          .all(option, d.property)
          .map((c) => (c.termType === "Literal" ? c.value : model.required(c, `${RDFS}label`)))
          .sort(byName),
      })),
      tools: model
        .all(option, `${CHOICE}supportedBy`)
        .map((tool) => {
          const answer = model.one(tool, `${CHOICE}availableWith`);
          return { label: model.required(tool, `${RDFS}label`), ...(answer && { availableWith: answerOf(model, answer) }) };
        })
        .sort((a, b) => byName(a.label, b.label)),
    })),
  );
}

function readRules(model: Model, type: string, paths: Map<string, Atom[][]>) {
  return byOrder(
    model.ofType(`${CHOICE}${type}`).map((rule) => {
      const recommends = model.one(rule, `${CHOICE}recommends`);
      const part = model.text(rule, `${CHOICE}part`);
      const whenChosen = model.one(rule, `${CHOICE}whenChosen`);
      return {
        order: Number(model.required(rule, `${SH}order`)),
        id: local(rule),
        label: model.required(rule, `${RDFS}label`),
        ...(recommends && { recommends: local(recommends) }),
        ...(part && { part }),
        quote: model.required(rule, `${CHOICE}quote`),
        explanation: model.required(rule, `${RDFS}comment`),
        when: [...(paths.get(rule.value) ?? []), ...model.all(rule, `${CHOICE}when`).map((condition) => clause(model, condition))],
        ...(whenChosen && { whenChosen: local(whenChosen) }),
      };
    }),
  );
}

function clause(model: Model, condition: Term): Atom[] {
  const anyOf = model.one(condition, `${CHOICE}anyOf`);
  return (anyOf ? model.list(anyOf) : [condition]).map((atom) => ({
    criterion: model.required(model.one(atom, `${CHOICE}criterion`)!, `${SKOS}notation`),
    answers: model.list(model.one(atom, `${CHOICE}in`)).map((answer) => model.required(answer, `${SKOS}notation`)),
  }));
}

function readLadder(model: Model) {
  return byOrder(
    model.ofType(`${CHOICE}Step`).map((step) => {
      const level = model.one(step, `${CHOICE}level`)!;
      return {
        order: Number(model.required(step, `${SH}order`)),
        id: local(step),
        option: local(model.one(step, `${CHOICE}option`)!),
        level: model.required(level, `${RDFS}label`),
        levelOrder: Number(model.required(level, `${SH}order`)),
        explanation: model.required(step, `${RDFS}comment`),
      };
    }),
  );
}

// A decision tree, if the domain has one: for each choice rule, the paths that lead to it as
// conditions, one clause per arrow. And what is wrong with its structure:
//   - a question without exactly one arrow per answer: an answer leads nowhere, or to two places;
//   - a choice rule in the tree without exactly one path to it.
export function readTree(model: Model) {
  const start = model.ofType(`${CHOICE}Domain`).flatMap((d) => model.all(d, `${CHOICE}startsAt`))[0];
  if (!start) return { paths: new Map<string, Atom[][]>(), findings: [] };
  const paths = new Map<string, Atom[][][]>();

  const findings = model
    .select(
      `SELECT ?criterion ?answer (COUNT(?branch) AS ?arrows) WHERE {
        { SELECT DISTINCT ?criterion WHERE {
            { ?domain choice:startsAt ?criterion } UNION { ?any choice:branch/choice:to ?criterion . ?criterion a choice:Criterion } } }
        ?criterion choice:answers/rdf:rest*/rdf:first ?answer .
        OPTIONAL { ?criterion choice:branch ?branch . ?branch choice:answer ?answer }
      } GROUP BY ?criterion ?answer HAVING (COUNT(?branch) != 1) ORDER BY ?criterion ?answer`,
    )
    .map((row) => `${local(row.criterion!)}: ${row.arrows!.value} arrows for "${model.required(row.answer!, `${SKOS}notation`)}"`);

  const isCriterion = (t: Term) => model.ofType(`${CHOICE}Criterion`).some((c) => c.equals(t));
  const walk = (node: Term, path: Atom[][], seen: string[]) => {
    if (seen.includes(node.value)) return void findings.push(`${local(node)}: the tree loops`);
    if (!isCriterion(node)) return void paths.set(node.value, [...(paths.get(node.value) ?? []), path]);
    for (const branch of model.all(node, `${CHOICE}branch`)) {
      const atom = { criterion: model.required(node, `${SKOS}notation`), answers: [model.required(model.one(branch, `${CHOICE}answer`)!, `${SKOS}notation`)] };
      walk(model.one(branch, `${CHOICE}to`)!, [...path, [atom]], [...seen, node.value]);
    }
  };
  walk(start, [], []);

  const inTree = model.select(`SELECT DISTINCT ?rule WHERE { ?any choice:branch/choice:to ?rule . ?rule a choice:ChoiceRule }`).map((r) => r.rule!.value);
  for (const rule of inTree) {
    const n = paths.get(rule)?.length ?? 0;
    if (n !== 1) findings.push(`${rule.replace(/^.*[#/]/, "")}: ${n} paths lead to it`);
  }
  // A rule's conditions are the one path to it. With more paths, the first; the finding says so.
  return { paths: new Map([...paths].map(([rule, p]) => [rule, p[0]!])), findings };
}

// The criterion and the code of an answer: answer codes are only unique within their criterion.
function answerOf(model: Model, answer: Term) {
  const criterion = model.ofType(`${CHOICE}Criterion`).find((c) => model.list(model.one(c, `${CHOICE}answers`)).some((a) => a.equals(answer)));
  if (!criterion) throw new Error(`${answer.value} is not an answer of any criterion`);
  return { criterion: model.required(criterion, `${SKOS}notation`), answer: model.required(answer, `${SKOS}notation`) };
}

// RDF does not keep the order in which a file lists the values of a property, so the values of a
// dimension and the tools of an option are sorted by name.
const byName = new Intl.Collator("en").compare;

function byOrder<T extends { order: number }>(items: T[]) {
  return [...items].sort((a, b) => a.order - b.order).map(({ order, ...item }) => item);
}
