import { expect, test } from "bun:test";
import { generateForm } from "./generate-form";
import { IMCI, parseOntology } from "./read-ontology";

const turtle = `
@prefix imci: <${IMCI}> .
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
imci:Tab a sh:PropertyGroup ; sh:order 1 .
imci:Shape a sh:NodeShape ;
  sh:property [ sh:path imci:risk ; sh:in ( "high" "no" ) ; sh:minCount 1 ; sh:group imci:Tab ] ,
              [ sh:path imci:days ; sh:datatype xsd:integer ; sh:group imci:Tab ] .
`;

test("sh:minCount 1 makes the field required, and a field without it is optional", () => {
  expect(generateForm(parseOntology(turtle)).schema.required).toEqual(["risk"]);
});
