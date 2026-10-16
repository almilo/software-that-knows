import { useState } from "react";
import { addOffset, deadlines } from "../engine/dates";
import type { Answers } from "../engine/model";
import { policy } from "./data";
import { Page, Sources } from "./ui";

const facts = policy.facts.filter((f) => f.group === "date");

// The dates: the dates that the user knows, and the timeline of the deadlines that follow from them.
export function Dates() {
  const [dates, setDates] = useState<Answers>({});
  const list = deadlines(policy, dates);
  const today = new Date().toISOString().slice(0, 10);
  const example = () => {
    const nextYear = `${Number(today.slice(0, 4)) + 1}-01-01`;
    setDates({ renewalDate: nextYear, claimFreeSince: addOffset(nextYear, "-P4Y"), claimPaid: addOffset(today, "-P5D"), theftReported: addOffset(today, "-P10D") });
  };
  const label = (id: string) => facts.find((f) => f.id === id)?.label ?? id;

  return (
    <Page title="Dates" intro={<>Enter the dates that you know. Each deadline is one of these dates moved by a duration that the conditions set.</>}>
      <div className="columns">
        <section className="date-fields">
          <h2>Your dates</h2>
          {facts.map((f) => (
            <label key={f.id} className="date-field">
              <span>
                {f.label}
                {f.help && <small>{f.help}</small>}
              </span>
              <input type="date" value={String(dates[f.id] ?? "")} onChange={(e) => setDates((d) => ({ ...d, [f.id]: e.target.value }))} />
            </label>
          ))}
          <div className="buttons">
            <button type="button" onClick={example}>
              Fill example dates
            </button>
            <button type="button" onClick={() => setDates({})}>
              Clear
            </button>
          </div>
        </section>
        <section className="timeline">
          <h2>Deadlines</h2>
          {list.length === 0 && <p className="hint">Enter a date to see its deadlines.</p>}
          <ol>
            {list.map(({ deadline: d, date }) => (
              <li key={d.id} className={date < today ? "past" : undefined}>
                <time dateTime={date}>{format(date)}</time>
                <div>
                  <strong>{d.label}</strong> <span className="who">{d.who}</span>
                  <p>{d.meaning}</p>
                  <p className="derived">
                    {label(d.anchor)} {offsetWords(d.offset)} <Sources ids={d.sources} />
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </Page>
  );
}

const format = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

// -P3M1D → "minus 3 months and 1 day"
function offsetWords(offset: string) {
  const m = /^(-)?P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?$/.exec(offset)!;
  const parts = [
    [m[2], "year"],
    [m[3], "month"],
    [m[4], "week"],
    [m[5], "day"],
  ]
    .filter(([n]) => n)
    .map(([n, unit]) => `${n} ${unit}${n === "1" ? "" : "s"}`);
  return `${m[1] ? "minus" : "plus"} ${parts.join(" and ")}`;
}
