// The submission, on a small model of its own: it checks the answers against the schema and
// decides again with the engine, whatever the page sends.
import { describe, expect, test } from "bun:test";
import { createEngine, type Answers } from "./engine";
import { createSubmit } from "./submit";
import { createValidator } from "./validate";

const model = `
@prefix ex:   <https://example.org/ex#> .
@prefix form: <https://example.org/form#> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix sh:   <http://www.w3.org/ns/shacl#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .
ex: sh:declare [ sh:prefix "ex" ; sh:namespace "https://example.org/ex#"^^xsd:anyURI ] .
ex:group a sh:PropertyGroup ; sh:order 1 .
ex:Shape a sh:NodeShape ; sh:targetClass ex:Thing ; form:region "CH" ;
  sh:property [ sh:path ex:amount ; sh:datatype xsd:decimal ; sh:minInclusive 0 ; sh:minCount 1 ; sh:group ex:group ; sh:order 1 ] ;
  sh:rule [ a sh:SPARQLRule ; sh:prefixes ex: , form: ;
            sh:construct "CONSTRUCT { $this form:finding ex:TooMuch } WHERE { $this ex:amount ?a FILTER (?a > 100) }" ] ,
          [ a sh:SPARQLRule ; sh:prefixes ex: , form: ;
            sh:construct "CONSTRUCT { $this form:finding ex:Late } WHERE { $this form:today ?d FILTER (?d > '2026-10-02'^^xsd:date) }" ] ,
          [ a sh:SPARQLRule ; sh:prefixes ex: ;
            sh:construct "CONSTRUCT { $this ex:double ?d } WHERE { $this ex:amount ?a BIND (?a * 2 AS ?d) }" ] ,
          [ a sh:SPARQLRule ; sh:prefixes ex: , form: ;
            sh:construct "CONSTRUCT { $this form:nextStep ex:Step } WHERE { }" ] .
ex:double a form:Value ; prov:wasDerivedFrom ex:Source .
ex:TooMuch a form:Finding ; form:severity form:Refusal .
ex:Late a form:Finding ; form:severity form:Refusal .
ex:Step a form:NextStep .
`;
const schema = { type: "object", properties: { amount: { type: "number", minimum: 0 } }, additionalProperties: false };
const { evaluate } = createEngine([model]);
const submit = createSubmit(evaluate, createValidator(schema));
const now = new Date(2026, 9, 2, 9, 0);

describe("submit()", () => {
  test("gives an allowed application a receipt with the values and the next steps", () => {
    expect(apply({ amount: 10 })).toEqual({
      receipt: {
        reference: "2026-TEST01",
        received: "2026-10-02",
        values: [{ id: "double", value: 20, datatype: "decimal", sources: ["Source"] }],
        findings: [],
        nextSteps: [{ id: "Step", sources: [] }],
      },
    });
  });

  test("refuses an application with the findings that block it", () => {
    expect(apply({ amount: 101 })).toEqual({ refusal: { error: "refused", details: ["TooMuch"] } });
  });

  test("decides on the date of the submission", () => {
    expect(submit({ amount: 10 }, new Date(2026, 9, 3))).toEqual({ refusal: { error: "refused", details: ["Late"] } });
  });

  test("names the missing answers of an incomplete application", () => {
    expect(apply({})).toEqual({ refusal: { error: "incomplete", details: ["amount"] } });
  });

  test("refuses answers that do not match the form", () => {
    expect(apply({ amount: "ten" })).toEqual({ refusal: { error: "invalid", details: ["amount"] } });
    expect(apply({ amount: -1 })).toEqual({ refusal: { error: "invalid", details: ["amount"] } });
    expect(apply({ amount: 10, salary: 1 })).toEqual({ refusal: { error: "invalid", details: ["salary"] } });
  });
});

function apply(answers: Answers) {
  return submit(answers, now, () => "2026-TEST01");
}
