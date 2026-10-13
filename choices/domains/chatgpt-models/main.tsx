import { start } from "../../app/main";
import type { DecisionModel } from "../../decide/model";
import decision from "./generated/decision.json";

start("chatgpt-models", decision as DecisionModel);
