// The happy path in a real browser: the person fills in the form, the app
// checks the answers with the SHACL engine and shows the results.

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium, type Browser, type Page } from 'playwright'
import { happyPathAnswers, model, question, SOURCE_ART_3_1_B, SOURCE_ART_5_2, STK } from '../helpers'

const ROOT = join(import.meta.dir, '..', '..')
const CHROMIUM = process.env.CHROMIUM_PATH ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined)

let outdir: string
let server: ReturnType<typeof Bun.serve>
let browser: Browser

beforeAll(async () => {
	outdir = mkdtempSync(join(tmpdir(), 'app-'))
	// The same build as "bun run build".
	const build = Bun.spawnSync(['bun', 'build', join(ROOT, 'app', 'index.html'), '--outdir', outdir, '--minify'], { cwd: ROOT })
	if (!build.success) throw new Error('Build failed: ' + build.stderr.toString())
	server = Bun.serve({
		port: 0,
		async fetch(request) {
			const path = new URL(request.url).pathname
			const file = Bun.file(join(outdir, path === '/' ? 'index.html' : path))
			return (await file.exists()) ? new Response(file) : new Response('Not found', { status: 404 })
		},
	})
	browser = await chromium.launch({ executablePath: CHROMIUM })
})

afterAll(async () => {
	await browser?.close()
	server?.stop()
	if (outdir) rmSync(outdir, { recursive: true, force: true })
})

async function answer(page: Page, title: string, value: unknown) {
	const control = page.locator(`[id="${question(title).scope}-input"]`)
	if (typeof value === 'string' && value.startsWith('http')) {
		await page.locator(`input[type="radio"][value="${value}"]`).click()
		await page.locator(`input[type="radio"][value="${value}"]:checked`).waitFor()
	} else {
		await control.waitFor()
		await control.fill(String(value))
		await control.blur()
	}
}

describe('browser', () => {
	test('the happy path shows the education allowance with its sources', async () => {
		const page = await browser.newPage()
		const errors: string[] = []
		page.on('pageerror', (error) => errors.push(error.message))
		await page.goto(server.url.href)
		await page.locator('.results[data-ready="true"]').waitFor()

		// The questions that are not yet relevant are not shown.
		await expect(page.locator(`[id="${question('Seit wann ist das Kind in dieser Ausbildung?').scope}-input"]`).count()).resolves.toBe(0)

		for (const [title, value] of Object.entries(happyPathAnswers())) {
			await answer(page, title, value)
		}

		const allowance = page.locator(`.result[data-result-type="${STK}Value"]`)
		await allowance.filter({ hasText: '2034-03-31' }).waitFor({ timeout: 60_000 })
		const text = await allowance.innerText()
		expect(text).toContain('mindestens CHF 268 pro Monat')
		expect(text).toContain('längstens bis 2034-03-31')
		const sources = await allowance.locator('.sources > li > a').allTextContents()
		expect(sources.sort()).toEqual([SOURCE_ART_3_1_B, SOURCE_ART_5_2])
		await expect(page.locator(`.result[data-result-type="${STK}Refusal"]`).count()).resolves.toBe(0)

		// Questions that the answers do not make relevant are not shown.
		const hidden = model.questions.filter((candidate) => !Object.keys(happyPathAnswers()).some((title) => question(title).id === candidate.id))
		for (const candidate of hidden) {
			await expect(page.locator(`.control[id="${candidate.scope}"], .control.${candidate.scope.slice(1).replaceAll('/', '_')}`).count()).resolves.toBe(0)
		}
		if (process.env.SCREENSHOT) await page.screenshot({ path: process.env.SCREENSHOT, fullPage: true })
		expect(errors).toEqual([])
	}, 180_000)
})
