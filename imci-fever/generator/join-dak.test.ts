import { expect, test } from "bun:test";
import type { DakDictionary } from "./extract-dak";
import { dakDefinitions } from "./join-dak";
import { IMCI, parseOntology } from "./read-ontology";

const ontology = parseOntology(`
@prefix imci: <${IMCI}> .
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix dak: <https://example.org/dak-ccc#> .
imci:Tab a sh:PropertyGroup .
imci:Shape a sh:NodeShape ;
  sh:property [ sh:path imci:feverReported ; sh:datatype xsd:boolean ; sh:group imci:Tab ;
                sh:name "Fever reported (fever in this illness)" ; prov:wasDerivedFrom dak:CHE.B11S1.DE02 ] ,
              [ sh:path imci:obviousCause ; sh:datatype xsd:boolean ; sh:group imci:Tab ;
                sh:name "Obvious cause of fever" ; prov:wasDerivedFrom dak:CHE.DT.01.CL89 ] .
`);

const element = (id: string, label: string, definition: string) => ({ id, sheet: "Symptoms", label, definition, options: "" });
const dictionary: DakDictionary = {
  $comment: "",
  source: { title: "", version: "" },
  elements: [
    element("CHE.B11S1.DE02", "Diarrhoea for how long?", "Length of time the child has had diarrhoea"),
    element("CHE.B11S1.DE02", "Fever reported", "The child has had any fever with this illness.\n\nAsk the caregiver."),
  ],
};

test("a field gets the first paragraph of its data element's definition; a shared ID resolves by label", () => {
  expect(dakDefinitions(ontology, dictionary)).toEqual({ feverReported: "The child has had any fever with this illness." });
});
