# eligibility

One knowledge model, three stacks. A knowledge model describes processes under Swiss law (a
*domain* each): their questions, their rules (SPARQL), what follows, and the articles that each part
comes from. Three applications run the same model, and the same test cases check that they decide
the same. It is a demonstration of the approach, not an application for real use.

| Domain | Process | Shared modules |
| --- | --- | --- |
| [`wef`](knowledge/domains/wef/) | Pension money for a home (BVG Art. 30a–30g, WEFV) | `person`, `pension` |
| [`vested-benefits`](knowledge/domains/vested-benefits/) | The vested benefit in cash (FZG Art. 2–5, 25f) | `person`, `pension` |
| [`parental-allowance`](knowledge/domains/parental-allowance/) | Maternity and other parent's allowance (EOG Art. 16b–16l) | none |

> **Demonstration only. Not legal or financial advice.** See each domain for what was checked.

## Folders

| Folder | What it holds |
| --- | --- |
| [`knowledge/`](knowledge/) | The only source of truth, for every stack: the form vocabulary (`ontology/form.ttl`), the shared modules (`modules/`) and the domains (`domains/<name>/ontology/`) |
| [`conformance/`](conformance/) | The shared test cases: for each domain, applications and what every stack must decide for them |
| [`react-bun/`](react-bun/) | The browser stack: React, JSON Forms and Oxigraph (WebAssembly). A generator writes its files from the model; the rules run in the browser. [Its README](react-bun/README.md) describes the model, the modules, the engine and the wizard in detail |
| [`java/`](java/) | The Java stacks, one Gradle build: `eligibility-core` (Apache Jena), `vaadin-app` (Vaadin + Spring Boot) and `flowable-app` (Spring Boot + Flowable) |

## The stacks

| Stack | Where the model runs | What it shows | Address |
| --- | --- | --- | --- |
| React + Bun | In the browser (Oxigraph, WebAssembly) | A static site: the list of processes and a wizard for each, generated from the model | http://127.0.0.1:3518/ |
| Vaadin + Spring Boot | On the server (Jena) | The same list and wizard, built from the model at startup, with no generated files | http://localhost:3520/ |
| Spring Boot + Flowable + htmx | On the server (Jena), in a BPMN process | Applications through a process: the model decides in a service task, missing answers go back to the applicant, each next step of the model is a task of the office, and a reviewer decides. Pages rendered on the server, with htmx and the BPMN diagram. [Its README](java/flowable-app/README.md) | http://localhost:3521/ |

No stack knows a domain. The TypeScript core (`react-bun/core/`) and the Java core
(`java/eligibility-core/`) do the same four things: load a domain with the modules that it imports,
read its form (SHACL), run its rules until nothing new is derived, and read back the values, the
findings and the next steps.

The Flowable process (`java/flowable-app/src/main/resources/processes/application.bpmn20.xml`) is
the same for every domain: submitted, decided by the model, completed by the applicant, refused or
checked step by step, then approved, rejected or returned.

## The shared test cases

`conformance/<domain>.json` holds up to 80 applications for each domain, drawn from the fields of
its form with a fixed seed and kept one for each distinct outcome, and what the engine decides for
each: the questions asked and missing, the values, the findings, the next steps with their
sources, and whether the application is allowed. `conformance/<domain>.examples.json` adds
applications written by hand (wef needs them: random answers rarely pass all its rules).

The Bun tests (`react-bun/test/conformance.test.ts`) and the Java tests
(`java/eligibility-core/.../ConformanceTest.java`) run every case; numbers are compared by value.
They found a real difference: Oxigraph lost the parental allowance for most incomes, because an
inexact decimal division left more digits than it keeps; the model now computes those amounts as
`xsd:double`, which every engine computes the same.

The Java core also checks that it reads the same texts as the TypeScript generator writes, and that
it adds durations to dates as Oxigraph does.

## Adding a domain

1. Write the model in `knowledge/domains/<name>/ontology/` (see
   [react-bun/README.md](react-bun/README.md#adding-a-domain)): one `sh:NodeShape` with a title, a
   `form:summary` and a `form:region`, its fields, rules, values, findings, next steps and sources;
   import the shared modules that it needs.
2. In `react-bun/`: `bun run generate`, then `bun run conformance`.
3. Nothing changes in the Java stacks: they find the domain in `knowledge/`.

## Commands

```
cd react-bun && bun install && bun run dev      # http://127.0.0.1:3518/
cd react-bun && bun run test                    # tests, the shared cases included
cd react-bun && bun run conformance             # record the shared cases again

cd java && ./gradlew build                      # Java tests, the shared cases included
cd java && ./gradlew :vaadin-app:bootRun        # http://localhost:3520/
cd java && ./gradlew :flowable-app:bootRun      # http://localhost:3521/
```

The Java builds need Java 21; Gradle downloads the rest. The Vaadin app's first start downloads
Node and builds its frontend, which takes a few minutes.

## Licence

Swiss laws and ordinances are not protected by copyright (URG Art. 5), so this folder, the
knowledge models and modules included, is MIT licensed, like the code of the repository.
