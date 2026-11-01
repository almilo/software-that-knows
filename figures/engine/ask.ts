// A question, grounded in the model: the words of the question are matched to the concepts of the
// model (rdfs:label and skos:altLabel), and the concepts decide which articles an LLM would read.
// When no article can answer, the answer is "I do not know", with the reason; when the question asks
// for something that the model does not define, such as "top" without a ranking, the answer says
// so. This demo does not call an LLM: it shows what an LLM would get.
import type { Article, Engine, Viewer } from "./engine";

export type Match = { kind: string; id: string; label: string; word: string };
export type AskResult = { matches: Match[]; period: string; articles: Article[]; notes: string[]; unknown?: string };

export function ask(engine: Engine, question: string, viewer: Viewer, period: string): AskResult {
  const { model } = engine;
  const months = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    name: new Date(Date.UTC(2000, i, 1)).toLocaleString("en", { month: "long", timeZone: "UTC" }),
  }));

  // Every concept with its words, the longest words first, so that "account manager" wins over a
  // shorter word inside it.
  const concepts = [
    ...model.partOrder.flatMap((p) => model.parts[p.key].map((c) => ({ kind: p.label, id: c.code, label: c.label, words: c.words }))),
    ...model.entityTypes.map((t) => ({ kind: "entity type", id: t.id, label: t.label, words: t.words })),
    ...model.entities.map((e) => ({ kind: "entity", id: e.id, label: e.label, words: e.words })),
    ...model.rankings.map((r) => ({ kind: "ranking", id: r.id, label: r.label, words: r.words })),
    ...months.map((m) => ({ kind: "month", id: String(m.month), label: m.name, words: [m.name.toLowerCase()] })),
  ];
  const candidates = concepts.flatMap((c) => c.words.map((word) => ({ ...c, word }))).sort((a, b) => b.word.length - a.word.length);

  let text = ` ${question.toLowerCase().replace(/[^a-z0-9 ]+/g, " ")} `;
  const matches: Match[] = [];
  for (const c of candidates) {
    const pattern = ` ${c.word} `;
    if (!text.includes(pattern)) continue;
    if (!matches.some((m) => m.kind === c.kind && m.id === c.id)) matches.push({ kind: c.kind, id: c.id, label: c.label, word: c.word });
    text = text.replaceAll(pattern, " · ");
  }
  const of = (kind: string) => matches.filter((m) => m.kind === kind);
  const result = (rest: Partial<AskResult>): AskResult => ({ matches, period, articles: [], notes: [], ...rest });

  // The month: the one in the question, else the one on the page.
  const month = of("month")[0];
  if (month) {
    const found = model.periods.find((p) => Number(p.month.slice(5)) === Number(month.id));
    if (!found) return result({ unknown: `There is no data for ${month.label}.` });
    period = found.month;
  }

  const used = new Set(engine.variablesUsed().flatMap((n) => n.split("_")));
  for (const m of of("measure")) {
    const measure = model.parts.measure.find((x) => x.code === m.id)!;
    const hasRows = engine.sourceTable.some((r) => r.measure === measure.sourceMeasure);
    if (!used.has(m.id) || !hasRows) {
      return result({ unknown: `No article has the ${m.label}${hasRows ? "" : ": there are no source rows for it"}.` });
    }
  }
  for (const m of of("time slice")) if (!used.has(m.id)) return result({ unknown: `No article has figures for the ${m.label}.` });

  const types = [...of("entity type").map((m) => m.id), ...of("entity").map((m) => model.entities.find((e) => e.id === m.id)!.type)];
  for (const type of new Set(types)) {
    if (!model.templates.some((t) => t.about === type)) {
      return result({ unknown: `No article is about a ${model.entityTypes.find((t) => t.id === type)!.label}.` });
    }
  }

  const notes: string[] = [];
  const rankingWord = model.rankingWords.find((w) => ` ${question.toLowerCase()} `.match(new RegExp(`\\W${w}\\W`)));
  const rankings = of("ranking").map((m) => model.rankings.find((r) => r.id === m.id)!);
  if (rankingWord && !rankings.length) {
    notes.push(`The model does not define what "${rankingWord}" means. The LLM gets the articles, and decides it.`);
  }
  for (const r of rankings) {
    if (!r.decision) notes.push(`The model has ${r.candidates.length} definitions of the ${r.label} and no decision: the article says when they give different answers.`);
  }

  // The articles: the ones about the entities of the question; with a ranking, the ones that hold
  // it; else every article that the viewer sees.
  const all = engine.articles(period);
  const visible = engine.articles(period, viewer);
  const entities = of("entity").map((m) => m.id);
  const wanted = all.filter((a) => {
    if (entities.length) return entities.includes(a.entity);
    if (rankings.length) return rankings.some((r) => model.templates.find((t) => t.id === a.template)!.text.includes(`{ranking:${r.id}}`));
    return true;
  });
  const seen = wanted.filter((a) => visible.some((v) => v.template === a.template && v.entity === a.entity));
  if (!wanted.length) {
    return result({ notes, unknown: `No article has an answer for ${engine.monthName(period)}.` });
  }
  if (!seen.length) return result({ notes, unknown: `You do not see the articles that answer this: ${wanted.map((a) => a.entityLabel).join(", ")}.` });
  if (seen.length < wanted.length) notes.push(`You do not see ${wanted.length - seen.length} of the articles that answer this.`);
  return result({ period, articles: seen, notes });
}
