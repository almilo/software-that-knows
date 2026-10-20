# Run summary: family allowances for one child (FamZG, 1 January 2026)

## Result

The happy path passes as an automated test (`tests/happy-path.test.ts`). The test makes
the form data with JSON Forms core actions and checks the data with the SHACL engine.

- Answers: employed, annual income CHF 60,000; own child born 2009-03-10; post-compulsory
  education (apprenticeship) since 2025-08-01; date of the application 2026-10-19.
- Result: **Value: education allowance**, at least **CHF 268** a month, claim from
  2025-08-01, at the latest until **2034-03-31**.
  Sources: **FamZG Art. 3 para. 1 let. b** and **FamZG Art. 5 para. 2**.
- Next step: give the application to the employer (FamZG Art. 12 para. 2, Art. 13 para. 1,
  Art. 15).
- The app does not ask the questions that are not relevant (taxable income,
  supplementary benefits, maintenance of a sibling, incapacity for work).

Test status: 24 unit tests pass (`bun run test`). The browser test passes
(`bun run test:e2e`). The type check passes (`bun run typecheck`).

## Parts

| Part | File |
| --- | --- |
| Knowledge model (one Turtle file) | `model/famzg.ttl` |
| Own vocabulary (generic) | `model/vocabulary.ttl` |
| Generator (deterministic, no LLM) | `generator/generate.ts` |
| Generated files | `app/src/generated/` |
| App (Bun, React, JSON Forms, shacl-engine) | `app/` |
| Tests | `tests/` |

The model has 11 questions, 12 rules (5 refusals, 2 values,
5 next steps), 11 parameters, 12 interpretations and 7 open points.

## Interpretations (marked in the model with `stk:Interpretation`)

- **I1 Completed year of age.** «Das n. Altersjahr vollenden» means the n-th birthday. The
  month in which the child completes year n is the month of the n-th birthday.
- **I2 Reference date.** The model gives the allowance that applies in the month of the
  date of the application. The answers describe the situation at that date.
- **I3 Latest end of the education allowance.** The end of the education is not known.
  The model gives the latest end: the end of the month of the 25th birthday.
- **I4 Minimum income.** «Halber jährlicher Betrag der minimalen vollen Altersrente» =
  0.5 × 12 × CHF 1,260 = CHF 7,560. The BSV gives the same amount.
- **I5 Annual income.** The question asks for the annual earned income with AHV
  contributions (Art. 13 para. 3).
- **I6 Income limit for non-employed persons.** «Anderthalbfacher Betrag einer
  maximalen vollen Altersrente» = 1.5 × 12 × CHF 2,520 = CHF 45,360 of taxable income a year.
- **I7 Own child.** «Kindesverhältnis im Sinne des ZGB» is asked as «own child (by birth
  or by adoption)».
- **I8 Post-compulsory education.** An apprenticeship, an upper secondary school and a
  university are post-compulsory education. The model does not check the definition.
- **I9 Compulsory school after the 16th birthday.** The education allowance starts at the
  start of the month after the month of the 16th birthday.
- **I10 AHV insurance and subjection.** The model does not ask if the applicant is
  compulsorily insured in the AHV and if the employer is subject to the act. It assumes yes.
- **I11 Values of 2026.** The model uses the amounts of 2026 for all dates of application.
- **I12 Agriculture.** Art. 18 sends persons in agriculture to the FLG. The model gives a
  next step and asks no more questions.

Values that the act does not give, from official sources:

- Minimum full AHV old-age pension CHF 1,260 a month, maximum CHF 2,520 a month (in force
  since 1 January 2025, no change for 2026):
  [Informationsstelle AHV/IV, Update «Sozialversicherungen in der Schweiz», Stand 1. Januar 2026](https://www.shop.ahv-iv.ch/data/docs/de/82816/Update-%C2%ABSozialversicherungen-in-der-Schweiz%C2%BB-Stand-1.-Januar-2026.pdf).
- Minimum earned income CHF 7,560 a year (cross-check of I4):
  [BSV, Zulagen für Familien](https://www.bsv.admin.ch/de/zulagen-fuer-familien).

Design decisions of the app (generic, not law):

- A refusal ends the process. The app then shows only the refusals and asks no new questions.
- The parameters of the model are added to the data graph, because SHACL-SPARQL queries
  read the data graph.
- A value result is one SPARQL solution for each value: `?path` names the result property
  and `?value` gives the value.
- Yes/no answers are the strings `"true"` and `"false"` in the form data, so that «not
  answered» is a third state. The JSON-LD context types them as `xsd:boolean`.

## Open points (marked in the model with `stk:OpenPoint`, rules deactivated)

1. Details for stepchildren and foster children (Art. 4 para. 2, FamZV): not in the act.
2. Definition of education and income limit of a child in education (FamZV): not in the act.
3. Claim after the end of the salary and during incapacity for work (Art. 13 para. 1 and
   para. 4 let. a).
4. Several employers, or employed and self-employed at the same time (Art. 13 para. 4 let. b).
5. Unemployed mothers with maternity allowance (Art. 19 para. 1ter).
6. Payment for past months (Art. 1, Art. 24 ATSG): the model gives the start of the claim,
   not the limit for payments for past months.
7. Adjustment of the amounts (Art. 5 para. 3): the model has the values of 2026 only.

## Commands

```sh
bun install
bun run generate     # model -> app/src/generated
bun run test         # generate, then all unit tests
bun run test:e2e     # build, then the happy path in Chromium
bun run dev          # dev server on http://localhost:3000
bun run build        # production build in dist/
bun run serve        # serve dist/ on http://localhost:3000
bun run typecheck
```
