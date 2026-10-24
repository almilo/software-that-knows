// The list of processes (index.html): one card for each domain, with its title and summary, and a
// link to its page. Everything comes from generated/index.json; adding a domain adds its card.
import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import index from "../generated/index.json";
import { preferred, translator } from "./i18n";

const messages: Record<string, Record<string, string>> = index.messages;
const languages = Object.keys(messages);

createRoot(document.getElementById("root")!).render(<Processes />);

export function Processes() {
  const [language, setLanguage] = useState(() => preferred(languages));
  const { t } = useMemo(() => translator(language, messages), [language]);
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = t("processes.label");
  }, [language]);
  return (
    <main>
      <header>
        <h1>{t("processes.label")}</h1>
        <select aria-label="Language" value={language} onChange={(e) => setLanguage(e.target.value)}>
          {languages.map((l) => (
            <option key={l} value={l}>
              {translator(l, messages).t("language.label")}
            </option>
          ))}
        </select>
        <p className="intro">{t("processesIntro.label")}</p>
      </header>
      <ul className="processes">
        {index.domains.map((name) => (
          <li key={name}>
            <a href={`./${name}/`}>
              <h2>{t(`${name}.label`)}</h2>
              <p>{t(`${name}.summary`)}</p>
              <span>{t("open.label")}</span>
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
