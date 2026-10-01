// Notes that a health worker could write, with the answers that a correct interpretation gives. Only the
// facts that the note states: a field that it does not mention must stay empty. The evaluations
// run all of them: the example notes of the note panel (note/examples.ts) and the short phrases below.
import { notes, type Example } from "../note/examples";

export type Case = Example;

// Short phrases, one or two facts each, and phrases that answer no field.
const phrases: Case[] = [
  { text: "He has had fever for 3 days, he is very sleepy and he does not drink.", answers: { feverReported: true, feverDuration: "7 days or less", lethargic: true, notAbleToDrink: true } },
  { text: "No convulsions, not lethargic, drinks well, no vomiting.", answers: { convulsions: false, lethargic: false, notAbleToDrink: false, vomitsEverything: false } },
  { text: "Axillary temperature 38.6", answers: { axillaryTemperature: 38.6 } },
  { text: "Rectal temp is 39.2 degrees", answers: { rectalTemperature: 39.2 } },
  { text: "We have no thermometer but she feels hot.", answers: { thermometerNotAvailable: true, hotToTouch: true } },
  { text: "She had two fits yesterday.", answers: { convulsions: true, convulsionCount: "two or more" } },
  { text: "One short convulsion, less than a minute.", answers: { convulsions: true, convulsionCount: "one", convulsionLong: false } },
  { text: "The child is convulsing right now.", answers: { convulsingNow: true } },
  { text: "He vomits everything he takes.", answers: { vomitsEverything: true } },
  { text: "Malaria risk here is high.", answers: { malariaRisk: "high" } },
  { text: "We are in a low risk area, but the family travelled to a high risk area last week.", answers: { malariaRisk: "low", travelToHighRiskArea: true } },
  { text: "The rapid test is positive.", answers: { malariaTest: "positive" } },
  { text: "RDT negative.", answers: { malariaTest: "negative" } },
  { text: "No test available today.", answers: { malariaTest: "unknown" } },
  { text: "Fever every day for two weeks.", answers: { feverReported: true, feverDuration: "more than 7 days", feverEveryDay: true } },
  { text: "Stiff neck present.", answers: { stiffNeck: true } },
  { text: "No stiff neck.", answers: { stiffNeck: false } },
  { text: "She cries when she passes urine.", answers: { painPassingUrine: true } },
  { text: "Cough and runny nose, eyes are red.", answers: { cough: true, runnyNose: true, redEyes: true } },
  { text: "He refuses to use his left leg and the knee is swollen.", answers: { refusalToUseLimb: true, warmTenderJoint: true } },
  { text: "Generalized rash, looks like measles.", answers: { skinProblem: "generalized", measlesRash: true } },
  { text: "Had measles two months ago.", answers: { measlesRecent: true } },
  { text: "Deep and extensive mouth ulcers.", answers: { mouthUlcers: "deep and extensive" } },
  { text: "Pus coming from the eye, cornea is clear.", answers: { pusFromEye: true, corneaClouding: false } },
  { text: "What dose of paracetamol should I give?", answers: {} },
  // Vague words that must not become answers: "from time to time" is not vomiting everything, the
  // site of the temperature is not stated, and "malaria in the area" does not say high or low.
  {
    text: "The child is hot and the temperature is 40. He has not slept and vomits from time to time. There is malaria in the area and he has been shivering.",
    answers: { feverReported: true, vomitsEverything: false },
  },
];

export const cases: Case[] = [...notes, ...phrases];
