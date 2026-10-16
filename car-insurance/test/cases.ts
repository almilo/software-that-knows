// The test claims: the specification of the claim check. Each claim gives the answers of a user and
// the expected decision: the status, the cover, the rules that decide, the rules that a precedence
// sets aside, and the payment in CHF. The checks walk each claim as the app does (one question
// at a time, only the questions that the decision needs), so a claim also fails when it must answer
// a question that the app would not ask, or does not answer one that it would ask.
import type { Status } from "../engine/claim";
import type { Answers } from "../engine/model";

export type Case = {
  name: string;
  answers: Answers;
  status: Status;
  cover?: string;
  rules?: string[];
  overridden?: string[];
  payment?: number;
};

// No exclusion and no reduction applies.
const normal: Answers = {
  place: "CHFL",
  use: "NormalUse",
  driver: "Licensed",
  journey: "Permitted",
  alcohol: "Sober",
  crime: "NoCrime",
  emergency: "NoEmergency",
  operation: "NotOperation",
  fault: "NoFault",
};

const car = { vehicleClass: "PassengerCar" };
const collision = { ...car, event: "CollisionEvent" };

export const cases: Case[] = [
  {
    name: "Collision, partial loss, deductible reduced after 4 claim-free years",
    answers: { ...collision, ...normal, monthsOfService: 30, catalogPrice: 40000, marketValue: 25000, repairCost: 6000, deductible: 1000, claimFreeYears: 4, helpPoint: "NoHelpPoint" },
    status: "covered",
    cover: "Collision",
    rules: ["CollisionRule"],
    payment: 5500,
  },
  {
    name: "Collision in the first year: total loss at 65% of the table value",
    answers: { ...collision, ...normal, monthsOfService: 6, catalogPrice: 50000, repairCost: 40000, deductible: 1000, claimFreeYears: 0, helpPoint: "NoHelpPoint" },
    status: "covered",
    cover: "Collision",
    payment: 49000,
  },
  {
    name: "Collision in the middle of year 2: 90% of the catalogue price, pro rata",
    answers: { ...collision, ...normal, monthsOfService: 18, catalogPrice: 50000, repairCost: 30000, deductible: 1000, claimFreeYears: 0, helpPoint: "NoHelpPoint" },
    status: "covered",
    payment: 44000,
  },
  {
    name: "Collision with 1.6 per mille or more",
    answers: { ...collision, ...normal, alcohol: "HighAlcohol" },
    status: "excluded",
    rules: ["CollisionRule", "HighAlcohol"],
  },
  {
    name: "Collision under the influence, below 1.6 per mille",
    answers: { ...collision, ...normal, alcohol: "Influenced", monthsOfService: 10, catalogPrice: 30000, repairCost: 4000, deductible: 500, claimFreeYears: 0, helpPoint: "NoHelpPoint" },
    status: "reduced",
    rules: ["CollisionRule", "AlcoholReduction"],
    payment: 3500,
  },
  {
    name: "Gross negligence, with coverage for gross negligence",
    answers: {
      ...collision,
      ...normal,
      fault: "GrossNegligence",
      hasCollisionGrossNegligence: "Yes",
      monthsOfService: 10,
      catalogPrice: 30000,
      repairCost: 4000,
      deductible: 500,
      claimFreeYears: 0,
      helpPoint: "NoHelpPoint",
    },
    status: "covered",
    overridden: ["GrossNegligenceReduction"],
    payment: 3500,
  },
  {
    name: "Gross negligence, without coverage for gross negligence",
    answers: { ...collision, ...normal, fault: "GrossNegligence", hasCollisionGrossNegligence: "No", monthsOfService: 10, catalogPrice: 30000, repairCost: 4000, deductible: 500, claimFreeYears: 0, helpPoint: "NoHelpPoint" },
    status: "reduced",
    rules: ["CollisionRule", "GrossNegligenceReduction"],
  },
  {
    name: "Theft of fuel",
    answers: { ...car, event: "TheftEvent", theftKind: "FuelOnly" },
    status: "excluded",
    rules: ["FuelTheft"],
  },
  {
    name: "Motorcycle stolen outside without the steering lock",
    answers: { vehicleClass: "Motorcycle", event: "TheftEvent", theftKind: "VehicleStolen", motorcycleSecured: "NotSecured" },
    status: "excluded",
    cover: "Theft",
    rules: ["TheftRule", "MotorcycleNotSecured"],
  },
  {
    name: "Car stolen and not found within 30 days: total loss in year 4",
    answers: { ...car, event: "TheftEvent", theftKind: "VehicleStolen", ...normal, theftRecovered: "NotRecovered", monthsOfService: 40, catalogPrice: 60000, marketValue: 30000, deductible: 200, helpPoint: "NoHelpPoint" },
    status: "covered",
    cover: "Theft",
    payment: 42800,
  },
  {
    name: "Paintwork scratched: not in the closed list of vandalism",
    answers: { ...car, event: "VandalismEvent", vandalismKind: "Scratched" },
    status: "excluded",
    rules: ["NotInVandalismList"],
  },
  {
    name: "Tyres punctured by a vandal: the list wins over the tyre exclusion (our interpretation)",
    answers: { ...car, event: "VandalismEvent", vandalismKind: "PuncturedTyres", ...normal, operation: "TyresOrBatteryOnly", monthsOfService: 10, catalogPrice: 30000, repairCost: 800, deductible: 200, helpPoint: "NoHelpPoint" },
    status: "covered",
    cover: "Vandalism",
    overridden: ["TyresOrBatteries"],
    payment: 600,
  },
  {
    name: "A broken headlight, without Glass PLUS",
    answers: { ...car, event: "GlassEvent", glassPart: "OtherGlass", hasGlassPlus: "No" },
    status: "notAgreed",
    cover: "GlassPlus",
  },
  {
    name: "A broken headlight on a motorcycle: Glass PLUS is basic",
    answers: { vehicleClass: "Motorcycle", event: "GlassEvent", glassPart: "OtherGlass", glassCost: "BelowValue", ...normal, monthsOfService: 30, catalogPrice: 20000, marketValue: 12000, repairCost: 400, deductible: 0, helpPoint: "NoHelpPoint" },
    status: "covered",
    cover: "GlassPlus",
    payment: 400,
  },
  {
    name: "Protective clothing for a car",
    answers: { ...car, event: "ClothingEvent" },
    status: "notInsurable",
    cover: "ProtectiveClothing",
  },
  {
    name: "The third parking damage of the year",
    answers: { ...car, event: "ParkingEvent", hasParkingDamage: "Yes", parkingCount: "ThirdOrMore" },
    status: "excluded",
    rules: ["ParkingRule", "ThirdParkingDamage"],
  },
  {
    name: "Parking damage above the limit, without PLUS",
    answers: {
      ...car,
      event: "ParkingEvent",
      hasParkingDamage: "Yes",
      parkingCount: "FirstOrSecond",
      ...normal,
      hasParkingDamagePlus: "No",
      monthsOfService: 50,
      catalogPrice: 35000,
      marketValue: 18000,
      repairCost: 2500,
      deductible: 0,
      helpPoint: "NoHelpPoint",
    },
    status: "covered",
    payment: 1000,
  },
  {
    name: "Parking damage, without the option",
    answers: { ...car, event: "ParkingEvent", hasParkingDamage: "No" },
    status: "notAgreed",
  },
  {
    name: "Wind below 75 km/h",
    answers: { ...car, event: "HazardEvent", hazardKind: "OtherHazard" },
    status: "excluded",
    rules: ["OtherHazards"],
  },
  {
    name: "Swerved to avoid a deer: collision damage, deductible not below 0",
    answers: { ...car, event: "AnimalEvent", animalKind: "Swerved", ...normal, monthsOfService: 12, catalogPrice: 30000, repairCost: 3000, deductible: 500, claimFreeYears: 6, helpPoint: "NoHelpPoint" },
    status: "covered",
    cover: "Collision",
    rules: ["SwervedForAnimal"],
    payment: 3000,
  },
  {
    name: "A laptop in a truck",
    answers: { vehicleClass: "OtherVehicle", event: "ItemsEvent", hasItemsTransported: "Yes", itemsKind: "Electronics" },
    status: "excluded",
    rules: ["ItemsRule", "ElectronicsInOtherVehicle"],
  },
  {
    name: "Luggage stolen from the locked car: no deductible",
    answers: { ...car, event: "ItemsEvent", hasItemsTransported: "Yes", itemsKind: "OrdinaryItems", itemsHow: "BreakIn", ...normal, repairCost: 1200 },
    status: "covered",
    cover: "ItemsTransported",
    payment: 1200,
  },
  {
    name: "Collision in an excluded country",
    answers: { ...collision, place: "ExcludedCountry" },
    status: "excluded",
    rules: ["CollisionRule", "OutsideTerritory"],
  },
  {
    name: "A tyre burst and the car hit a wall: collision as a consequence of wear",
    answers: { ...collision, ...normal, operation: "AfterBreakdown", monthsOfService: 10, catalogPrice: 30000, repairCost: 5000, deductible: 1000, claimFreeYears: 0, helpPoint: "NoHelpPoint" },
    status: "covered",
    payment: 4000,
  },
  {
    name: "Help Point PLUS not followed: 500 CHF more deductible",
    answers: { ...collision, ...normal, monthsOfService: 5, catalogPrice: 40000, repairCost: 5000, deductible: 1000, claimFreeYears: 3, helpPoint: "HelpPointNotFollowed" },
    status: "covered",
    payment: 4000,
  },
  {
    name: "A person of the household used the car without permission",
    answers: { ...car, event: "TheftEvent", theftKind: "HouseholdUse" },
    status: "excluded",
    rules: ["HouseholdUseNotTheft"],
  },
  {
    name: "Fire during civil unrest, with precautions; after 7 years: the replacement value",
    answers: { ...car, event: "FireEvent", fireKind: "Flames", ...normal, emergency: "UnrestPrecautions", monthsOfService: 100, catalogPrice: 30000, marketValue: 5000, repairCost: 6000, deductible: 300, helpPoint: "NoHelpPoint" },
    status: "covered",
    cover: "Fire",
    payment: 4700,
  },
  {
    name: "Damage with intent",
    answers: { ...collision, ...normal, fault: "Intent" },
    status: "excluded",
    rules: ["CollisionRule", "Intent"],
  },
];
