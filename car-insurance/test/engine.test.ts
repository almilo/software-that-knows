import { describe, expect, test } from "bun:test";
import { createClaim } from "../engine/claim";
import { addOffset, deadlines } from "../engine/dates";
import { obligations } from "../engine/guide";
import { generatePolicy } from "../generator/generate-policy";
import { readModel } from "../generator/generate";

const policy = generatePolicy(await readModel());
const claim = createClaim(policy);

describe("the claim check asks only the questions that can change the decision", () => {
  test("it starts with the vehicle and the event", () => {
    expect(claim.next({})?.id).toBe("vehicleClass");
    expect(claim.next({ vehicleClass: "PassengerCar" })?.id).toBe("event");
  });

  test("the kind of fire after a fire, and no question of theft", () => {
    expect(claim.next({ vehicleClass: "PassengerCar", event: "FireEvent" })?.id).toBe("fireKind");
  });

  test("the steering lock only for a motorcycle", () => {
    const stolen = { event: "TheftEvent", theftKind: "VehicleStolen" };
    expect(claim.next({ vehicleClass: "Motorcycle", ...stolen })?.id).toBe("motorcycleSecured");
    expect(claim.next({ vehicleClass: "PassengerCar", ...stolen })?.id).toBe("place");
  });

  test("the option for gross negligence only after gross negligence", () => {
    const before = { vehicleClass: "PassengerCar", event: "CollisionEvent", place: "CHFL", use: "NormalUse", driver: "Licensed", journey: "Permitted", alcohol: "Sober", crime: "NoCrime", emergency: "NoEmergency", operation: "NotOperation" };
    expect(claim.next(before)?.id).toBe("fault");
    expect(claim.next({ ...before, fault: "NoFault" })?.id).toBe("monthsOfService");
    expect(claim.next({ ...before, fault: "GrossNegligence" })?.id).toBe("hasCollisionGrossNegligence");
  });

  test("no more questions after an exclusion", () => {
    const answers = { vehicleClass: "PassengerCar", event: "CollisionEvent", place: "Elsewhere" };
    expect(claim.evaluate(answers).status).toBe("excluded");
    expect(claim.next(answers)).toBeUndefined();
  });

  test("a changed answer drops the answers that are no longer needed", () => {
    const answers = { vehicleClass: "PassengerCar", event: "TheftEvent", theftKind: "VehicleStolen", place: "CHFL" };
    expect(claim.asked({ ...answers, event: "FireEvent" }).map((f) => f.id)).toEqual(["vehicleClass", "event"]);
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
    expect(ids({ helpPointAgreed: "Yes" })).not.toContain("HelpPoint");
    expect(ids({ helpPointAgreed: "Yes", damaged: "Yes" })).toContain("HelpPoint");
  });
});
