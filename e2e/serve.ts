// Serves the built app (dist/) for the browser test.
import { join } from "node:path";

const root = join(import.meta.dir, "..", "dist");
export function serve(port = 0) {
  return Bun.serve({
    port,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      const file = Bun.file(join(root, path === "/" ? "index.html" : path));
      return (await file.exists()) ? new Response(file) : new Response("Not found", { status: 404 });
    },
  });
}

if (import.meta.main) {
  const server = serve(Number(process.env.PORT ?? 3000));
  console.log(`Serving dist/ on ${server.url}`);
}
