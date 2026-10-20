# Software that knows

A small browser app for one process under Swiss law: the family allowances for
one child (child allowance and education allowance) under the Federal Act on
Family Allowances (FamZG), version of 1 January 2026.

All knowledge of the law is in one Turtle file. A generator without knowledge
of the law turns it into the files that the app needs. The app checks the
answers against the model with an existing SHACL engine.

```
model/famzg.ttl  ──►  generator/generate.ts  ──►  app/src/generated/  ──►  app (React + JSON Forms + shacl-engine)
(the law)              (standards + sk:)           app-model.json            checks the answers with SHACL
vocabulary/sk.ttl                                  model.ts (Turtle text)
(own vocabulary)
```

## Parts

| Part | Path | Contents |
| --- | --- | --- |
| Knowledge model | `model/famzg.ttl` | Questions (SHACL property shapes), relevance rules and result rules (SHACL-SPARQL), parameters, sources, interpretations, open points. RDF, RDFS, SHACL, SKOS, PROV-O, XSD plus `sk:`. |
| Own vocabulary | `vocabulary/sk.ttl` | `sk:Questionnaire`, `sk:RelevanceRule`/`sk:asks`, `sk:Rule`/`sk:resultKind` (`sk:Refusal`, `sk:Value`, `sk:NextStep`), `sk:Parameter`, `sk:Interpretation`, `sk:OpenPoint`, `sk:status` (`sk:Open`, `sk:Settled`). No law. |
| Generator | `generator/` | Reads the model with N3. Writes the JSON schema for JSON Forms, the questions, the rules with message templates and sources, and the Turtle text. Deterministic, no LLM. |
| App | `app/` | Bun + React + JSON Forms (vanilla renderers). `app/src/engine.ts` turns the form data into RDF and validates it with [shacl-engine](https://github.com/rdf-ext/shacl-engine) (SHACL Core + SHACL-SPARQL through Comunica). |
| Tests | `tests/`, `e2e/` | Happy path, more scenarios, the "no law in code" check, and a browser test with Playwright. |

## How it works

- **Questions** are the property shapes of the `sk:Questionnaire` shape
  (`sh:name`, `sh:description`, `sh:datatype`, `sh:in`, `sh:order`,
  `sh:group`). The generator makes one JSON schema property for each.
- **Relevance**: an `sk:RelevanceRule` is a node shape with a SHACL-SPARQL
  constraint. Each result of it makes the question in `sk:asks` relevant. A
  question without a relevance rule is always relevant. The app shows only the
  relevant questions, removes the answers to questions that are no longer
  relevant and validates again until the answers do not change.
- **Results**: an `sk:Rule` is a node shape with a SHACL-SPARQL constraint. Each
  result is a refusal, a value or a next step. The text is the `sh:message`
  with the values of the SELECT row (`{?amount}`). The sources are in
  `prov:wasDerivedFrom` and point to `sk:LegalProvision` nodes with the
  citation, the Fedlex link and the original German text.
- **Parameters**: rules read all numbers (amounts, ages, pension, factors) from
  `sk:Parameter` nodes, with their sources and validity dates. The app adds
  these nodes to the data graph.
- **Problems with answers** are SHACL Core violations of the question shapes
  (for example `sh:lessThanOrEquals`). JSON Forms shows them at the field.

## Commands

```sh
bun install            # also applies patches/shacl-engine@1.1.3.patch
bun run test           # generate, then all tests (happy path, scenarios, no law in code)
bun run typecheck      # generate, then tsc
bun run e2e            # build, then the happy path in Chromium (Playwright)
bun run dev            # generate, then the dev server for app/index.html
bun run build          # generate, then build the app into dist/
bun run serve          # serve dist/ on http://localhost:3000
```

For `bun run e2e` outside this environment, set `CHROMIUM_PATH` to a Chromium
binary.

## Note about shacl-engine

`patches/shacl-engine@1.1.3.patch` changes one line: shacl-engine created a new
Comunica query engine for each SPARQL query. The patch uses one engine for all
queries. The results do not change; one evaluation takes about 0.3 s in place
of about 2 s.
