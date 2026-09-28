import { expect, test } from "bun:test";
import { compileCondition } from "./compile-condition";
import { IMCI, parseOntology } from "./read-ontology";
import { DataFactory } from "n3";

const turtle = `
@prefix imci: <${IMCI}> .
@prefix sh: <http://www.w3.org/ns/shacl#> .
imci:Shape sh:property [ sh:path imci:feverReported ], [ sh:path imci:temperature ], [ sh:path imci:stiffNeck ] .
imci:hasFever a imci:Condition ; imci:field imci:feverReported ; imci:equals true .
imci:hasHighFever a imci:Condition ; imci:field imci:temperature ; imci:atLeast 38.5 .
imci:complex a imci:Condition ; imci:allOf ( imci:hasFever [ imci:not [ imci:anyOf ( imci:hasHighFever ) ] ] ) .
imci:notTyped imci:field imci:stiffNeck ; imci:equals true .
imci:noTest a imci:Condition ; imci:field imci:stiffNeck .
imci:misspelled a imci:Condition ; imci:field imci:stiffNek ; imci:equals true .
`;
const o = parseOntology(turtle);
const compile = (name: string) => compileCondition(o, DataFactory.namedNode(`${IMCI}${name}`));

test("imci:equals becomes const, and the field is required", () => {
  expect(compile("hasFever")).toEqual({ properties: { feverReported: { const: true } }, required: ["feverReported"] });
});

test("imci:atLeast becomes minimum, and the field is required", () => {
  expect(compile("hasHighFever")).toEqual({ properties: { temperature: { minimum: 38.5 } }, required: ["temperature"] });
});

test("allOf, anyOf and not nest, and a named condition is copied where it is used", () => {
  expect(compile("complex")).toEqual({
    allOf: [compile("hasFever"), { not: { anyOf: [compile("hasHighFever")] } }],
  });
});

test("a named condition must have the type imci:Condition", () => {
  expect(() => compile("notTyped")).toThrow("not an imci:Condition");
});

test("a field condition must have imci:equals or imci:atLeast", () => {
  expect(() => compile("noTest")).toThrow("no imci:equals or imci:atLeast");
});

test("a condition must use a field that the form has", () => {
  expect(() => compile("misspelled")).toThrow("no field in the form has this name");
});
