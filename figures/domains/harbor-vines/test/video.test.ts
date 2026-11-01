import { describe, expect, test } from "bun:test";
import { ask } from "../../../engine/ask";
import { createEngine } from "../../../engine/engine";
import { asShown, readModel, readRows } from "../../../generator/generate";

// The example of the video, "Kiraa Engine Explainer": the engine of this demo, with the template as
// the video shows it, writes the articles of the video. The model gives the same sentences, with
// its rule in place of the template's calculation.
const rows = await readRows("harbor-vines");
const model = createEngine(await readModel("harbor-vines"), rows);
const video = createEngine(await readModel("harbor-vines", await asShown("harbor-vines")), rows);
const august = "2026-08";
const september = "2026-09";

const videoArticles = [
  "Anna sold $1,000 in August against the budget of $800. That's 25% above plan.",
  "Tom sold $600 in August against the budget of $500. That's 20% above plan.",
];

describe("August, as in the video", () => {
  test("the template of the video gives the articles of the video", () => {
    expect(video.articles(august).map((a) => a.text)).toEqual(videoArticles);
  });

  test("the model's template starts with the same sentences", () => {
    const texts = model.articles(august).filter((a) => a.template === "AccountManagerArticle").map((a) => a.text);
    expect(texts.map((t) => t.split(" Since ")[0])).toEqual(videoArticles);
  });

  test("the data frame has the numbers of the video", () => {
    const frame = model.dataFrame("AccountManager", august);
    const value = (who: string, name: string) => frame.rows.find((r) => r.entity.id === who)!.cells.find((c) => c.name === name)!.cell.value;
    expect([value("Anna", "SALES_TFY_CP_ACT_VAL"), value("Anna", "SALES_TFY_CP_BUD_VAL")]).toEqual([1000, 800]);
    expect([value("Tom", "SALES_TFY_CP_ACT_VAL"), value("Tom", "SALES_TFY_CP_BUD_VAL")]).toEqual([600, 500]);
  });

  test("one row counts for many facts: Cafe Uno's $300 of cola is in the month and in the year to date", () => {
    for (const name of ["SALES_TFY_CP_ACT_VAL", "SALES_TFY_YTD_ACT_VAL"]) expect(model.cell(name, "Anna", august).rows).toContain("T01");
  });

  test("the top account manager is Anna by both definitions", () => {
    const r = model.rankingResult("TopAccountManager", august);
    expect(r.agree).toBe(true);
    expect(r.candidates.map((c) => c.top.map((e) => e.id))).toEqual([["Anna"], ["Anna"]]);
  });
});

describe("September, invented for this demo", () => {
  test("the template of the video writes a negative result as above plan, and a division by 0 as n/a", () => {
    const texts = video.articles(september).map((a) => a.text);
    expect(texts).toContain("Anna sold $900 in September against the budget of $1,000. That's -10% above plan.");
    expect(texts).toContain("Sam sold $250 in September against the budget of $0. That's n/a above plan.");
  });

  test("the model's rule has words for both signs, and a reason when there is no result", () => {
    const texts = model.articles(september).map((a) => a.text);
    expect(texts.some((t) => t.startsWith("Anna sold $900 in September against the budget of $1,000. That's 10% below plan."))).toBe(true);
    expect(texts.some((t) => t.includes("That's not comparable, because the budget is 0."))).toBe(true);
  });

  test("the two definitions of the top account manager give different answers, and the article says so", () => {
    const sales = model.articles(september).find((a) => a.template === "SalesManagerArticle")!;
    expect(sales.text).toContain("Who is the top account manager is not decided: by sales it is Anna ($900); by result against budget it is Tom (20% above plan).");
  });

  test("Sam has no article for August, the month before his first sale", () => {
    expect(model.articles(august).some((a) => a.entity === "Sam")).toBe(false);
  });
});

describe("every figure", () => {
  test("is the sum of the source rows it names, for a value; the same every time", () => {
    for (const period of [august, september]) {
      for (const a of model.articles(period)) {
        for (const s of a.segments) {
          if (!("figure" in s) || !s.figure.name.endsWith("_VAL")) continue;
          const sum = model.sourceTable.filter((r) => s.figure.rows.includes(r.id)).reduce((n, r) => n + r.amount, 0);
          expect(s.figure.value, `${a.entity} ${s.figure.name}`).toBe(sum);
        }
      }
      const again = createEngine(model.model, rows);
      expect(again.articles(period).map((a) => a.text)).toEqual(model.articles(period).map((a) => a.text));
    }
  });
});

describe("who sees what", () => {
  test("an account manager sees only the article about them; the sales manager sees every article", () => {
    const tom = model.viewers.find((v) => v.id === "Tom")!;
    const manager = model.viewers.find((v) => v.role === "SalesManagerRole")!;
    expect(model.articles(september, tom).map((a) => a.entity)).toEqual(["Tom"]);
    expect(model.articles(september, manager).length).toBe(model.articles(september).length);
  });
});

describe("questions", () => {
  const manager = model.viewers.find((v) => v.role === "SalesManagerRole")!;

  test("the question of the video reads the sales manager's article, with the open decision", () => {
    const r = ask(model, "Who was our top account manager in August and how did they go against budget?", manager, september);
    expect(r.period).toBe(august);
    expect(r.articles.map((a) => a.template)).toEqual(["SalesManagerArticle"]);
    expect(r.notes.join()).toContain("no decision");
  });

  test("with the template of the video, nothing in the model says what top means", () => {
    const r = ask(video, "Who was our top account manager in August?", video.viewers[0]!, august);
    expect(r.notes).toEqual(['The model does not define what "top" means. The LLM gets the articles, and decides it.']);
    expect(r.articles.map((a) => a.entity)).toEqual(["Anna", "Tom"]);
  });

  test.each([
    ["What was our margin in August?", "No article has the margin: there are no source rows for it."],
    ["Which product sold most at Cafe Uno?", "No article is about a product."],
    ["What are the sales for the full year?", "No article has figures for the full year."],
    ["How did we do in October?", "There is no data for October."],
  ])("%s → I do not know", (question, reason) => {
    expect(ask(model, question, manager, september).unknown).toBe(reason);
  });

  test("an account manager does not get the article about another one", () => {
    const tom = model.viewers.find((v) => v.id === "Tom")!;
    expect(ask(model, "How did Anna do?", tom, september).unknown).toBe("You do not see the articles that answer this: Anna.");
  });
});
