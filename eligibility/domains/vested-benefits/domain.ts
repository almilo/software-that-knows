// The vested-benefits domain: the cash payment of the vested benefit (FZG Art. 2–5, 25f).
// Its model, the shared modules that it imports, and the files generated from them, as the app and
// the tests use them.
import type { DomainFiles } from "../../app/domain";
import { laws, modules } from "../../modules";
import domain from "./generated/domain.json";
import messages from "./generated/messages.json";
import schema from "./generated/schema.json";
import uischema from "./generated/uischema.json";
import model from "./ontology/vested-benefits.ttl" with { type: "text" };

export const vestedBenefits: DomainFiles = {
  model: [model, modules.person, modules.pension, laws.fzg, laws.bvg, laws.dbg],
  schema,
  uischema,
  messages,
  region: domain.region,
};
