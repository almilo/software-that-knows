import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import type { AppModel } from "./app-model.ts";
import { createEngine } from "./engine.ts";
import appModelJson from "./generated/app-model.json";
import { modelTurtle } from "./generated/model.ts";

const appModel = appModelJson as unknown as AppModel;
const engine = createEngine(appModel, modelTurtle);

document.title = appModel.title;
createRoot(document.getElementById("root")!).render(<App appModel={appModel} engine={engine} />);
