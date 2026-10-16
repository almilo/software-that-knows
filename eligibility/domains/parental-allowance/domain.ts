// The parental-allowance domain: the maternity and paternity allowance (EOG Art. 16b–16l).
// Its model, the law module that it imports, and the files generated from them, as the app and the
// tests use them. It imports no shared module of knowledge: see its model.
import type { DomainFiles } from "../../app/domain";
import { laws } from "../../modules";
import domain from "./generated/domain.json";
import messages from "./generated/messages.json";
import schema from "./generated/schema.json";
import uischema from "./generated/uischema.json";
import model from "./ontology/parental-allowance.ttl" with { type: "text" };

export const parentalAllowance: DomainFiles = {
  model: [model, laws.eog],
  schema,
  uischema,
  messages,
  region: domain.region,
};
