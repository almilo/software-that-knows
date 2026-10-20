// All knowledge of the law is in the model. This test searches the code of the
// generator and of the app for words and numbers of the law.

import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { Parser } from 'n3'

const ROOT = join(import.meta.dir, '..')
const MODEL = join(ROOT, 'model', 'famzg.ttl')
const CODE_DIRECTORIES = ['generator', 'app']
const CODE_EXTENSIONS = ['.ts', '.tsx', '.js', '.html', '.css']
const GENERATED = join(ROOT, 'app', 'generated')
const SH_SELECT = 'http://www.w3.org/ns/shacl#select'
const TEXT_TYPES = ['http://www.w3.org/2001/XMLSchema#string', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString']

// Words of the domain in English and German, in addition to the words that come from the model.
const DOMAIN_WORDS = [
	'allowance', 'allowances', 'child', 'children', 'education', 'apprentice', 'apprenticeship', 'income',
	'employed', 'employee', 'employer', 'employment', 'pension', 'canton', 'cantonal', 'birth', 'families',
	'famzg', 'ahv', 'ahvg', 'atsg', 'flg', 'zulage', 'resultType', 'kinder', 'ausbildung', 'lehre', 'franken', 'chf',
]
// Numbers that every program uses.
const GENERIC_NUMBERS = new Set(['0', '1'])

function codeFiles(directory: string): string[] {
	return readdirSync(directory).flatMap((name) => {
		const path = join(directory, name)
		if (path === GENERATED) return []
		if (statSync(path).isDirectory()) return codeFiles(path)
		return CODE_EXTENSIONS.some((extension) => name.endsWith(extension)) ? [path] : []
	})
}

/** Words of an identifier or a text: split at non-letters and at camel case, in lower case. */
function words(text: string): string[] {
	return text
		.replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2')
		.split(/[^\p{L}]+/u)
		.map((word) => word.toLowerCase())
		.filter((word) => word.length > 0)
}

/** Numbers that stand alone: not part of an identifier, a CSS unit or a hex colour. */
function numbers(text: string): string[] {
	return [...text.replace(/https?:\/\/\S+/g, " ").matchAll(/(?<![\w.#])\d+(?:\.\d+)?(?![\w.%])/g)].map((match) => String(Number(match[0])))
}

function lawVocabulary() {
	const quads = new Parser().parse(readFileSync(MODEL, 'utf8'))
	const lawWords = new Set<string>(DOMAIN_WORDS)
	const lawNumbers = new Set<string>()
	// Words of the standards and of the vocabulary (for example "shape" in sh:NodeShape) are not words of the law.
	const standardWords = new Set<string>()
	// The namespace of the law: the namespace of the process that the model describes.
	const process = quads.find((quad) => quad.object.value === 'https://almilo.github.io/software-that-knows/vocabulary#Process')!
	const namespace = process.subject.value.slice(0, process.subject.value.lastIndexOf('#') + 1)
	for (const quad of quads) {
		for (const term of [quad.subject, quad.predicate, quad.object]) {
			if (term.termType === 'NamedNode' && !term.value.startsWith(namespace)) {
				for (const word of words(term.value.slice(Math.max(term.value.lastIndexOf('#'), term.value.lastIndexOf('/')) + 1))) standardWords.add(word)
			}
			if (term.termType === 'NamedNode' && term.value.startsWith(namespace)) {
				const localName = term.value.slice(namespace.length)
				lawWords.add(localName.toLowerCase())
				for (const word of words(localName)) if (word.length >= 4) lawWords.add(word)
			}
		}
		if (quad.object.termType === 'Literal') {
			for (const number of numbers(quad.object.value)) lawNumbers.add(number)
			if (/^-?\d+(\.\d+)?$/.test(quad.object.value)) lawNumbers.add(String(Number(quad.object.value)))
			if (quad.predicate.value !== SH_SELECT && TEXT_TYPES.includes(quad.object.datatype.value)) {
				// Without the variables of message templates, for example {?value}.
				for (const word of words(quad.object.value.replace(/\{[?$]\w+\}/g, ' '))) if (word.length >= 4) lawWords.add(word)
			}
		}
	}
	for (const number of GENERIC_NUMBERS) lawNumbers.delete(number)
	for (const word of standardWords) if (!DOMAIN_WORDS.includes(word)) lawWords.delete(word)
	return { lawWords, lawNumbers }
}

describe('no knowledge of the law in the generator and the app', () => {
	const { lawWords, lawNumbers } = lawVocabulary()
	const files = CODE_DIRECTORIES.flatMap((directory) => codeFiles(join(ROOT, directory)))

	test('the search covers the code and the law', () => {
		expect(files.map((file) => relative(ROOT, file))).toContain('generator/generate.ts')
		expect(files.map((file) => relative(ROOT, file))).toContain('app/engine.ts')
		expect(files.map((file) => relative(ROOT, file))).toContain('app/App.tsx')
		for (const word of ['ausbildungszulage', 'kinderzulage', 'altersjahr', 'erwerbseinkommen']) expect(lawWords).toContain(word)
		for (const number of ['215', '268', '16', '25', '1260', '1.5', '0.5', '12']) expect(lawNumbers).toContain(number)
	})

	test('the search finds a word and a number of the law in a sample of code', () => {
		const sample = 'const minimumRate = 268 // Ausbildungszulage, see Art. 5\nconst educationAllowance = true'
		expect([...new Set(words(sample))].filter((word) => lawWords.has(word))).toEqual(['ausbildungszulage', 'education', 'allowance'])
		expect(numbers(sample).filter((number) => lawNumbers.has(number))).toEqual(['268', '5'])
	})

	for (const file of files) {
		test(`${relative(ROOT, file)} contains no word and no number of the law`, () => {
			const text = readFileSync(file, 'utf8')
			const foundWords = [...new Set(words(text))].filter((word) => lawWords.has(word))
			const foundNumbers = [...new Set(numbers(text))].filter((number) => lawNumbers.has(number))
			expect({ words: foundWords, numbers: foundNumbers }).toEqual({ words: [], numbers: [] })
		})
	}
})
