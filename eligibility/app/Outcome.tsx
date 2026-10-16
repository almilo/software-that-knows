import type { Evaluation } from "../core/engine";
import { useI18n } from "./i18n";

// What the rules found: each finding in the colour of its severity (the CSS class), then, when
// nothing blocks the application, its next steps; under them the values that the answers give.
// Each item names its sources.
type Props = Pick<Evaluation, "findings" | "nextSteps" | "values" | "allowed">;

export function Outcome({ findings, nextSteps, values, allowed }: Props) {
  const { t, value } = useI18n();
  function sources(ids: string[]) {
    return ids.length > 0 && <small>{ids.map((id) => t(`${id}.label`)).join(", ")}</small>;
  }
  return (
    <>
      {findings.map((f) => (
        <article key={f.id} className={f.severity}>
          <h4>
            {t(`${f.severity}.label`)}: {t(`${f.id}.label`)}
          </h4>
          <p>{t(`${f.id}.comment`)}</p>
          {sources(f.sources)}
        </article>
      ))}
      {allowed && (
        <article className="allowed">
          <h4>{t("allowed.label")}</h4>
          <p>{t("nextSteps.label")}:</p>
          <ul>
            {nextSteps.map((s) => (
              <li key={s.id}>
                {t(`${s.id}.label`)} {sources(s.sources)}
              </li>
            ))}
          </ul>
        </article>
      )}
      {values.length > 0 && (
        <dl className="values">
          {values.map((v) => (
            <div key={v.id}>
              <dt>{t(`${v.id}.label`)}</dt>
              <dd>
                {value(v.value)} {sources(v.sources)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </>
  );
}
