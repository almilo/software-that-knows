// Test helpers: find questions and answer options in the generated model by their labels,
// as a person who uses the form does.

import modelFile from '../app/generated/model.json'
import type { AppModel, QuestionInfo } from '../app/model-types'

export const model = modelFile as unknown as AppModel

export function question(title: string): QuestionInfo {
	const found = model.questions.find((candidate) => schemaAt(candidate.path).title === title)
	if (!found) throw new Error(`No question with the title "${title}".`)
	return found
}

export function schemaAt(path: string[]): Record<string, any> {
	let schema: Record<string, any> = model.schema
	for (const key of path) schema = schema.properties[key]
	return schema
}

/** The value of the answer option whose label starts with the given text. */
export function option(questionTitle: string, label: string): string | boolean {
	const choices: { const: string | boolean; title: string }[] = schemaAt(question(questionTitle).path).oneOf
	const found = choices.find((choice) => choice.title.startsWith(label))
	if (!found) throw new Error(`No option "${label}" for "${questionTitle}".`)
	return found.const
}

/** Builds the form data (as JSON Forms holds it) from answers given by question titles. */
export function formData(answers: Record<string, unknown>): Record<string, unknown> {
	const data: Record<string, any> = {}
	for (const [title, value] of Object.entries(answers)) {
		const path = question(title).path
		let target = data
		for (const key of path.slice(0, -1)) target = target[key] ??= {}
		target[path[path.length - 1]] = value
	}
	return data
}

export const SOURCE_ART_3_1_B = 'FamZG Art. 3 Abs. 1 Bst. b'
export const SOURCE_ART_5_2 = 'FamZG Art. 5 Abs. 2'
export const STK = 'https://almilo.github.io/software-that-knows/vocabulary#'

/** The answers of the happy path, by question title. */
export function happyPathAnswers() {
	return {
		'Datum des Antrags': '2026-10-19',
		Erwerbssituation: option('Erwerbssituation', 'Arbeitnehmerin oder Arbeitnehmer'),
		'Jährliches Erwerbseinkommen, auf dem Sie AHV-Beiträge bezahlen (CHF)': 60000,
		'Wie stehen Sie zum Kind?': option('Wie stehen Sie zum Kind?', 'Eigenes Kind'),
		'Geburtsdatum des Kindes': '2009-03-10',
		'Welche Ausbildung macht das Kind im Monat des Antrags?': option('Welche Ausbildung macht das Kind im Monat des Antrags?', 'Lehre'),
		'Seit wann ist das Kind in dieser Ausbildung?': '2025-08-01',
	}
}
