// The development server: `bun run dev`. It serves each domain at /<name>/, on this computer only
// (127.0.0.1), with hot reload.
const root = import.meta.dir;
const port = Number(process.env.PORT ?? 3518);

const pages = (await Array.fromAsync(new Bun.Glob("domains/*/index.html").scan({ cwd: root }))).sort();
const routes = Object.fromEntries(
  await Promise.all(pages.map(async (page) => [`/${page.split("/")[1]}/`, (await import(`${root}/${page}`)).default as Bun.HTMLBundle])),
);
const first = Object.keys(routes)[0]!;

Bun.serve({
  hostname: "127.0.0.1",
  port,
  development: true,
  routes: { ...routes, "/": Response.redirect(first, 302) },
});

Object.keys(routes).forEach((path) => console.log(`http://127.0.0.1:${port}${path}`));
