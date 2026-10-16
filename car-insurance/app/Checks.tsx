import { type Check, type Finding, status } from "../engine/checks";
import { checks } from "./data";
import { Badge, basisWords, Page, Sources } from "./ui";

const statusWords = { ok: "pass", resolved: "pass, with decisions", open: "open findings" } as const;

// The report of the checks that ran at build time (generated/checks.json).
export function Checks() {
  const findings = checks.flatMap((c) => c.findings);
  const count = (s: Finding["status"]) => findings.filter((f) => f.status === s).length;
  return (
    <Page
      title="Model checks"
      intro={
        <>
          These checks ran when the app was built, on the model and on the test claims. They compare the statements of the
          document with each other: a person reads one article at a time, the checks see all statements about the same
          thing at once.
        </>
      }
    >
      <div className="summary-tiles">
        <div>
          <strong>{checks.length}</strong> checks
        </div>
        <div className="ok">
          <strong>{count("ok")}</strong> items pass
        </div>
        <div className="resolved">
          <strong>{count("resolved")}</strong> decided by the model
        </div>
        <div className="open">
          <strong>{count("open")}</strong> open
        </div>
      </div>
      <p className="hint">
        <Badge status="resolved">decided by our interpretation</Badge> marks a place where the document is unclear or says two
        things, and the model records which statement wins and why. The insurer must confirm these decisions. A build with an
        open finding fails.
      </p>
      {checks.map((c) => (
        <CheckCard key={c.id} check={c} />
      ))}
    </Page>
  );
}

function CheckCard({ check }: { check: Check }) {
  const s = status(check);
  const notable = check.findings.filter((f) => f.status !== "ok");
  const ok = check.findings.filter((f) => f.status === "ok");
  return (
    <section className={`check ${s}`}>
      <h2>
        {check.title} <Badge status={s}>{statusWords[s]}</Badge>
      </h2>
      <p>
        <strong>What it checks.</strong> {check.what}
      </p>
      <p>
        <strong>Why it matters.</strong> {check.why}
      </p>
      {notable.length > 0 && (
        <ul className="findings">
          {notable.map((f) => (
            <li key={f.text} className={f.status}>
              <Badge status={f.status}>{f.status === "open" ? "open" : basisWords[f.basis!]}</Badge> {f.text} <Sources ids={f.sources} />
              {f.resolution && <p className="resolution">{f.resolution}</p>}
            </li>
          ))}
        </ul>
      )}
      {ok.length > 0 && (
        <details open={ok.length <= 3}>
          <summary>
            {ok.length} {ok.length === 1 ? "item passes" : "items pass"}
          </summary>
          <ul className="findings">
            {ok.map((f) => (
              <li key={f.text} className="ok">
                {f.text} <Sources ids={f.sources} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
