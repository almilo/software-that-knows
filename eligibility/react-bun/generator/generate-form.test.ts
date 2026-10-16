import { describe, expect, test } from "bun:test";
import { loadModel, readShape } from "../core/model";
import { generateForm } from "./generate-form";

const model = `
@prefix ex: <https://example.org/ex#> .
@prefix form: <https://example.org/form#> .
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
ex:first a sh:PropertyGroup ; sh:order 1 .
ex:second a sh:PropertyGroup ; sh:order 2 .
ex:Shape a sh:NodeShape ; sh:targetClass ex:Thing ; form:region "CH" ;
  sh:property [ sh:path ex:day ; sh:datatype xsd:date ; sh:group ex:first ; sh:order 2 ] ,
              [ sh:path ex:count ; sh:datatype xsd:integer ; sh:minInclusive 1 ; sh:maxInclusive 9 ; sh:group ex:first ; sh:order 1 ] ,
              [ sh:path ex:answer ; sh:in ( form:yes form:no ) ; sh:group ex:second ; sh:order 2 ] ,
              [ sh:path ex:amount ; sh:datatype xsd:decimal ; sh:minInclusive 0 ; sh:group ex:second ; sh:order 1 ] .
`;
const { schema, uischema } = generateForm(readShape(loadModel([model])));
const properties: Record<string, unknown> = schema.properties;

describe("generateForm()", () => {
  test("sh:datatype and sh:in become JSON Schema types; dates have the format date", () => {
    expect(properties.day).toEqual({ type: "string", format: "date" });
    expect(properties.answer).toEqual({ type: "string", enum: ["yes", "no"] });
    expect(properties.amount).toEqual({ type: "number", minimum: 0 });
  });

  test("sh:minInclusive and sh:maxInclusive become minimum and maximum; other answers are not allowed", () => {
    expect(properties.count).toEqual({ type: "integer", minimum: 1, maximum: 9 });
    expect(schema.additionalProperties).toBe(false);
  });

  test("one category for each sh:PropertyGroup, in sh:order, with its fields in sh:order", () => {
    expect(uischema.elements.map((c) => c.i18n)).toEqual(["first", "second"]);
    expect(uischema.elements.map((c) => c.elements.map((e) => e.scope))).toEqual([
      ["#/properties/count", "#/properties/day"],
      ["#/properties/amount", "#/properties/answer"],
    ]);
  });

  test("a field without sh:in or a known sh:datatype is an error", () => {
    const untyped = model.replace("sh:datatype xsd:date ;", "");
    expect(() => generateForm(readShape(loadModel([untyped])))).toThrow("The field day has no sh:in and no known sh:datatype");
  });
});
