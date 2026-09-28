import { expect, test } from "bun:test";
import { generateRules } from "./generate-rules";
import { IMCI, parseOntology } from "./read-ontology";

const turtle = `
@prefix imci: <${IMCI}> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
imci:Tab a sh:PropertyGroup .
imci:Shape a sh:NodeShape ; sh:property [ sh:path imci:fever ; sh:datatype xsd:boolean ; sh:group imci:Tab ] .
imci:hasFever a imci:Condition ; imci:field imci:fever ; imci:equals true .
imci:Guide a prov:Entity ; rdfs:label "Guide" .
imci:Row1 a prov:Entity ; rdfs:label "Row 1" .
imci:Table a imci:ClassificationTable ; rdfs:label "Table" ; prov:wasDerivedFrom imci:Guide ;
  imci:usedWhen imci:hasFever ; imci:rows ( imci:Fever ) .
imci:Fever a imci:Classification ; rdfs:label "FEVER" ; imci:severity imci:Green ;
  imci:matchesWhen imci:hasFever ; prov:wasDerivedFrom imci:Row1 ;
  imci:qualifiers ( imci:Long ) ; imci:treatments ( ) .
imci:Long a imci:Qualifier ; rdfs:label "Long fever" ; imci:givenWhen imci:hasFever ; prov:wasDerivedFrom imci:Row1 .
imci:Green rdfs:label "green" .
`;

test("prov:wasDerivedFrom becomes the source of a table and derivedFrom of a row and a qualifier", () => {
  const [table] = generateRules(parseOntology(turtle)).tables;
  expect(table!.source).toBe("Guide");
  expect(table!.rows[0]).toMatchObject({
    derivedFrom: ["Row 1"],
    qualifiers: [{ label: "Long fever", derivedFrom: ["Row 1"] }],
  });
});
