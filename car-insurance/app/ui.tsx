// Small parts that the views share.
import type { ReactNode } from "react";
import type { Finding } from "../engine/checks";
import { article } from "./data";

// The articles of a statement, as links to the policy explorer. The title shows the summary.
export function Sources({ ids }: { ids: string[] }) {
  if (!ids.length) return null;
  return (
    <span className="sources">
      {ids.map((id) => {
        const a = article(id);
        return (
          <a key={id} href={`#/policy/${id}`} title={a ? `${a.title}${a.summary ? `: ${a.summary}` : ""}` : undefined}>
            Art. {a?.number ?? id}
          </a>
        );
      })}
    </span>
  );
}

export function Badge({ status, children }: { status: Finding["status"] | "covered" | "excluded" | "reduced" | "neutral"; children: ReactNode }) {
  return <span className={`badge ${status}`}>{children}</span>;
}

export const basisWords = { text: "decided by the text", interpretation: "decided by our interpretation" } as const;

export function Page({ title, intro, children, wide }: { title: string; intro: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <main className={wide ? "page wide" : "page"}>
      <header className="page-header">
        <h1>{title}</h1>
        <p className="intro">{intro}</p>
      </header>
      {children}
    </main>
  );
}
