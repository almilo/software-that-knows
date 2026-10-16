# Software that knows

Companion code for the series
[Software that knows](https://almilo.com/blog/software-that-knows-the-hypothesis/) on almilo.com.
Each folder is one self-contained demo.

| Demo | What it shows |
| --- | --- |
| [`imci-fever/`](imci-fever/) | A knowledge model of the fever part of WHO's IMCI guidance, and an app generated from it |
| [`cloud-architecture/`](cloud-architecture/) | A diagram that compares architecture styles, and its author's heuristics, as an ontology; an app that recommends a style for a team, asking only the questions that matter |
| [`car-insurance/`](car-insurance/) | The General Conditions of a motor vehicle insurance as an ontology, and six apps from it: a claim check, a guide after an event, dates, a comparison, a policy explorer, and the checks that find where the document contradicts itself |
| [`choices/`](choices/) | One generic decision app with two domains: the architecture styles of `cloud-architecture/`, and a decision tree for ChatGPT models; the checks that find gaps and conflicts in a model |

> **IMCI fever is a demonstration only, not a medical device.** Do not use it to assess or treat anyone.
> **Car insurance is a demonstration only, not insurance advice.** It is not made or checked by Zurich.

## Licences

This repository has two licences, and some files that are not licensed. [`REUSE.toml`](REUSE.toml) says which covers each file.

| What | Licence |
| --- | --- |
| Code and documentation | [MIT](LICENSES/MIT.txt) |
| The IMCI knowledge model (`imci-fever/ontology/`) and the files generated from it (`imci-fever/generated/`) | [CC BY-NC-SA 3.0 IGO](LICENSES/CC-BY-NC-SA-3.0-IGO.txt) |
| The model of Zurich's motor vehicle insurance conditions (`car-insurance/ontology/`, `car-insurance/generated/`) | [Not licensed](LICENSES/LicenseRef-NotLicensed.txt): all rights stay with Zurich Insurance Company Ltd |
| The ontologies extracted from Alok Sharan's diagrams, and the generated files that hold their content (`cloud-architecture/`, `choices/`) | [Not licensed](LICENSES/LicenseRef-NotLicensed.txt): all rights stay with its author |

The knowledge models are adapted from the
[WHO Digital adaptation kit for child health (0–59 months) in humanitarian emergencies](https://www.who.int/publications/i/item/9789240089907)
(World Health Organization, 2024), licensed under CC BY-NC-SA 3.0 IGO. **This adaptation was not
created by the World Health Organization (WHO). WHO is not responsible for the content or accuracy
of this adaptation.** No endorsement by WHO is implied.
