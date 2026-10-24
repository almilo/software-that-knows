// The engine on a small model of its own: it runs SHACL-AF rules and form:askedWhen as the form
// vocabulary says, whatever the domain.
import { describe, expect, test } from "bun:test";
import { createEngine } from "./engine";

const model = `
@prefix ex:   <https://example.org/ex#> .
@prefix form: <https://example.org/form#> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix sh:   <http://www.w3.org/ns/shacl#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .
ex: sh:declare [ sh:prefix "ex" ; sh:namespace "https://example.org/ex#"^^xsd:anyURI ] .
ex:group a sh:PropertyGroup ; sh:order 1 .
ex:Shape a sh:NodeShape ; sh:targetClass ex:Thing ; form:region "CH" ;
  sh:property [ sh:path ex:a ; sh:datatype xsd:integer ; sh:minCount 1 ; sh:group ex:group ; sh:order 1 ] ,
              [ sh:path ex:b ; sh:datatype xsd:integer ; sh:minCount 1 ; sh:group ex:group ; sh:order 2 ;
                form:askedWhen [ sh:prefixes ex: ; sh:ask "ASK { $this ex:double ?d FILTER (?d > 10) }" ] ] ;
  # In the wrong order on purpose: the rules run again until nothing new comes.
  sh:rule [ a sh:SPARQLRule ; sh:order 1 ; sh:prefixes ex: , form: ;
            sh:construct "CONSTRUCT { $this form:finding ex:Big } WHERE { $this ex:quadruple ?q FILTER (?q > 100) }" ] ,
          [ a sh:SPARQLRule ; sh:order 2 ; sh:prefixes ex: ;
            sh:construct "CONSTRUCT { $this ex:quadruple ?q } WHERE { $this ex:double ?d BIND (?d * 2 AS ?q) }" ] ,
          [ a sh:SPARQLRule ; sh:order 3 ; sh:prefixes ex: ;
            sh:construct "CONSTRUCT { $this ex:double ?d } WHERE { $this ex:a ?a BIND (?a * 2 AS ?d) }" ] ,
          [ a sh:SPARQLRule ; sh:deactivated true ; sh:prefixes ex: , form: ;
            sh:construct "CONSTRUCT { $this form:finding ex:Never } WHERE { }" ] ,
          [ a sh:SPARQLRule ; sh:prefixes ex: , form: ;
            sh:construct "CONSTRUCT { $this form:nextStep ex:Step } WHERE { $this ex:b ?b }" ] .
ex:quadruple a form:Value ; prov:wasDerivedFrom ex:Source .
ex:Big a form:Finding ; form:severity form:Notice .
ex:Never a form:Finding ; form:severity form:Refusal .
ex:Step a form:NextStep .
`;
const { evaluate } = createEngine([model]);

describe("evaluate()", () => {
  test("rules run until no rule adds a triple, whatever their order", () => {
    expect(evaluate({ a: 30 }).values).toEqual([{ id: "quadruple", value: 120, datatype: "integer", sources: ["Source"] }]);
    expect(evaluate({ a: 30 }).findings.map((f) => f.id)).toEqual(["Big"]);
  });

  test("a deactivated rule does not run", () => {
    expect(evaluate({ a: 1 }).findings).toEqual([]);
  });

  test("a field is asked when its ASK query is true, and then it needs an answer", () => {
    expect(evaluate({ a: 5 }).shown).toEqual(["a"]);
    expect(evaluate({ a: 6 }).shown).toEqual(["a", "b"]);
    expect(evaluate({ a: 6 }).missing).toEqual(["b"]);
    expect(evaluate({ a: 6, b: 1 }).allowed).toBe(true);
    expect(evaluate({}).missing).toEqual(["a"]);
  });

  test("the answer to a field that is not asked does not count, also for the rules", () => {
    const e = evaluate({ a: 2, b: 1 });
    expect(e.shown).toEqual(["a"]);
    expect(e.answers).toEqual({ a: 2 });
    expect(e.nextSteps).toEqual([]);
    expect(evaluate({ a: 6, b: 1 }).nextSteps.map((s) => s.id)).toEqual(["Step"]);
  });

  test("unknown fields and empty answers are ignored; only a finding that blocks stops the application", () => {
    expect(evaluate({ a: 30, b: 1, c: 3, d: "" }).answers).toEqual({ a: 30, b: 1 });
    expect(evaluate({ a: 30, b: 1 }).allowed).toBe(true); // ex:Big is a notice
  });
});
