// The happy path in the real browser app: fill the form, read the results.
// Run: bun run build && bun e2e/happy-path.e2e.ts
import { chromium, type Page } from "playwright-core";
import { serve } from "./serve.ts";

const server = serve();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium" });
const page = await browser.newPage();
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));

const idle = (p: Page) => p.waitForSelector('section.results[aria-busy="false"]');
const control = (p: Page, label: string) => p.locator(".control", { hasText: label });

try {
  await page.goto(server.url.href);
  await idle(page);
  await control(page, "Date of the application").locator("input").fill("2026-10-19");
  await idle(page);
  await control(page, "What is your work status?").getByLabel("Employee", { exact: true }).check();
  await idle(page);
  await control(page, "annual income from work").locator("input").fill("60000");
  await idle(page);
  await control(page, "Who is the child to you?").getByLabel("My own child (also adopted)").check();
  await idle(page);
  await control(page, "Date of birth of the child").locator("input").fill("2009-03-10");
  await idle(page);
  await control(page, "Is the child in an education after the compulsory school?").getByLabel("Yes").check();
  await idle(page);
  await control(page, "When did this education begin?").locator("input").fill("2025-08-01");
  await idle(page);

  const value = page.locator("article.result.value");
  const text = await value.innerText();
  const expected = ["Education allowance: at least CHF 268 a month", "until 2034-03-31 at the latest", "FamZG Art. 3 para. 1 b", "FamZG Art. 5 para. 2"];
  const missing = expected.filter((e) => !text.includes(e));
  if (process.env.SCREENSHOT) await page.screenshot({ path: process.env.SCREENSHOT, fullPage: true });
  if (missing.length > 0 || errors.length > 0) {
    console.error("FAIL", { missing, errors, text });
    process.exitCode = 1;
  } else {
    console.log("PASS: browser happy path\n" + text);
  }
} finally {
  await browser.close();
  server.stop();
}
