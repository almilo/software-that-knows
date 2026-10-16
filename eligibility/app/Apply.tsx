import { useState } from "react";
import type { Reply } from "../core/submit";
import { useDomain } from "./domain";
import type { Answers } from "../core/engine";
import { useI18n } from "./i18n";

// Submits the answers (core/submit.ts), and shows the receipt or the refusal. The parent gives a new
// key when the answers change, so an old receipt never stays on screen.
export function Apply({ answers }: { answers: Answers }) {
  const { t, date } = useI18n();
  const { submit } = useDomain();
  const [reply, setReply] = useState<Reply>();

  if (reply && "receipt" in reply) {
    const r = reply.receipt;
    return (
      <section className="receipt">
        <h3>{t("received.label")}</h3>
        <p>{t("receipt.label", { reference: r.reference, date: date(r.received) })}</p>
      </section>
    );
  }
  return (
    <section className="apply">
      <button className="primary" onClick={() => setReply(submit(answers))}>
        {t("submit.label")}
      </button>
      <p className="hint">{t("demo.label")}</p>
      {reply && (
        <p className="error">
          {t(`${reply.refusal.error}.label`)} {reply.refusal.details?.map((id) => t(`${id}.label`)).join(", ")}
        </p>
      )}
    </section>
  );
}
