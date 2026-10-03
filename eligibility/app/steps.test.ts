// The steps of the wizard, on a small model of its own: they come from the groups of the model, and
// a step is complete when each question that the engine asks has an answer without an error.
import { describe, expect, test } from "bun:test";
import { createEngine, type Answers } from "../core/engine";
import { loadModel, readShape } from "../core/model";
import { createValidator } from "../core/validate";
import { generateForm } from "../generator/generate-form";
import { createSteps, layout, open, type Step } from "./steps";

const model = `
@prefix ex:   <https://example.org/ex#> .
@prefix form: <https://example.org/form#> .
@prefix sh:   <http://www.w3.org/ns/shacl#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .
ex: sh:declare [ sh:prefix "ex" ; sh:namespace "https://example.org/ex#"^^xsd:anyURI ] .
ex:first a sh:PropertyGroup ; sh:order 1 .
ex:second a sh:PropertyGroup ; sh:order 2 .
ex:Shape a sh:NodeShape ; sh:targetClass ex:Thing ; form:region "CH" ;
  sh:property [ sh:path ex:count ; sh:datatype xsd:integer ; sh:minInclusive 1 ; sh:minCount 1 ; sh:group ex:first ; sh:order 1 ] ,
              [ sh:path ex:more ; sh:in ( form:yes form:no ) ; sh:minCount 1 ; sh:group ex:first ; sh:order 2 ;
                form:askedWhen [ sh:prefixes ex: ; sh:ask "ASK { $this ex:count ?c FILTER (?c > 5) }" ] ] ,
              [ sh:path ex:note ; sh:datatype xsd:string ; sh:group ex:second ; sh:order 1 ] .
`;
const { schema, uischema } = generateForm(readShape(loadModel([model])));
const { evaluate } = createEngine([model]);
const validator = createValidator(schema);
const steps = createSteps(uischema);
const [first, second] = steps;

describe("createSteps()", () => {
  test("makes one step for each group of the model, in its order", () => {
    expect(steps.map((s) => ({ id: s.id, fields: s.fields }))).toEqual([
      { id: "first", fields: ["count", "more"] },
      { id: "second", fields: ["note"] },
    ]);
  });
});

describe("open()", () => {
  test("lists the questions of a step that the engine asks and that have no answer", () => {
    expect(openIn(first, {})).toEqual(["count"]);
    expect(openIn(first, { count: 3 })).toEqual([]);
    expect(openIn(first, { count: 7 })).toEqual(["more"]);
    expect(openIn(second, {})).toEqual([]);
  });

  test("keeps a step open while an answer has an error", () => {
    expect(openIn(first, { count: 0 })).toEqual(["count"]);
  });
});

describe("layout()", () => {
  test("hides the questions that the engine does not ask, and keeps their positions", () => {
    expect(layout(first!, evaluate({ count: 3 })).elements.map((c) => "rule" in c)).toEqual([false, true]);
    expect(layout(first!, evaluate({ count: 7 })).elements.map((c) => "rule" in c)).toEqual([false, false]);
  });
});

function openIn(step: Step | undefined, data: Answers) {
  return open(step!, evaluate(data, "2026-10-02"), data, validator);
}
