// The answers in a browser-like DOM (happy-dom), because the OpenUI runtime fills $facts and runs the
// queries only after the screen is mounted. The modules that use the DOM are imported after it is
// registered.
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

GlobalRegistrator.register();
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { Renderer } = await import("@openuidev/react-lang");
const { policy } = await import("../../app/data");
const { statusWords } = await import("../../engine/text");
const { decide, expectedFor, readAnswer } = await import("../evaluation");
const { fixtures } = await import("../fixtures");
const { CertificateContext, library } = await import("../library");
const { createTools } = await import("../tools");

const certificate = policy.certificates.find((c) => c.id === "ExampleCertificate")!.answers;
const settle = () => act(async () => void (await new Promise((r) => setTimeout(r, 20))));

async function mount(response: string) {
  const element = document.createElement("div");
  document.body.appendChild(element);
  const root = createRoot(element);
  await act(async () =>
    root.render(
      <CertificateContext.Provider value={certificate}>
        <Renderer response={response} library={library} toolProvider={createTools(policy, certificate)} isStreaming={false} />
      </CertificateContext.Provider>,
    ),
  );
  await settle();
  return { element, unmount: () => act(async () => root.unmount()) };
}

beforeAll(() => expect(document).toBeDefined());
afterAll(() => GlobalRegistrator.unregister());

describe("the five answers, mounted", () => {
  for (const f of fixtures) {
    test(f.question, async () => {
      const { element, unmount } = await mount(f.response);
      const text = element.textContent ?? "";
      expect(text).toContain("What I understood");
      // The first screen shows the decision of the person's policy, or that it needs more answers.
      const first = decide(expectedFor(f.question)!, readAnswer(f.response).facts).firstStatus;
      expect(text).toContain(first === "open" ? "Not decided yet" : statusWords[first].title);
      await unmount();
    });
  }
});

describe("what-if: the answers go into $facts, and the query runs again", () => {
  for (const f of fixtures.filter((f) => f.response.includes("Query("))) {
    test(f.question, async () => {
      const { element, unmount } = await mount(f.response);
      const card = () => element.querySelector(".verdict-card")!;
      expect(card().textContent).not.toContain("Waiting for the engine");
      expect(card().textContent).toContain("Your policy, with:");
      // Answer the questions of the what-if, with the first answer, until it decides.
      const asked: string[] = [];
      for (let i = 0; i < 20; i++) {
        const question = card().querySelector("fieldset");
        if (!question) break;
        const before = question.querySelector("legend")!.textContent!;
        asked.push(before);
        const input = question.querySelector("input") as HTMLInputElement | null;
        await act(async () => {
          if (input) {
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
            setter.call(input, "1000");
            input.dispatchEvent(new Event("input", { bubbles: true }));
          }
        });
        await act(async () => {
          if (input) (question.querySelector("form") as HTMLFormElement).requestSubmit();
          else (question.querySelector("button") as HTMLButtonElement).click();
        });
        await settle();
        expect(card().querySelector("fieldset legend")?.textContent).not.toBe(before);
      }
      expect(card().querySelector("fieldset")).toBeNull();
      expect(card().querySelector(".verdict h4")!.textContent).not.toBe(statusWords.open.title);
      // The claim check does not show the person's answers as understood from the question.
      const understood = element.querySelector(".assistant-claim .understood")!.textContent!;
      const given = element.querySelector(".assistant-claim .given")!.textContent!;
      for (const label of asked) {
        expect(understood).not.toContain(label);
        expect(given).toContain(label);
      }
      await unmount();
    });
  }
});
