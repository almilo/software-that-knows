// The generated files, typed. The app reads nothing else.
import type { Check } from "../engine/checks";
import type { Policy } from "../engine/model";
import checksJson from "../generated/checks.json";
import policyJson from "../generated/policy.json";

export const policy = policyJson as unknown as Policy;
export const checks = (checksJson as unknown as { checks: Check[] }).checks;

export const repository = "https://github.com/almilo/software-that-knows/tree/main/car-insurance";

export const article = (id: string) => policy.articles.find((a) => a.id === id);
export const cover = (id: string) => policy.covers.find((c) => c.id === id)!;
export const part = (id: string) => policy.parts.find((p) => p.id === id)!;
export const concept = (id: string) => policy.concepts.find((c) => c.id === id);
export const anyRule = (id: string) => policy.rules.find((r) => r.id === id) ?? policy.benefits.find((b) => b.id === id);
