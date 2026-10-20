// Checks the answers against the knowledge model with the SHACL engine.
// The engine knows SHACL, JSON-LD and the generated model file. It does not know the law.

import jsonld from 'jsonld'
import { DataFactory, Parser, Store, type Quad } from 'n3'
import Validator from 'shacl-engine/Validator.js'
import { targetResolvers, validations } from 'shacl-engine/sparql.js'
import type { AppModel, QuestionInfo, ResultInfo, SourceInfo } from './model-types'

export type Answers = Record<string, unknown>

/** The IRI of the root node of the answers in the data graph. */
export const ROOT_IRI = 'urn:x-software-that-knows:answers'

export interface Result {
	rule: string
	resultType: string
	message: string
	value?: string
	order: number
	sources: SourceInfo[]
	interpretations: string[]
}

export interface AnswerIssue {
	question?: string
	message: string
}

export interface Evaluation {
	/** IDs of the questions that the model makes relevant to the answers. */
	relevant: Set<string>
	/** The answers without the answers to questions that are not relevant. */
	answers: Answers
	results: Result[]
	issues: AnswerIssue[]
}

const isEmpty = (value: unknown) => value === undefined || value === null || value === ''

/** Copies only the answers to the given questions. */
export function pruneAnswers(answers: Answers, questions: QuestionInfo[]): Answers {
	const pruned: Answers = {}
	for (const question of questions) {
		let source: unknown = answers
		for (const key of question.path) source = (source as Record<string, unknown> | undefined)?.[key]
		if (isEmpty(source)) continue
		let target = pruned
		for (const key of question.path.slice(0, -1)) {
			target[key] = (target[key] as Answers | undefined) ?? {}
			target = target[key] as Answers
		}
		target[question.path[question.path.length - 1]] = source
	}
	return pruned
}

/** Replaces N-Triples literals in a message (for example "42"^^<…#integer>) with their lexical form. */
export function plainMessage(message: string): string {
	return message.replace(/"((?:[^"\\]|\\.)*)"(?:\^\^<[^>]*>|@[A-Za-z-]+)?/g, (_match, lexical: string) =>
		lexical.replace(/\\(.)/g, '$1'),
	)
}

export class Engine {
	private readonly validator: Validator
	private readonly facts: Quad[]
	private readonly questionsByShape: Map<string, QuestionInfo>

	constructor(private readonly model: AppModel) {
		const shapes = new Store(new Parser().parse(model.shapes))
		this.validator = new Validator(shapes, { factory: DataFactory, validations, targetResolvers })
		this.facts = new Parser().parse(model.facts)
		this.questionsByShape = new Map(model.questions.map((question) => [question.id, question]))
	}

	/** Converts the answers (JSON Forms data) to RDF with the generated JSON-LD context. */
	async toDataset(answers: Answers): Promise<Store> {
		const document = { '@context': this.model.context, '@id': ROOT_IRI, '@type': this.model.root.class, ...answers }
		const nquads = (await jsonld.toRDF(document as jsonld.JsonLdDocument, { format: 'application/n-quads' })) as unknown as string
		const store = new Store(new Parser({ format: 'N-Quads' }).parse(nquads))
		store.addQuads(this.facts)
		return store
	}

	private async conforms(dataset: Store, shape: string): Promise<boolean> {
		const report = await this.validator.validate(
			{ dataset, terms: [DataFactory.namedNode(ROOT_IRI)] },
			[{ terms: [DataFactory.namedNode(shape)] }],
		)
		return report.conforms
	}

	/** Finds the relevant questions. A question is relevant if the pruned answers conform to its condition. */
	async relevance(answers: Answers): Promise<{ relevant: Set<string>; answers: Answers }> {
		const questions = this.model.questions
		let relevant = new Set(questions.map((question) => question.id))
		// Repeat until the set does not change: an answer that is not relevant cannot make another question relevant.
		for (const _ of questions) {
			const pruned = pruneAnswers(answers, questions.filter((question) => relevant.has(question.id)))
			const dataset = await this.toDataset(pruned)
			const next = new Set<string>()
			for (const question of questions) {
				if (!question.condition || (await this.conforms(dataset, question.condition))) next.add(question.id)
			}
			const stable = next.size === relevant.size && [...next].every((id) => relevant.has(id))
			relevant = next
			if (stable) break
		}
		return { relevant, answers: pruneAnswers(answers, questions.filter((question) => relevant.has(question.id))) }
	}

	async evaluate(answers: Answers): Promise<Evaluation> {
		const { relevant, answers: pruned } = await this.relevance(answers)
		const dataset = await this.toDataset(pruned)
		const report = await this.validator.validate({ dataset })
		const typeOrder = new Map(this.model.resultTypes.map((resultType) => [resultType.id, resultType.order]))
		const results: Result[] = []
		const issues: AnswerIssue[] = []

		for (const result of report.results) {
			const messages: { value: string; language?: string }[] = result.message ?? []
			const message = plainMessage(
				(messages.find((literal) => literal.language === this.model.process.language) ?? messages[0])?.value ?? '',
			)
			const rule: ResultInfo | undefined = (result.source ?? []).map((term: { value: string }) => this.model.results[term.value]).find(Boolean)
			if (!rule) {
				const question = this.questionsByShape.get(result.shape?.ptr?.term?.value)
				issues.push({ question: question?.id, message })
				continue
			}
			const value = result.value?.terms?.[0]
			results.push({
				rule: rule.id,
				resultType: rule.resultType,
				message,
				value: value && value.termType === 'Literal' ? value.value : undefined,
				order: rule.order,
				sources: rule.sources.map((id) => this.model.sources[id]),
				interpretations: rule.interpretations,
			})
		}

		results.sort(
			(a, b) => (typeOrder.get(a.resultType) ?? Infinity) - (typeOrder.get(b.resultType) ?? Infinity) || a.order - b.order,
		)
		return { relevant, answers: pruned, results, issues }
	}
}
