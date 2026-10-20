# Software that knows: family allowances for one child

A small browser app for one process under Swiss law: the family allowances for one
child (child allowance and education allowance) under the Federal Act on Family
Allowances (FamZG, SR 836.2), version of 1 January 2026.

Scope: federal minimum amounts only. Out of scope: cantonal amounts, children abroad,
several persons entitled for the same child.

## Architecture

```
model/famzg.ttl ──► generator/generate.ts ──► app/src/generated/* ──► app (React + JSON Forms + shacl-engine)
model/vocabulary.ttl
```

1. **Knowledge model** (`model/famzg.ttl`, one Turtle file). It uses W3C standards
   (RDF, RDFS, OWL, SHACL, SHACL-SPARQL, XSD), Dublin Core, SKOS and ELI. A small own
   vocabulary (`model/vocabulary.ttl`, prefix `stk:`) adds what the standards cannot
   express:
   - `stk:Questionnaire`: the node shape whose property shapes are the questions.
   - `stk:askWhen`: a question is relevant only when the answers conform to this shape.
   - `stk:Rule` with `stk:outcome` (`stk:Refusal`, `stk:Value`, `stk:NextStep`):
     a node shape with one SHACL-SPARQL constraint, with `sh:message` and
     `dcterms:source`. A rule can bind `?path` and `?value` to give values of the
     result (for example the amount and the end date).
   - `stk:ResultProperty`: a property that a rule gives as a value of a result.
   - `stk:Parameter`: a value of the law (`rdf:value`) with its source.
   - `stk:Interpretation` and `stk:interpretation`: every interpretation is marked.
   - `stk:OpenPoint`: a rule that is not applied (`sh:deactivated true`), with the reason.
2. **Generator** (`generator/generate.ts`, deterministic, no LLM). It reads only the
   standards and the `stk:` vocabulary and writes:
   - `schema.json` (JSON Schema), `uischema.json` (JSON Forms UI schema),
   - `context.jsonld` (JSON-LD context: form data to RDF),
   - `shapes.ttl` (the shapes graph), `parameters.ttl` (the values of the law),
   - `catalog.json` (labels, rules, sources, interpretations, open points).
3. **App** (`app/`). JSON Forms shows the questions. After each answer, the app converts
   the form data to RDF with the JSON-LD context, adds the parameters, and validates with
   [shacl-engine](https://github.com/rdf-ext/shacl-engine) (SHACL core + SHACL-SPARQL
   through Comunica):
   - First the relevance: each `stk:askWhen` shape is validated against the answers.
     Answers to questions that are not relevant are removed, until the set is stable.
   - Then the rules. Each result of a `stk:Rule` is an outcome (refusal, value or next
     step) with its message, values, sources and interpretations. Results of core
     constraints are errors on the answers and show at the field in JSON Forms.

The generator and the app contain no word or number of the law.
`tests/no-law-in-code.test.ts` checks this: it searches their code for the terms and
texts of the model, the words of the law text (`law/famzg-2026-01-01.de.txt`), the
values of the parameters and the numbers of the law text.

## Commands

```sh
bun install
bun run generate     # model -> app/src/generated
bun run test         # generate, then all unit tests (happy path, branches, generator, no law in code)
bun run test:e2e     # build, then the happy path in Chromium (Playwright)
bun run dev          # dev server on http://localhost:3000
bun run build        # production build in dist/
bun run serve        # serve dist/ on http://localhost:3000
bun run typecheck
```

See `RUN.md` for the interpretations, the open points and the result of the run.
