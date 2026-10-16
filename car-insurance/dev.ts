// The development server: `bun run dev`. It serves the app on this computer only (127.0.0.1), with
// hot reload.
import index from "./index.html";

const port = Number(process.env.PORT ?? 3013);
Bun.serve({ hostname: "127.0.0.1", port, development: true, routes: { "/": index } });
console.log(`http://127.0.0.1:${port}/`);
