import { describe, expect, test } from 'bun:test'
import { Engine } from '../app/engine'
import { formData, happyPathAnswers, model, question, SOURCE_ART_3_1_B, SOURCE_ART_5_2, STK } from './helpers'

const engine = new Engine(model)

describe('happy path: employed parent, own child in an apprenticeship', () => {
	test('gives the education allowance of at least CHF 268 a month until 2034-03-31, with its sources', async () => {
		const evaluation = await engine.evaluate(formData(happyPathAnswers()))

		const values = evaluation.results.filter((result) => result.resultType === STK + 'Value')
		expect(values).toHaveLength(1)
		const allowance = values[0]
		expect(allowance.message).toStartWith('Ausbildungszulage')
		expect(Number(allowance.value)).toBeGreaterThanOrEqual(268)
		expect(allowance.message).toContain('mindestens CHF 268 pro Monat')
		expect(allowance.message).toContain('längstens bis 2034-03-31')
		expect(allowance.sources.map((source) => source.label).sort()).toEqual([SOURCE_ART_3_1_B, SOURCE_ART_5_2])

		expect(evaluation.results.filter((result) => result.resultType === STK + 'Refusal')).toEqual([])
		expect(evaluation.results.some((result) => result.resultType === STK + 'NextStep')).toBe(true)
		expect(evaluation.issues).toEqual([])
	})

	test('asks only the questions that the answers make relevant', async () => {
		const evaluation = await engine.evaluate(formData(happyPathAnswers()))
		const asked = model.questions.filter((candidate) => evaluation.relevant.has(candidate.id)).map((candidate) => candidate.id)
		expect(asked).toEqual(Object.keys(happyPathAnswers()).map((title) => question(title).id))
	})

	test('each result has a message and at least one source', async () => {
		const evaluation = await engine.evaluate(formData(happyPathAnswers()))
		for (const result of evaluation.results) {
			expect(result.message.length).toBeGreaterThan(0)
			expect(result.message).not.toContain('{?')
			expect(result.sources.length).toBeGreaterThan(0)
		}
	})
})
