import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { ready } from "../core/rdf";
import { createDomain, DomainContext, type Domain, type DomainFiles } from "./domain";
import { I18n, preferred, translator } from "./i18n";
import { Wizard } from "./Wizard";

function App({ domain }: { domain: Domain }) {
  const { languages, messages, region, schema } = domain;
  const [language, setLanguage] = useState(() => preferred(languages));
  const i18n = useMemo(() => translator(language, messages, region), [language]);
  const { t } = i18n;
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = t(`${schema.i18n}.label`);
  }, [language]);
  return (
    <DomainContext.Provider value={domain}>
      <I18n.Provider value={i18n}>
        <main>
          <header>
            <h1>{t(`${schema.i18n}.label`)}</h1>
            <select aria-label="Language" value={language} onChange={(e) => setLanguage(e.target.value)}>
              {languages.map((l) => (
                <option key={l} value={l}>
                  {translator(l, messages).t("language.label")}
                </option>
              ))}
            </select>
            <p className="warning">{t(`${schema.i18n}.comment`)}</p>
          </header>
          <Wizard />
        </main>
      </I18n.Provider>
    </DomainContext.Provider>
  );
}

// Starts the app for one domain. Each domain's entry (domains/<name>/main.tsx) calls it.
export async function start(files: DomainFiles) {
  await ready; // the engine needs the WebAssembly of Oxigraph
  createRoot(document.getElementById("root")!).render(<App domain={createDomain(files)} />);
}
