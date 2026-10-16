// The production build: `bun run build`. The list of processes becomes dist/index.html, and each
// domain a static site of its own in dist/<name>/, with relative paths, so any static host can
// serve them from any path.
import { rm } from "node:fs/promises";

const root = import.meta.dir;
await rm(`${root}/dist`, { recursive: true, force: true });

const pages = await Array.fromAsync(new Bun.Glob("domains/*/index.html").scan({ cwd: root }));
await Promise.all([buildPage("index.html", "dist"), ...pages.map((page) => buildPage(page, `dist/${page.split("/")[1]}`))]);

async function buildPage(page: string, outdir: string) {
  const build = await Bun.build({
    entrypoints: [`${root}/${page}`],
    outdir: `${root}/${outdir}`,
    minify: true,
    define: { "process.env.NODE_ENV": '"production"' },
  });
  if (!build.success) throw new AggregateError(build.logs, `The build of ${page} failed`);
  console.log(`${outdir}/: ${build.outputs.length} files`);
}
