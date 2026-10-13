import { start } from "../../app/main";
import type { DecisionModel } from "../../decide/model";
import decision from "./generated/decision.json";

start("cloud-architecture", decision as DecisionModel);
