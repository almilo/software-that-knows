// The development server: `bun run assistant`. It builds the app once at start and serves it on this
// computer only (127.0.0.1); POST /api/answer streams the answer of the language model as plain
// text. Without an API key it replays the hand-written answer of an evaluation question, and says so
// in a header.
import Anthropic from "@anthropic-ai/sdk";
import { fixtures } from "./fixtures";
import { streamAnswer } from "./llm";

const live = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const port = Number(process.env.PORT ?? 3014);

// The OpenUI runtime reads process.env.NODE_ENV, also as process.env["NODE_ENV"], and expects the
// bundler to replace it. As "production", it also leaves out its devtools, which load a script from
// a CDN.
const build = await Bun.build({
  entrypoints: [new URL("./index.html", import.meta.url).pathname],
  define: { "process.env.NODE_ENV": JSON.stringify("production"), "process.env": JSON.stringify({ NODE_ENV: "production" }) },
});
if (!build.success) throw new AggregateError(build.logs, "The build of the app failed");
const files = new Map(build.outputs.map((o) => [`/${o.path.replace(/^\.\//, "")}`, o]));

async function answer(req: Request) {
  const { question } = (await req.json()) as { question?: string };
  if (!question?.trim()) return new Response("A question is needed.", { status: 400 });
  if (!live) {
    const fixture = fixtures.find((f) => f.question === question);
    if (!fixture) return new Response("No API key is set, so only the example questions have an answer.", { status: 503 });
    return new Response(fixture.response, { headers: { "content-type": "text/plain; charset=utf-8", "x-answer-source": "replay" } });
  }
  const stream = streamAnswer(question);
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      stream.on("text", (text) => controller.enqueue(encoder.encode(text)));
      try {
        const message = await stream.finalMessage();
        if (message.stop_reason === "refusal") controller.enqueue(encoder.encode('\nroot = Answer([refused])\nrefused = Note("The model declined to answer this question.")'));
      } catch (error) {
        console.error(error instanceof Anthropic.APIError ? `API error ${error.status}: ${error.message}` : error);
      }
      controller.close();
    },
    cancel: () => stream.abort(),
  });
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "x-answer-source": "model" } });
}

Bun.serve({
  hostname: "127.0.0.1",
  port,
  routes: { "/api/answer": { POST: answer } },
  fetch(req) {
    const path = new URL(req.url).pathname;
    const file = files.get(path === "/" ? "/index.html" : path);
    return file ? new Response(file, { headers: { "content-type": file.type } }) : new Response("Not found", { status: 404 });
  },
});
console.log(`http://127.0.0.1:${port}/ (${live ? "live model" : "replay: no API key"})`);
