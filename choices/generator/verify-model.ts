// `bun run verify`: the checks of every domain's model, as a table, then the findings.
// `bun run verify <domain> <file>…`: the checks of one domain, with other files in place of some of
// its files, by name, for example `bun run verify chatgpt-models domains/chatgpt-models/test/drawn/rules.ttl`.
//   structure  the findings of the decision tree, if there is one (generate-decision.ts, readTree);
//   behaviour  the findings over every situation (decide/verify.ts).
import { createDecision } from "../decide/decision";
import type { DecisionModel } from "../decide/model";
import { verify } from "../decide/verify";
import { generateDecision } from "./generate-decision";
import { domains, readModel } from "./generate";

export async function verifyModel(name: string, replace: Record<string, string> = {}) {
  const { findings: structure, ...model } = generateDecision(await readModel(name, replace), { strict: false }) as ReturnType<typeof generateDecision> & {
    findings: string[];
  };
  const behaviour = verify(createDecision(model as DecisionModel));
  return { name, situations: behaviour.situations, structure, behaviour: behaviour.findings };
}

if (import.meta.main) {
  const [name, ...files] = process.argv.slice(2);
  const replace = Object.fromEntries(files.map((f) => [f.split("/").at(-1)!, f]));
  const results = await Promise.all((name ? [name] : await domains()).map((n) => verifyModel(n, replace)));
  console.table(
    Object.fromEntries(results.map((r) => [r.name, { situations: r.situations, "structure findings": r.structure.length, "behaviour findings": r.behaviour.length }])),
  );
  for (const r of results) for (const f of [...r.structure.map((s) => `structure: ${s}`), ...r.behaviour]) console.log(`${r.name}  ✗ ${f}`);
}
