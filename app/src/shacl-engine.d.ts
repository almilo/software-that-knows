// shacl-engine has no type declarations.
declare module "shacl-engine" {
  export class Validator {
    constructor(shapes: unknown, options: Record<string, unknown>);
    validate(data: { dataset: unknown; terms?: unknown[] }): Promise<{ conforms: boolean; results: unknown[] }>;
  }
}
declare module "shacl-engine/sparql.js" {
  export const targetResolvers: Map<unknown, unknown>;
  export const validations: Map<unknown, unknown>;
}
