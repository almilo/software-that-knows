// Loads the files that the generator made from the model.
import catalog from "./generated/catalog.json";
import context from "./generated/context.jsonld" with { type: "json" };
import schema from "./generated/schema.json";
import uischema from "./generated/uischema.json";
import shapes from "./generated/shapes.ttl" with { type: "text" };
import parameters from "./generated/parameters.ttl" with { type: "text" };
import { Engine } from "./engine";

export { schema, uischema };

export const files = { catalog: catalog as any, context: context as any, shapes, parameters };

export function createEngine() {
  return new Engine(files);
}
