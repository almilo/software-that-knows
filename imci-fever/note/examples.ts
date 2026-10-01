// Example notes that the note panel offers, each with the answers that a correct interpretation gives.
// The evaluations (eval/phrases.ts) score them too, so a change here changes the development cases.
export type Example = { text: string; answers: Record<string, unknown> };

export const notes: Example[] = [
  {
    text: "Girl, 2 years. Fever for 3 days, axillary temperature 38.9. No convulsions, drinks well, no vomiting. We are in a high malaria risk area and the rapid test is positive.",
    answers: {
      feverReported: true,
      feverDuration: "7 days or less",
      axillaryTemperature: 38.9,
      convulsions: false,
      notAbleToDrink: false,
      vomitsEverything: false,
      malariaRisk: "high",
      malariaTest: "positive",
    },
  },
  {
    text: "Boy with fever every day for two weeks. He is very sleepy and not able to drink. Stiff neck.",
    answers: { feverReported: true, feverDuration: "more than 7 days", feverEveryDay: true, lethargic: true, notAbleToDrink: true, stiffNeck: true },
  },
  {
    text: "Fever since yesterday. Cough, runny nose and red eyes, and a generalized rash that looks like measles. Mouth ulcers, not deep.",
    answers: {
      feverReported: true,
      feverDuration: "7 days or less",
      cough: true,
      runnyNose: true,
      redEyes: true,
      skinProblem: "generalized",
      measlesRash: true,
      mouthUlcers: "not deep and extensive",
    },
  },
  {
    text: "No thermometer, but she feels hot. Low malaria risk here and no travel. She cries when she passes urine.",
    answers: { thermometerNotAvailable: true, hotToTouch: true, malariaRisk: "low", travelToHighRiskArea: false, painPassingUrine: true },
  },
];
