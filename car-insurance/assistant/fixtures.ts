// Answers in OpenUI Lang for the five questions of the evaluation, written by hand: what a good
// answer of the language model looks like. The tests render them through the components and the
// engine; the server replays them when no API key is set, so the app runs without a model. They
// are not output of a language model: `bun run eval` asks the model itself.
export const fixtures: { question: string; response: string }[] = [
  {
    question: "Is damage from driving on a flooded road covered?",
    response: `root = Answer([check])
check = ClaimCheck({event: "HazardEvent", hazardKind: "DroveIntoWater"})`,
  },
  {
    question: "Can I use my motor insurance to sue someone who damaged my car and refuses to pay?",
    response: `root = Answer([check])
check = ClaimCheck({event: "LegalEvent", legalKind: "ClaimDamages"})`,
  },
  {
    question: "If I'm injured as a passenger in my own car when my partner is driving, are my medical expenses covered by the auto insurance?",
    response: `root = Answer([check, todo])
check = ClaimCheck({event: "InjuryEvent", injuredPerson: "Passenger"})
todo = Obligations({injury: "Yes"})`,
  },
  {
    question: "My car broke down on the autobahn and won't start — will Zurich send someone to tow me to a garage?",
    response: `root = Answer([note, check, todo])
note = Note("The autobahn is outside Switzerland, so I took the place as elsewhere in Europe.")
check = ClaimCheck({event: "BreakdownEvent", place: "Europe"})
todo = Obligations({unusable: "Yes", abroad: "Yes"})`,
  },
  {
    question: "Someone smashed my car window and stole my laptop from the back seat — am I covered for the laptop?",
    response: `root = Answer([check, todo])
check = ClaimCheck({event: "TheftEvent", theftKind: "ItemsStolen"})
todo = Obligations({stolen: "Yes", damaged: "Yes"})`,
  },
];
