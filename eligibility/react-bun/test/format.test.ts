// The shared cases of how values are written (../conformance/display/format.json): this app writes
// each value as every other stack does. Numbers take their separators from the model
// (form:NumberFormat), since the platforms do not agree on them.
import { describe, expect, test } from "bun:test";
import { translator } from "../app/i18n";
import domain from "../domains/wef/generated/domain.json";
import messages from "../domains/wef/generated/messages.json";

type Case = { language: string; value: unknown; field?: string; expected: string };
const { cases } = (await Bun.file(new URL("../../conformance/display/format.json", import.meta.url).pathname).json()) as { cases: Case[] };

describe("translator().value()", () => {
  test.each(cases.map((c) => [`${c.language} ${c.value}`, c] as const))("writes %s as every stack does", (_, c) => {
    const { $comment: _comment, ...texts } = messages as Record<string, Record<string, string>>;
    expect(translator(c.language, texts, domain.region, domain.numbers).value(c.value, c.field)).toBe(c.expected);
  });
});
