# Software that knows

Companion code for the series
[Software that knows](https://almilo.com/blog/software-that-knows-the-hypothesis/) on almilo.com.
Each folder is one self-contained demo.

| Demo | What it shows |
| --- | --- |
| [`imci-fever/`](imci-fever/) | A knowledge model of the fever part of WHO's IMCI guidance, and an app generated from it |
| [`eligibility/`](eligibility/) | A generic wizard for applications under a law or an ordinance: knowledge models with their rules as SPARQL and their texts in several languages, run in the browser. First domain: the early withdrawal of Swiss pension money for a home (BVG Art. 30a–30g, WEFV) |

> **Demonstrations only.** `imci-fever` is not a medical device: do not use it to assess or treat anyone.
> `eligibility` is not legal or financial advice.

## Licences

This repository has two licences. [`REUSE.toml`](REUSE.toml) says which one covers each file.

| What | Licence |
| --- | --- |
| Code and documentation | [MIT](LICENSES/MIT.txt) |
| The IMCI knowledge model (`imci-fever/ontology/`) and the files generated from it or extracted from the DAK (`imci-fever/generated/`, `imci-fever/source/`) | [CC BY-NC-SA 3.0 IGO](LICENSES/CC-BY-NC-SA-3.0-IGO.txt) |
| The knowledge models of `eligibility` (`eligibility/ontology/`, `eligibility/domains/*/ontology/`) and the files generated from them (`eligibility/domains/*/generated/`) | [MIT](LICENSES/MIT.txt): Swiss laws and ordinances are not protected by copyright (URG Art. 5) |

The IMCI knowledge model is adapted from the
[WHO Digital adaptation kit for child health (0–59 months) in humanitarian emergencies](https://www.who.int/publications/i/item/9789240089907)
(World Health Organization, 2024), licensed under CC BY-NC-SA 3.0 IGO. **This adaptation was not
created by the World Health Organization (WHO). WHO is not responsible for the content or accuracy
of this adaptation.** No endorsement by WHO is implied.
