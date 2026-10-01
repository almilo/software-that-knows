import { useState } from "react";
import { createRoot } from "react-dom/client";
import { NotePanel } from "./NotePanel";
import { classify, type Assessment } from "./classify";
import { Form } from "./Form";
import { Results } from "./Results";

// The form on the left. On the right, a note in free text that fills the same form, and the result.
function App() {
  const [data, setData] = useState<Assessment>({});
  // The data that the form loads. It changes only when the note changes the answers (see Form.tsx).
  const [formData, setFormData] = useState<Assessment>({});
  const fromNote = (next: Assessment) => {
    setData(next);
    setFormData(next);
  };

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
        <Form data={formData} onChange={setData} />
        <button className="clear" onClick={() => fromNote({})}>
          Clear the form
        </button>
      </section>
      <section className="side">
        <NotePanel data={data} onApply={fromNote} />
        <h2>Result</h2>
        <Results results={classify(data)} answered={Object.keys(data).length > 0} />
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
