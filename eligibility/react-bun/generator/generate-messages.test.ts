import { describe, expect, test } from "bun:test";
import { loadModel, readShape } from "../core/model";
import { generateMessages } from "./generate-messages";

const model = `
@prefix ex: <https://example.org/ex#> .
@prefix form: <https://example.org/form#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix sh: <http://www.w3.org/ns/shacl#> .
ex:group a sh:PropertyGroup ; sh:order 1 ; rdfs:label "Group"@en , "Gruppe"@de .
ex:Shape a sh:NodeShape ; sh:targetClass ex:Thing ; form:region "CH" ; rdfs:label "Thing"@en , "Ding"@de ;
  sh:property [ sh:path ex:answer ; sh:in ( ex:left ex:right ) ; sh:group ex:group ;
                sh:name "Which side?"@en , "Welche Seite?"@de ; sh:description "Look."@en , "Schauen."@de ] .
ex:left rdfs:label "Left"@en , "Links"@de .
ex:right rdfs:label "Right"@en , "Rechts"@de .
ex:Finding rdfs:label "Found"@en , "Gefunden"@de ; rdfs:comment "A note for the authors of the model." .
`;

describe("generateMessages()", () => {
  test("the keys of JSON Forms for the questions and their choices, and local names for the rest", () => {
    const { de } = messages(model);
    expect(de).toMatchObject({
      "answer.label": "Welche Seite?",
      "answer.description": "Schauen.",
      "answer.left": "Links",
      "group.label": "Gruppe",
      "Finding.label": "Gefunden",
    });
  });

  test("the languages are those of the shape's title; a text without a language tag is a note, not a message", () => {
    const all = messages(model);
    expect(Object.keys(all)).toEqual(["de", "en"]); // the form vocabulary also has fr and it
    expect(all.de!["yes.label"]).toBe("Ja");
    expect(Object.keys(all.de!)).toEqual(Object.keys(all.en!));
    expect(all.en!["Finding.comment"]).toBeUndefined();
  });

  test("a text that is missing in a language is an error", () => {
    const extra = `<https://example.org/ex#Late> <http://www.w3.org/2000/01/rdf-schema#label> "Late"@en .`;
    expect(() => messages(model + extra)).toThrow("Texts missing: Late.label: no de");
  });

  test("two terms with the same local name would share their texts, which is an error", () => {
    const twin = `<https://example.org/ex#yes> <http://www.w3.org/2000/01/rdf-schema#label> "Yes"@en , "Ja"@de .`;
    expect(() => messages(model + twin)).toThrow("Two terms have the key yes.label");
  });

  test("a shape without a title in any language is an error", () => {
    expect(() => messages(model.replace(' rdfs:label "Thing"@en , "Ding"@de ;', ""))).toThrow("needs an rdfs:label with a language tag");
  });
});

function messages(turtle: string) {
  const store = loadModel([turtle]);
  return generateMessages(store, readShape(store));
}
