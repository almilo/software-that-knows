import { useState } from "react";
import { chf } from "../engine/benefit";
import type { Availability, Benefit } from "../engine/model";
import { concept, cover, policy } from "./data";
import { Badge, basisWords, Page, Sources } from "./ui";

const symbols: Record<Availability, string> = { basic: "●", option: "○", none: "–" };
const words: Record<Availability, string> = { basic: "in the basic scope of the module", option: "option of the module", none: "not insurable" };

// The product overview for each vehicle class, and two covers side by side, benefit by benefit.
export function Compare() {
  const [vehicle, setVehicle] = useState(policy.vehicleClasses[0]!.id);
  const [comparisonId, setComparison] = useState(policy.comparisons[0]!.id);
  const comparison = policy.comparisons.find((c) => c.id === comparisonId)!;

  return (
    <Page title="Compare" intro={<>What each vehicle class gets, and what an option adds. All of it comes from the product overview and the articles.</>} wide>
      <section>
        <h2>Product overview</h2>
        <div className="segmented" role="group" aria-label="Vehicle class">
          {policy.vehicleClasses.map((v) => (
            <button key={v.id} type="button" aria-pressed={vehicle === v.id} onClick={() => setVehicle(v.id)} title={v.help}>
              {v.label}
            </button>
          ))}
        </div>
        <div className="table-scroll">
          <table className="overview">
            <thead>
              <tr>
                <th>Cover</th>
                {policy.vehicleClasses.map((v) => (
                  <th key={v.id} className={v.id === vehicle ? "marked" : undefined}>
                    {v.label}
                  </th>
                ))}
                <th>Articles</th>
              </tr>
            </thead>
            {policy.parts
              .filter((p) => policy.covers.some((c) => c.part === p.id))
              .map((p) => (
                <tbody key={p.id}>
                  <tr className="part">
                    <th colSpan={policy.vehicleClasses.length + 2}>{p.label}</th>
                  </tr>
                  {policy.covers
                    .filter((c) => c.part === p.id)
                    .map((c) => (
                      <tr key={c.id}>
                        <td>
                          {c.group && <span className="group">{c.group}: </span>}
                          {c.label}
                          <small className="note">Module: {policy.modules.find((m) => m.id === c.module)!.label}{c.note ? `. ${c.note}` : ""}</small>
                        </td>
                        {policy.vehicleClasses.map((v) => (
                          <td key={v.id} className={`status ${c.availability[v.id]}${v.id === vehicle ? " marked" : ""}`} title={words[c.availability[v.id]!]}>
                            {symbols[c.availability[v.id]!]}
                          </td>
                        ))}
                        <td>
                          <Sources ids={c.sources} />
                        </td>
                      </tr>
                    ))}
                </tbody>
              ))}
          </table>
        </div>
        <p className="legend">● in the basic scope of the module · ○ option · – not insurable. A policy has a cover only when its certificate includes the module (and the option); only third party liability is in every policy.</p>
      </section>

      <section>
        <h2>Side by side</h2>
        <div className="segmented" role="group" aria-label="Comparison">
          {policy.comparisons.map((c) => (
            <button key={c.id} type="button" aria-pressed={comparisonId === c.id} onClick={() => setComparison(c.id)}>
              {c.label}
            </button>
          ))}
        </div>
        <SideBySide left={comparison.left} right={comparison.right} />
      </section>
    </Page>
  );
}

function SideBySide({ left, right }: { left: string; right: string }) {
  const of = (coverId: string) => policy.benefits.filter((b) => b.covers.includes(coverId));
  const rows = [...new Set([...of(left), ...of(right)].flatMap((b) => b.mentions))].map((id) => concept(id)!).sort((a, b) => a.order - b.order);
  const losers = new Map(policy.precedences.map((p) => [p.loser, p]));
  const cell = (coverId: string, conceptId: string) => of(coverId).filter((b) => b.mentions.includes(conceptId));
  const key = (bs: Benefit[]) => bs.map((b) => `${b.label} ${b.limit}`).join("|");

  return (
    <div className="table-scroll">
      <table className="side">
        <thead>
          <tr>
            <th />
            <th>{cover(left).label}</th>
            <th>{cover(right).label}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const l = cell(left, c.id);
            const r = cell(right, c.id);
            return (
              <tr key={c.id} className={key(l) !== key(r) ? "differs" : undefined}>
                <th>{c.label}</th>
                {[l, r].map((bs, i) => (
                  <td key={i}>
                    {bs.length === 0 && <span className="none">—</span>}
                    {bs.map((b) => {
                      const lost = losers.get(b.id);
                      return (
                        <div key={b.id} className={lost ? "benefit set-aside" : "benefit"}>
                          <span>{lost ? <s>{b.label}</s> : b.label}</span>
                          {b.limit !== undefined && <strong> up to CHF {chf(b.limit)}{b.per ? ` per ${b.per}` : ""}</strong>}
                          <Sources ids={b.sources} />
                          {b.note && <small className="note">{b.note}</small>}
                          {lost && (
                            <small className="note">
                              <Badge status={lost.basis === "text" ? "ok" : "resolved"}>set aside, {basisWords[lost.basis]}</Badge> {lost.comment}
                            </small>
                          )}
                        </div>
                      );
                    })}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
