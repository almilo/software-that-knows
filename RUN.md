# Run summary: family allowances for one child (FamZG)

## Result

The happy path passes as an automated test, through the form data and the SHACL engine (`tests/happy-path.test.ts`). It also passes in the real browser app (`e2e/happy-path.e2e.ts`).

- **Answers:** employee, CHF 60,000 a year; own child born 2009-03-10; in education since 2025-08-01; application on 2026-10-19.
- **Value:** "Education allowance: at least CHF 268 a month, from 2025-08-01 until the end of the education, but until 2034-03-31 at the latest."
- **Sources:** FamZG Art. 3 para. 1 b and FamZG Art. 5 para. 2.
- **Next steps:**
  - Give the application to the employer.
  - Confirm that the child earns not more than CHF 2,520 a month. The happy path does not give this answer.

All checks pass:

- `bun run test`: 34 tests pass. This includes 18 more scenarios and the "no law in code" check.
- `bun run typecheck`: no errors.
- `bun run e2e`: PASS.

## What I built

- **`model/famzg.ttl`** is the knowledge model. It contains:
  - 15 questions (SHACL property shapes)
  - 13 relevance rules and 16 result rules (SHACL-SPARQL, each with a message and its sources)
  - parameters with sources and validity dates, and 28 cited provisions with the German original text and a Fedlex link
  - 14 interpretations and 8 open points
- **`vocabulary/sk.ttl`** is a small vocabulary of my own. It contains no law.
- **`generator/generate.ts`** is the deterministic generator. It turns the model into `app-model.json` (JSON schema, questions, rules, sources) and the Turtle text.
- **`app/`** is the browser app: Bun, React, JSON Forms and shacl-engine (SHACL Core and SHACL-SPARQL through Comunica).
  - It shows only the questions that a relevance rule makes relevant.
  - It removes the answers that become irrelevant.
  - It updates the results after each answer. Each result is a refusal, a value or a next step, with its sources, interpretations and open points.
- **`tests/no-law-in-code.test.ts`** makes the list of forbidden words and numbers from the model itself. It then searches all code in `generator/` and `app/`, but not the generated files.

## Values from official sources other than the FamZG

- **Minimum full AHV old-age pension:**
  - CHF 1,260 a month for 2025–2026 (Ordinance of 28 August 2024, SR 831.108, Art. 3 para. 1)
  - CHF 1,280 from 2027 (Ordinance of 2 October 2026, Art. 3 para. 1)
  - The minimum income (FamZG Art. 13 para. 3) comes from this pension: CHF 7,560 a year in 2026.
- **Maximum pension = 2 × minimum pension** (AHVG Art. 34 para. 3). From this:
  - the child income limit is CHF 2,520 a month (AHVV Art. 49bis para. 3)
  - the limit for non-employed persons is CHF 45,360 (FamZG Art. 19 para. 2)
- **FamZV Art. 1, 4, 5, 6, 10b, 17** give the definition of education, stepchild, foster child, sibling or grandchild, and the income rules.

## Interpretations (each is an `sk:Interpretation` in the model)

1. The results are for the calendar month of the date of the application.
2. "Das N. Altersjahr vollenden" means the Nth birthday. The month of that birthday counts.
3. The annual pension is 12 × the monthly pension. The minimum income is half of the annual pension.
4. The model uses the pension amount that is in force at the date of the application.
5. The annual income is the AHV-liable income from work, as the person states it. The person adds all incomes (FamZV Art. 10b).
6. The limit for the taxable income of non-employed persons is annual: 1.5 × 12 × the maximum pension.
7. The person selects one main status (employee, self-employed, not employed, agriculture).
8. For some legal terms the person judges, and the model does not examine them:
   - education after the compulsory school
   - compulsory school
   - incapable of work
   - stepchild in the household
   - foster child without payment
   - support of a sibling or grandchild
9. A child that still attends the compulsory school after its 16th birthday gets the education allowance from the next month.
10. If the income of the child is not known, the model presumes it is under the limit. The result is provisional, and a next step asks the person to confirm the income.
11. The amounts are the federal minimum ("at least"). The canton can pay more.
12. An employee gives the application to the employer (FamZG Art. 15 para. 2: the employer usually pays).
13. A self-employed person applies to the family compensation fund that the person is affiliated with.
14. A non-employed person applies to the fund of the canton where the person lives.

## Open points (each is an `sk:OpenPoint` in the model)

1. **Out of scope:** cantonal amounts, birth and adoption allowances, children abroad, several persons entitled for the same child.
2. **Start and end of the wage claim or the self-employment** (FamZG Art. 13 para. 1, FamZV Art. 10/10a). The model presumes that the work continues.
3. **Back payment for past months** (ATSG). The model does not examine it.
4. **Open rule `rule_SiblingOrGrandchild`:** the threshold "maximum full orphan's pension" (FamZV Art. 6) is not in the model, so the person judges.
5. **End of validity of CHF 215 and CHF 268:** these amounts are used for all dates from 2025 (FamZG Art. 5 para. 3).
6. **End or interruption of the education** (AHVV Art. 49ter). The model gives only the latest possible end.
7. **Exceptions for non-employed persons** (FamZV Art. 16) and unemployed mothers (FamZG Art. 19 para. 1ter).
8. **Open rule `rule_NoParametersForDate`:** the model has no amounts before 2025.

## Decisions that you can review

- **shacl-engine patch:** `patches/shacl-engine@1.1.3.patch` makes shacl-engine use one Comunica query engine for all queries. Before, it made a new engine for each query. The results stay the same, and one evaluation takes about 0.3 s instead of about 2 s.
- **Data graph:** the data graph is the answers plus the `sk:Parameter` nodes of the model. The rules read all numbers from these nodes.
- **Allowed words:** the no-law test allows the words of the vocabulary, the local names of the standard terms, the JSON Schema keywords and a short list of common English words (`STOP_WORDS`). You can check this list in the test file.
- **Rule sources are static:** a rule cites the 2025 and the 2027 pension ordinance together, also when only one applies.
- **Generated files:** `app/src/generated/` is in `.gitignore`. Each script generates it again.

## Commands

```sh
bun install          # applies the shacl-engine patch
bun run test         # generate + all tests
bun run typecheck    # generate + tsc
bun run e2e          # build + browser happy path (set CHROMIUM_PATH outside this environment)
bun run dev          # dev server
bun run build        # build into dist/
bun run serve        # serve dist/ on http://localhost:3000
```
