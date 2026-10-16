# parental-allowance: maternity and other parent's allowance

A domain of [`eligibility`](../../): the maternity allowance and the other parent's allowance
(Mutterschaftsentschädigung, Entschädigung des andern Elternteils) in Switzerland: who is entitled,
how much a day, for how many days, and until when.

The model follows the Federal Act on Compensation for Loss of Earnings (EOG, SR 834.1),
Art. 16b to 16l. Each field, finding, value and next step names its article with
`prov:wasDerivedFrom`, and the app shows them. The texts are in English, German, French and Italian.

> **Demonstration only. Not legal or financial advice.** Not checked by a lawyer or a compensation
> office. The articles were checked against the consolidated text on
> [fedlex.admin.ch](https://www.fedlex.admin.ch) on 16 October 2026 (in force since 1 June 2026). The
> translations use the official terms but are not official texts.

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
| EOG Art. 16b para. 1, 16i | The conditions: 9 months of AHV insurance before the birth, 5 months of work, at the birth employed, self-employed or working in the spouse's business for a cash wage; for the other parent (the father or the mother's wife), the legal other parent at the birth or within 6 months |
| EOG Art. 16c para. 1 and 2 | The mother's allowance begins on the day of the birth, not before it, and is paid on 98 consecutive days: until the date of birth plus 97 days |
| EOG Art. 16d | Earlier if the mother works again |
| EOG Art. 16e, 16f, 16l | 80 % of the average daily income (monthly income / 30, annual income / 360), at most CHF 220 |
| EOG Art. 16j, 16k | The other parent's 14 daily allowances (7 a week, or 2 more for each 5 single days), within the framework period of 6 months that begins on the day of the birth |

Our reading: the last day of the framework period is the day before the same date 6 months later
(birth on 1 September, last day 28 February), as for other framework periods of the social
insurances. Neither the law nor the leaflet of the compensation offices gives an example.

Left out: the longer allowance while the newborn is in hospital, births before the 9th month of
pregnancy, the extra daily allowances when a parent dies, unemployed parents and parents unable to
work (the model tells them to ask their compensation office), and rounding.

## Review against Fedlex

The first version was written from memory. The review against the consolidated text found two
errors, now corrected:

- Since 2024, EOG Art. 16i gives the leave to "the legal other parent": the father or the mother's
  wife. The model had only the father.
- EOG Art. 16b para. 1 and 16i para. 1 also cover a person who works in the spouse's business for a
  cash wage. The model sent them to the compensation office.

The article numbers were right. The model now also cites Art. 16c para. 2 for the 98 days.

## Licence

Swiss laws and ordinances are not protected by copyright (URG Art. 5), so this folder, the
knowledge model included, is MIT licensed, like the code of the repository.
