// Browser test of the built app (run with: bun run test:e2e).
import { afterAll, beforeAll, expect, test } from "bun:test";
import { chromium, type Browser, type Page } from "playwright";
import { existsSync } from "node:fs";
import { join } from "node:path";

const dist = join(import.meta.dir, "../../dist");
let server: ReturnType<typeof Bun.serve>;
let browser: Browser;

beforeAll(async () => {
  server = Bun.serve({
    port: 0,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      const file = Bun.file(join(dist, path === "/" ? "index.html" : path));
      return (await file.exists()) ? new Response(file) : new Response("Not found", { status: 404 });
    },
  });
  const executablePath = ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find(existsSync);
  browser = await chromium.launch(executablePath ? { executablePath } : {});
});

afterAll(async () => {
  await browser?.close();
  server?.stop(true);
});

const control = (page: Page, key: string) => page.locator(`.root_properties_${key}`);

test("happy path in the browser", async () => {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://localhost:${server.port}/`);

  await page.getByLabel("Employed (not in agriculture)", { exact: true }).check();
  await control(page, "annualIncome").locator("input").fill("60000");
  await page.getByLabel("Own child (by birth or by adoption)").check();
  await control(page, "birthDate").locator("input").fill("2009-03-10");
  await page.getByLabel(/^Post-compulsory education/).check();
  await control(page, "educationStart").locator("input").fill("2025-08-01");
  await control(page, "applicationDate").locator("input").fill("2026-10-19");

  const value = page.locator('[data-testid="outcome"][data-kind$="#Value"]');
  await value.waitFor({ timeout: 30_000 });
  const text = await value.innerText();
  expect(text).toContain("Education allowance");
  expect(text).toContain("268");
  expect(text).toContain("2034-03-31");
  expect(text).toContain("FamZG Art. 3 para. 1 let. b");
  expect(text).toContain("FamZG Art. 5 para. 2");

  // Questions that are not relevant are not shown.
  expect(await control(page, "taxableIncome").count()).toBe(0);
  expect(await control(page, "incapableOfWork").count()).toBe(0);
  expect(errors).toEqual([]);

  await page.screenshot({ path: join(dist, "happy-path.png"), fullPage: true });
}, 60_000);
