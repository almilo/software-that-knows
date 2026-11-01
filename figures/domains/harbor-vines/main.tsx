import { start } from "../../app/main";
import type { FiguresModel, SourceRow } from "../../engine/model";
import asShown from "./generated/as-shown.json";
import model from "./generated/model.json";
import source from "./generated/rows.json";

start("harbor-vines", model as FiguresModel, asShown as FiguresModel, source.rows as SourceRow[]);
