import { describe, expect, test } from "bun:test";
import { createClaim } from "../engine/claim";
import { addOffset, deadlines } from "../engine/dates";
import { obligations } from "../engine/guide";
import { generatePolicy } from "../generator/generate-policy";
import { readModel } from "../generator/generate";

const policy = generatePolicy(await readModel());
const claim = createClaim(policy);
// A policy with every module and option, as the app gives it from the certificate.
const full = policy.certificates.find((c) => c.id === "FullCertificate")!.answers;
const example = policy.certificates.find((c) => c.id === "ExampleCertificate")!.answers;

describe("the claim check asks only the questions that can change the decision", () => {
  test("without a certificate, it starts with the vehicle and the event", () => {
    expect(claim.next({})?.id).toBe("vehicleClass");
    expect(claim.next({ vehicleClass: "PassengerCar" })?.id).toBe("event");
  });

  test("the kind of fire after a fire, and no question of theft", () => {
    expect(claim.next({ ...full, event: "FireEvent" })?.id).toBe("fireKind");
  });

  test("the steering lock only for a motorcycle", () => {
    const stolen = { event: "TheftEvent", theftKind: "VehicleStolen" };
    expect(claim.next({ ...full, vehicleClass: "Motorcycle", ...stolen })?.id).toBe("motorcycleSecured");
    expect(claim.next({ ...full, ...stolen })?.id).toBe("place");
  });

  test("no question about a natural hazard after a collision", () => {
    const asked = claim.asked({ ...full, event: "CollisionEvent", place: "CHFL" }).map((f) => f.id);
    expect(asked).not.toContain("hazardKind");
  });

  test("the option for gross negligence counts only after gross negligence", () => {
    // A certificate that does not say whether the option is included: the check asks it.
    const { hasCollisionGrossNegligence: _, ...withoutOption } = full;
    const before = { ...withoutOption, event: "CollisionEvent", place: "CHFL", use: "NormalUse", driver: "Licensed", journey: "Permitted", alcohol: "Sober", crime: "NoCrime", emergency: "NoEmergency", operation: "NotOperation" };
    expect(claim.next(before)?.id).toBe("fault");
    expect(claim.next({ ...before, fault: "NoFault" })?.id).toBe("monthsOfService");
    expect(claim.next({ ...before, fault: "GrossNegligence" })?.id).toBe("hasCollisionGrossNegligence");
  });

  test("no more questions after an exclusion", () => {
    const answers = { ...full, event: "CollisionEvent", place: "Elsewhere" };
    expect(claim.evaluate(answers).status).toBe("excluded");
    expect(claim.next(answers)).toBeUndefined();
  });

  test("a changed answer drops the answers that are no longer needed", () => {
    const answers = { vehicleClass: "PassengerCar", hasPartialCasco: "Yes", event: "TheftEvent", theftKind: "VehicleStolen", place: "CHFL" };
    expect(claim.asked({ ...answers, event: "FireEvent" }).map((f) => f.id)).toEqual(["vehicleClass", "event"]);
  });
});

describe("the certificate decides which modules a claim can use", () => {
  test("a module that the certificate does not include", () => {
    const r = claim.evaluate({ ...example, event: "BreakdownEvent", place: "CHFL" });
    expect([r.status, r.cover?.id]).toEqual(["moduleNotActive", "RoadsideCHFL"]);
  });

  test("the same breakdown with roadside assistance", () => {
    const r = claim.evaluate({ ...full, event: "BreakdownEvent", place: "CHFL", use: "NormalUse", driver: "Licensed", journey: "Permitted", alcohol: "Sober", crime: "NoCrime", emergency: "NoEmergency" });
    expect(r.status).toBe("covered");
    expect(r.benefits?.find((b) => b.label.startsWith("All benefits together"))?.amount).toBe(1000);
  });

  test("the accident benefits show the sums of the certificate", () => {
    const r = claim.evaluate({ ...example, event: "InjuryEvent", injuredPerson: "Passenger", place: "CHFL", use: "NormalUse", driver: "Licensed", journey: "Permitted", alcohol: "Sober", crime: "NoCrime", emergency: "NoEmergency" });
    expect(r.status).toBe("covered");
    expect(r.benefits?.map((b) => b.amount).filter((x) => x !== undefined)).toEqual([30000, 60000, 25, 25]);
  });
});

describe("deadlines", () => {
  test("three months and one day before the renewal", () => expect(addOffset("2027-01-01", "-P3M1D")).toBe("2026-09-30"));
  test("a day that the month does not have becomes its last day", () => expect(addOffset("2026-05-31", "-P3M")).toBe("2026-02-28"));
  test("weeks and years", () => {
    expect(addOffset("2026-12-20", "P4W")).toBe("2027-01-17");
    expect(addOffset("2024-02-29", "P3Y")).toBe("2027-02-28");
  });
  test("the deadlines of the dates that are given, in order", () => {
    const list = deadlines(policy, { renewalDate: "2027-01-01" }).map((d) => [d.deadline.id, d.date]);
    expect(list).toEqual([
      ["NoticeByPolicyholder", "2026-09-30"],
      ["PremiumChangeInfo", "2026-12-07"],
      ["CancelAfterChange", "2026-12-31"],
    ]);
  });
});

describe("the guide", () => {
  const ids = (a: Record<string, string>) => obligations(policy, a).map((o) => o.id);
  test("always: tell the insurer, help with the investigation", () => expect(ids({})).toEqual(["NotifyInsurer", "Investigation"]));
  test("a theft: the police, the 30 days, criminal charges", () => {
    expect(ids({ stolen: "Yes" })).toEqual(["NotifyInsurer", "CallPolice", "TheftWait", "CriminalCharges", "Investigation"]);
  });
  test("Help Point PLUS only with a damaged vehicle", () => {
    expect(ids({ hasHelpPoint: "Yes" })).not.toContain("HelpPoint");
    expect(ids({ hasHelpPoint: "Yes", damaged: "Yes" })).toContain("HelpPoint");
  });
  test("roadside help only when the policy has roadside assistance", () => {
    expect(ids({ unusable: "Yes", hasRoadside: "Yes" })).toContain("RoadsidePhone");
    expect(ids({ unusable: "Yes", hasRoadside: "No" })).toEqual(["NotifyInsurer", "NoRoadside", "Investigation"]);
  });
  test("legal protection only when the policy has it", () => {
    expect(ids({ legalDispute: "Yes", hasLegal: "No" })).toEqual(["NotifyInsurer", "NoLegal", "Investigation"]);
  });
});
