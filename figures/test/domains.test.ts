import { expect, test } from "bun:test";
import { createEngine } from "../engine/engine";
import { verifyStructure } from "../engine/verify";
import { asShown, domains, readModel, readRows } from "../generator/generate";
import { verifyModel } from "../generator/verify-model";

// The checks of the knowledge model. Unlike the checks of choices/, they do not all pass: the
// findings are the result of the demo. A change to the model that changes them must change this
// test too. The table of `bun run verify` shows the same results.
test("the model of harbor-vines has the findings of the demo", async () => {
  const result = await verifyModel("harbor-vines");
  expect(result.structure).toEqual([
    "open decision: top account manager: 2 definitions (by sales, by result against budget), no decision",
    "no article: measure margin",
    "no article: time slice full year",
    "no article: entity type customer",
    "no article: entity type product",
    "no data: measure margin has no source rows",
  ]);
  expect(result.periods.map((p) => p.findings)).toEqual([
    [],
    [
      "no value: Sam: SALES_TFY_CP_VAR_PCT: the budget is 0",
      "no value: Sam: SALES_TFY_YTD_VAR_PCT: the budget is 0",
      "decision: top account manager in September: by sales, Anna; by result against budget, Tom",
    ],
  ]);
});

test("the template of the video has a rule that nobody owns, and writes -10% above plan", async () => {
  const result = await verifyModel("harbor-vines", await asShown("harbor-vines"));
  expect(result.structure[0]).toBe(
    'rule in a template: AccountManagerArticle: "(SALES_TFY_CP_ACT_VAL - SALES_TFY_CP_BUD_VAL) / SALES_TFY_CP_BUD_VAL" has no name and no owner',
  );
  expect(result.periods[1]!.findings).toEqual([
    `wording: Anna: "That's -10% above plan."`,
    "no value: Sam: (SALES_TFY_CP_ACT_VAL - SALES_TFY_CP_BUD_VAL) / SALES_TFY_CP_BUD_VAL: division by 0",
  ]);
});

// The grammar of a name, on the lists of every domain.
test.each(await domains())("%s: a name that breaks the grammar is not a variable", async (name) => {
  const model = await readModel(name);
  const engine = createEngine(model, await readRows(name));
  expect(engine.parse("SALES_TFY_CP_ACT")).toEqual({ error: "SALES_TFY_CP_ACT is not a variable: it has 4 parts, not 5" });
  expect(engine.parse("SALES_TFY_XX_ACT_VAL")).toEqual({ error: 'SALES_TFY_XX_ACT_VAL is not a variable: part 3, "XX", is not a time slice' });
  expect(engine.parse("SALES_TFY_CP_VAR_VAL")).toEqual({ error: "SALES_TFY_CP_VAR_VAL is not a variable: a comparison is a percent" });

  const broken = { ...model, templates: [{ ...model.templates[0]!, text: "{entity} sold {SALES_TFY_MONTH_ACT_VAL}." }] };
  expect(verifyStructure(createEngine(broken, []))).toContain('grammar: SALES_TFY_MONTH_ACT_VAL is not a variable: part 3, "MONTH", is not a time slice');
});
