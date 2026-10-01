---
name: extract-words
description: Extend the words of the IMCI fever knowledge model (part 6 of imci-fever/ontology/imci-fever.ttl) - synonyms, words for absence, words for values, clinical abbreviations - with three independent LLM runs, consensus and automatic checks. Use when the model gets new questions, when a DAK update changes labels or definitions, or when development notes show words the model misses. Never reads the test notes.
---

# Extract words

The words of the knowledge model link the language of a health worker's note to the
questions of the form. Code makes everything that can be made deterministically; this skill adds
the words that need judgement, and code checks them.

## Who does what

| Part | Made by | Where |
| --- | --- | --- |
| Labels, definitions and input options of the DAK data elements | Code: `bun run extract-dak <xlsx>` | `imci-fever/source/dak-data-dictionary.json` |
| Each question's own label as a word ("vomiting everything") | Code: the generator | `generated/lexicon.json` |
| Each question's DAK definition, in the form and in the lexicon | Code: the generator, through `prov:wasDerivedFrom` | `generated/schema.json`, `generated/lexicon.json` |
| Synonyms, words for absence, words for values, abbreviations | Three LLM runs (this skill), then code: consensus, checks, regression gate | Part 6 of `imci-fever/ontology/imci-fever.ttl`, record in `imci-fever/extract-words/runs/` |

The words are accepted automatically when they pass the checks. Like the rest of the knowledge
model, they are part of the clinical review that the app's disclaimer says is still to come.

## Procedure

All commands run in `imci-fever/`. `<folder>` is `extract-words/runs/<date>`.

1. **Input (code).** `bun run generate`, then `bun extract-words/run.ts input <folder>`. It writes
   `input.json` (each question's title, DAK definition, allowed values and current words) and
   `prompt.md` (the run prompt below), so the folder records exactly what the runs got.
2. **Three runs (LLM).** Start three subagents, each with `prompt.md` and the paths of `input.json`
   and of its output. Each writes its JSON reply to `<folder>/run-<n>.json` (n = 1, 2, 3). They must not
   see each other's output, the code, or any evaluation notes.
3. **Apply (code).** `bun extract-words/run.ts apply <folder>`. It:
   - keeps the words that at least two runs propose;
   - drops a word for an unknown question, a value the question does not allow, a word the
     question already has, a word with a comma, "and" or "but" (a note is split there, so it never
     matches), or a word that would state a sign both present and absent;
   - adds the words question by question, and keeps them only if the development notes do not get
     worse (no fewer facts found, no more wrong answers, no danger sign invented or wrongly denied). If a question's
     words make them worse, it tries each word alone;
   - adds the kept words below part 6, with a header for the run;
   - writes `<folder>/record.md`: every proposed word, how many runs proposed it, and the result.
4. **Verify (code).** `bun run test`, then `bun eval/words-eval.ts` for the results on both sets.
5. **Commit** the folder together with the ontology and generated files.

The test notes (`eval/held-out.ts`) are never an input and never a gate: they stay a fair test.

## Run prompt

> Read the JSON file at `<path>`. It lists the questions of a form about a sick child with fever:
> each question's id, title, DAK definition, allowed values and current words. Propose words a
> health worker would write in a note that state exactly what the definition says, of three kinds:
> `altLabel` (states the question; for a yes/no question, that the sign is present), `absentLabel`
> (states that a yes/no sign is absent) and `valueLabel` (states one allowed value, given in
> `value`). Clinical abbreviations are `altLabel` or `valueLabel`. Rules:
> - A word must mean what the definition says, not something close to it. "Sometimes vomits" is
>   not "vomiting everything (not able to hold anything down at all)".
> - Prefer phrases to single generic words: a single word such as "test", "hot" or "alert"
>   matches too many notes.
> - No comma, "and" or "but" inside a word: notes are split there.
> - A word must not state two questions in conflicting ways.
> - Lower case. Not a current word of the question.
> - Give each word a one-line reason that refers to the definition.
>
> Write only a JSON list to `<output path>`, each item
> `{ "question": <id>, "kind": "altLabel" | "absentLabel" | "valueLabel", "value": <allowed value, only for valueLabel>, "word": <word>, "reason": <reason> }`.
> Read no other file.

## Why repeated runs stay stable

- The words in the model are the starting point: a run only adds words, so repeating the skill
  changes little.
- A word needs at least two of three runs, which removes most of the variation of a single run.
- Code checks every word, and the regression gate keeps the development results from getting worse.
- Each run leaves a record: the input, the prompt, the three replies and the result of every word.
