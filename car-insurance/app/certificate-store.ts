import { useSyncExternalStore } from "react";
import type { Answers } from "../engine/model";
import { policy } from "./data";

// The certificate of the policy that the views use: one of the certificates of the model, or one
// that the user changed. The claim check and the guide read it; they do not ask about it.
type State = { id: string; answers: Answers };
const first = policy.certificates[0]!;
let state: State = { id: first.id, answers: first.answers };
const listeners = new Set<() => void>();
const set = (next: State) => {
  state = next;
  listeners.forEach((l) => l());
};

export function useCertificate() {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => state,
  );
}
export const chooseCertificate = (id: string) => set({ id, answers: policy.certificates.find((c) => c.id === id)!.answers });
export const changeCertificate = (changes: Answers) => set({ id: "custom", answers: { ...state.answers, ...changes } });

const certificateFacts = new Set(policy.facts.filter((f) => f.group === "certificate").map((f) => f.id));
export const isCertificateFact = (id: string) => certificateFacts.has(id);
// The answers without the ones of the certificate, and only the ones of the certificate.
export const withoutCertificate = (answers: Answers) => Object.fromEntries(Object.entries(answers).filter(([id]) => !isCertificateFact(id)));
export const onlyCertificate = (answers: Answers) => Object.fromEntries(Object.entries(answers).filter(([id]) => isCertificateFact(id)));
