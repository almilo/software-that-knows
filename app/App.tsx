import { Actions, type Middleware } from '@jsonforms/core'
import { JsonForms } from '@jsonforms/react'
import { vanillaCells, vanillaRenderers } from '@jsonforms/vanilla-renderers'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Engine, type Answers, type Evaluation, type Result } from './engine'
import modelFile from './generated/model.json'
import type { AppModel, NoteInfo, SourceInfo } from './model-types'

const model = modelFile as unknown as AppModel
const engine = new Engine(model)
const interpretationsById = new Map(model.interpretations.map((note) => [note.id, note]))
const anchor = (id: string) => 'note-' + id.replace(/[^A-Za-z0-9_-]/g, '-')

/**
 * The form owns its data. When the layout changes (a question becomes relevant), JSON Forms
 * would set the data again from the data property; then an answer that it has not yet
 * reported with onChange would be lost. This middleware keeps the current data.
 */
const keepFormData: Middleware = (state, action, reducer) =>
	reducer(state, action.type === Actions.UPDATE_CORE ? { ...action, data: state.data } : action)

const NO_ANSWERS: Answers = {}

type UiElement = { type: string; scope?: string; elements?: UiElement[] } & Record<string, unknown>

/** Keeps only the controls of relevant questions, and the layouts that still contain a control. */
function relevantUiSchema(element: UiElement, visibleScopes: Set<string>): UiElement | null {
	if (element.scope) return visibleScopes.has(element.scope) ? element : null
	if (!element.elements) return element
	const elements = element.elements
		.map((nested) => relevantUiSchema(nested, visibleScopes))
		.filter((nested): nested is UiElement => nested !== null)
	return elements.length > 0 ? { ...element, elements } : null
}

function Sources({ ids }: { ids: SourceInfo[] }) {
	return (
		<ul className="sources">
			{ids.map((source) => (
				<li key={source.id}>
					{source.url ? (
						<a href={source.url} target="_blank" rel="noreferrer">
							{source.label}
						</a>
					) : (
						source.label
					)}
					{source.quote && <blockquote>{source.quote}</blockquote>}
				</li>
			))}
		</ul>
	)
}

function ResultCard({ result }: { result: Result }) {
	const resultType = model.resultTypes.find((candidate) => candidate.id === result.resultType)
	const notes = result.interpretations
		.map((id) => interpretationsById.get(id))
		.filter((note): note is NoteInfo => !!note)
	return (
		<article className="result" data-result-type={resultType?.id} data-rule={result.rule}>
			<header>{resultType?.label}</header>
			<p className="message">{result.message}</p>
			<details>
				<summary>{model.labels.sources}</summary>
				<Sources ids={result.sources} />
			</details>
			{notes.length > 0 && (
				<details>
					<summary>{model.labels.interpretation}</summary>
					<ul>
						{notes.map((note) => (
							<li key={note.id}>
								<a href={'#' + anchor(note.id)}>{note.label}</a>
							</li>
						))}
					</ul>
				</details>
			)}
		</article>
	)
}

function Notes({ title, notes }: { title: string; notes: NoteInfo[] }) {
	return (
		<details className="notes">
			<summary>{title}</summary>
			{notes.map((note) => (
				<section key={note.id} id={anchor(note.id)}>
					<h4>{note.label}</h4>
					{note.comment && <p>{note.comment}</p>}
					<Sources ids={note.sources.map((id) => model.sources[id])} />
				</section>
			))}
		</details>
	)
}

export function App() {
	const [answers, setAnswers] = useState<Answers>({})
	const [evaluation, setEvaluation] = useState<Evaluation | null>(null)
	const latest = useRef(0)

	useEffect(() => {
		document.title = model.process.title
	}, [])

	useEffect(() => {
		const run = ++latest.current
		engine
			.evaluate(answers)
			.then((next) => {
				if (run === latest.current) setEvaluation(next)
			})
			.catch((error) => console.error(error))
	}, [answers])

	const uischema = useMemo(() => {
		const relevant = evaluation?.relevant ?? new Set(model.questions.filter((question) => !question.condition).map((question) => question.id))
		const scopes = new Set(model.questions.filter((question) => relevant.has(question.id)).map((question) => question.scope))
		return relevantUiSchema(model.uischema as UiElement, scopes) ?? { type: 'VerticalLayout', elements: [] }
	}, [evaluation])

	return (
		<main>
			<header className="page">
				<h1>{model.process.title}</h1>
				{model.process.description && <p>{model.process.description}</p>}
			</header>
			<div className="columns">
				<section className="questions" aria-label={model.labels.questions}>
					<h2>{model.labels.questions}</h2>
					<JsonForms
						schema={model.schema as any}
						uischema={uischema as any}
						data={NO_ANSWERS}
						middleware={keepFormData}
						renderers={vanillaRenderers}
						cells={vanillaCells}
						onChange={({ data }) => setAnswers(data ?? {})}
					/>
				</section>
				<section className="results" aria-label={model.labels.results} aria-live="polite" data-ready={evaluation ? 'true' : 'false'}>
					<h2>{model.labels.results}</h2>
					{evaluation && evaluation.results.length === 0 && <p className="empty">{model.labels.noResults}</p>}
					{evaluation?.results.map((result, index) => <ResultCard key={result.rule + index} result={result} />)}
					{evaluation?.issues.map((issue, index) => (
						<p className="issue" key={index}>
							{issue.message}
						</p>
					))}
				</section>
			</div>
			<footer>
				<Notes title={model.labels.interpretation} notes={model.interpretations} />
				<Notes title={model.labels.openPoint} notes={model.openPoints} />
				<Notes
					title={model.labels.parameters}
					notes={model.parameters.map((parameter) => ({
						id: parameter.id,
						label: `${parameter.label}: ${parameter.value}${parameter.unit ? ' ' + parameter.unit : ''}`,
						sources: parameter.sources,
					}))}
				/>
				<details className="notes">
					<summary>{model.labels.outOfScope}</summary>
					<ul>
						{model.process.outOfScope.map((topic) => (
							<li key={topic}>{topic}</li>
						))}
					</ul>
				</details>
				<Sources ids={model.process.sources.map((id) => model.sources[id])} />
			</footer>
		</main>
	)
}
