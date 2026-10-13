import { describe, expect, test } from "bun:test";
import { domains, readModel, root } from "./generate";
import { generateDecision, notSure } from "./generate-decision";
import { loadModel } from "./rdf";

// The same checks for every domain: the generator knows no domain.
describe.each(await domains())("generateDecision() for %s", async (name) => {
  const decision = generateDecision(await readModel(name));

  test("gives every question at least two answers with distinct codes, none of them the code for not sure", () => {
    decision.criteria.forEach((c) => {
      const codes = c.answers.map((a) => a.code);
      expect(codes.length, c.key).toBeGreaterThanOrEqual(2);
      expect(new Set(codes).size, c.key).toBe(codes.length);
      expect(codes, c.key).not.toContain(notSure);
    });
  });

  test("reads the options, each on the same dimensions", () => {
    expect(decision.options.length).toBeGreaterThanOrEqual(2);
    decision.options.forEach((o) => expect(o.dimensions.map((d) => d.label)).toEqual(decision.options[0]!.dimensions.map((d) => d.label)));
  });

  test("writes the rules' conditions with answers of their own questions", () => {
    const rules = [...decision.rules.choice, ...decision.rules.additions, ...decision.rules.cautions];
    rules.flatMap((r) => r.when.flat()).forEach((atom) => {
      const codes = decision.criteria.find((c) => c.key === atom.criterion)!.answers.map((a) => a.code);
      atom.answers.forEach((a) => expect(codes, atom.criterion).toContain(a));
    });
  });

  test("recommends options of the diagram, and names choice rules of the domain", () => {
    const options = decision.options.map((o) => o.id);
    [...decision.rules.choice, ...decision.rules.additions].forEach((r) => expect(options).toContain(r.recommends!));
    decision.ladder.forEach((s) => expect(options).toContain(s.option));
    decision.rules.cautions.filter((r) => r.whenChosen).forEach((r) => expect(decision.rules.choice.map((c) => c.id)).toContain(r.whenChosen!));
  });
});

describe("generateDecision()", () => {
  const vocabulary = Bun.file(`${root}ontology/choice.ttl`).text();
  const domain = `
    @prefix : <https://example.org/test#> .
    @prefix choice: <https://example.org/choice#> .
    @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
    @prefix skos: <http://www.w3.org/2004/02/skos/core#> .
    @prefix sh: <http://www.w3.org/ns/shacl#> .
    @prefix dcterms: <http://purl.org/dc/terms/> .
    :Domain a choice:Domain ; rdfs:label "Test" ; choice:intro "Test." ; choice:author "Someone" ; choice:sourceTitle "Source" ;
      dcterms:source <https://example.org/source> ; choice:optionsTitle "Options" ; choice:recordTitle "Option" ;
      choice:recordName "a record" ; choice:recordFile "record.md" .`;

  test("fails when a question or an answer misses a word it needs", async () => {
    const question = `
      :Size a choice:Criterion ; skos:notation "size" ; sh:order 1 ; rdfs:label "Size" ; skos:definition "How big." ;
        choice:answers ( :Big ) .
      :Big a choice:Answer ; rdfs:label "Big" .`;
    const model = loadModel([await vocabulary, domain + question]);
    expect(() => generateDecision(model)).toThrow("https://example.org/test#Big has no");
  });

  test("stops at a decision tree in which an answer leads nowhere", async () => {
    const tree = `
      :Domain choice:startsAt :Big .
      :Big a choice:Criterion ; skos:notation "big" ; sh:order 1 ; rdfs:label "Is it big?" ; skos:definition "Big." ;
        choice:answers ( choice:yes choice:no ) ;
        choice:branch [ choice:answer choice:yes ; choice:to :ChooseLarge ] .
      :Large a choice:Option ; sh:order 1 ; rdfs:label "Large" .
      :ChooseLarge a choice:ChoiceRule ; sh:order 1 ; rdfs:label "Large" ; choice:recommends :Large ; choice:quote "Big things." ;
        rdfs:comment "For big things." .`;
    const model = loadModel([await vocabulary, domain + tree]);
    expect(() => generateDecision(model)).toThrow('Big: 0 arrows for "no"');
  });
});
