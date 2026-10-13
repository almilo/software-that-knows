// The production build: `bun run build`. Each domain becomes a static site of its own in
// dist/<name>/, with relative paths, so any static host can serve it from any path.
import { rm } from "node:fs/promises";

const root = import.meta.dir;
await rm(`${root}/dist`, { recursive: true, force: true });

const pages = await Array.fromAsync(new Bun.Glob("domains/*/index.html").scan({ cwd: root }));
await Promise.all(pages.map(buildDomain));

async function buildDomain(page: string) {
  const name = page.split("/")[1]!;
  const build = await Bun.build({
    entrypoints: [`${root}/${page}`],
    outdir: `${root}/dist/${name}`,
    minify: true,
    define: { "process.env.NODE_ENV": '"production"' },
  });
  if (!build.success) throw new AggregateError(build.logs, `The build of ${name} failed`);
  console.log(`dist/${name}/: ${build.outputs.length} files`);
}
