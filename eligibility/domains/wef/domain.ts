// The wef domain: the early withdrawal of pension money for a home (BVG Art. 30a–30g, WEFV).
// Its model, the shared modules that it imports, and the files generated from them, as the app and
// the tests use them.
import type { DomainFiles } from "../../app/domain";
import { laws, modules } from "../../modules";
import domain from "./generated/domain.json";
import messages from "./generated/messages.json";
import schema from "./generated/schema.json";
import uischema from "./generated/uischema.json";
import model from "./ontology/wef.ttl" with { type: "text" };

export const wef: DomainFiles = {
  model: [model, modules.person, modules.pension, laws.bvg, laws.wefv],
  schema,
  uischema,
  messages,
  region: domain.region,
};
