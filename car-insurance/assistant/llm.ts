// The one call to the language model: the person's question in, OpenUI Lang out, as a stream of
// text. The system prompt is the same for every request, so it is cached.
import Anthropic from "@anthropic-ai/sdk";
import { systemPrompt } from "./prompt";

export const model = process.env.ASSISTANT_MODEL ?? "claude-opus-5-5";

const client = new Anthropic();

export function streamAnswer(question: string) {
  return client.beta.messages.stream({
    model,
    max_tokens: 16000,
    // Choosing components and filling in facts is a light task.
    output_config: { effort: "low" },
    // On a refusal, the API retries on the server's default fallback model for this one.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: question }],
  });
}

// The text of a complete answer, for the evaluation.
export async function answer(question: string): Promise<{ text: string; stopReason: string | null }> {
  const message = await streamAnswer(question).finalMessage();
  const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  return { text, stopReason: message.stop_reason };
}
