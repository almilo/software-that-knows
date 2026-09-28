import { useState } from "react";
import { createRoot } from "react-dom/client";
import { classify, type Assessment } from "./classify";
import { Form } from "./Form";
import { Results } from "./Results";

function App() {
  const [data, setData] = useState<Assessment>({});
  return (
    <main>
      <header>
        <h1>Does the child have fever?</h1>
        <p className="warning">
          Demonstration only. Not a medical device. Adapted from the WHO digital adaptation kit for child health (2024)
          and not reviewed by a clinician. WHO did not create this adaptation and is not responsible for it.
        </p>
      </header>
      <section className="form">
        <Form onChange={setData} />
      </section>
      <section className="results">
        <Results results={classify(data)} />
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
