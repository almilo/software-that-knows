// Draws the BPMN process with bpmn-js in each .diagram element, with the names in the page's
// language (the server translates them in /process.bpmn), and marks the activities and flows that
// are done and the ones that are active. htmx.onLoad also runs for content that htmx swaps in.
htmx.onLoad((root) => root.querySelectorAll(".diagram").forEach(draw));

async function draw(element) {
  if (element.dataset.drawn) return;
  element.dataset.drawn = "true";
  const viewer = new BpmnJS({ container: element });
  const xml = await fetch(`/process.bpmn?language=${document.documentElement.lang}`, { cache: "no-store" }).then((r) => r.text());
  await viewer.importXML(xml);
  const canvas = viewer.get("canvas");
  canvas.zoom("fit-viewport");
  ids(element.dataset.done).forEach((id) => mark(canvas, id, "done"));
  ids(element.dataset.active).forEach((id) => mark(canvas, id, "active"));
}

function mark(canvas, id, marker) {
  try {
    canvas.addMarker(id, marker);
  } catch {
    // not drawn: the multi-instance body has the id of its task
  }
}

function ids(text) {
  return (text || "").split(",").filter(Boolean);
}
