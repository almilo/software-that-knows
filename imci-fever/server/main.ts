// The app's server: `bun run dev`. It serves the app on this computer only (127.0.0.1) and offers the
// cloud interpreters of a note:
//   GET  /api/interpreters  which cloud interpreters have their API key set in this server's environment
//   POST /api/interpret     interprets a note with one of them: { interpreter, text, data }
// The words of the knowledge model interpret in the browser and need no server. The API keys stay in
// this server; the browser never sees them. The note is sent to the chosen provider.
import Anthropic from "@anthropic-ai/sdk";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import OpenAI from "openai";
import index from "../index.html";
import type { Assessment } from "../app/classify";
import type { Interpretation } from "../note/check";
import { formOrder } from "../note/fields";
import { interpretNote, structure } from "../note/interpret";
import { cloudInterpreters, JEV_THRESHOLD, type InterpreterInfo } from "../note/interpreters";
import { interpretWithClaude } from "./claude";
import { acceptedDecisions, interpretWithJev } from "./jev";
import { interpretWithOpenAI } from "./openai";

const MAX_NOTE = 4000; // characters
const port = Number(process.env.PORT ?? 3517);

type Result = { r: Interpretation; model: string; ms: number };
type Interpreter = InterpreterInfo & { provider: string; key: string; interpret: (text: string, data: Assessment) => Promise<Result> };

const run: Record<string, Interpreter["interpret"]> = {
  jev: async (text, data) => {
    const words = interpretNote(text, data);
    const jev = await interpretWithJev(new TypeSafeClient(), text);
    const extra = acceptedDecisions(jev.decisions, JEV_THRESHOLD).filter((p) => !words.proposals.some((w) => w.field === p.field));
    return { r: structure({ proposals: [...words.proposals, ...extra], rejected: words.rejected }, data), model: jev.model, ms: jev.ms };
  },
  haiku: async (text, data) => {
    const c = await interpretWithClaude(new Anthropic(), text);
    return { r: structure(c.r, data), model: c.model, ms: c.ms };
  },
  luna: async (text, data) => {
    const o = await interpretWithOpenAI(new OpenAI(), text);
    return { r: structure(o.r, data), model: o.model, ms: o.ms };
  },
};

// The descriptions are in note/interpreters.ts, which the browser shows with or without this server.
const interpreters: Interpreter[] = cloudInterpreters.map((i) => ({ ...i, provider: i.provider!, key: i.key!, interpret: run[i.id]! }));

Bun.serve({
  hostname: "127.0.0.1",
  port,
  development: true,
  routes: {
    "/": index,
    "/api/interpreters": () => Response.json(interpreters.map(({ id, key }) => ({ id, available: hasKey(key) }))),
    "/api/interpret": { POST: interpret },
  },
});

console.log(`IMCI fever: http://127.0.0.1:${port}/`);
interpreters.forEach((i) => console.log(`  ${i.name}: ${hasKey(i.key) ? "ready" : `not available, set ${i.key}`}`));

async function interpret(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => undefined)) as { interpreter?: unknown; text?: unknown; data?: unknown } | undefined;
  const interpreter = interpreters.find((i) => i.id === body?.interpreter);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!interpreter) return Response.json({ error: "Unknown interpreter." }, { status: 400 });
  if (!hasKey(interpreter.key)) {
    return Response.json({ error: `${interpreter.name} needs ${interpreter.key} in the environment of the server. Set it and restart bun run dev.` }, { status: 400 });
  }
  if (!text || text.length > MAX_NOTE) return Response.json({ error: `A note of 1 to ${MAX_NOTE} characters is needed.` }, { status: 400 });
  const data = (typeof body?.data === "object" && body.data !== null ? body.data : {}) as Assessment;
  try {
    const { r, model, ms } = await interpreter.interpret(text, data);
    const rank = (f: string) => formOrder.indexOf(f);
    return Response.json({ ...r, proposals: [...r.proposals].sort((a, b) => rank(a.field) - rank(b.field)), model, ms: Math.round(ms) });
  } catch (e) {
    console.error(`${interpreter.name}:`, e);
    return Response.json({ error: explain(e, interpreter) }, { status: 502 });
  }
}

function hasKey(key: string) {
  return Boolean(process.env[key]);
}

// A message that says what went wrong, for the errors of the three SDKs.
function explain(e: unknown, interpreter: Interpreter): string {
  const err = e as { status?: number; code?: string; name?: string; message?: string; error?: { error?: { type?: string } } };
  const detail = `${err.code ?? ""} ${err.error?.error?.type ?? ""} ${err.message ?? ""}`;
  const { provider, key } = interpreter;
  if (err.status === 401 || err.status === 403) return `${provider} rejected the API key (${err.status}). Check ${key}.`;
  if (err.status === 429 && /quota|credit|billing/i.test(detail)) return `The ${provider} account has no credit left. Add credit in the ${provider} console.`;
  if (err.status === 429) return `${provider} is limiting the number of requests. Try again in a moment.`;
  if (err.status !== undefined && err.status >= 500) return `${provider} had a server error (${err.status}). Try again later.`;
  if (/connection|fetch failed|ENOTFOUND|ECONNREFUSED/i.test(`${err.name} ${err.message}`)) return `Cannot reach ${provider}. Check the internet connection.`;
  return `${provider}: ${err.message ?? String(e)}`;
}
