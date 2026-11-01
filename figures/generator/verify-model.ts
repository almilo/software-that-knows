// `bun run verify`: the checks of every domain's model, as a table, then the findings.
// `bun run verify <domain> <file>…`: the checks of one domain, with other files in place of some of
// its files, by name, for example
//   bun run verify harbor-vines domains/harbor-vines/test/as-shown/articles.ttl
//   structure  what the model says, in any month (engine/verify.ts, verifyStructure);
//   <month>    what its articles say in that month (engine/verify.ts, verifyPeriod).
import { createEngine } from "../engine/engine";
import { verifyPeriod, verifyStructure } from "../engine/verify";
import { domains, readModel, readRows } from "./generate";

export async function verifyModel(name: string, replace: Record<string, string> = {}) {
  const engine = createEngine(await readModel(name, replace), await readRows(name));
  return {
    name,
    structure: verifyStructure(engine),
    periods: engine.model.periods.map((p) => ({ month: p.month, label: engine.monthName(p.month), findings: verifyPeriod(engine, p.month) })),
  };
}

if (import.meta.main) {
  const [name, ...files] = process.argv.slice(2);
  const replace = Object.fromEntries(files.map((f) => [f.split("/").at(-1)!, f]));
  const results = await Promise.all((name ? [name] : await domains()).map((n) => verifyModel(n, replace)));
  console.table(
    Object.fromEntries(
      results.map((r) => [r.name, { structure: r.structure.length, ...Object.fromEntries(r.periods.map((p) => [p.label, p.findings.length])) }]),
    ),
  );
  for (const r of results) {
    for (const f of r.structure) console.log(`${r.name}  ✗ ${f}`);
    for (const p of r.periods) for (const f of p.findings) console.log(`${r.name}  ${p.label}  ✗ ${f}`);
  }
}
