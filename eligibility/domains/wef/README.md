# wef: pension money for a home

A domain of [`eligibility`](../../): the early withdrawal of Swiss occupational pension money for a
home (Wohneigentumsförderung, WEF): who can withdraw, how much, until when, for what, and what
follows.

The model follows the Federal Act on Occupational Pensions (BVG, SR 831.40), Art. 30a to 30g and
Art. 83a, and the Ordinance on the Promotion of Home Ownership with Occupational Pension Funds
(WEFV, SR 831.411). Each field, finding, next step and value names its article with
`prov:wasDerivedFrom`, and the app shows them. The texts are in English, German, French and Italian.

> **Demonstration only. Not legal or financial advice.** Not checked by a lawyer or a pension fund.
> The articles were checked against the consolidated texts on
> [fedlex.admin.ch](https://www.fedlex.admin.ch) on 4 October 2026: the BVG in force since 1 January
> 2025 and the WEFV in force since 1 October 2017. The translations use the official terms but are
> not official texts. Each pension fund's regulations decide the retirement age and can add conditions.

| File | What it holds |
| --- | --- |
| `ontology/wef.ttl` | The model: choices, fields, rules (SPARQL), values, findings, next steps, articles |
| `generated/` | `schema.json`, `uischema.json`, `messages.json`, `domain.json`, written by `bun run generate` |
| `domain.ts`, `main.tsx`, `index.html` | The domain as the app and the tests use it, and its page |
| `test/paths.test.ts` | One test for each rule, named after its articles |
| `test/invariants.test.ts` | The law written again in TypeScript, compared with the engine on 1,000 random applications |
| `test/model.test.ts` | The texts in four languages, the steps, and a label for every source |

## Rules as SPARQL

A rule is a standard SPARQL query, for example the deadline of BVG Art. 30c para. 1:

```turtle
wef:ApplicationShape sh:rule [ a sh:SPARQLRule ; sh:order 1 ; sh:prefixes wef: , form: ;
  sh:construct """
    CONSTRUCT { $this wef:lastDayToApply ?last }
    WHERE {
      $this wef:birthDate ?birth ; wef:retirementAge ?age .
      OPTIONAL { $this wef:retirementAgeMonths ?m }
      BIND (?birth + STRDT(CONCAT("P", STR(?age - 3), "Y", STR(COALESCE(?m, 0)), "M"), xsd:duration) AS ?last)
    }""" ] .
```

Knowledge that is data stays data: "an apartment qualifies" is the triple
`wef:apartment a wef:EligibleProperty`, and "buying a home requires the purchase contract" is
`wef:buyOrBuild wef:requires wef:AttachPurchaseContract`. One rule reads all `wef:requires`.

## The law in the model

| Article | In the model |
| --- | --- |
| BVG Art. 13 | The reference age (in years and months), which the fund's regulations set |
| BVG Art. 30c para. 1 | Until 3 years before the reference age of the fund's regulations: the last day to apply; only for a home of one's own |
| BVG Art. 30c para. 2 | The maximum up to 50: the vested benefit |
| BVG Art. 30c para. 3 | Shares in a housing cooperative |
| BVG Art. 30c para. 4 | Lower benefits, extra insurance |
| BVG Art. 30c para. 5 | The written consent of the spouse or registered partner |
| BVG Art. 30d, 30e para. 2, 83a | Repayment (sale, rights that amount to a sale, death without benefits; at most the proceeds; 2 years to reinvest), land register, tax |
| WEFV Art. 1 | Purposes (para. 1); one property at a time (para. 2) |
| WEFV Art. 2 to 4 | Homes, forms of ownership, participations, own use (letting only while the person cannot live there) |
| WEFV Art. 5 | Minimum CHF 20 000 (not for shares); 5 years after the last withdrawal; the maximum over 50 (para. 4) |
| WEFV Art. 6, 6a | Payment within 6 months; limits for a mortgage repayment while the fund is underfunded, if its regulations say so |
| WEFV Art. 10, 16 | Proof of the conditions; share certificates kept by the fund |

Readings that a lawyer should check:

- The date of the application is the date of the evaluation.
- "Until 3 years before the right to retirement benefits begins": the last day to apply is the day
  on which the person reaches the reference age of the fund's regulations minus 3 years. The
  ordinary age counts, not the earliest age for early retirement.
- "Das 50. Altersjahr überschritten": from the 50th birthday.
- A birthday on 29 February falls on 28 February in other years (XPath date arithmetic).
- "Every 5 years": counted from the date of the last withdrawal.
- The vested benefit comes from the pension certificate. Over 50, the person gives the vested
  benefit at 50 as the fund states it, with the repayments and withdrawals since then (WEFV Art. 5
  para. 4 a), and the pension money already in the home (para. 4 b).
- "Underfunded": a coverage ratio below 100 % (BVV 2 Art. 44, not checked).
- The date check (younger than 18, a withdrawal in the future) is a plausibility check, not a rule
  of the law, and names no article.

Left out: pledging (BVG Art. 30b) and pledge enforcements, the repayment process (Art. 30d), divorce
(Art. 30c para. 6), participations other than cooperative shares (WEFV Art. 3 b and c), claims
against vested benefits institutions (WEFV Art. 5 para. 2), the consent for later mortgages (BVG
Art. 30c para. 5), delays when the fund lacks cash (WEFV Art. 6 para. 4), and the additional rules
of each pension fund.

## What changed from the first version

| | First version | Now |
| --- | --- | --- |
| Rules | An own condition vocabulary (`wef:equals`, `wef:atLeast`, `wef:minus`, …), compiled to JSON Schema and an own expression format, evaluated by `classify.ts` | SPARQL in the model, run as it is by a standard engine (Oxigraph). The compiler, the contract and the interpreter (about 410 lines) are gone |
| Outcome | A decision table: the first row that matches wins | Findings: every reason to refuse is shown at once, the most serious first |
| Dates | Ages in full years, entered by the person | Date of birth, date of the last withdrawal, and the date of the application. The deadlines are calculated |
| Languages | English | English, German, French, Italian: texts with language tags in the model; the generator fails if one is missing |
| Visibility | JSON Forms rules, from conditions compiled to JSON Schema | `form:askedWhen` ASK queries; the wizard hides the questions that the engine does not ask |
| Submission | A simulated pension fund in a service worker, with English replies | A function (`core/submit.ts`) that the page calls; it replies with ids of the model, which the page shows in its language |

The price: the page loads Oxigraph's WebAssembly (4.0 MB, 1.4 MB with gzip) next to the app
(184 KB with gzip), and one evaluation takes about 10 ms instead of about 1 ms.

## What a real server would add

The submission (`core/submit.ts`) shows what a server would do, but in the browser it protects
nothing. For this domain, a real server would add:

- a decision that others can trust, on a computer that the pension fund controls, with its own
  clock for the deadlines;
- the data that the fund already has (the vested benefits, the retirement age of its regulations,
  its coverage ratio, the earlier withdrawals), so the person does not enter it;
- who applies, and the proof of the spouse's consent;
- a stored application with a unique reference, its documents, and the version of the model that
  decided.

## Licence

Swiss laws and ordinances are not protected by copyright (URG Art. 5), so this folder, the
knowledge model included, is MIT licensed, like the code of the repository.
