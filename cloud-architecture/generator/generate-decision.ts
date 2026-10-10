// The decision, in the shape the app uses: the questions about the team (criteria.ttl), the three
// styles of the diagram with their characteristics per dimension and their tools
// (cloud-native-architecture.ttl), and Alok Sharan's heuristics as rules over the answers
// (rules.ttl). A rule's condition is a list of clauses that must all hold; a clause holds when one
// of its atoms does, and an atom holds when the criterion has one of its answers.
import type { Term } from "n3";
import { ARCH, local, type Ontology, RDFS, SH, SKOS } from "./read-ontology";

// Every question accepts this answer, added here rather than in the ontology.
export const notSure = "not_sure";

export type Criterion = ReturnType<typeof readCriteria>[number];

export function generateDecision(ontology: Ontology) {
  return {
    notSure,
    criteria: readCriteria(ontology),
    styles: readStyles(ontology),
    rules: {
      style: readRules(ontology, "StyleRule"),
      parts: readRules(ontology, "PartRule"),
      cautions: readRules(ontology, "Caution"),
    },
  };
}

function readCriteria(ontology: Ontology) {
  return byOrder(
    ontology.ofType(`${ARCH}Criterion`).map((criterion) => ({
      order: Number(ontology.required(criterion, `${SH}order`)),
      key: ontology.required(criterion, `${SKOS}notation`),
      label: ontology.required(criterion, `${RDFS}label`),
      definition: ontology.required(criterion, `${SKOS}definition`),
      answers: ontology.list(ontology.one(criterion, `${ARCH}answers`)).map((answer) => ({
        code: ontology.required(answer, `${SKOS}notation`),
        label: ontology.required(answer, `${RDFS}label`),
        definition: ontology.required(answer, `${SKOS}definition`),
      })),
    })),
  );
}

function readStyles(ontology: Ontology) {
  const dimensions = byOrder(
    ontology.subjects(`${RDFS}subPropertyOf`, `${ARCH}hasCharacteristic`).map((property) => ({
      order: Number(ontology.required(property, `${SH}order`)),
      property: property.value,
      label: ontology.required(ontology.one(property, `${RDFS}range`)!, `${RDFS}label`),
    })),
  );
  return byOrder(
    ontology.ofType(`${ARCH}ArchitectureStyle`).map((style) => ({
      order: Number(ontology.required(style, `${SH}order`)),
      id: local(style),
      label: ontology.required(style, `${RDFS}label`),
      dimensions: dimensions.map((d) => ({
        label: d.label,
        characteristics: ontology.all(style, d.property).map((c) => ontology.required(c, `${RDFS}label`)),
      })),
      tools: ontology.all(style, `${ARCH}supportedBy`).map((tool) => {
        const platform = ontology.one(tool, `${ARCH}onPlatform`);
        return { label: ontology.required(tool, `${RDFS}label`), platform: platform && ontology.required(platform, `${SKOS}notation`) };
      }),
    })),
  );
}

function readRules(ontology: Ontology, type: string) {
  return byOrder(
    ontology.ofType(`${ARCH}${type}`).map((rule) => {
      const recommends = ontology.one(rule, `${ARCH}recommends`);
      const part = ontology.text(rule, `${ARCH}part`);
      return {
        order: Number(ontology.required(rule, `${SH}order`)),
        id: local(rule),
        label: ontology.required(rule, `${RDFS}label`),
        ...(recommends && { recommends: local(recommends) }),
        ...(part && { part }),
        quote: ontology.required(rule, `${ARCH}quote`),
        explanation: ontology.required(rule, `${RDFS}comment`),
        when: ontology.all(rule, `${ARCH}when`).map((condition) => clause(ontology, condition)),
      };
    }),
  );
}

function clause(ontology: Ontology, condition: Term) {
  const anyOf = ontology.one(condition, `${ARCH}anyOf`);
  return (anyOf ? ontology.list(anyOf) : [condition]).map((atom) => ({
    criterion: ontology.required(ontology.one(atom, `${ARCH}criterion`)!, `${SKOS}notation`),
    answers: ontology.list(ontology.one(atom, `${ARCH}in`)).map((answer) => ontology.required(answer, `${SKOS}notation`)),
  }));
}

function byOrder<T extends { order: number }>(items: T[]) {
  return [...items].sort((a, b) => a.order - b.order).map(({ order, ...item }) => item);
}
