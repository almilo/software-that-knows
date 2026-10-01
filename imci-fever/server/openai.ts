// Interprets a note with an OpenAI model (gpt-6-luna): the app's prompt (fields, rules, one example,
// all from the generated files), a strict JSON Schema for the reply, and the app's checks (check.ts:
// allowed values, quote in the note). Used by the server (main.ts) and by eval/openai-eval.ts.
import OpenAI from "openai";
import { check, type Interpretation } from "../note/check";
import { buildMessages, replySchema } from "./prompt";

export const openaiModel = { id: "gpt-6-luna", price: { input: 0.1 / 1e6, output: 0.5 / 1e6 } }; // US dollars per token (Standard)

export type OpenAIResult = { r: Interpretation; reply: string; model: string; usage: OpenAI.Responses.ResponseUsage | undefined; ms: number };

export async function interpretWithOpenAI(client: OpenAI, text: string): Promise<OpenAIResult> {
  const t0 = performance.now();
  const response = await client.responses.create({
    model: openaiModel.id,
    input: buildMessages(text).map((m) => ({ role: m.role, content: m.content })),
    text: { format: { type: "json_schema", name: "answers", strict: true, schema: replySchema() } },
  });
  return { r: check(text, response.output_text), reply: response.output_text, model: response.model, usage: response.usage, ms: performance.now() - t0 };
}
