// The engine, in the four steps of the video, for one domain and one period:
//   1. source table  every source row with the entities it is about, from the master data;
//   2. data frame    one cell for each entity and each variable that a template asks for,
//                    calculated by fixed rules, with the source rows it comes from;
//   3. templates     texts with blanks (the model);
//   4. articles      the templates with their blanks filled, one for each entity.
// The engine knows the figures words (engine/model.ts), and nothing about drinks or sales.
import type { Entity, FiguresModel, PartKey, SourceRow, Template } from "./model";

export type Variable = { name: string } & { [K in PartKey]: FiguresModel["parts"][K][number] };
export type Cell = { value?: number; reason?: string; rows: string[] };
export type Figure = {
  kind: "variable" | "calculation";
  name: string;
  entity: string;
  display: string;
  value?: number;
  reason?: string;
  rows: string[];
};
export type Segment = { text: string } | { figure: Figure };
export type Article = { template: string; templateLabel: string; entity: string; entityLabel: string; segments: Segment[]; text: string };
export type Viewer = { id: string; label: string; role: string; entity?: string };
export type SourceTableRow = SourceRow & { entities: Record<string, string | undefined> };

export type Engine = ReturnType<typeof createEngine>;

// A blank of a template: {entity}, {period}, {yearStart}, {ranking:Name}, {=calculation|format},
// {VARIABLE} or {VARIABLE|direction}.
export const blankPattern = /\{([^}]+)\}/g;

export function createEngine(model: FiguresModel, rows: SourceRow[]) {
  const entity = (id: string) => model.entities.find((e) => e.id === id)!;
  const entitiesOf = (type: string) => model.entities.filter((e) => e.type === type).sort((a, b) => a.label.localeCompare(b.label));
  const byCode = new Map(model.entities.filter((e) => e.code).map((e) => [e.code!, e]));

  // --- Variables --------------------------------------------------------------------------------

  // The name of a variable is one code of each list, joined with "_", in the order of the parts.
  function parse(name: string): { variable: Variable } | { error: string } {
    const codes = name.split("_");
    if (codes.length !== model.partOrder.length) return { error: `${name} is not a variable: it has ${codes.length} parts, not ${model.partOrder.length}` };
    const variable = { name } as Variable;
    for (const [i, part] of model.partOrder.entries()) {
      const concept = model.parts[part.key].find((c) => c.code === codes[i]);
      if (!concept) return { error: `${name} is not a variable: part ${i + 1}, "${codes[i]}", is not a ${part.label}` };
      (variable as Record<string, unknown>)[part.key] = concept;
    }
    const percent = variable.suffix.format === "percent";
    if (variable.scenario.comparison && !percent) return { error: `${name} is not a variable: a comparison is a percent` };
    if (!variable.scenario.comparison && percent) return { error: `${name} is not a variable: only a comparison is a percent` };
    return { variable };
  }

  function variable(name: string) {
    const parsed = parse(name);
    if ("error" in parsed) throw new Error(parsed.error);
    return parsed.variable;
  }

  // The name with other concepts in some parts, such as the budget of an actual.
  const rename = (v: Variable, changes: Partial<Record<PartKey, string>>) =>
    model.partOrder.map((p) => changes[p.key] ?? v[p.key].code).join("_");

  // --- Calendar ---------------------------------------------------------------------------------

  const start = model.domain.fiscalYearStart;
  const ym = (date: string) => date.split("-").slice(0, 2).map(Number) as [number, number];
  const fiscalYear = (date: string) => {
    const [y, m] = ym(date);
    return m >= start ? y : y - 1;
  };
  const fiscalIndex = (date: string) => (ym(date)[1] - start + 12) % 12;
  const monthName = (m: number) => new Date(Date.UTC(2000, m - 1, 1)).toLocaleString("en", { month: "long", timeZone: "UTC" });

  function inSlice(date: string, period: string, v: Variable) {
    if (fiscalYear(date) !== fiscalYear(period) + v.timeBasis.yearOffset) return false;
    if (v.timeSlice.kind === "FullYear") return true;
    if (v.timeSlice.kind === "YearToDate") return fiscalIndex(date) <= fiscalIndex(period);
    return fiscalIndex(date) === fiscalIndex(period);
  }

  // --- 1. Source table --------------------------------------------------------------------------

  // The entity of a type that a row is about: the business as a whole, the entity of a code in the
  // row, or the entity linked to it (a customer → its account manager).
  function entityOf(type: string, row: SourceRow) {
    const t = model.entityTypes.find((e) => e.id === type)!;
    if (t.whole) return entitiesOf(type)[0]?.id;
    const base = byCode.get(String(row[t.sourceColumn!] ?? ""));
    if (!base) return undefined;
    return t.via ? base.links[t.via] : base.type === type ? base.id : undefined;
  }

  const sourceTable: SourceTableRow[] = rows.map((row) => ({
    ...row,
    entities: Object.fromEntries(model.entityTypes.map((t) => [t.id, entityOf(t.id, row)])),
  }));

  // --- 2. Data frame ----------------------------------------------------------------------------

  const cache = new Map<string, Cell>();

  function cell(name: string, entityId: string, period: string): Cell {
    const key = `${name} ${entityId} ${period}`;
    if (!cache.has(key)) cache.set(key, calculate(variable(name), entityId, period));
    return cache.get(key)!;
  }

  function calculate(v: Variable, entityId: string, period: string): Cell {
    const comparison = v.scenario.comparison;
    if (comparison) {
      const of = cell(rename(v, { scenario: comparison.of, suffix: comparison.inputSuffix }), entityId, period);
      const against = cell(rename(v, { scenario: comparison.against, suffix: comparison.inputSuffix }), entityId, period);
      const rows = [...of.rows, ...against.rows];
      if (of.value === undefined || against.value === undefined) return { reason: of.reason ?? against.reason, rows };
      if (against.value === 0) return { reason: `the ${scenarioLabel(comparison.against)} is 0`, rows };
      return { value: (of.value - against.value) / against.value, rows };
    }
    const type = entity(entityId).type;
    const matching = sourceTable.filter(
      (r) => r.measure === v.measure.sourceMeasure && r.version === v.scenario.sourceVersion && r.entities[type] === entityId && inSlice(r.date, period, v),
    );
    return { value: matching.reduce((sum, r) => sum + r.amount, 0), rows: matching.map((r) => r.id) };
  }

  const scenarioLabel = (code: string) => model.parts.scenario.find((s) => s.code === code)!.label;

  // --- Numbers as text --------------------------------------------------------------------------

  const percent = (n: number) => `${Number((n * 100).toFixed(1))}%`;
  const currency = (n: number) => `${n < 0 ? "-" : ""}${model.domain.currencySymbol}${Math.abs(n).toLocaleString("en-AU", { maximumFractionDigits: 0 })}`;

  function display(v: Variable, c: Cell, withDirection: boolean) {
    const comparison = v.scenario.comparison;
    if (c.value === undefined) return withDirection ? `not comparable, because ${c.reason}` : "n/a";
    if (v.suffix.format === "currency") return currency(c.value);
    if (!withDirection || !comparison) return percent(c.value);
    if (c.value === 0) return comparison.equal;
    return `${percent(Math.abs(c.value))} ${c.value > 0 ? comparison.above : comparison.below}`;
  }

  // --- 4. Articles ------------------------------------------------------------------------------

  function fill(template: Template, e: Entity, period: string): Article {
    const segments: Segment[] = [];
    let last = 0;
    for (const match of template.text.matchAll(blankPattern)) {
      if (match.index > last) segments.push({ text: template.text.slice(last, match.index) });
      segments.push(...blank(match[1]!, e, period));
      last = match.index + match[0].length;
    }
    if (last < template.text.length) segments.push({ text: template.text.slice(last) });
    const text = segments.map((s) => ("text" in s ? s.text : s.figure.display)).join("");
    return { template: template.id, templateLabel: template.label, entity: e.id, entityLabel: e.label, segments, text };
  }

  function blank(content: string, e: Entity, period: string): Segment[] {
    if (content === "entity") return [{ text: e.label }];
    if (content === "period") return [{ text: monthName(ym(period)[1]) }];
    if (content === "yearStart") return [{ text: monthName(start) }];
    if (content.startsWith("ranking:")) return ranking(content.slice("ranking:".length), period);
    if (content.startsWith("=")) {
      const [expression, format] = content.slice(1).split("|");
      const result = calculation(expression!, e.id, period);
      const shown = result.value === undefined ? "n/a" : format === "percent" ? percent(result.value) : currency(result.value);
      return [{ figure: { kind: "calculation", name: expression!.trim(), entity: e.id, display: shown, ...result } }];
    }
    const [name, option] = content.split("|");
    const v = variable(name!);
    const c = cell(name!, e.id, period);
    return [{ figure: { kind: "variable", name: name!, entity: e.id, display: display(v, c, option === "direction"), ...c } }];
  }

  // A calculation in a template: variable names, numbers, + - * / and brackets.
  function calculation(expression: string, entityId: string, period: string): Cell {
    const tokens = expression.match(/[A-Z][A-Z0-9_]*|\d+(?:\.\d+)?|[-+*/()]/g) ?? [];
    const used: string[] = [];
    let i = 0;
    let reason: string | undefined;
    const primary = (): number => {
      const t = tokens[i++]!;
      if (t === "(") {
        const v = sum();
        i++;
        return v;
      }
      if (/^\d/.test(t)) return Number(t);
      const c = cell(t, entityId, period);
      used.push(...c.rows);
      return c.value ?? NaN;
    };
    const product = (): number => {
      let v = primary();
      while (tokens[i] === "*" || tokens[i] === "/") {
        const op = tokens[i++];
        const right = primary();
        if (op === "/" && right === 0) reason = "division by 0";
        v = op === "*" ? v * right : v / right;
      }
      return v;
    };
    const sum = (): number => {
      let v = product();
      while (tokens[i] === "+" || tokens[i] === "-") v = tokens[i++] === "+" ? v + product() : v - product();
      return v;
    };
    const value = sum();
    const rows = [...new Set(used)];
    return Number.isFinite(value) ? { value, rows } : { reason: reason ?? "no value", rows };
  }

  // --- Rankings ---------------------------------------------------------------------------------

  // The top entity of each definition of a ranking, in a period.
  function rankingResult(id: string, period: string) {
    const r = model.rankings.find((x) => x.id === id);
    if (!r) throw new Error(`There is no ranking ${id}`);
    const candidates = r.candidates.map((c) => {
      const v = variable(c.variable);
      const values = entitiesOf(r.of)
        .map((e) => ({ e, c: cell(c.variable, e.id, period) }))
        .filter((x) => x.c.value !== undefined);
      const best = Math.max(...values.map((x) => x.c.value!));
      const top = values.filter((x) => x.c.value === best);
      return { ...c, top: top.map((x) => x.e), value: top[0]?.c.value, display: top[0] ? display(v, top[0].c, true) : "n/a", rows: top.flatMap((x) => x.c.rows) };
    });
    const decided = r.decision ? candidates.filter((c) => c.variable === r.decision) : [];
    const agree = new Set(candidates.map((c) => c.top.map((e) => e.id).join())).size <= 1;
    return { ranking: r, candidates, decided: decided[0], agree };
  }

  function ranking(id: string, period: string): Segment[] {
    const { ranking: r, candidates, decided, agree } = rankingResult(id, period);
    const names = (es: Entity[]) => es.map((e) => e.label).join(" and ") || "nobody";
    const figure = (c: (typeof candidates)[number]): Segment => ({
      figure: { kind: "variable", name: c.variable, entity: c.top[0]?.id ?? "", display: c.display, value: c.value, rows: c.rows },
    });
    if (decided) return [{ text: `The ${r.label} is ${names(decided.top)}, ${decided.label} (` }, figure(decided), { text: ")." }];
    if (agree) {
      return [
        { text: `${names(candidates[0]!.top)} is the ${r.label} ` },
        ...candidates.flatMap((c, i) => [{ text: `${i ? " and " : ""}${c.label} (` }, figure(c), { text: ")" }]),
        { text: "." },
      ];
    }
    return [
      { text: `Who is the ${r.label} is not decided: ` },
      ...candidates.flatMap((c, i) => [{ text: `${i ? "; " : ""}${c.label} it is ${names(c.top)} (` }, figure(c), { text: ")" }]),
      { text: "." },
    ];
  }

  // --- Who sees what ----------------------------------------------------------------------------

  // A role that no entity has is one viewer (the sales manager); each entity with a role is one.
  const viewers: Viewer[] = [
    ...model.roles.filter((r) => !model.entities.some((e) => e.roles.includes(r.id))).map((r) => ({ id: r.id, label: r.label, role: r.id })),
    ...model.entities.flatMap((e) =>
      e.roles.map((role) => ({ id: e.id, label: `${e.label} (${model.roles.find((r) => r.id === role)!.label.toLowerCase()})`, role, entity: e.id })),
    ),
  ];

  const sees = (viewer: Viewer, template: Template, entityId: string) =>
    template.visibleTo.some((v) => v.role === viewer.role && (v.scope === "All" || viewer.entity === entityId));

  function articles(period: string, viewer?: Viewer) {
    return model.templates.flatMap((t) =>
      entitiesOf(t.about)
        .filter((e) => !viewer || sees(viewer, t, e.id))
        .map((e) => fill(t, e, period))
        // No rows, no article: Sam has no article for August, the month before he started.
        .filter((a) => a.segments.every((s) => "text" in s) || a.segments.some((s) => "figure" in s && s.figure.rows.length > 0)),
    );
  }

  // The variables that the templates ask for: the columns of the data frame, nothing more. For an
  // entity type: the variables of the templates about it, and of the rankings of its entities.
  function variablesUsed(type?: string) {
    const names = new Set<string>();
    for (const t of model.templates) {
      for (const [, content] of t.text.matchAll(blankPattern)) {
        const rankingId = content!.startsWith("ranking:") ? content!.slice("ranking:".length) : undefined;
        if (rankingId) {
          const r = model.rankings.find((x) => x.id === rankingId);
          if (r && (!type || r.of === type)) r.candidates.forEach((c) => names.add(c.variable));
        } else if (type && t.about !== type) continue;
        else if (content!.startsWith("=")) for (const n of content!.slice(1).match(/[A-Z][A-Z0-9_]*/g) ?? []) names.add(n);
        else if (/^[A-Z]/.test(content!)) names.add(content!.split("|")[0]!);
      }
    }
    return [...names];
  }

  // The data frame of an entity type: one row for each entity, one column for each variable that
  // the templates ask for.
  function dataFrame(type: string, period: string) {
    const columns = variablesUsed(type).filter((n) => !("error" in parse(n)));
    return {
      columns,
      rows: entitiesOf(type).map((e) => ({
        entity: e,
        cells: columns.map((n) => {
          const c = cell(n, e.id, period);
          return { name: n, cell: c, shown: display(variable(n), c, false) };
        }),
      })),
    };
  }

  return {
    model,
    parse,
    variable,
    cell,
    display,
    articles,
    rankingResult,
    viewers,
    sourceTable,
    dataFrame,
    variablesUsed,
    entitiesOf,
    monthName: (period: string) => monthName(ym(period)[1]),
  };
}
