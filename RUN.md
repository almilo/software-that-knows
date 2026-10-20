# Run report: family allowances for one child (FamZG)

## Result

The happy path passes as an automated test, through the form data and the SHACL engine
(`tests/happy-path.test.ts`). It also passes in Chromium (`tests/browser/happy-path.browser.test.ts`).

- Answers: employed parent, annual income CHF 60,000; own child born 2009-03-10, in an
  apprenticeship since 2025-08-01; date of the application 2026-10-19.
- Result (type "Wert"): "Ausbildungszulage: mindestens CHF 268 pro Monat, ab 2025-08-01 bis zum
  Abschluss der Ausbildung, längstens bis 2034-03-31."
- Sources: FamZG Art. 3 Abs. 1 Bst. b and FamZG Art. 5 Abs. 2.
- The app also gives a next step: send the application to the employer.

All 33 tests pass (`bun run test`). The TypeScript check passes (`bun run typecheck`).

## What is in the project

1. `model/famzg.ttl`: the knowledge model in one Turtle file. It uses SHACL, SHACL-SPARQL, RDF,
   DCMI Terms and ELI. It has 11 questions, 16 rules (each with a message and its sources),
   13 parameters, 11 interpretations and 6 open points.
2. `model/vocabulary.ttl`: the small vocabulary `stk:` for what the standards cannot express.
   It contains no knowledge of a law.
3. `generator/generate.ts`: a deterministic generator with no LLM. It writes
   `app/generated/model.json`.
4. `app/`: Bun, React and JSON Forms. The app checks the answers with `shacl-engine` and its SPARQL plug-in.
5. `tests/no-law-in-code.test.ts`: searches the generator and the app for words and numbers of the
   law. It finds none.

## Interpretations

All interpretations are `stk:Interpretation` nodes in the model. The rules, questions and answer
options that use them link to them with `stk:interpretation`.

1. The result is for the month of the date of the application. The model does not calculate
   back payments.
2. "Das N. Altersjahr vollenden" means: the Nth birthday. The month is the month of birth in the
   year of birth + N.
3. An apprenticeship (Lehre) is a post-compulsory education (basis: FamZV Art. 1 Abs. 2).
4. The education continues in the month of the application. Its end is not known, so the result
   gives the latest end.
5. The annual amount of an old-age pension is 12 monthly amounts (no 13th pension). Thus the
   minimum income is CHF 7,560 a year, and the limit for persons who are not gainfully employed
   is CHF 45,360. The BSV gives the same CHF 7,560.
6. The pension values are for applications in 2026 only. For a date outside 2026, the app gives a
   next step: check the current values.
7. The person is compulsorily insured in the AHV. The app does not ask this.
8. "Employee" includes FamZG Art. 13 Abs. 1 and Abs. 2.
9. Employees send the application to their employer.
10. For agriculture, the AHV compensation office is the office to contact (FamZG Art. 18 and Art. 21c Bst. c).
11. An adopted child is an own child (Kindesverhältnis).

## Values from other official sources

The FamZG does not give the values of the AHV pension. The model takes them from these sources:

- Minimum amount of the full old-age pension: CHF 1,260 a month. Sources: AHVG Art. 34 Abs. 5
  (version of 1 January 2026) and the ordinance of 28 August 2024 (SR 831.108), Art. 3 Abs. 1.
- Maximum amount: two times the minimum amount. Source: AHVG Art. 34 Abs. 3.
- Confirmation of CHF 7,560: BSV, FAQ about family allowances for employees.

## Open points

All open points are `stk:OpenPoint` nodes in the model.

1. Income of a child in education (FamZV Art. 1, AHVV Art. 49bis Abs. 3). This condition is not
   in the FamZG. The rule is in the model, but it is deactivated (`sh:deactivated true`), because
   the app does not ask for the income of the child.
2. Back payments for earlier months (FamZG Art. 1, ATSG Art. 24 Abs. 1).
3. Start and end of the entitlement with the wage, and the details for self-employed persons
   (FamZG Art. 13 Abs. 1 and 2bis).
4. Details for stepchildren and foster children (FamZG Art. 4 Abs. 2, regulated by the Federal Council).
5. Values from 2027: an ordinance of 2 October 2026 changes the pensions from 2027. It is not yet
   in force and not in the model.
6. An education that starts after the date of the application is not checked.

Out of scope, as requested: cantonal amounts, children abroad, and more than one entitled person
for the same child.

## Notes about the SHACL engine

- `shacl-engine` 1.1.3 executes only the first `sh:sparql` of a shape. Thus each rule is in its
  own property shape.
- SPARQL targets ignore `sh:prefixes`. Thus the target queries have their own `PREFIX` lines.
- Messages keep the N-Triples form of literals. The app removes this syntax.
- One evaluation takes approximately one second, because the engine starts a new SPARQL engine
  for each query.

## Commands

```sh
bun install
bun run generate       # model -> app/generated/model.json
bun run dev            # start the app on http://localhost:3000
bun run build          # build the app into dist/
bun run typecheck
bun run test           # all tests, also the browser test (needs Chromium; set CHROMIUM_PATH if necessary)
bun test tests/happy-path.test.ts   # only the happy path through the form data and the SHACL engine
```
