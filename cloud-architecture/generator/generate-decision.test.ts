import { describe, expect, test } from "bun:test";
import { root } from "./generate";
import { generateDecision, notSure } from "./generate-decision";
import { parseOntology, readOntology } from "./read-ontology";

const decision = generateDecision(await readOntology(["cloud-native-architecture.ttl", "criteria.ttl", "rules.ttl"].map((f) => `${root}ontology/${f}`)));

describe("generateDecision()", () => {
  test("reads the questions in the order of the ontology", () => {
    expect(decision.criteria.map((c) => c.key)).toEqual(["teamSize", "teams", "domainSeparation", "traffic", "backgroundWork", "platform", "expectedScale", "opsMaturity"]);
  });

  test("gives every question at least two answers with distinct codes, none of them the code for not sure", () => {
    decision.criteria.forEach((c) => {
      const codes = c.answers.map((a) => a.code);
      expect(codes.length, c.key).toBeGreaterThanOrEqual(2);
      expect(new Set(codes).size, c.key).toBe(codes.length);
      expect(codes, c.key).not.toContain(notSure);
    });
  });

  test("reads the three styles of the diagram, each on the same dimensions", () => {
    expect(decision.styles.map((s) => s.label)).toEqual(["Microservices", "Serverless", "Modular monolith"]);
    decision.styles.forEach((s) => expect(s.dimensions.map((d) => d.label)).toEqual(decision.styles[0]!.dimensions.map((d) => d.label)));
  });

  test("writes the rules' conditions with answers of their own questions", () => {
    const rules = [...decision.rules.style, ...decision.rules.parts, ...decision.rules.cautions];
    rules.flatMap((r) => r.when.flat()).forEach((atom) => {
      const codes = decision.criteria.find((c) => c.key === atom.criterion)!.answers.map((a) => a.code);
      atom.answers.forEach((a) => expect(codes, atom.criterion).toContain(a));
    });
  });

  test("fails when a question or an answer has no definition", () => {
    const turtle = `
      @prefix : <https://example.org/cloud-native-architecture#> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      @prefix skos: <http://www.w3.org/2004/02/skos/core#> .
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      :Size a :Criterion ; skos:notation "size" ; sh:order 1 ; rdfs:label "Size" ; skos:definition "How big." ;
        :answers ( :Big ) .
      :Big a :Answer ; skos:notation "big" ; rdfs:label "Big" .`;
    expect(() => generateDecision(parseOntology(turtle))).toThrow("https://example.org/cloud-native-architecture#Big has no");
  });
});
