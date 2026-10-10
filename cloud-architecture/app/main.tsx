import { useState } from "react";
import { createRoot } from "react-dom/client";
import { type Answers, possibleOutcomes } from "../decide/decide";
import { Compare } from "./Compare";
import { Questions } from "./Questions";
import { Recommendation } from "./Recommendation";

// The questions on the left, asked one at a time and only while they can change the
// recommendation; the recommendation on the right, updated at every answer; the diagram below.
function App() {
  const [answers, setAnswers] = useState<Answers>({});
  const outcomes = possibleOutcomes(answers);

  return (
    <main>
      <header>
        <h1>Microservices, serverless or a modular monolith?</h1>
        <p className="intro">
          A recommendation for your team, from Alok Sharan's diagram{" "}
          <a href="https://www.linkedin.com/feed/update/urn:li:activity:7514433067860582400/">
            Microservices VS Serverless VS Modular Monolith
          </a>{" "}
          and the heuristics of the post that goes with it, written down as an ontology. The rules decide, and say why.
        </p>
      </header>
      <Questions answers={answers} onChange={setAnswers} />
      <Recommendation answers={answers} />
      <Compare outcome={outcomes.length === 1 ? outcomes[0] : undefined} />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
