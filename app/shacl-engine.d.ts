// The package shacl-engine has no type declarations.
declare module 'shacl-engine/Validator.js' {
	export default class Validator {
		constructor(dataset: unknown, options: Record<string, unknown>)
		validate(data: { dataset: unknown; terms?: unknown[] }, shapes?: { terms: unknown[] }[]): Promise<any>
	}
}
declare module 'shacl-engine/sparql.js' {
	export const targetResolvers: Map<unknown, unknown>
	export const validations: Map<unknown, unknown>
}
