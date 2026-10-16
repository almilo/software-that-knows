# vested-benefits: the vested benefit in cash

A domain of [`eligibility`](../../): the cash payment of the vested benefit
(Barauszahlung der Freizügigkeitsleistung) in Switzerland: when a person who leaves a pension fund,
or who has money with a vested benefits institution, can take it in cash, and what follows.

The model follows the Vested Benefits Act (FZG, SR 831.42), Art. 2 to 5 and 25f, and for the tax
the Federal Act on Direct Federal Taxation (DBG, SR 642.11), Art. 38, 95 and 96. Each field,
finding and next step names its article with `prov:wasDerivedFrom`, and the app shows them. The
texts are in English, German, French and Italian.

> **Demonstration only. Not legal or financial advice.** Not checked by a lawyer or a pension fund.
> **Not checked against the consolidated texts:** the articles were written from memory, because
> fedlex.admin.ch was not reachable when the model was written. Check each article on
> [fedlex.admin.ch](https://www.fedlex.admin.ch) before relying on it.

## Reuse

This is the second process on the shared modules of [`wef`](../wef/). The step "You" and the
vested benefit come from `modules/person.ttl` and `modules/pension.ttl`, with their texts in four
languages; so do the finding "written consent missing" and the next step "attach the consent", with
their rules. The model adds only what is new, and states why it uses each shared part:

```turtle
fzg:Application rdfs:subClassOf pension:PensionApplication .
person:ConsentMissing prov:wasDerivedFrom law:FZG-5-2 , law:FZG-5-3 .
```

`bun run reuse` (in `eligibility/`) counts it: 6 of its 13 fields and 56 of its 204 texts come from
the modules.

| File | What it holds |
| --- | --- |
| `ontology/vested-benefits.ttl` | The model: choices, fields, rules (SPARQL), findings, next steps, and the legal basis of the shared parts |
| `generated/` | `schema.json`, `uischema.json`, `messages.json`, `domain.json`, written by `bun run generate` |
| `domain.ts`, `main.tsx`, `index.html` | The domain with its modules, as the app and the tests use it, and its page |
| `test/paths.test.ts` | One test for each rule, named after its articles |

## The law in the model

| Article | In the model |
| --- | --- |
| FZG Art. 2 para. 1 | A vested benefit before an insured event: not at or after the reference age |
| FZG Art. 2 para. 3 and 4 | Due when the person leaves the fund; interest, and interest on arrears after 30 days |
| FZG Art. 3, 4 | Without a reason for a cash payment: a new fund, or a vested benefits account or policy |
| FZG Art. 5 para. 1 | The reasons: leaving Switzerland for good, self-employment without mandatory insurance, an amount below the annual contribution |
| FZG Art. 5 para. 2 and 3 | The written consent of the spouse or registered partner (shared with wef); the court |
| FZG Art. 25f | To the EU or EFTA, with mandatory insurance there: the BVG part stays in Switzerland |
| DBG Art. 38, 95, 96 | Taxed as a capital benefit; at source when the person lives abroad |
| BVG Art. 13 | The reference age (shared with wef) |

Left out: leaving after the earliest age for early retirement (FZG Art. 2 para. 1bis), disability
and death, divorce (FZG Art. 22), the special rules for Liechtenstein, and the amounts of the vested
benefit (FZG Art. 15 to 19): the person gives the amount from the fund's statement.

## Licence

Swiss laws and ordinances are not protected by copyright (URG Art. 5), so this folder, the
knowledge model included, is MIT licensed, like the code of the repository.
