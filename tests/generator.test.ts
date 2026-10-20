import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { generate } from '../generator/generate'

const ROOT = join(import.meta.dir, '..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const modelText = read('model/famzg.ttl')
const vocabularyText = read('model/vocabulary.ttl')

describe('generator', () => {
	test('is deterministic, and the generated file is up to date', () => {
		const first = generate(modelText, vocabularyText)
		const second = generate(modelText, vocabularyText)
		expect(JSON.stringify(second)).toBe(JSON.stringify(first))
		expect(JSON.parse(read('app/generated/model.json'))).toEqual(JSON.parse(JSON.stringify(first)))
	})

	test('gives every rule its message type and sources', () => {
		const model = generate(modelText, vocabularyText)
		expect(Object.keys(model.results).length).toBeGreaterThan(0)
		for (const rule of Object.values(model.results)) {
			expect(model.resultTypes.map((type) => type.id)).toContain(rule.resultType)
			expect(rule.sources.length).toBeGreaterThan(0)
		}
	})

	const minimal = (rule: string) => `
		@prefix sh: <http://www.w3.org/ns/shacl#> .
		@prefix dcterms: <http://purl.org/dc/terms/> .
		@prefix stk: <https://almilo.github.io/software-that-knows/vocabulary#> .
		@prefix ex: <http://example.org/> .
		ex:Process a stk:Process ; dcterms:language "en" ; stk:rootShape ex:Root .
		ex:Root a sh:NodeShape ; sh:targetClass ex:Case ; sh:property [ sh:path ex:answer ; sh:name "Answer" ] .
		ex:Rule a sh:SPARQLConstraint ; stk:resultType stk:Value ; sh:select "SELECT $this WHERE { }" ${rule} .`

	test('refuses a rule without a source or without a message', () => {
		expect(() => generate(minimal('; sh:message "Yes"'), vocabularyText)).toThrow('has no dcterms:source')
		expect(() => generate(minimal('; dcterms:source ex:Law'), vocabularyText)).toThrow('has no sh:message')
		expect(Object.keys(generate(minimal('; sh:message "Yes" ; dcterms:source ex:Law'), vocabularyText).results)).toEqual([
			'http://example.org/Rule',
		])
	})
})
