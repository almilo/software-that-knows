// The components that the language model may use, as an OpenUI library. The model chooses the
// components and fills in the facts that the person stated; the components decide nothing in their
// own words. They read their texts from the generated policy and run the engine of the demonstrator:
// the decision, its rules and articles, the next question and the obligations come from the
// knowledge model, not from the language model. For a what-if, the model writes a Query of the tool
// assess_claim (tools.ts), and Verdict shows its result.
import { createLibrary, defineComponent, reactive, useStateField } from "@openuidev/react-lang";
import { createContext, useContext, useMemo, useState } from "react";
import { z } from "zod/v4";
import { createClaim } from "../engine/claim";
import { obligations } from "../engine/guide";
import type { Answers } from "../engine/model";
import { answerText, chf } from "../engine/text";
import { article, policy } from "../app/data";
import { Decision } from "../app/Decision";
import { Question } from "../app/Question";
import { Sources } from "../app/ui";
import { ground, type Rejected } from "./grounding";
import { isIssued } from "./tools";

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

// The facts of a component: bound to $facts, the person's answers are written into it, so that every
// Query that uses $facts runs again; as a literal, they stay in the component.
// The ids of the facts that the person answered, in any component of the screen, so that no
// component shows them as understood from the question. The root component holds them.
const AnsweredContext = createContext<{ ids: string[]; add: (id: string) => void }>({ ids: [], add: () => {} });

function useFacts(binding: unknown) {
  const field = useStateField<Record<string, unknown>>("facts", binding as Record<string, unknown>);
  const [own, setOwn] = useState<Answers>({});
  const { ids: answered, add } = useContext(AnsweredContext);
  const all = { ...(field.value ?? {}), ...(field.isReactive ? {} : own) };
  const answer = (id: string, value: string | number) => {
    add(id);
    if (field.isReactive) field.setValue({ ...(field.value ?? {}), [id]: value });
    else setOwn((o) => ({ ...o, [id]: value }));
  };
  const stated = Object.fromEntries(Object.entries(all).filter(([id]) => !answered.includes(id)));
  const given = Object.fromEntries(Object.entries(all).filter(([id]) => answered.includes(id))) as Answers;
  return { stated, given, answer };
}

function Answered({ answers }: { answers: Answers }) {
  const entries = Object.entries(answers);
  if (!entries.length) return null;
  return (
    <div className="given">
      <h4>Your answers</h4>
      {entries.map(([id, value]) => (
        <div key={id} className="answered">
          <span>{claim.fact(id).label}</span>
          <strong>{answerText(claim.fact(id), value)}</strong>
        </div>
      ))}
    </div>
  );
}

function ClaimCheckView({ binding }: { binding: unknown }) {
  const certificate = useContext(CertificateContext);
  const { stated, given, answer } = useFacts(binding);
  const { answers: understood, rejected } = ground(policy, stated, ["claim"]);
  const answers = { ...certificate, ...understood, ...given };
  const next = claim.next(answers);
  const result = claim.evaluate(answers);
  return (
    <section className="assistant-claim columns">
      <div className="questions">
        <Understood answers={understood} rejected={rejected} />
        <Answered answers={given} />
        {next && <Question key={next.id} fact={next} next onAnswer={(v) => answer(next.id, v)} />}
      </div>
      <Decision claim={claim} result={result} answers={answers} done={!next} />
    </section>
  );
}

const ClaimCheck = defineComponent({
  name: "ClaimCheck",
  description:
    "Decides whether the event is covered by the person's policy, with the rules and their articles, and asks the questions that the decision still needs. Use it once for every question about whether something is covered or paid. Pass $facts, so that the answers of the person reach every Query.",
  props: z.object({
    facts: reactive(facts.describe("$facts: the facts that the person stated, a claim fact id of the catalog and one of its value ids, or a number for a number fact.")),
  }),
  component: ({ props }) => <ClaimCheckView binding={props.facts} />,
});

// A result of assess_claim, from a Query. Shown only with a proof that the tool issued it; while the
// Query runs, or for a result that the language model wrote itself, it shows that it waits.
function VerdictView({ title, result, binding }: { title?: string; result: unknown; binding: unknown }) {
  const { answer } = useFacts(binding);
  if (!isIssued(result)) {
    return (
      <section className="verdict-card">
        <h3>{title}</h3>
        <p className="hint">Waiting for the engine.</p>
      </section>
    );
  }
  const next = result.next ? claim.fact(result.next) : undefined;
  const changes = Object.entries(result.changes).map(([id, v]) => answerText(policy.facts.find((f) => f.id === id)!, v));
  const tone = result.status === "covered" ? "covered" : result.status === "reduced" ? "reduced" : result.status === "open" ? "neutral" : "excluded";
  return (
    <section className="verdict-card">
      <h3>{title}</h3>
      {Object.keys(result.changes).length > 0 && (
        <p className="hint">
          Your policy, with: {Object.keys(result.changes).map((id, i) => `${policy.facts.find((f) => f.id === id)!.label} ${changes[i]}`).join(", ")}
        </p>
      )}
      <article className={`verdict ${tone}`}>
        <h4>{result.title}</h4>
        {result.cover && (
          <p>
            Cover: <strong>{result.cover.label}</strong> <Sources ids={result.cover.sources} />
          </p>
        )}
        {result.payment !== undefined && <p>Payment: CHF {chf(result.payment)}</p>}
      </article>
      <ul className="why">
        {result.rules
          .filter((r) => r.role !== "overridden")
          .map((r) => (
            <li key={r.label}>
              {r.label} <Sources ids={r.sources} />
            </li>
          ))}
      </ul>
      {result.rejected.map((r) => (
        <p key={r.fact} className="rejected">
          Not used: {r.fact} = {JSON.stringify(r.value)}, because {r.reason}.
        </p>
      ))}
      {next && <Question key={next.id} fact={next} onAnswer={(v) => answer(next.id, v)} />}
    </section>
  );
}

const Verdict = defineComponent({
  name: "Verdict",
  description: "Shows a result of a Query of assess_claim, with a title, and asks the next question that this result needs. Use it for a what-if, next to ClaimCheck.",
  props: z.object({
    title: z.string().describe("What the result is, for example the change of the policy."),
    result: z.any().describe("The result of a Query of assess_claim. Never write a result yourself."),
    facts: reactive(facts.describe("$facts, so that the answer to the next question reaches every Query.").optional()),
  }),
  component: ({ props }) => <VerdictView title={props.title} result={props.result} binding={props.facts} />,
});

const Columns = defineComponent({
  name: "Columns",
  description: "Shows its children side by side, for a comparison.",
  props: z.object({ children: z.array(z.union([Verdict.ref])) }),
  component: ({ props, renderNode }) => <div className="compare">{renderNode(props.children)}</div>,
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
  props: z.object({ children: z.array(z.union([Note.ref, ClaimCheck.ref, Obligations.ref, Article.ref, Verdict.ref, Columns.ref])) }),
  component: ({ props, renderNode }) => <AnswerView>{renderNode(props.children)}</AnswerView>,
});

function AnswerView({ children }: { children: React.ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);
  const value = useMemo(() => ({ ids, add: (id: string) => setIds((a) => [...a, id]) }), [ids]);
  return (
    <AnsweredContext.Provider value={value}>
      <div className="answer">{children}</div>
    </AnsweredContext.Provider>
  );
}

export const library = createLibrary({ components: [Answer, Note, ClaimCheck, Verdict, Columns, Obligations, Article], root: "Answer" });
