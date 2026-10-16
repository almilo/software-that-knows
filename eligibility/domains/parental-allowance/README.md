# parental-allowance: maternity and paternity allowance

A domain of [`eligibility`](../../): the maternity and paternity allowance
(Mutterschafts- und Vaterschaftsentschädigung) in Switzerland: who is entitled, how much a day, for
how many days, and until when.

The model follows the Federal Act on Compensation for Loss of Earnings (EOG, SR 834.1),
Art. 16b to 16l. Each field, finding, value and next step names its article with
`prov:wasDerivedFrom`, and the app shows them. The texts are in English, German, French and Italian.

> **Demonstration only. Not legal or financial advice.** Not checked by a lawyer or a compensation
> office. **Not checked against the consolidated text:** the articles and their numbers were written
> from memory, because fedlex.admin.ch was not reachable when the model was written. Check each
> article on [fedlex.admin.ch](https://www.fedlex.admin.ch) before relying on it.

## Reuse

This domain shares no knowledge with [`wef`](../wef/) and [`vested-benefits`](../vested-benefits/):
it imports no shared module, only the module of its act (`modules/law/eog.ttl`). It reuses the app,
the engine and the form vocabulary: the steps, the yes/no answers, the severities and the texts of
the app in four languages. It is the other end of the scale: `bun run reuse` counts 0 of its 9
fields from the modules, against 6 of 13 for vested-benefits.

| File | What it holds |
| --- | --- |
| `ontology/parental-allowance.ttl` | The model: choices, fields, rules (SPARQL), values, findings, next steps |
| `generated/` | `schema.json`, `uischema.json`, `messages.json`, `domain.json`, written by `bun run generate` |
| `domain.ts`, `main.tsx`, `index.html` | The domain, as the app and the tests use it, and its page |
| `test/paths.test.ts` | One test for each rule, named after its articles |

## The law in the model

| Article | In the model |
| --- | --- |
| EOG Art. 16b para. 1, 16i | The conditions: 9 months of AHV insurance before the birth, 5 months of work, employed or self-employed at the birth; for the father, legal father at the birth or within 6 months |
| EOG Art. 16c para. 1 | The mother's allowance begins on the day of the birth: not before it |
| EOG Art. 16d | 98 days, until the date of birth plus 97 days; earlier if the mother works again |
| EOG Art. 16e, 16f, 16l | 80 % of the average daily income (monthly income / 30, annual income / 360), at most CHF 220 |
| EOG Art. 16j, 16k | The father's 14 daily allowances, within the 6 months after the birth |

Left out: the other parent's leave of the mother's wife, the longer allowance while the newborn is
in hospital, premature births, unemployed parents and parents unable to work (the model tells them
to ask their compensation office), and rounding.

## Licence

Swiss laws and ordinances are not protected by copyright (URG Art. 5), so this folder, the
knowledge model included, is MIT licensed, like the code of the repository.
