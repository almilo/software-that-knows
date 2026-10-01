// Held-out notes: written before any improvement of the interpretation, and never used to tune it.
// The evaluations report them separately from the development cases in phrases.ts. Do not change
// them to fit a result: that would make the held-out numbers meaningless.
import type { Case } from "./phrases";

export const heldOut: Case[] = [
  {
    text: "Toddler brought in with high fever since this morning. Temperature under the arm 39.4. Mother says he had a fit last night that lasted about 20 minutes.",
    answers: { feverReported: true, feverDuration: "7 days or less", axillaryTemperature: 39.4, convulsions: true, convulsionCount: "one", convulsionLong: true },
  },
  {
    text: "Baby is floppy and hard to wake. Fever. Refuses the breast.",
    answers: { lethargic: true, feverReported: true, notAbleToDrink: true },
  },
  {
    text: "Hot body for 9 days, not every day. No cough, no runny nose.",
    answers: { feverReported: true, feverDuration: "more than 7 days", feverEveryDay: false, cough: false, runnyNose: false },
  },
  {
    text: "No malaria in this district. Child feverish, temp 38.2 rectal.",
    answers: { malariaRisk: "no", feverReported: true, rectalTemperature: 38.2 },
  },
  {
    text: "Malaria RDT not done because we ran out of tests. High-transmission area.",
    answers: { malariaTest: "unknown", malariaRisk: "high" },
  },
  {
    text: "She has sores all over her mouth, deep ones, and her eyes look cloudy.",
    answers: { mouthUlcers: "deep and extensive", corneaClouding: true },
  },
  {
    text: "Rash on the whole body with cough and red eyes, started with fever four days ago.",
    answers: { skinProblem: "generalized", cough: true, redEyes: true, feverReported: true, feverDuration: "7 days or less" },
  },
  {
    text: "The child keeps vomiting everything, even water. When we gave the cup she could not drink at all.",
    answers: { vomitsEverything: true, notAbleToDrink: true, oralFluidTest: "completely unable to drink" },
  },
  {
    text: "Swollen, warm ankle and he won't walk on that leg. Fever two days.",
    answers: { warmTenderJoint: true, refusalToUseLimb: true, feverReported: true, feverDuration: "7 days or less" },
  },
  {
    text: "Burning when passing urine according to the mother. Temperature not measured, no thermometer at the post, the forehead feels hot.",
    answers: { painPassingUrine: true, thermometerNotAvailable: true, hotToTouch: true },
  },
  {
    text: "Parasite count very high on the smear, test positive.",
    answers: { malariaTest: "positive", highParasiteDensity: true },
  },
  {
    text: "Neck is stiff and she is convulsing now.",
    answers: { stiffNeck: true, convulsingNow: true },
  },
  {
    text: "Measles last month. Got vitamin A two weeks ago. Some pus in the left eye.",
    answers: { measlesRecent: true, vitaminARecent: true, pusFromEye: true },
  },
  {
    text: "Fever, clear cause: she has an ear infection. We live in a low malaria area and have not travelled.",
    answers: { feverReported: true, obviousCause: true, malariaRisk: "low", travelToHighRiskArea: false },
  },
  {
    text: "White patches in the mouth, like thrush. No fever.",
    answers: { mouthUlcers: "oral thrush", feverReported: false },
  },
];
