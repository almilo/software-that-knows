import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Checks } from "./Checks";
import { Claim } from "./Claim";
import { Compare } from "./Compare";
import { Dates } from "./Dates";
import { Guide } from "./Guide";
import { Home } from "./Home";
import { PolicyExplorer } from "./PolicyExplorer";

// The views, by the first part of the hash: #/claim, #/policy/204.6. Hash links keep the build
// static: any static host can serve it from any path.
export const views = [
  { path: "claim", label: "Claim check" },
  { path: "guide", label: "After an event" },
  { path: "dates", label: "Dates" },
  { path: "compare", label: "Compare" },
  { path: "policy", label: "Policy explorer" },
  { path: "checks", label: "Model checks" },
] as const;

function useHash() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const update = () => setHash(location.hash);
    addEventListener("hashchange", update);
    return () => removeEventListener("hashchange", update);
  }, []);
  return hash.replace(/^#\/?/, "").split("/");
}

function App() {
  const [view = "", param] = useHash();
  useEffect(() => {
    scrollTo(0, 0);
  }, [view]);
  const content =
    view === "claim" ? <Claim />
    : view === "guide" ? <Guide />
    : view === "dates" ? <Dates />
    : view === "compare" ? <Compare />
    : view === "policy" ? <PolicyExplorer selected={param} />
    : view === "checks" ? <Checks />
    : <Home />;
  return (
    <>
      <nav className="top">
        <a href="#/" className={view === "" ? "home current" : "home"}>
          Car insurance that knows
        </a>
        <div className="views">
          {views.map((v) => (
            <a key={v.path} href={`#/${v.path}`} className={view === v.path ? "current" : undefined}>
              {v.label}
            </a>
          ))}
        </div>
      </nav>
      {content}
      <footer>
        Demonstration only. Not insurance advice, and not made or checked by Zurich. The decisions are our reading of the
        General Conditions of Insurance, edition 01/2015; your policy and the German text of the conditions decide.
      </footer>
    </>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
