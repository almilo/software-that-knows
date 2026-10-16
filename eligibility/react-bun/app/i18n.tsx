// The languages of the app. Every text, the app's own included (form.ttl), comes from the
// generated messages.json of the domain, in the languages of the domain.
import { createContext, useContext } from "react";

// The first language of the browser that the domain has, otherwise English, otherwise its first.
export function preferred(languages: string[]) {
  const browser = (navigator.languages ?? []).map((l) => l.slice(0, 2)).find((l) => languages.includes(l));
  return browser ?? (languages.includes("en") ? "en" : languages[0]!);
}

// messages: the texts of the domain, by language. region: how dates and numbers are written.
export function translator(language: string, messages: Record<string, Record<string, string>>, region?: string) {
  const locale = region ? `${language}-${region}` : language;
  function text(key: string) {
    return messages[language]?.[key];
  }
  function t(key: string, values: Record<string, unknown> = {}) {
    return (text(key) ?? key).replace(/\{(\w+)\}/g, (_, name) => String(values[name]));
  }
  function number(n: number) {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(n);
  }
  // A date of the model (YYYY-MM-DD), in the language of the app.
  function date(iso: string) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(y!, m! - 1, d));
  }
  // A value of the model: a date, a number, or a choice of a field.
  function value(v: unknown, field?: string) {
    if (typeof v === "number") return number(v);
    if (typeof v === "string" && /^\d{4}-\d\d-\d\d$/.test(v)) return date(v);
    return field ? t(`${field}.${v}`) : String(v);
  }
  return { language, text, t, number, date, value };
}

export type Translator = ReturnType<typeof translator>;
export const I18n = createContext<Translator>(translator("en", {}));
export function useI18n() {
  return useContext(I18n);
}
