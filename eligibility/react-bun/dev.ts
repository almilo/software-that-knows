// The development server: `bun run dev`. It serves the list of processes at / and each domain at
// /<name>/, on this computer only (127.0.0.1), with hot reload.
const root = import.meta.dir;
const port = Number(process.env.PORT ?? 3518);

const pages = (await Array.fromAsync(new Bun.Glob("domains/*/index.html").scan({ cwd: root }))).sort();
const routes = Object.fromEntries(
  await Promise.all(pages.map(async (page) => [`/${page.split("/")[1]}/`, (await import(`${root}/${page}`)).default as Bun.HTMLBundle])),
);

Bun.serve({
  hostname: "127.0.0.1",
  port,
  development: true,
  routes: { ...routes, "/": (await import(`${root}/index.html`)).default as Bun.HTMLBundle },
});

["/", ...Object.keys(routes)].forEach((path) => console.log(`http://127.0.0.1:${port}${path}`));
