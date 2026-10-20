// Serves the built app from dist/.
import { join, normalize } from "node:path";

const root = join(import.meta.dir, "..", "dist");
const port = Number(process.env.PORT ?? 3000);

const server = Bun.serve({
  port,
  async fetch(request) {
    const path = normalize(decodeURIComponent(new URL(request.url).pathname)).replace(/^(\.\.[/\\])+/, "");
    const file = Bun.file(join(root, path === "/" ? "index.html" : path));
    return (await file.exists()) ? new Response(file) : new Response("Not found", { status: 404 });
  },
});
console.log(`App on http://localhost:${server.port}`);
