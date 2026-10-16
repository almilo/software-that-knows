import { useState } from "react";
import { chf } from "../engine/benefit";
import { conditionText } from "../engine/checks";
import type { Article } from "../engine/model";
import { anyRule, article, checks, cover, part, policy } from "./data";
import { Badge, basisWords, Page, Sources } from "./ui";

const kindWords = { cover: "Cover rule", exclusion: "Exclusion", reduction: "Reduction", waiver: "Waiver", territory: "Territory rule" } as const;

// The articles by part, with a filter; for the selected article, its summary, its links, and
// every statement of the model that comes from it.
export function PolicyExplorer({ selected = "202.3f" }: { selected?: string }) {
  const [filter, setFilter] = useState("");
  const a = article(selected) ?? article("202.3f")!;
  const words = filter.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (x: Article) => words.every((w) => `${x.number} ${x.title} ${x.summary ?? ""}`.toLowerCase().includes(w));
  const partOf = (x: Article): string | undefined => x.part ?? (x.within ? partOf(article(x.within)!) : undefined);

  return (
    <Page title="Policy explorer" intro={<>Each article, in our words, with every statement of the model that comes from it. Every article number in the other views links here.</>} wide>
      <div className="explorer">
        <nav className="article-list" aria-label="Articles">
          <input type="search" placeholder="Filter: tyres, theft, 204…" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter the articles" />
          {policy.parts.map((p) => {
            const list = policy.articles.filter((x) => partOf(x) === p.id && matches(x));
            if (!list.length) return null;
            return (
              <div key={p.id}>
                <h3>
                  {p.label} {p.modelled && <Badge status="ok">rules modelled</Badge>}
                </h3>
                <ul>
                  {list.map((x) => (
                    <li key={x.id} className={x.within ? "sub" : undefined}>
                      <a href={`#/policy/${x.id}`} aria-current={x.id === a.id ? "page" : undefined}>
                        <span className="number">{x.number}</span> {x.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>
        <ArticleDetail a={a} partLabel={part(partOf(a) ?? "Common").label} />
      </div>
    </Page>
  );
}

function ArticleDetail({ a, partLabel }: { a: Article; partLabel: string }) {
  const cites = <T extends { sources: string[] }>(xs: T[]) => xs.filter((x) => x.sources.includes(a.id));
  const children = policy.articles.filter((x) => x.within === a.id);
  const referredBy = policy.articles.filter((x) => x.refersTo.includes(a.id));
  const rules = cites(policy.rules);
  const precedences = policy.precedences.filter((p) => [p.winner, p.loser].some((id) => anyRule(id)?.sources.includes(a.id)));
  const findings = checks.flatMap((c) => c.findings.filter((f) => f.status !== "ok" && f.sources.includes(a.id)).map((f) => ({ check: c, f })));
  const statements = [
    ...cites(policy.covers).map((c) => ({ key: c.id, kind: "Cover", text: c.label, extra: c.note })),
    ...cites(policy.benefits).map((b) => ({ key: b.id, kind: "Benefit", text: `${b.covers.map((c) => cover(c).label).join(", ")}: ${b.label}`, extra: b.limit !== undefined ? `Up to CHF ${chf(b.limit)}` : undefined })),
    ...cites(policy.parameters).map((x) => ({ key: x.id, kind: "Number", text: x.label, extra: String(x.amount) })),
    ...cites(policy.obligations).map((o) => ({ key: o.id, kind: "Obligation", text: o.label, extra: o.action })),
    ...cites(policy.deadlines).map((d) => ({ key: d.id, kind: "Deadline", text: d.label, extra: d.meaning })),
    ...cites(policy.closedLists).map((l) => ({ key: l.id, kind: "Closed list", text: l.label, extra: l.items.join(" · ") })),
  ];
  const nothing = !rules.length && !statements.length && !precedences.length;

  return (
    <article className="article-detail">
      <p className="crumbs">
        {partLabel}
        {a.within && (
          <>
            {" "}
            › <a href={`#/policy/${a.within}`}>Art. {article(a.within)!.number}</a>
          </>
        )}
        {a.page && <> · page {a.page}</>}
      </p>
      <h2>
        Art. {a.number} {a.title}
      </h2>
      {a.summary ? <p className="summary">{a.summary}</p> : <p className="hint">No summary: the model uses only the title of this article.</p>}
      {findings.map(({ check, f }) => (
        <p key={f.text} className={`finding ${f.status}`}>
          <Badge status={f.status}>{f.status === "open" ? "open finding" : basisWords[f.basis!]}</Badge> {f.text}{" "}
          <a href="#/checks">{check.title}</a>
        </p>
      ))}
      {children.length > 0 && <Links label="Contains" ids={children.map((x) => x.id)} />}
      {a.refersTo.length > 0 && <Links label="Refers to" ids={a.refersTo} />}
      {referredBy.length > 0 && <Links label="Referred to by" ids={referredBy.map((x) => x.id)} />}

      {rules.length > 0 && (
        <>
          <h3>Rules from this article</h3>
          <ul className="statements">
            {rules.map((r) => (
              <li key={r.id}>
                <span className="kind">{kindWords[r.kind]}</span> <strong>{r.label}</strong>
                <p>
                  {r.covers ? `Gives: ${cover(r.covers).label}. ` : `About: ${r.appliesToNamed.map((id) => policy.parts.find((p) => p.id === id)?.label ?? cover(id).label).join(", ")}. `}
                  {r.when.length ? `When: ${r.when.map((c) => conditionText(policy, c)).join("; and ")}.` : "Always."}
                </p>
                {r.sources.length > 1 && (
                  <p className="also">
                    Also from: <Sources ids={r.sources.filter((s) => s !== a.id)} />
                  </p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {precedences.length > 0 && (
        <>
          <h3>Precedence</h3>
          <ul className="statements">
            {precedences.map((p) => (
              <li key={p.id}>
                <Badge status={p.basis === "text" ? "ok" : "resolved"}>{basisWords[p.basis]}</Badge> “{anyRule(p.winner)!.label}” wins over “{anyRule(p.loser)!.label}”.
                <p>{p.comment}</p>
              </li>
            ))}
          </ul>
        </>
      )}
      {statements.length > 0 && (
        <>
          <h3>Other statements from this article</h3>
          <ul className="statements">
            {statements.map((s) => (
              <li key={`${s.kind}${s.key}`}>
                <span className="kind">{s.kind}</span> <strong>{s.text}</strong>
                {s.extra && <p>{s.extra}</p>}
              </li>
            ))}
          </ul>
        </>
      )}
      {nothing && <p className="hint">No statement of the model comes from this article yet.</p>}
    </article>
  );
}

function Links({ label, ids }: { label: string; ids: string[] }) {
  return (
    <p className="links">
      {label}: <Sources ids={ids} />
    </p>
  );
}
