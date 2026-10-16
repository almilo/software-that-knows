// `bun run reuse`: how much of each domain comes from the shared modules (modules/), as a table.
// It counts, file by file, the fields (sh:property), the rules (sh:rule), the findings, next steps
// and values, and the texts for the person (literals with a language tag); the articles are counted
// apart, as cited articles of acts that another domain cites too.
import { ready, select, Store } from "../core/rdf";
import { domains, root } from "./generate";

const counts = {
  fields: `SELECT (COUNT(*) AS ?n) WHERE { ?shape sh:property ?field }`,
  rules: `SELECT (COUNT(*) AS ?n) WHERE { ?shape sh:rule ?rule }`,
  outcomes: `SELECT (COUNT(*) AS ?n) WHERE { VALUES ?type { form:Finding form:NextStep form:Value } ?x a ?type }`,
  texts: `SELECT (COUNT(*) AS ?n) WHERE { ?s ?p ?text FILTER (isLiteral(?text) && LANG(?text) != "") }`,
};
type Count = Record<keyof typeof counts, number>;

export async function reuse() {
  await ready;
  const all = await domains();
  // The law modules that each domain loads, to find the acts that more than one domain cites.
  const lawUsers = Map.groupBy([...all].flatMap(([name, files]) => files.filter(isLaw).map((f) => ({ f, name }))), (x) => x.f);
  return Promise.all(
    [...all].map(async ([name, files]) => {
      const own = files.filter((f) => f.startsWith("domains/"));
      const shared = files.filter((f) => f.startsWith("modules/") && !isLaw(f));
      const laws = files.filter(isLaw);
      const [ownCount, sharedCount] = await Promise.all([total(own), total(shared)]);
      const cited = await citedArticles(own.concat(shared), laws, lawUsers);
      return {
        name,
        modules: shared.concat(laws).map((f) => f.replace("modules/", "").replace(".ttl", "")),
        own: ownCount,
        shared: sharedCount,
        articles: cited,
      };
    }),
  );
}

async function total(files: string[]) {
  const each = await Promise.all(files.map(count));
  return Object.fromEntries(Object.keys(counts).map((k) => [k, each.reduce((sum, c) => sum + c[k as keyof Count], 0)])) as Count;
}

async function count(file: string): Promise<Count> {
  const store = await load([file]);
  return Object.fromEntries(Object.entries(counts).map(([k, q]) => [k, Number(select(store, q)[0]!.n!.value)])) as Count;
}

// The articles that the domain cites, and how many of them are in an act that another domain
// cites too.
async function citedArticles(model: string[], laws: string[], users: Map<string, { name: string }[]>) {
  const store = await load([...model, ...laws]);
  const rows = select(store, `SELECT DISTINCT ?article ?act WHERE { ?x prov:wasDerivedFrom ?article . ?article prov:wasDerivedFrom ?act }`);
  const actFile = new Map(
    await Promise.all(laws.map(async (f) => [select(await load([f]), `SELECT ?act WHERE { ?act a prov:Entity FILTER NOT EXISTS { ?act prov:wasDerivedFrom ?any } }`)[0]!.act!.value, f] as const)),
  );
  const shared = rows.filter((r) => (users.get(actFile.get(r.act!.value) ?? "")?.length ?? 0) > 1);
  return { cited: rows.length, inSharedActs: shared.length };
}

async function load(files: string[]) {
  const store = new Store();
  for (const f of files) store.load(await Bun.file(`${root}${f}`).text(), { format: "text/turtle" });
  return store;
}

function isLaw(file: string) {
  return file.startsWith("modules/law/");
}

if (import.meta.main) {
  const rows = await reuse();
  const of = (shared: number, own: number) => `${shared} of ${shared + own}`;
  console.log("From the shared modules, of all in the domain:");
  console.table(
    Object.fromEntries(
      rows.map((r) => [
        r.name,
        {
          fields: of(r.shared.fields, r.own.fields),
          rules: of(r.shared.rules, r.own.rules),
          "findings, next steps, values": of(r.shared.outcomes, r.own.outcomes),
          texts: of(r.shared.texts, r.own.texts),
          "articles in shared acts": `${r.articles.inSharedActs} of ${r.articles.cited}`,
        },
      ]),
    ),
  );
  for (const r of rows) console.log(`${r.name}: ${r.modules.join(", ")}`);
}
