import { status } from "../engine/checks";
import { checks, policy, repository } from "./data";

// The landing page: what the demonstrator is, and for each application what it shows, its
// interface, and what the model gives it. The numbers come from the generated files.
export function Home() {
  const { questionsPerClaim, modelQuestions } = checks.find((c) => c.id === "claims")!.stats!;
  const resolved = checks.flatMap((c) => c.findings).filter((f) => f.status === "resolved");
  const interpreted = resolved.filter((f) => f.basis === "interpretation").length;
  const open = checks.flatMap((c) => c.findings).filter((f) => f.status === "open");
  const count = (kind: string) => policy.rules.filter((r) => r.kind === kind).length;

  const cases = [
    {
      path: "claim",
      title: "Claim check",
      question: "Is this covered by my policy, and how much does the insurer pay?",
      shows:
        "A decision for a claim, with the articles that make it: which cover the event belongs to, whether the certificate of your policy includes its module and option, and which exclusions and reductions apply. For accidental damage, the payment step by step: total loss or repair, compensation table, limits, deductible. For the other modules, what the cover pays, with the sums of your policy.",
      interface: "Your policy (the certificate) at the top. One question at a time on the left. On the right, the decision as it builds up: the cover, the exclusions and reductions that hold, the statements that a precedence sets aside, the amount. A record of the decision to download.",
      model: `${count("cover")} cover rules, ${count("exclusion")} exclusions, ${count("reduction")} reductions, ${policy.modules.length} modules, the product overview, the compensation table, ${policy.parameters.length} numbers and ${policy.certificates.length} example certificates. A test claim needs ${questionsPerClaim} of the ${modelQuestions} questions on average.`,
    },
    {
      path: "guide",
      title: "After an event",
      question: "What must I do now, and what happens if I do not?",
      shows: "A checklist of the obligations after an accident, a theft or a breakdown, for the situation of the user, in order, with the consequence of each one.",
      interface: "A few yes or no questions; the checklist changes at each answer. Made for a phone at the roadside, with the emergency numbers on top.",
      model: `${policy.obligations.length} obligations, each with its conditions, its consequence and its articles.`,
    },
    {
      path: "dates",
      title: "Dates",
      question: "By which day must I act?",
      shows: "The deadlines of the contract and of a claim: notice of termination, a new premium, the 14 days after a claim, the 30 days after a theft, the end of the accident benefits.",
      interface: "Date fields for the dates that you know; a timeline of the deadlines that follow from them.",
      model: `${policy.deadlines.length} deadlines, each one a date of the user moved by a duration of the model (for example three months and one day before the renewal).`,
    },
    {
      path: "compare",
      title: "Compare",
      question: "What does an option add?",
      shows: "The product overview for each vehicle class, and two covers side by side, benefit by benefit: Glass and Glass PLUS, Parking damage and PLUS, roadside assistance CH/FL and Europe.",
      interface: "The overview as a table, with the vehicle class of your choice marked. Below, a comparison with the rows that differ marked.",
      model: `The status of ${policy.covers.length} covers for ${policy.vehicleClasses.length} vehicle classes, and ${policy.benefits.length} benefits with their limits.`,
    },
    {
      path: "policy",
      title: "Policy explorer",
      question: "What does this article say, and what does it change?",
      shows: "Each article with a summary, the articles that it refers to or that refer to it, and every statement of the model that comes from it: rules in words, limits, obligations, deadlines.",
      interface: "The articles by part, with a filter. Every article number in the other views links here.",
      model: `${policy.articles.length} articles, and the source of every statement of the model.`,
    },
    {
      path: "checks",
      title: "Model checks",
      question: "Is the model complete, and does the document contradict itself?",
      shows: `The report of ${checks.length} checks that run at build time, on the model and on the test claims. They found ${resolved.length} places where two statements of the document apply to the same claim with opposite effects, or state the same limit differently. For ${resolved.length - interpreted} of them the text says which one wins; for ${interpreted}, the text does not, and the model records our interpretation, and why.`,
      interface: "A report: for each check, what it checks, why it matters, and what it found. Each finding links to its articles.",
      model: "All of it: the checks compare the statements with each other, not with the text.",
    },
  ];

  return (
    <main className="page home-page">
      <header className="hero">
        <h1>Car insurance that knows</h1>
        <p className="lead">
          A motor vehicle insurance policy, written down as an ontology: the covers, the rules, the numbers and the
          obligations of its General Conditions, each with the article it comes from. Six applications are derived from
          this one model. They run in your browser.
        </p>
        <p className="warning">
          Demonstration only. Not insurance advice. Not made or checked by Zurich. The model is our reading of the
          document; your policy and the German text of the conditions decide.
        </p>
        <p className="source">
          Source: {policy.source}. <a href={repository}>Code and ontology on GitHub</a>
        </p>
      </header>

      <section className="cases">
        {cases.map((c) => (
          <article key={c.path} className="case">
            <h2>
              <a href={`#/${c.path}`}>{c.title}</a>
            </h2>
            <p className="ask">{c.question}</p>
            <dl>
              <dt>What it shows</dt>
              <dd>{c.shows}</dd>
              <dt>The interface</dt>
              <dd>{c.interface}</dd>
              <dt>What the model gives it</dt>
              <dd>{c.model}</dd>
            </dl>
            <a className="open" href={`#/${c.path}`}>
              Open {c.title.toLowerCase()}
            </a>
          </article>
        ))}
      </section>

      <section className="how">
        <h2>How it works</h2>
        <ol className="pipeline">
          <li>
            <strong>Knowledge</strong>
            <span>7 Turtle files in ontology/: the words of insurance, the product, the questions, the rules, the numbers, the obligations, the certificates</span>
          </li>
          <li>
            <strong>Generator</strong>
            <span>At build time: Turtle to JSON, then the checks of the model and the test claims</span>
          </li>
          <li>
            <strong>Generated files</strong>
            <span>policy.json and checks.json, tracked by Git, so a review shows what a change to the model changes</span>
          </li>
          <li>
            <strong>Engine</strong>
            <span>TypeScript without a user interface: claim, amount, obligations, deadlines, checks, record</span>
          </li>
          <li>
            <strong>Applications</strong>
            <span>The six views of this page, in React, in the browser</span>
          </li>
        </ol>
        <p>
          The engine knows the words of an insurance policy (module, cover, exclusion, reduction, precedence, deadline), not
          this product. The General Conditions say what each module covers; the certificate of a policy says which modules
          and options it has. Accidental damage insurance (Art. 201 to 204) is modelled rule by rule, with the amount. For
          the other modules, the model says which events belong to them, their exclusions and their benefits.
        </p>
        <p className="status-line">
          Checks now: {checks.filter((c) => status(c) === "ok").length} pass, {checks.filter((c) => status(c) === "resolved").length} pass with decisions
          that the model records, {open.length} open findings. <a href="#/checks">See the report</a>.
        </p>
      </section>

      <section className="not-here">
        <h2>Not in this demonstrator</h2>
        <p>
          Two more applications use the same engine, but they need a language model and a server, and this demonstrator
          runs only in the browser:
        </p>
        <ul>
          <li>
            <strong>Questions in your own words.</strong> A chat where a language model turns a question into calls of the
            engine and answers with the articles, or says that the policy does not answer it.
          </li>
          <li>
            <strong>Tools for agents.</strong> The functions of the engine (is it covered, the amount, the deadlines) as
            tools that an AI agent can call, with the decision record as the result.
          </li>
        </ul>
      </section>
    </main>
  );
}
