import { describe, expect, test } from 'bun:test'
import { Engine, type Evaluation } from '../app/engine'
import { formData, happyPathAnswers, model, option, question, STK } from './helpers'

const engine = new Engine(model)

const DATE = 'Datum des Antrags'
const STATUS = 'Erwerbssituation'
const INCOME = 'Jährliches Erwerbseinkommen, auf dem Sie AHV-Beiträge bezahlen (CHF)'
const TAXABLE = 'Steuerbares Einkommen pro Jahr (CHF)'
const EL = 'Beziehen Sie Ergänzungsleistungen zur AHV/IV?'
const RELATION = 'Wie stehen Sie zum Kind?'
const SUPPORT = 'Kommen Sie in überwiegendem Mass für den Unterhalt des Kindes auf?'
const BIRTH = 'Geburtsdatum des Kindes'
const EDUCATION = 'Welche Ausbildung macht das Kind im Monat des Antrags?'
const START = 'Seit wann ist das Kind in dieser Ausbildung?'
const UNABLE = 'Ist das Kind erwerbsunfähig (Art. 7 ATSG)?'

const employed = {
	[DATE]: '2026-10-19',
	[STATUS]: option(STATUS, 'Arbeitnehmerin'),
	[INCOME]: 60000,
	[RELATION]: option(RELATION, 'Eigenes Kind'),
}

const evaluate = (answers: Record<string, unknown>) => engine.evaluate(formData(answers))
const of = (evaluation: Evaluation, resultType: string) => evaluation.results.filter((result) => result.resultType === STK + resultType)
const asked = (evaluation: Evaluation, title: string) => evaluation.relevant.has(question(title).id)

describe('relevance of questions', () => {
	test('the results and the questions change after each answer of the happy path', async () => {
		const answers: Record<string, unknown> = {}
		const steps: { asked: string[]; values: number }[] = []
		for (const [title, value] of Object.entries(happyPathAnswers())) {
			answers[title] = value
			const evaluation = await evaluate(answers)
			steps.push({
				asked: model.questions.filter((candidate) => evaluation.relevant.has(candidate.id)).map((candidate) => candidate.id),
				values: of(evaluation, 'Value').length,
			})
		}
		expect(steps[0].asked).not.toContain(question(INCOME).id)
		expect(steps[1].asked).toContain(question(INCOME).id)
		expect(steps[3].asked).not.toContain(question(EDUCATION).id)
		expect(steps[4].asked).toContain(question(EDUCATION).id)
		expect(steps[4].asked).not.toContain(question(START).id)
		expect(steps[5].asked).toContain(question(START).id)
		expect(steps.at(-1)!.values).toBe(1)
		expect(steps.slice(0, -1).every((step) => step.values === 0)).toBe(true)
	}, 120_000)

	test('the taxable income is asked only of a person who counts as not gainfully employed', async () => {
		expect(asked(await evaluate(employed), TAXABLE)).toBe(false)
		expect(asked(await evaluate({ ...employed, [INCOME]: 5000 }), TAXABLE)).toBe(true)
		expect(asked(await evaluate({ ...employed, [STATUS]: option(STATUS, 'Nichterwerbstätig') }), INCOME)).toBe(false)
	})

	test('an answer to a question that is no longer relevant is not used', async () => {
		const evaluation = await evaluate({ ...employed, [TAXABLE]: 999999, [EL]: true, [BIRTH]: '2016-05-05' })
		expect(of(evaluation, 'Refusal')).toEqual([])
		expect(evaluation.answers).not.toHaveProperty('antragsteller.steuerbaresEinkommen')
	})

	test('the question about the inability to work is asked only for a child between 16 and 20 without education', async () => {
		const child17 = { ...employed, [BIRTH]: '2009-03-10' }
		expect(asked(await evaluate({ ...child17, [EDUCATION]: option(EDUCATION, 'Keine') }), UNABLE)).toBe(true)
		expect(asked(await evaluate({ ...child17, [EDUCATION]: option(EDUCATION, 'Lehre') }), UNABLE)).toBe(false)
		expect(asked(await evaluate({ ...employed, [BIRTH]: '2016-05-05' }), EDUCATION)).toBe(false)
	})
})

describe('results', () => {
	test('child allowance for a child under 15', async () => {
		const [value] = of(await evaluate({ ...employed, [BIRTH]: '2016-05-05' }), 'Value')
		expect(value.value).toBe('215')
		expect(value.message).toContain('2032-05-31')
		expect(value.sources.map((source) => source.label)).toEqual(['FamZG Art. 3 Abs. 1 Bst. a', 'FamZG Art. 5 Abs. 1'])
	})

	test('education allowance from the month after the 16th birthday for a child still in compulsory school', async () => {
		const [value] = of(await evaluate({ ...employed, [BIRTH]: '2009-03-10', [EDUCATION]: option(EDUCATION, 'Obligatorische') }), 'Value')
		expect(value.message).toContain('ab 2025-04-01')
	})

	test('refusal for a child of 17 without education who can work', async () => {
		const evaluation = await evaluate({ ...employed, [BIRTH]: '2009-03-10', [EDUCATION]: option(EDUCATION, 'Keine'), [UNABLE]: false })
		expect(of(evaluation, 'Refusal')).toHaveLength(1)
		expect(of(evaluation, 'Value')).toEqual([])
		expect(of(evaluation, 'NextStep')).toEqual([])
	})

	test('child allowance until 20 for a child who is unable to work', async () => {
		const [value] = of(await evaluate({ ...employed, [BIRTH]: '2009-03-10', [EDUCATION]: option(EDUCATION, 'Keine'), [UNABLE]: true }), 'Value')
		expect(value.message).toContain('2029-03-31')
	})

	test('refusal for a child older than 25', async () => {
		const evaluation = await evaluate({ ...employed, [BIRTH]: '2000-01-10' })
		expect(of(evaluation, 'Refusal').map((result) => result.sources.map((source) => source.label))).toEqual([
			['FamZG Art. 3 Abs. 1 Bst. a', 'FamZG Art. 3 Abs. 1 Bst. b'],
		])
	})

	test('an income under the minimum income counts as not gainfully employed', async () => {
		const evaluation = await evaluate({ ...employed, [INCOME]: 7559, [TAXABLE]: 30000, [EL]: false, [BIRTH]: '2016-05-05' })
		expect(of(evaluation, 'Value').map((result) => result.value)).toEqual(['7560', '215'])
		const minimum = await evaluate({ ...employed, [INCOME]: 7560, [BIRTH]: '2016-05-05' })
		expect(asked(minimum, TAXABLE)).toBe(false)
		expect(of(minimum, 'Value').map((result) => result.value)).toEqual(['215'])
	})

	test('refusal for a person who is not gainfully employed with a taxable income over the limit', async () => {
		const base = { ...employed, [STATUS]: option(STATUS, 'Nichterwerbstätig'), [EL]: false, [BIRTH]: '2016-05-05' }
		expect(of(await evaluate({ ...base, [TAXABLE]: 45360 }), 'Refusal')).toEqual([])
		const [refusal] = of(await evaluate({ ...base, [TAXABLE]: 45361 }), 'Refusal')
		expect(refusal.message).toContain('45360')
		expect(refusal.sources.map((source) => source.label)).toContain('FamZG Art. 19 Abs. 2')
	})

	test('refusal for supplementary benefits', async () => {
		const evaluation = await evaluate({ ...employed, [STATUS]: option(STATUS, 'Nichterwerbstätig'), [TAXABLE]: 1000, [EL]: true, [BIRTH]: '2016-05-05' })
		expect(of(evaluation, 'Refusal')).toHaveLength(1)
		expect(of(evaluation, 'Value')).toEqual([])
	})

	test('refusals for the relation to the child', async () => {
		expect(of(await evaluate({ ...employed, [RELATION]: option(RELATION, 'Anderes'), [BIRTH]: '2016-05-05' }), 'Refusal')).toHaveLength(1)
		const sibling = { ...employed, [RELATION]: option(RELATION, 'Geschwister'), [BIRTH]: '2016-05-05' }
		expect(of(await evaluate({ ...sibling, [SUPPORT]: false }), 'Refusal')).toHaveLength(1)
		expect(of(await evaluate({ ...sibling, [SUPPORT]: true }), 'Value')).toHaveLength(1)
	})

	test('next step for agriculture', async () => {
		const evaluation = await evaluate({ ...employed, [STATUS]: option(STATUS, 'Erwerbstätig in der Landwirtschaft'), [BIRTH]: '2016-05-05' })
		expect(of(evaluation, 'NextStep').map((result) => result.sources.map((source) => source.label))).toEqual([
			['FamZG Art. 18', 'FamZG Art. 21c Bst. c'],
		])
		expect(of(evaluation, 'Value')).toEqual([])
	})

	test('next step for a date outside the values of the model', async () => {
		const evaluation = await evaluate({ ...employed, [DATE]: '2027-01-04', [BIRTH]: '2016-05-05' })
		expect(of(evaluation, 'NextStep').some((result) => result.message.includes('2026-12-31'))).toBe(true)
	})

	test('the end of February in a leap year', async () => {
		const [value] = of(await evaluate({ ...employed, [BIRTH]: '2012-02-10' }), 'Value')
		expect(value.message).toContain('2028-02-29')
	})
})
