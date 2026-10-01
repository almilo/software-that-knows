// The interpreters of a note. The words of the knowledge model run in the browser; the cloud
// interpreters run through the local server (server/main.ts), which holds their API keys. The app
// lists all of them, with or without the server, so the difference is visible.
export type InterpreterInfo = { id: string; name: string; kind: string; provider?: string; key?: string; how: string };

export const WORDS: InterpreterInfo = {
  id: "words",
  name: "Words of the knowledge model",
  kind: "no AI",
  how: "looks up the words of the knowledge model in the note. Runs in this browser: no AI provider, no API key",
};

// How to run the app on one's own computer, with the cloud interpreters: the README of this version.
export const SETUP_URL = "https://github.com/almilo/software-that-knows/tree/part-6/imci-fever#run-it-on-your-computer";

// Jev's confidence threshold, chosen on the development notes (see README, Evaluations).
export const JEV_THRESHOLD = 0.95;

export const cloudInterpreters: InterpreterInfo[] = [
  {
    id: "jev",
    name: "Jev",
    kind: "a System 1 model",
    provider: "TypeSafe",
    key: "TYPESAFE_API_KEY",
    how: `completes the words: one typed question for each field that the words leave empty, kept when Jev is at least ${JEV_THRESHOLD * 100}% confident. Gives a confidence, not a quote`,
  },
  {
    id: "haiku",
    name: "Claude Haiku 4.5",
    kind: "a small frontier model",
    provider: "Anthropic",
    key: "ANTHROPIC_API_KEY",
    how: "interprets the whole note with every field of the form; each answer must quote the note",
  },
  {
    id: "luna",
    name: "gpt-6-luna",
    kind: "a small frontier model",
    provider: "OpenAI",
    key: "OPENAI_API_KEY",
    how: "interprets the whole note with every field of the form; each answer must quote the note",
  },
];
