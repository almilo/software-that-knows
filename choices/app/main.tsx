import { useState } from "react";
import { createRoot } from "react-dom/client";
import { type Answers, createDecision, type Decision } from "../decide/decision";
import type { DecisionModel } from "../decide/model";
import { Compare } from "./Compare";
import { Ladder } from "./Ladder";
import { Questions } from "./Questions";
import { Recommendation } from "./Recommendation";

const repository = "https://github.com/almilo/software-that-knows/tree/main/choices";

// The page of a domain: its main.tsx calls this with its generated decision.
export function start(name: string, model: DecisionModel) {
  createRoot(document.getElementById("root")!).render(<App name={name} d={createDecision(model)} />);
}

// The questions on the left, asked one at a time and only while they can change the
// recommendation; the recommendation on the right, updated at every answer; the diagram below.
function App({ name, d }: { name: string; d: Decision }) {
  const [answers, setAnswers] = useState<Answers>({});
  const outcomes = d.possibleOutcomes(answers);
  const outcome = outcomes.length === 1 ? outcomes[0] : undefined;
  const { domain } = d;

  return (
    <main>
      <header>
        <h1>{domain.title}</h1>
        <p className="intro">
          {domain.intro} Source: <a href={domain.source}>{domain.sourceTitle}</a>, written down as an{" "}
          <a href={`${repository}/domains/${name}/ontology`}>ontology</a>. The rules decide, and say why.{" "}
          <a href={repository}>Code on GitHub</a>
        </p>
      </header>
      <Questions d={d} answers={answers} onChange={setAnswers} />
      <Recommendation d={d} answers={answers} />
      <Compare d={d} outcome={outcome} />
      {d.ladder.length > 0 && <Ladder d={d} outcome={outcome} />}
    </main>
  );
}
