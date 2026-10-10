# The ontology

Three Turtle files hold everything the app knows: what the diagram says about each architecture
style, the questions about a team, and the author's rules for choosing a style. The code knows none
of it. A generator reads the three files and writes `../generated/decision.json`, the one file that
the app reads.

| File | Kind of knowledge | Whose | The question it answers |
| --- | --- | --- | --- |
| [`cloud-native-architecture.ttl`](cloud-native-architecture.ttl) | **Facts**: what each style is like | Alok Sharan's diagram | What does each style give and cost? |
| [`criteria.ttl`](criteria.ttl) | **Questions**: how to describe a team | ours | What do we need to know about the team? |
| [`rules.ttl`](rules.ttl) | **Opinion**: which style for which team | Alok Sharan's heuristics, mapped by us | Given the answers, which style, and why? |

## Why three files

A diagram and the post that goes with it mix three kinds of knowledge. Here they are kept apart:

- **They come from different places.** The facts and the opinion are the author's; the questions
  are ours. Each file can say where it comes from and carry its own licence: the diagram's file is
  not licensed, the others are MIT (see `REUSE.toml`).
- **They change at different speeds.** The diagram is fixed. The questions can be refined, for
  example a better definition of a medium team, without touching the rules. The rules are an
  opinion: another author's rules could replace them on the same facts and questions.
- **They are reviewed by different people.** The facts can be checked against the picture, the
  rules against the post, each on its own.

The most important line between them: **the facts never decide.** The diagram says that
microservices are best for "Large engineering teams". In the facts, that stays a label. Only the
rules act on the size of a team.

## How they are joined: names

Every thing in the three files has a name in the same namespace,
`https://example.org/cloud-native-architecture#`, written `:` for short: `:Microservices`,
`:TeamSizeLarge`, `:AwsLambda`. A rule that recommends `:Microservices` means exactly the style that
the facts describe, and a rule whose condition is `:TeamSizeLarge` means exactly the answer that the
questions define. The generator reads the three files as one graph.

## `cloud-native-architecture.ttl`: the facts

The diagram as data: 3 styles, 8 dimensions, 57 characteristics and 12 tools, with the labels as the
diagram writes them and in its order. It decides nothing.

One style, with two of its dimensions:

```turtle
:Microservices a :ArchitectureStyle ; sh:order 1 ;
    rdfs:label "Microservices"@en ;
    :hasCostModel :ContinuousInfrastructureCost , :HigherOperationalOverhead , :EfficientAtLargeScale ;
    :supportedBy  :Kubernetes , :Docker , :Istio , :ApacheKafka .
```

Each characteristic is a thing with a name and a label, not a piece of text:

```turtle
:MinimalIdleCost a :CostModel ; rdfs:label "Minimal idle cost"@en .
```

Each dimension is a property, declared as a kind of `:hasCharacteristic`:

```turtle
:hasCostModel a owl:ObjectProperty ; sh:order 6 ;
    rdfs:subPropertyOf :hasCharacteristic ; rdfs:range :CostModel .
```

The generator finds the dimensions by asking for the kinds of `:hasCharacteristic`, so the code has
no list of them, and `sh:order` keeps the diagram's order. The dimension's name comes from the label
of its range, here `:CostModel`, "Cost model".

**In the app:** the table at the bottom of the page, "What comes with it" in a recommendation, and
the names of the tools.

## `criteria.ttl`: the questions

Eight questions about a team: its size, the number of teams, how separate the business areas are,
the traffic, background work, the platform, the expected growth and the team's experience of
running distributed systems. A rule cannot act on "a large team" until "large" is defined, so every
question and every answer has a definition.

```turtle
:Traffic a :Criterion ; skos:notation "traffic" ; sh:order 4 ;
    rdfs:label "Traffic"@en ;
    skos:definition "How the load from users changes over time."@en ;
    :answers ( :TrafficSteady :TrafficSpikyPredictable :TrafficUnpredictable ) .

:TrafficUnpredictable a :Answer ; skos:notation "unpredictable" ;
    rdfs:label "Unpredictable"@en ;
    skos:definition "The load has peaks the team cannot foresee."@en .
```

Each statement has a job in the app:

| Statement | Example | In the app |
| --- | --- | --- |
| `rdfs:label` | "Traffic", "Unpredictable" | the question's title and the answer's button |
| `skos:definition` | "The load has peaks the team cannot foresee." | the hint under the button |
| `skos:notation` | `traffic`, `unpredictable` | the keys and codes that the code and the answers use |
| `sh:order` | `4` | when the question is asked |
| `:answers ( … )` | an RDF list | the order of the buttons |

"Not sure" is an answer to every question. It is not in the file: the generator adds it, so the file
only states real answers.

The post names its criteria (team size, domain complexity, scaling needs, operational maturity) but
not their values. The answers and their definitions are ours: for example, a medium team is 4 to 10
developers.

## `rules.ttl`: the opinion

The only file that decides. Its rules have conditions on the answers of `criteria.ttl` and recommend
styles of `cloud-native-architecture.ttl`. The post ends with the author's view:

> Start with modular clarity. Use serverless for event-driven execution. Move to microservices when
> scale, ownership, and domain boundaries justify the operational cost.

His sentence about microservices becomes four conditions:

```turtle
:MoveToMicroservices a :StyleRule ; sh:order 1 ;
    :recommends :Microservices ;
    :quote "Move to microservices when scale, ownership, and domain boundaries justify the operational cost."@en ;
    :when [ :anyOf ( [ :criterion :ExpectedScale ; :in ( :ScaleHigh ) ]
                     [ :criterion :TeamSize ; :in ( :TeamSizeLarge ) ] ) ] ,          # scale
          [ :criterion :Teams ; :in ( :TeamsTwoOrThree :TeamsMoreThanThree ) ] ,     # ownership
          [ :criterion :DomainSeparation ; :in ( :DomainsClearlySeparate ) ] ,       # domain boundaries
          [ :criterion :OpsMaturity ; :in ( :OpsMedium :OpsHigh ) ] .                 # operational cost
```

A rule applies when all its `:when` conditions hold. A condition holds when the team's answer to its
`:criterion` is one of the answers `:in` it; an `:anyOf` condition holds when one of its conditions
does.

**The words are the author's; the mapping from his words to answers is ours.** The rule keeps both:
the conditions for the code, the `:quote` for the reader. Someone who disagrees with the mapping can
see exactly where, and change one line.

There are three kinds of rule:

| Kind | How it applies | Rules |
| --- | --- | --- |
| `:StyleRule` | the first that applies, by `sh:order`, decides the style of the whole system | `:MoveToMicroservices`; `:StartModular`, which has no conditions and so always applies ("Start with modular clarity") |
| `:PartRule` | every one that applies adds a part in another style | `:ServerlessForEvents` ("Use serverless for event-driven execution"); `:ServerlessForUnpredictableTraffic` |
| `:Caution` | every one that applies adds a warning | `:MicroservicesNeedOperations` (microservices would fit, but the team lacks the operations experience); `:NoServerlessForSustainedLoad` |

A part rule with one condition:

```turtle
:ServerlessForEvents a :PartRule ; sh:order 1 ;
    :recommends :Serverless ;
    :part "scheduled and event-driven jobs"@en ;
    :quote "Use serverless for event-driven execution."@en ;
    :when [ :criterion :BackgroundWork ; :in ( :BackgroundScheduledOrEvent ) ] .
```

The file also adds facts about things that the other files define:

```turtle
:AwsLambda :onPlatform :PlatformAws .
```

`:AwsLambda` is one of the diagram's tools; `:PlatformAws` is an answer to the platform question.
The line joins them without changing either file, so a recommendation can name the serverless tool
for the team's own platform.

## One team, through the three files

A team answers: medium size, one team, unpredictable traffic, scheduled jobs, on Azure.

1. **`criteria.ttl` asks.** The app shows "Team size" (order 1), then "Number of teams" (order 2),
   with their labels and definitions.
2. **`rules.ttl` narrows the questions.** After "One", no answer can make `:MoveToMicroservices`
   apply, because it needs two teams or more. The app stops asking about the domains, the expected
   growth and the operations experience. A file the user never sees decides which questions they see.
3. **`rules.ttl` decides.** `:StartModular` decides the style. Both part rules apply: serverless for
   the scheduled jobs and for the parts with unpredictable traffic.
4. **The facts and the links add the details.** The serverless tool on Azure is `:AzureFunctions`,
   labelled "Azure Functions" in the facts. "What comes with it" lists the facts of
   `:ModularMonolith`.
5. **`rules.ttl` explains.** The recommendation quotes "Start with modular clarity." Under
   "Reconsider microservices when", it lists the conditions of `:MoveToMicroservices` that the team
   does not meet yet.

## Vocabularies

The files use standard vocabularies where one fits, so any tool that reads RDF can read them:

| Prefix | Vocabulary | Used for |
| --- | --- | --- |
| `rdfs:` | RDF Schema | labels, comments, properties and their kinds |
| `owl:` | OWL | classes and properties |
| `skos:` | SKOS | definitions, and notations (the codes) |
| `sh:` | SHACL | `sh:order`, the order of styles, dimensions, questions and rules |
| `dcterms:` | Dublin Core | the source of each file |

The rest (`:Criterion`, `:Answer`, `:Rule`, `:when`, `:anyOf`, `:recommends`, `:quote`,
`:onPlatform` and the diagram's classes and properties) is declared at the top of the file that uses
it, with a comment.

## What the ontology adds, and what it does not

What makes the app possible is that the knowledge is written down, as data, apart from the code:
the app can ask only the questions that matter, explain its recommendation and be tested on every
possible team because the rules are data. A plain JSON file with the same content would allow that
too.

What RDF adds is in how the knowledge is kept: three sources with separate owners and licences that
still refer to each other exactly, facts added about another file's things without editing it (the
platform links), and standard vocabularies. What the app does not use is reasoning or queries: the
generator reads the statements and writes JSON.

## Changing the knowledge

1. Edit a Turtle file.
2. Run `bun run generate` in `cloud-architecture/`, and look at the change in
   `generated/decision.json`.
3. Run `bun test`. The tests check that every question has answers with definitions, that every
   rule's conditions use answers of their own question, and that the rules give every one of the
   13,122 possible teams a recommendation, with every rule applying to some team.
