// The components that the language model may use, as an OpenUI library. The model chooses the
// components and fills in the facts that the person stated; the components decide nothing in their
// own words. They read their texts from the generated policy and run the engine of the demonstrator:
// the decision, its rules and articles, the next question and the obligations come from the
// knowledge model, not from the language model.
import { createLibrary, defineComponent } from "@openuidev/react-lang";
import { createContext, useContext, useState } from "react";
import { z } from "zod/v4";
import { createClaim } from "../engine/claim";
import { obligations } from "../engine/guide";
import type { Answers } from "../engine/model";
import { answerText } from "../engine/text";
import { article, policy } from "../app/data";
import { Decision } from "../app/Decision";
import { Question } from "../app/Question";
import { Sources } from "../app/ui";
import { ground, type Rejected } from "./grounding";

// The answers of the certificate of the person's policy. The app provides them; the language model
// never sees or sets them.
export const CertificateContext = createContext<Answers>({});

const claim = createClaim(policy);
const facts = z.record(z.string(), z.union([z.string(), z.number()]));

function Understood({ answers, rejected }: { answers: Answers; rejected: Rejected[] }) {
  const entries = Object.entries(answers);
  if (!entries.length && !rejected.length) return null;
  return (
    <div className="understood">
      <h4>What I understood</h4>
      {entries.map(([id, value]) => {
        const fact = policy.facts.find((f) => f.id === id)!;
        return (
          <div key={id} className="answered">
            <span>{fact.label}</span>
            <strong>{answerText(fact, value)}</strong>
          </div>
        );
      })}
      {rejected.map((r) => (
        <p key={r.fact} className="rejected">
          Not used: {r.fact} = {JSON.stringify(r.value)}, because {r.reason}.
        </p>
      ))}
    </div>
  );
}

function ClaimCheckView({ stated }: { stated?: Record<string, unknown> }) {
  const certificate = useContext(CertificateContext);
  const { answers: understood, rejected } = ground(policy, stated, ["claim"]);
  // The answers that the person gives to the questions that the check still asks.
  const [own, setOwn] = useState<Answers>({});
  const answers = { ...certificate, ...understood, ...own };
  const next = claim.next(answers);
  const result = claim.evaluate(answers);
  return (
    <section className="assistant-claim columns">
      <div className="questions">
        <Understood answers={understood} rejected={rejected} />
        {Object.entries(own).map(([id, value]) => (
          <div key={id} className="answered">
            <span>{claim.fact(id).label}</span>
            <strong>{answerText(claim.fact(id), value)}</strong>
          </div>
        ))}
        {next && <Question key={next.id} fact={next} next onAnswer={(v) => setOwn((o) => ({ ...o, [next.id]: v }))} />}
      </div>
      <Decision claim={claim} result={result} answers={answers} done={!next} />
    </section>
  );
}

const ClaimCheck = defineComponent({
  name: "ClaimCheck",
  description:
    "Decides whether the event is covered by the person's policy, with the rules and their articles, and asks the questions that the decision still needs. Use it once for every question about whether something is covered or paid.",
  props: z.object({
    facts: facts.describe("The facts that the person stated: a claim fact id of the catalog, and one of its value ids, or a number for a number fact."),
  }),
  component: ({ props }) => <ClaimCheckView stated={props.facts} />,
});

function ObligationsView({ stated }: { stated?: Record<string, unknown> }) {
  const certificate = useContext(CertificateContext);
  const { answers, rejected } = ground(policy, stated, ["guide"]);
  const list = obligations(policy, { ...certificate, ...answers });
  return (
    <section className="checklist">
      <h3>What to do now ({list.length})</h3>
      <Understood answers={answers} rejected={rejected} />
      <ol>
        {list.map((o) => (
          <li key={o.id}>
            <strong>{o.label}</strong>
            <p>{o.action}</p>
            {o.consequence && <p className="consequence">If not: {o.consequence}</p>}
            <Sources ids={o.sources} />
          </li>
        ))}
      </ol>
    </section>
  );
}

const Obligations = defineComponent({
  name: "Obligations",
  description:
    "What the person must do after an event that has happened, in order, and what happens if they do not. Use it when the person describes an event that has already happened.",
  props: z.object({
    facts: facts.describe("The guide facts of the catalog that the person's description makes true, each with the value id Yes."),
  }),
  component: ({ props }) => <ObligationsView stated={props.facts} />,
});

const Article = defineComponent({
  name: "Article",
  description: "One article of the General Conditions, with its title and summary. Use it when the person asks what an article says.",
  props: z.object({ id: z.string().describe("The article number, for example 204.1.") }),
  component: ({ props }) => {
    const a = props.id ? article(props.id.replace(/\s/g, "")) : undefined;
    if (!a) return props.id ? <p className="rejected">Not used: there is no article {props.id} in the model.</p> : null;
    return (
      <section className="article">
        <h3>
          Art. {a.number} {a.title}
        </h3>
        {a.summary && <p>{a.summary}</p>}
      </section>
    );
  },
});

const Note = defineComponent({
  name: "Note",
  description: "One or two short sentences: what you understood, or why the question is not about this insurance. Never a decision, an amount, a deadline or an obligation.",
  props: z.object({ text: z.string() }),
  component: ({ props }) => <p className="note">{props.text}</p>,
});

const Answer = defineComponent({
  name: "Answer",
  description: "The screen of one answer.",
  props: z.object({ children: z.array(z.union([Note.ref, ClaimCheck.ref, Obligations.ref, Article.ref])) }),
  component: ({ props, renderNode }) => <div className="answer">{renderNode(props.children)}</div>,
});

export const library = createLibrary({ components: [Answer, Note, ClaimCheck, Obligations, Article], root: "Answer" });
