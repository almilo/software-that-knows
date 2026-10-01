// Where a note is split into the parts that one statement covers (note/words.ts): sentences, then
// commas, "and" and "but". A full stop ends a sentence unless a digit follows it (as in 38.9).
// A word that contains one of these can never match, so the generator and the extract-words skill
// reject such words.
export const SENTENCE_BREAK = /[!?;\n]|\.(?![0-9])/;
export const CLAUSE_BREAK = /,| and | but /;

export const canMatch = (word: string) => !SENTENCE_BREAK.test(word) && !CLAUSE_BREAK.test(word);
