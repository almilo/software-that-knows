Read the JSON file at `/Users/almilo/projects/software-that-knows/imci-fever/word-runs/2026-10-01/input.json`. It lists the questions of a form about a sick child with fever: each question's id, title, DAK definition, allowed values and current words. Propose words a health worker would write in a note that state exactly what the definition says, of three kinds: `altLabel` (states the question; for a yes/no question, that the sign is present), `absentLabel` (states that a yes/no sign is absent) and `valueLabel` (states one allowed value, given in `value`). Clinical abbreviations are `altLabel` or `valueLabel`. Rules:
- A word must mean what the definition says, not something close to it. "Sometimes vomits" is not "vomiting everything (not able to hold anything down at all)".
- Prefer phrases to single generic words: a single word such as "test" or "hot" matches too many notes.
- A word must not state two questions in conflicting ways.
- Lower case. Not a current word of the question.
- Give each word a one-line reason that refers to the definition.

Write only a JSON list to `/Users/almilo/projects/software-that-knows/imci-fever/word-runs/2026-10-01/run-<n>.json`, each item `{ "question": <id>, "kind": "altLabel" | "absentLabel" | "valueLabel", "value": <allowed value, only for valueLabel>, "word": <word>, "reason": <reason> }`. Read no other file. Do not run any commands other than reading the input file and writing the output file. When done, reply with only the number of items you wrote.
