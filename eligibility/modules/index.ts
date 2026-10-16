// The shared modules of knowledge, as text, for the domains' entries (domains/<name>/domain.ts). A
// domain lists the modules that its model imports (owl:imports); loadModel (core/model.ts) checks
// that the list is exactly what the imports need.
import bvg from "./law/bvg.ttl" with { type: "text" };
import wefv from "./law/wefv.ttl" with { type: "text" };
import pension from "./pension.ttl" with { type: "text" };
import person from "./person.ttl" with { type: "text" };

export const modules = { person, pension };
export const laws = { bvg, wefv };
