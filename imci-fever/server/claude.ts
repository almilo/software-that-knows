// Interprets a note with Claude Haiku 4.5: the app's prompt (fields, rules, one example, all from the
// generated files), a JSON Schema for the reply, and the app's checks (check.ts: allowed values,
// quote in the note). Used by the server (main.ts) and by eval/claude-eval.ts.
import Anthropic from "@anthropic-ai/sdk";
import { check, type Interpretation } from "../note/check";
import { buildMessages, replySchema } from "./prompt";

export const claudeModel = { id: "claude-haiku-4-5", price: { input: 1 / 1e6, output: 5 / 1e6 } }; // US dollars per token

export type ClaudeResult = { r: Interpretation; reply: string; model: string; usage: Anthropic.Beta.BetaUsage; ms: number };

export async function interpretWithClaude(client: Anthropic, text: string): Promise<ClaudeResult> {
  const t0 = performance.now();
  const response = await client.beta.messages.create({ ...claudeRequest(text), max_tokens: 16000 });
  if (response.stop_reason === "refusal") throw new Error(`Claude declined to interpret this note (${response.stop_details?.category ?? "no category"}).`);
  const reply = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  return { r: check(text, reply), reply, model: response.model, usage: response.usage, ms: performance.now() - t0 };
}

// The request without max_tokens: also used to count its input tokens.
export function claudeRequest(text: string) {
  const [system, ...turns] = buildMessages(text);
  return {
    model: claudeModel.id,
    system: system!.content,
    messages: turns.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    output_config: { format: { type: "json_schema" as const, schema: replySchema() } },
  };
}
