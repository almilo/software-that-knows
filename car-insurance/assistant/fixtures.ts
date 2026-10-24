// Answers in OpenUI Lang for the five questions of the evaluation, written by hand: what a good
// answer of the language model looks like. The tests render them through the components and the
// engine; the server replays them when no API key is set, so the app runs without a model. They
// are not output of a language model: `bun run eval` asks the model itself. Where the policy does
// not include the module or the option, the answer adds a what-if with it.
export const fixtures: { question: string; response: string }[] = [
  {
    question: "Is damage from driving on a flooded road covered?",
    response: `root = Answer([check])
$facts = {event: "HazardEvent", hazardKind: "DroveIntoWater"}
check = ClaimCheck($facts)`,
  },
  {
    question: "Can I use my motor insurance to sue someone who damaged my car and refuses to pay?",
    response: `root = Answer([check, whatIf])
$facts = {event: "LegalEvent", legalKind: "ClaimDamages"}
check = ClaimCheck($facts)
withLegal = Query("assess_claim", {facts: $facts, changes: {hasLegal: "Yes"}}, {status: "open"})
whatIf = Columns([Verdict("With legal protection", withLegal, $facts)])`,
  },
  {
    question: "If I'm injured as a passenger in my own car when my partner is driving, are my medical expenses covered by the auto insurance?",
    response: `root = Answer([check, todo])
$facts = {event: "InjuryEvent", injuredPerson: "Passenger"}
check = ClaimCheck($facts)
todo = Obligations({injury: "Yes"})`,
  },
  {
    question: "My car broke down on the autobahn and won't start — will Zurich send someone to tow me to a garage?",
    response: `root = Answer([note, check, whatIf, todo])
note = Note("The autobahn is outside Switzerland, so I took the place as elsewhere in Europe.")
$facts = {event: "BreakdownEvent", place: "Europe"}
check = ClaimCheck($facts)
withRoadside = Query("assess_claim", {facts: $facts, changes: {hasRoadside: "Yes"}}, {status: "open"})
whatIf = Columns([Verdict("With roadside assistance", withRoadside, $facts)])
todo = Obligations({unusable: "Yes", abroad: "Yes"})`,
  },
  {
    question: "Someone smashed my car window and stole my laptop from the back seat — am I covered for the laptop?",
    response: `root = Answer([check, whatIf, todo])
$facts = {event: "TheftEvent", theftKind: "ItemsStolen"}
check = ClaimCheck($facts)
withItems = Query("assess_claim", {facts: $facts, changes: {hasItemsTransported: "Yes"}}, {status: "open"})
whatIf = Columns([Verdict("With the option items transported", withItems, $facts)])
todo = Obligations({stolen: "Yes", damaged: "Yes"})`,
  },
];
