import { expect, test } from "bun:test";
import { generateLexicon, labelWords } from "./generate-lexicon";
import { IMCI, parseOntology } from "./read-ontology";

const turtle = (extra: string) => `
@prefix imci: <${IMCI}> .
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
imci:Tab a sh:PropertyGroup .
imci:Shape a sh:NodeShape ;
  sh:property [ sh:path imci:cough ; sh:datatype xsd:boolean ; sh:group imci:Tab ] ,
              [ sh:path imci:risk ; sh:in ( "high" "low" ) ; sh:group imci:Tab ] .
imci:cough skos:altLabel "Cough" ; imci:absentLabel "no cough" .
${extra}
`;

test("skos:altLabel, imci:absentLabel and imci:valueLabel become the words of each field, in lower case", () => {
  const lexicon = generateLexicon(
    parseOntology(turtle(`imci:risk skos:altLabel "risk" ; imci:valueLabel [ imci:value "high" ; skos:altLabel "High risk" ; imci:minDays 1 ] .`)),
  );
  expect(lexicon.fields).toEqual({
    cough: { labels: ["cough"], absent: ["no cough"] },
    risk: { labels: ["risk"], absent: [], values: [{ value: "high", labels: ["high risk"], minDays: 1 }] },
  });
});

test("a field without words, or a value label for a value that the field does not allow, is an error", () => {
  expect(() => generateLexicon(parseOntology(turtle("")))).toThrow("risk has no words");
  expect(() =>
    generateLexicon(parseOntology(turtle(`imci:risk skos:altLabel "risk" ; imci:valueLabel [ imci:value "very high" ] .`))),
  ).toThrow('the value label "very high" is not an allowed value');
});

test("code derives a word from the field's label; part 6 must not repeat it", () => {
  expect(labelWords("Axillary temperature (°C)")).toEqual(["axillary temperature"]);
  expect(labelWords("Fever for how long?")).toEqual(["fever for how long"]);
  const named = turtle(`imci:risk skos:altLabel "risk" .`).replace("sh:path imci:cough ;", 'sh:path imci:cough ; sh:name "Cough" ;');
  expect(() => generateLexicon(parseOntology(named))).toThrow('cough: "cough" is already derived from sh:name');
  const written = named.replace('skos:altLabel "Cough"', 'skos:altLabel "coughing"');
  expect(generateLexicon(parseOntology(written)).fields.cough).toEqual({ labels: ["cough", "coughing"], absent: ["no cough"] });
});

test("a field's DAK definition goes into the lexicon", () => {
  const lexicon = generateLexicon(parseOntology(turtle(`imci:risk skos:altLabel "risk" .`)), { cough: "The child has a cough." });
  expect(lexicon.fields.cough!.definition).toBe("The child has a cough.");
});

test("value labels for the same value become one entry", () => {
  const lexicon = generateLexicon(
    parseOntology(turtle(`imci:risk skos:altLabel "risk" ; imci:valueLabel [ imci:value "high" ; skos:altLabel "high risk" ] , [ imci:value "high" ; skos:altLabel "high transmission" ] .`)),
  );
  expect(lexicon.fields.risk!.values).toEqual([{ value: "high", labels: ["high risk", "high transmission"] }]);
});

test("a word with a comma, \"and\" or \"but\" can never match, because a note is split there", () => {
  expect(() => generateLexicon(parseOntology(turtle(`imci:risk skos:altLabel "risk" .`).replace('imci:absentLabel "no cough"', 'imci:absentLabel "on and off"')))).toThrow(
    'cough: "on and off" contains a comma',
  );
});
