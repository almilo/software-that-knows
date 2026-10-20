// Types of the file that the generator writes and the app reads.

export interface SourceInfo {
	id: string
	label: string
	url?: string
	quote?: string
}

export interface QuestionInfo {
	id: string
	path: string[]
	scope: string
	radio: boolean
	group?: string
	order: number
	condition?: string
	interpretations: string[]
}

export interface ResultInfo {
	id: string
	resultType: string
	order: number
	sources: string[]
	interpretations: string[]
}

export interface ResultTypeInfo {
	id: string
	label: string
	order: number
}

export interface NoteInfo {
	id: string
	label: string
	comment?: string
	sources: string[]
}

export interface OpenPointInfo extends NoteInfo {
	deactivatedRules: string[]
}

export interface ParameterInfo {
	id: string
	label: string
	value: string
	unit?: string
	sources: string[]
	interpretations: string[]
}

export interface LocalizedLabels {
	questions: string
	results: string
	noResults: string
	sources: string
	interpretation: string
	openPoint: string
	outOfScope: string
	parameters: string
}

export interface AppModel {
	process: {
		id: string
		title: string
		description?: string
		language: string
		sources: string[]
		outOfScope: string[]
	}
	root: { class: string }
	schema: Record<string, unknown>
	uischema: Record<string, unknown>
	context: Record<string, unknown>
	questions: QuestionInfo[]
	results: Record<string, ResultInfo>
	resultTypes: ResultTypeInfo[]
	sources: Record<string, SourceInfo>
	interpretations: NoteInfo[]
	openPoints: OpenPointInfo[]
	parameters: ParameterInfo[]
	labels: LocalizedLabels
	shapes: string
	facts: string
}
