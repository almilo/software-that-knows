// The checks of a model. Structure: what the model says, in any month. Behaviour: what its
// articles say in one month.
//   structure
//     grammar          a blank whose name is not a variable: not five parts, or a part that is not
//                      in its list;
//     unknown blank    a blank that the engine does not know, or a ranking that is not in the model;
//     rule in a        a calculation in a template: a rule without a name and without an owner, which
//     template         no other template can use, and which the checks cannot see into;
//     no owner         a comparison (a rule of the model) without an owner;
//     open decision    a ranking with more than one definition and no decision;
//     no article       a concept of the lists, or an entity type, that no template uses: a question
//                      about it has no article to answer from;
//     no data          a measure without source rows.
//   behaviour (one month)
//     no value         a figure of an article without a value, and why;
//     wording          a calculation that gives a negative number: the words around it are the same
//                      for any sign, such as "-10% above plan";
//     decision         an open ranking whose definitions give different answers this month.
import { blankPattern, type Engine } from "./engine";

export function verifyStructure(engine: Engine) {
  const { model } = engine;
  const findings: string[] = [];
  const used = new Set<string>();

  for (const t of model.templates) {
    for (const [, content] of t.text.matchAll(blankPattern)) {
      if (["entity", "period", "yearStart"].includes(content!)) continue;
      if (content!.startsWith("ranking:")) {
        const id = content!.slice("ranking:".length);
        if (!model.rankings.some((r) => r.id === id)) findings.push(`unknown blank: ${t.id}: {${content}}: there is no ranking ${id}`);
        continue;
      }
      if (content!.startsWith("=")) {
        findings.push(`rule in a template: ${t.id}: "${content!.slice(1).split("|")[0]!.trim()}" has no name and no owner`);
        continue;
      }
      if (!/^[A-Z]/.test(content!)) findings.push(`unknown blank: ${t.id}: {${content}}`);
    }
  }

  const names = [...engine.variablesUsed(), ...model.rankings.flatMap((r) => (r.decision ? [r.decision] : []))];
  for (const name of new Set(names)) {
    const parsed = engine.parse(name);
    if ("error" in parsed) findings.push(`grammar: ${parsed.error}`);
    else for (const p of model.partOrder) used.add(`${p.key} ${parsed.variable[p.key].code}`);
  }
  // A comparison reads two other scenarios: they are used too.
  for (const s of model.parts.scenario) {
    if (s.comparison && used.has(`scenario ${s.code}`)) [s.comparison.of, s.comparison.against].forEach((c) => used.add(`scenario ${c}`));
    if (s.comparison && used.has(`scenario ${s.code}`)) used.add(`suffix ${s.comparison.inputSuffix}`);
  }

  for (const s of model.parts.scenario) if (s.comparison && !s.comparison.owner) findings.push(`no owner: scenario ${s.label} is a rule without an owner`);

  for (const r of model.rankings) {
    if (!r.decision && r.candidates.length > 1) {
      findings.push(`open decision: ${r.label}: ${r.candidates.length} definitions (${r.candidates.map((c) => c.label).join(", ")}), no decision`);
    }
  }

  for (const p of model.partOrder) {
    for (const c of model.parts[p.key]) if (!used.has(`${p.key} ${c.code}`)) findings.push(`no article: ${p.label} ${c.label}`);
  }
  for (const t of model.entityTypes) if (!model.templates.some((x) => x.about === t.id)) findings.push(`no article: entity type ${t.label}`);

  for (const m of model.parts.measure) {
    if (!engine.sourceTable.some((r) => r.measure === m.sourceMeasure)) findings.push(`no data: measure ${m.label} has no source rows`);
  }
  return findings;
}

export function verifyPeriod(engine: Engine, period: string) {
  const findings: string[] = [];
  for (const a of engine.articles(period)) {
    for (const s of a.segments) {
      if (!("figure" in s)) continue;
      const f = s.figure;
      if (f.value === undefined && f.reason) findings.push(`no value: ${a.entityLabel}: ${f.name}: ${f.reason}`);
      if (f.kind === "calculation" && f.value !== undefined && f.value < 0) {
        findings.push(`wording: ${a.entityLabel}: "${sentence(a.text, f.display)}"`);
      }
    }
  }
  for (const r of engine.model.rankings) {
    const result = engine.rankingResult(r.id, period);
    if (!result.decided && !result.agree) {
      const answers = result.candidates.map((c) => `${c.label}, ${c.top.map((e) => e.label).join(" and ")}`).join("; ");
      findings.push(`decision: ${r.label} in ${engine.monthName(period)}: ${answers}`);
    }
  }
  return [...new Set(findings)];
}

// The sentence of a text that holds a part of it.
function sentence(text: string, part: string) {
  return text.split(/(?<=\.)\s+/).find((s) => s.includes(part)) ?? text;
}
