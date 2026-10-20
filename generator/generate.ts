// Deterministic generator: turns a knowledge model (SHACL shapes, SHACL-SPARQL
// constraints and the stk: vocabulary) into the files that the app needs.
// It knows the W3C standards and the vocabulary. It does not know the law.
//
// Usage: bun generator/generate.ts <model.ttl> <vocabulary.ttl> <output directory>

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DataFactory, Parser, Store, Writer, type Quad_Object, type Term } from 'n3'
import type { AppModel, LocalizedLabels, QuestionInfo, ResultInfo, SourceInfo } from '../app/model-types'

const { namedNode } = DataFactory

const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
const RDFS = 'http://www.w3.org/2000/01/rdf-schema#'
const XSD = 'http://www.w3.org/2001/XMLSchema#'
const SH = 'http://www.w3.org/ns/shacl#'
const DCTERMS = 'http://purl.org/dc/terms/'
const STK = 'https://almilo.github.io/software-that-knows/vocabulary#'

const rdf = (name: string) => namedNode(RDF + name)
const rdfs = (name: string) => namedNode(RDFS + name)
const sh = (name: string) => namedNode(SH + name)
const dcterms = (name: string) => namedNode(DCTERMS + name)
const stk = (name: string) => namedNode(STK + name)

const NUMBER_TYPES: Record<string, 'number' | 'integer'> = {
	[XSD + 'decimal']: 'number',
	[XSD + 'double']: 'number',
	[XSD + 'float']: 'number',
	[XSD + 'integer']: 'integer',
	[XSD + 'int']: 'integer',
	[XSD + 'nonNegativeInteger']: 'integer',
}

class ModelError extends Error {}

export function generate(modelText: string, vocabularyText: string): AppModel {
	const store = new Store()
	store.addQuads(new Parser().parse(modelText))
	store.addQuads(new Parser().parse(vocabularyText))

	const objects = (subject: Term, predicate: Term) => store.getObjects(subject, predicate, null)
	const object = (subject: Term, predicate: Term): Quad_Object | undefined => objects(subject, predicate)[0]
	const subjectsOfType = (type: Term) => store.getSubjects(rdf('type'), type, null)

	const processes = subjectsOfType(stk('Process'))
	if (processes.length !== 1) throw new ModelError('The model must contain exactly one stk:Process.')
	const processNode = processes[0]
	const language = object(processNode, dcterms('language'))?.value ?? ''

	// A literal in the language of the process, else a literal without language, else any literal.
	const text = (subject: Term, predicate: Term): string | undefined => {
		const literals = objects(subject, predicate).filter((term) => term.termType === 'Literal')
		const pick =
			literals.find((term) => term.termType === 'Literal' && term.language === language) ??
			literals.find((term) => term.termType === 'Literal' && term.language === '') ??
			literals[0]
		return pick?.value
	}
	const texts = (subject: Term, predicate: Term): string[] =>
		objects(subject, predicate)
			.filter((term) => term.termType === 'Literal' && (term.language === language || term.language === ''))
			.map((term) => term.value)
	const order = (subject: Term): number => Number(object(subject, sh('order'))?.value ?? Number.MAX_SAFE_INTEGER)
	const byOrder = (a: Term, b: Term) => order(a) - order(b) || a.value.localeCompare(b.value)
	const list = (head: Term | undefined): Term[] => {
		const items: Term[] = []
		let node = head
		while (node && node.value !== RDF + 'nil') {
			const first = object(node, rdf('first'))
			if (!first) throw new ModelError(`Malformed RDF list at ${node.value}.`)
			items.push(first)
			node = object(node, rdf('rest'))
		}
		return items
	}
	const localName = (iri: string) => iri.slice(Math.max(iri.lastIndexOf('#'), iri.lastIndexOf('/')) + 1)

	// --- Sources -------------------------------------------------------------

	const sources: Record<string, SourceInfo> = {}
	const sourceIds = (subject: Term): string[] =>
		objects(subject, dcterms('source')).map((source) => {
			if (!sources[source.value]) {
				sources[source.value] = {
					id: source.value,
					label: text(source, rdfs('label')) ?? localName(source.value),
					url: object(source, rdfs('seeAlso'))?.value ?? (source.termType === 'NamedNode' ? source.value : undefined),
					quote: text(source, dcterms('description')),
				}
			}
			return source.value
		}).sort((a, b) => sources[a].label.localeCompare(sources[b].label, undefined, { numeric: true }))
	const interpretationIds = (subject: Term) => objects(subject, stk('interpretation')).map((term) => term.value)

	// --- Questions: JSON Schema, UI schema, JSON-LD context ------------------

	const rootShape = object(processNode, stk('rootShape'))
	if (!rootShape) throw new ModelError('The stk:Process has no stk:rootShape.')
	const rootClass = object(rootShape, sh('targetClass'))
	if (!rootClass) throw new ModelError('The root shape has no sh:targetClass.')

	const yes = text(stk('trueLabel'), rdfs('label')) ?? 'true'
	const no = text(stk('falseLabel'), rdfs('label')) ?? 'false'
	const context: Record<string, unknown> = {}
	const questions: QuestionInfo[] = []

	const addTerm = (key: string, definition: Record<string, string>) => {
		const existing = context[key] as Record<string, string> | undefined
		if (existing && existing['@id'] !== definition['@id']) {
			throw new ModelError(`Two paths have the same local name "${key}": ${existing['@id']} and ${definition['@id']}.`)
		}
		context[key] = definition
	}

	const objectSchema = (nodeShape: Term, path: string[]): Record<string, unknown> => {
		const properties: Record<string, unknown> = {}
		const propertyShapes = objects(nodeShape, sh('property')).sort(byOrder)
		for (const propertyShape of propertyShapes) {
			const pathTerm = object(propertyShape, sh('path'))
			if (!pathTerm || pathTerm.termType !== 'NamedNode') {
				throw new ModelError(`The question ${propertyShape.value} must have an IRI as sh:path.`)
			}
			const key = localName(pathTerm.value)
			const keyPath = [...path, key]
			const title = text(propertyShape, sh('name'))
			const description = text(propertyShape, sh('description'))
			const nested = object(propertyShape, sh('node'))

			if (nested) {
				addTerm(key, { '@id': pathTerm.value })
				properties[key] = { type: 'object', title, ...objectSchema(nested, keyPath) }
				continue
			}

			const schema: Record<string, unknown> = { title }
			if (description) schema.description = description
			const datatype = object(propertyShape, sh('datatype'))?.value
			const options = list(object(propertyShape, sh('in')))
			let radio = false

			if (options.length > 0) {
				schema.type = 'string'
				schema.oneOf = options.map((option) => ({ const: option.value, title: text(option, rdfs('label')) ?? localName(option.value) }))
				addTerm(key, { '@id': pathTerm.value, '@type': '@id' })
				radio = true
			} else if (datatype === XSD + 'boolean') {
				schema.type = 'boolean'
				// A select, not radio buttons: the radio renderer uses the value as element id, and
				// true and false would then be the same id in two questions.
				schema.oneOf = [
					{ const: true, title: yes },
					{ const: false, title: no },
				]
				addTerm(key, { '@id': pathTerm.value, '@type': datatype })
			} else if (datatype === XSD + 'date') {
				schema.type = 'string'
				schema.format = 'date'
				addTerm(key, { '@id': pathTerm.value, '@type': datatype })
			} else if (datatype && NUMBER_TYPES[datatype]) {
				schema.type = NUMBER_TYPES[datatype]
				const minimum = object(propertyShape, sh('minInclusive'))
				const maximum = object(propertyShape, sh('maxInclusive'))
				if (minimum) schema.minimum = Number(minimum.value)
				if (maximum) schema.maximum = Number(maximum.value)
				addTerm(key, { '@id': pathTerm.value, '@type': datatype })
			} else if (!datatype || datatype === XSD + 'string') {
				schema.type = 'string'
				addTerm(key, { '@id': pathTerm.value })
			} else {
				throw new ModelError(`The datatype ${datatype} of ${propertyShape.value} is not supported.`)
			}

			properties[key] = schema
			const condition = object(propertyShape, stk('relevantIf'))
			if (condition && !store.has(DataFactory.quad(condition as any, rdf('type'), sh('NodeShape')))) {
				throw new ModelError(`The condition ${condition.value} of ${propertyShape.value} must be a sh:NodeShape.`)
			}
			questions.push({
				id: propertyShape.value,
				path: keyPath,
				scope: '#' + keyPath.map((part) => `/properties/${part}`).join(''),
				radio,
				group: object(propertyShape, sh('group'))?.value,
				order: order(propertyShape),
				condition: condition?.value,
				interpretations: [...interpretationIds(propertyShape), ...options.flatMap(interpretationIds)],
			})
		}
		return { properties }
	}

	const schema = { type: 'object', ...objectSchema(rootShape, []) }

	// Groups in the order of sh:order; questions in a group in the order of sh:order.
	const groupIds = [...new Set(questions.map((question) => question.group))]
	const groupTerms = groupIds.filter((id): id is string => !!id).map((id) => namedNode(id)).sort(byOrder)
	const controls = (group: string | undefined) =>
		questions
			.filter((question) => question.group === group)
			.sort((a, b) => a.order - b.order)
			.map((question) => ({ type: 'Control', scope: question.scope, ...(question.radio ? { options: { format: 'radio', orientation: 'vertical' } } : {}) }))
	const uischema = {
		type: 'VerticalLayout',
		elements: [
			...groupTerms.map((group) => ({ type: 'Group', label: text(group, rdfs('label')) ?? localName(group.value), elements: controls(group.value) })),
			...(groupIds.includes(undefined) ? controls(undefined) : []),
		],
	}

	// --- Rules and results ----------------------------------------------------

	const results: Record<string, ResultInfo> = {}
	for (const quad of store.getQuads(null, stk('resultType'), null, null)) {
		const constraint = quad.subject
		if (!text(constraint, sh('message'))) throw new ModelError(`The rule ${constraint.value} has no sh:message.`)
		const ruleSources = sourceIds(constraint)
		if (ruleSources.length === 0) throw new ModelError(`The rule ${constraint.value} has no dcterms:source.`)
		results[constraint.value] = {
			id: constraint.value,
			resultType: quad.object.value,
			order: order(constraint),
			sources: ruleSources,
			interpretations: interpretationIds(constraint),
		}
	}
	const resultTypes = subjectsOfType(stk('ResultType'))
		.sort(byOrder)
		.map((resultType) => ({ id: resultType.value, label: text(resultType, rdfs('label')) ?? localName(resultType.value), order: order(resultType) }))

	const interpretations = subjectsOfType(stk('Interpretation'))
		.sort((a, b) => a.value.localeCompare(b.value))
		.map((node) => ({
			id: node.value,
			label: text(node, rdfs('label')) ?? localName(node.value),
			comment: text(node, rdfs('comment')),
			sources: sourceIds(node),
		}))

	const openPoints = subjectsOfType(stk('OpenPoint'))
		.sort((a, b) => a.value.localeCompare(b.value))
		.map((node) => ({
			id: node.value,
			label: text(node, rdfs('label')) ?? localName(node.value),
			comment: text(node, rdfs('comment')),
			sources: sourceIds(node),
			deactivatedRules: store
				.getSubjects(stk('openPoint'), node, null)
				.filter((shape) => object(shape, sh('deactivated'))?.value === 'true')
				.map((shape) => shape.value),
		}))

	// --- Parameters: copied into the data graph -------------------------------

	const parameterNodes = subjectsOfType(stk('Parameter')).sort((a, b) => a.value.localeCompare(b.value))
	const factsWriter = new Writer({ format: 'N-Triples' })
	const parameters = parameterNodes.map((node) => {
		const value = object(node, rdf('value'))
		if (!value) throw new ModelError(`The parameter ${node.value} has no rdf:value.`)
		factsWriter.addQuad(node as any, rdf('type'), stk('Parameter'))
		factsWriter.addQuad(node as any, rdf('value'), value)
		return {
			id: node.value,
			label: text(node, rdfs('label')) ?? localName(node.value),
			value: value.value,
			unit: text(node, stk('unit')),
			sources: sourceIds(node),
			interpretations: interpretationIds(node),
		}
	})
	let facts = ''
	factsWriter.end((error, output) => {
		if (error) throw error
		facts = output
	})

	const labels: LocalizedLabels = {
		questions: text(stk('Question'), rdfs('label')) ?? '',
		results: text(stk('Result'), rdfs('label')) ?? '',
		noResults: text(stk('Result'), rdfs('comment')) ?? '',
		sources: text(dcterms('source'), rdfs('label')) ?? '',
		interpretation: text(stk('Interpretation'), rdfs('label')) ?? '',
		openPoint: text(stk('OpenPoint'), rdfs('label')) ?? '',
		outOfScope: text(stk('outOfScope'), rdfs('label')) ?? '',
		parameters: text(stk('Parameter'), rdfs('label')) ?? '',
	}

	return {
		process: {
			id: processNode.value,
			title: text(processNode, dcterms('title')) ?? '',
			description: text(processNode, dcterms('description')),
			language,
			sources: sourceIds(processNode),
			outOfScope: texts(processNode, stk('outOfScope')).sort(),
		},
		root: { class: rootClass.value },
		schema,
		uischema,
		context,
		questions,
		results,
		resultTypes,
		sources,
		interpretations,
		openPoints,
		parameters,
		labels,
		shapes: modelText,
		facts,
	}
}

if (import.meta.main) {
	const [, , modelPath, vocabularyPath, outputDirectory] = process.argv
	if (!modelPath || !vocabularyPath || !outputDirectory) {
		console.error('Usage: bun generator/generate.ts <model.ttl> <vocabulary.ttl> <output directory>')
		process.exit(1)
	}
	const model = generate(readFileSync(modelPath, 'utf8'), readFileSync(vocabularyPath, 'utf8'))
	mkdirSync(outputDirectory, { recursive: true })
	const output = join(outputDirectory, 'model.json')
	writeFileSync(output, JSON.stringify(model, null, '\t') + '\n')
	console.log(`Wrote ${output}: ${model.questions.length} questions, ${Object.keys(model.results).length} rules, ${model.parameters.length} parameters.`)
}
