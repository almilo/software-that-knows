# Words run 2026-10-01

- Skill: extract-words; 3 independent runs (run-*.json) of the prompt in prompt.md, with input.json
- Proposed: 344 distinct words; made by all 3 runs: 118 (34%); by at least two: 201
- Added: 195. Development notes before: 70/71 found, 2 wrong; after: 70/71 found, 2 wrong; danger signs invented: 0, wrongly denied: 0

| Question | Kind | Word | Reason | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| convulsingNow | altLabel | currently convulsing | States the child is convulsing now. | 3/3 | added |
| convulsingNow | altLabel | actively convulsing | States a convulsion is in progress now. | 3/3 | added |
| convulsingNow | altLabel | convulsing at present | States the child is convulsing now. | 2/3 | added |
| convulsingNow | absentLabel | not convulsing now | States the child is not convulsing now. | 3/3 | added |
| convulsingNow | absentLabel | not currently convulsing | States no convulsion is happening now. | 3/3 | added |
| convulsions | altLabel | had a convulsion | States the child has had one or more convulsions. | 3/3 | added |
| convulsions | altLabel | had a fit | Definition says caregivers call convulsions fits; states one or more occurred. | 2/3 | added |
| convulsions | altLabel | history of convulsions | States the child has had convulsions. | 3/3 | added |
| convulsions | absentLabel | no history of convulsions | States the child has had no convulsions. | 3/3 | added |
| convulsions | absentLabel | has not convulsed | States the child has had no convulsions. | 2/3 | added |
| convulsionCount | altLabel | number of fits | States the question: how many convulsions (fits) occurred. | 2/3 | added |
| convulsionCount | altLabel | how many convulsions | States the question: the number of convulsions. | 2/3 | added |
| convulsionCount | valueLabel (one) | one convulsion | States exactly one convulsion. | 3/3 | added |
| convulsionCount | valueLabel (one) | convulsed once | States exactly one convulsion. | 3/3 | added |
| convulsionCount | valueLabel (one) | single convulsion | States exactly one convulsion. | 3/3 | added |
| convulsionCount | valueLabel (two or more) | more than one convulsion | States two or more convulsions. | 3/3 | added |
| convulsionCount | valueLabel (two or more) | convulsed twice | Two convulsions is two or more. | 3/3 | added |
| convulsionCount | valueLabel (two or more) | repeated convulsions | Repeated means more than one convulsion. | 3/3 | added |
| convulsionLong | altLabel | convulsion lasting 15 minutes or more | Restates a convulsion lasting 15 minutes or longer. | 3/3 | added |
| convulsionLong | altLabel | seizure lasting over 15 minutes | A seizure over 15 minutes satisfies 15 minutes or longer. | 2/3 | added |
| convulsionLong | absentLabel | convulsion lasted less than 15 minutes | States the convulsion was shorter than 15 minutes. | 3/3 | added |
| lethargic | altLabel | not awake and alert | Definition: not awake and alert when they should be. | 3/3 | dropped: contains a comma, "and" or "but", where a note is split, so it can never match |
| lethargic | altLabel | no interest in surroundings | Definition: does not show interest in what is happening around them. | 3/3 | added |
| lethargic | absentLabel | awake and alert | Negates the definition's not awake and alert. | 3/3 | dropped: contains a comma, "and" or "but", where a note is split, so it can never match |
| lethargic | absentLabel | alert and interested | Negates drowsy and showing no interest. | 2/3 | dropped: contains a comma, "and" or "but", where a note is split, so it can never match |
| notAbleToDrink | altLabel | unable to suck or swallow | Definition: not able to suck or swallow when offered a drink or breast milk. | 3/3 | added |
| notAbleToDrink | altLabel | cannot suck or swallow | Definition: not able to suck or swallow. | 2/3 | added |
| notAbleToDrink | altLabel | cannot breastfeed | Title: not able to breastfeed. | 3/3 | added |
| notAbleToDrink | absentLabel | able to breastfeed | Negates not able to breastfeed. | 3/3 | added |
| notAbleToDrink | absentLabel | able to suck and swallow | Negates the definition's not able to suck or swallow. | 3/3 | dropped: contains a comma, "and" or "but", where a note is split, so it can never match |
| vomitsEverything | altLabel | cannot hold anything down | Definition: not able to hold anything down at all. | 2/3 | added |
| vomitsEverything | altLabel | vomits everything taken | Definition: vomiting everything. | 3/3 | added |
| vomitsEverything | absentLabel | not vomiting everything | Negates vomiting everything. | 3/3 | added |
| vomitsEverything | absentLabel | keeps fluids down | Holding fluids down negates not able to hold anything down. | 2/3 | added |
| oralFluidTest | altLabel | watched the child drink | Definition: offer water and watch the child drink. | 2/3 | added |
| oralFluidTest | valueLabel (completely unable to drink) | unable to drink at all | States the child cannot drink at all on the test. | 3/3 | added |
| oralFluidTest | valueLabel (completely unable to drink) | cannot drink at all | States the child cannot drink at all on the test. | 2/3 | added |
| oralFluidTest | valueLabel (drinks poorly) | drinking poorly | Restates drinks poorly. | 3/3 | added |
| oralFluidTest | valueLabel (drinks poorly) | cannot drink without help | Definition: drinking poorly means weak and cannot drink without help. | 3/3 | added |
| oralFluidTest | valueLabel (drinks poorly) | swallows only if fluid put in mouth | Definition: may swallow only if fluid is put in their mouth. | 3/3 | added |
| oralFluidTest | valueLabel (drinks eagerly or thirstily) | drinking eagerly | Restates drinks eagerly. | 3/3 | added |
| oralFluidTest | valueLabel (drinks eagerly or thirstily) | reaches for the cup | Definition: child reaches out for the cup or spoon. | 3/3 | added |
| oralFluidTest | valueLabel (drinks normally) | drinking normally | Restates drinks normally. | 3/3 | added |
| oralFluidTest | valueLabel (unable to do the test) | oral fluid test not done | States the test could not be carried out. | 3/3 | added |
| feverReported | altLabel | history of fever | Definition: fever reported means history of fever. | 3/3 | added |
| feverReported | altLabel | reported fever | Restates fever reported. | 3/3 | added |
| feverReported | altLabel | fever in this illness | Definition: any fever with this illness. | 3/3 | added |
| feverReported | absentLabel | no history of fever | Negates history of fever. | 3/3 | added |
| feverReported | absentLabel | no reported fever | Negates fever reported. | 2/3 | added |
| axillaryTemperature | altLabel | axillary temp | Common abbreviation of axillary temperature. | 3/3 | added |
| axillaryTemperature | altLabel | temperature under the arm | Definition: temperature taken under the armpit. | 3/3 | added |
| rectalTemperature | altLabel | rectal temp | Common abbreviation of rectal temperature. | 3/3 | added |
| rectalTemperature | altLabel | temperature per rectum | Definition: temperature taken in the rectum. | 2/3 | added |
| thermometerNotAvailable | altLabel | thermometer unavailable | Definition: a thermometer is not available. | 3/3 | added |
| thermometerNotAvailable | altLabel | no thermometer to measure temperature | Definition: no thermometer available to measure the temperature. | 2/3 | added |
| hotToTouch | altLabel | feels hot to touch | Definition: the child is hot to touch. | 3/3 | added |
| hotToTouch | altLabel | skin feels hot | Definition: the child is hot to touch. | 2/3 | added |
| hotToTouch | absentLabel | not hot to touch | Negates hot to touch. | 3/3 | added |
| hotToTouch | absentLabel | cool to touch | Cool to touch is the opposite of hot to touch. | 3/3 | added |
| malariaRisk | altLabel | area malaria risk | Restates the area's malaria risk. | 3/3 | added |
| malariaRisk | valueLabel (high) | high malaria risk | States the area's malaria risk is high. | 3/3 | added |
| malariaRisk | valueLabel (low) | low malaria risk | States the area's malaria risk is low. | 3/3 | added |
| malariaRisk | valueLabel (no) | no malaria transmission | States the area has no malaria risk. | 3/3 | added |
| malariaRisk | valueLabel (no) | non-malarious area | States the area has no malaria risk. | 3/3 | added |
| travelToHighRiskArea | altLabel | travelled to a high malaria risk area | Definition: recently travelled to a high malaria risk area. | 3/3 | added |
| travelToHighRiskArea | absentLabel | no travel in the last 2 weeks | Negates travel in the last 2 weeks. | 3/3 | added |
| obviousCause | altLabel | clear cause of fever | Title: obvious cause of fever. | 3/3 | added |
| obviousCause | altLabel | apparent cause of fever | Title: obvious cause of fever. | 2/3 | added |
| obviousCause | absentLabel | no clear cause of fever | Negates obvious cause of fever. | 3/3 | added |
| feverDuration | altLabel | duration of fever | Definition: length of time the child has had fever. | 3/3 | added |
| feverDuration | altLabel | days of fever | Definition: length of time the child has had fever. | 2/3 | added |
| feverDuration | valueLabel (7 days or less) | fever for 7 days or less | Definition value: 7 days or less. | 3/3 | added |
| feverDuration | valueLabel (7 days or less) | fever for 1 week or less | Definition value: 1 week or less. | 2/3 | added |
| feverDuration | valueLabel (more than 7 days) | fever for more than 7 days | Definition value: more than 7 days. | 2/3 | added |
| feverDuration | valueLabel (more than 7 days) | fever for more than a week | Definition value: more than 1 week. | 2/3 | added |
| feverDuration | valueLabel (more than 7 days) | fever for over a week | Definition value: more than 1 week. | 2/3 | added |
| feverEveryDay | altLabel | fever every day | Definition: fever present every day. | 3/3 | added |
| feverEveryDay | altLabel | daily fever | Definition: fever present every day. | 3/3 | added |
| feverEveryDay | absentLabel | fever not every day | Negates fever present every day. | 3/3 | added |
| stiffNeck | altLabel | nuchal rigidity | Clinical term for a stiff neck with resistance to bending. | 3/3 | added |
| stiffNeck | altLabel | neck rigidity | Definition: neck feels stiff with resistance to bending. | 3/3 | added |
| stiffNeck | absentLabel | neck supple | Supple neck bends easily, so no stiff neck. | 3/3 | added |
| stiffNeck | absentLabel | bends neck easily | Definition: if the neck bends easily, no stiff neck. | 3/3 | added |
| stiffNeck | absentLabel | no nuchal rigidity | Negates stiff neck. | 3/3 | added |
| refusalToUseLimb | altLabel | unable to use a limb | Definition: unable to use a limb on examination. | 2/3 | added |
| refusalToUseLimb | altLabel | refuses to use arm | Definition: a limb is an arm or leg. | 2/3 | added |
| refusalToUseLimb | altLabel | refuses to use leg | Definition: a limb is an arm or leg. | 2/3 | added |
| refusalToUseLimb | absentLabel | uses all limbs | Negates unable to use a limb. | 3/3 | added |
| refusalToUseLimb | absentLabel | moves all limbs normally | Negates unable to use a limb. | 2/3 | added |
| warmTenderJoint | altLabel | swollen joint | Definition: swollen joint. | 3/3 | added |
| warmTenderJoint | altLabel | tender joint | Definition: tender joint. | 3/3 | added |
| warmTenderJoint | altLabel | joint swelling | Definition: swollen joint. | 3/3 | added |
| warmTenderJoint | altLabel | bone tenderness | Definition: tender bone. | 3/3 | added |
| painPassingUrine | altLabel | pain passing urine | Definition: pain passing urine. | 3/3 | added |
| painPassingUrine | altLabel | difficulty passing urine | Definition: difficulty passing urine. | 3/3 | added |
| painPassingUrine | altLabel | painful urination | Definition: pain passing urine. | 3/3 | added |
| painPassingUrine | altLabel | cries when passing urine | Definition: in younger children, crying when passing urine. | 3/3 | added |
| painPassingUrine | absentLabel | no dysuria | Negates pain passing urine. | 3/3 | added |
| painPassingUrine | absentLabel | no pain passing urine | Negates pain passing urine. | 2/3 | added |
| cough | altLabel | has a cough | Definition: the child has a cough. | 3/3 | added |
| cough | absentLabel | not coughing | Negates the child has a cough. | 3/3 | added |
| runnyNose | altLabel | rhinorrhoea | Clinical term for runny nose. | 3/3 | added |
| runnyNose | altLabel | rhinorrhea | Clinical term for runny nose (US spelling). | 3/3 | added |
| runnyNose | absentLabel | no nasal discharge | Negates runny nose. | 3/3 | added |
| runnyNose | absentLabel | no rhinorrhoea | Negates runny nose. | 3/3 | added |
| redEyes | altLabel | redness of the eyes | Definition: redness in the white part of the eye. | 2/3 | added |
| redEyes | altLabel | bloodshot eyes | Bloodshot means redness of the white of the eye. | 3/3 | added |
| redEyes | altLabel | conjunctival injection | Clinical term for redness of the white part of the eye. | 3/3 | added |
| redEyes | absentLabel | eyes not red | Negates red eyes. | 3/3 | added |
| otherSevereClassification | altLabel | other severe classification | Definition: a severe classification other than severe dehydration. | 2/3 | added |
| otherSevereClassification | absentLabel | no other severe classification | Negates a severe classification from another part of the assessment. | 2/3 | added |
| malariaTest | altLabel | malaria rdt | Malaria rapid diagnostic test, the malaria test. | 3/3 | added |
| malariaTest | altLabel | mrdt | Abbreviation of malaria rapid diagnostic test. | 3/3 | added |
| malariaTest | valueLabel (positive) | malaria positive | States the malaria test result is positive. | 3/3 | added |
| malariaTest | valueLabel (positive) | rdt positive | States the malaria test result is positive. | 3/3 | added |
| malariaTest | valueLabel (positive) | positive for malaria | States the malaria test result is positive. | 3/3 | added |
| malariaTest | valueLabel (negative) | malaria negative | States the malaria test result is negative. | 3/3 | added |
| malariaTest | valueLabel (negative) | rdt negative | States the malaria test result is negative. | 3/3 | added |
| malariaTest | valueLabel (negative) | negative for malaria | States the malaria test result is negative. | 3/3 | added |
| malariaTest | valueLabel (unknown) | malaria test not done | No malaria result is available, so it is unknown. | 3/3 | added |
| highParasiteDensity | altLabel | high parasitaemia | States a high parasite density. | 3/3 | added |
| highParasiteDensity | altLabel | hyperparasitaemia | Clinical term for high parasite density. | 3/3 | added |
| highParasiteDensity | absentLabel | low parasite density | A low density is not a high parasite density. | 3/3 | added |
| skinProblem | altLabel | skin rash | A rash is a skin problem. | 2/3 | added |
| skinProblem | altLabel | skin lesions | Lesions on the skin are a skin problem. | 3/3 | added |
| skinProblem | valueLabel (generalized) | rash all over the body | Definition: generalized affects the whole body. | 3/3 | added |
| skinProblem | valueLabel (generalized) | generalized rash | States a generalized skin problem. | 3/3 | added |
| skinProblem | valueLabel (localized) | localized rash | States a localized skin problem. | 3/3 | added |
| skinProblem | valueLabel (localized) | rash limited to one area | Definition: localized is limited to one area of the body. | 3/3 | added |
| skinProblem | valueLabel (none) | no skin lesions | States there is no skin problem. | 3/3 | added |
| measlesRash | altLabel | measles-like rash | States a rash of the measles pattern. | 2/3 | added |
| measlesRash | altLabel | morbilliform rash | Clinical term for a measles-type rash. | 3/3 | added |
| measlesRash | absentLabel | no measles rash | Negates measles rash. | 3/3 | added |
| measlesRecent | altLabel | measles in the last 3 months | Definition: had measles in the last 3 months. | 3/3 | added |
| measlesRecent | absentLabel | no measles in the last 3 months | Negates measles in the last 3 months. | 3/3 | added |
| mouthUlcers | altLabel | oral ulcers | Title: oral sores or mouth ulcers. | 3/3 | added |
| mouthUlcers | altLabel | sores in the mouth | Title: oral sores. | 3/3 | added |
| mouthUlcers | valueLabel (none) | no mouth sores | States no oral sores or mouth ulcers. | 3/3 | added |
| mouthUlcers | valueLabel (none) | no oral ulcers | States no oral sores or mouth ulcers. | 3/3 | added |
| mouthUlcers | valueLabel (oral thrush) | oral candidiasis | Clinical term for oral thrush. | 3/3 | added |
| mouthUlcers | valueLabel (deep and extensive) | deep and extensive mouth ulcers | States mouth ulcers that are deep and extensive. | 3/3 | dropped: contains a comma, "and" or "but", where a note is split, so it can never match |
| mouthUlcers | valueLabel (deep and extensive) | deep extensive ulcers | States ulcers that are both deep and extensive. | 3/3 | added |
| mouthUlcers | valueLabel (not deep and extensive) | superficial mouth ulcers | Superficial ulcers are not deep and extensive. | 3/3 | added |
| mouthUlcers | valueLabel (not deep and extensive) | mouth ulcers not deep | Ulcers that are not deep are not deep and extensive. | 2/3 | added |
| pusFromEye | altLabel | pus from the eye | Definition: pus draining from the eye. | 3/3 | added |
| pusFromEye | altLabel | purulent eye discharge | Purulent means pus; pus draining from the eye. | 3/3 | added |
| pusFromEye | altLabel | pus on the eyelids | Definition: look for pus on the conjunctiva or eyelids. | 2/3 | added |
| pusFromEye | absentLabel | no pus from the eye | Negates pus draining from the eye. | 3/3 | added |
| pusFromEye | absentLabel | no eye discharge | No discharge means no pus draining from the eye. | 2/3 | added |
| corneaClouding | altLabel | hazy cornea | Definition: the cornea may appear clouded or hazy. | 3/3 | added |
| corneaClouding | absentLabel | no corneal clouding | Negates clouding of the cornea. | 3/3 | added |
| corneaClouding | absentLabel | no clouding of the cornea | Negates clouding of the cornea. | 2/3 | added |
| vitaminARecent | altLabel | vitamin a in the past month | Title: vitamin A in the past month. | 3/3 | added |
| vitaminARecent | altLabel | vit a in the past month | Abbreviation of vitamin A, in the past month per the title. | 2/3 | added |
| vitaminARecent | absentLabel | no vitamin a in the past month | Negates vitamin A in the past month. | 3/3 | added |
| convulsions | altLabel | had convulsions | States the child has had one or more convulsions. | 2/3 | added |
| convulsions | altLabel | had fits | The definition names 'fits' as the caregiver's word for convulsions. | 2/3 | added |
| convulsions | altLabel | had spasms | The definition names 'spasms' as the caregiver's word for convulsions. | 2/3 | added |
| convulsionCount | valueLabel (one) | one fit | Caregiver term for one convulsion. | 2/3 | added |
| convulsionCount | valueLabel (two or more) | multiple convulsions | More than one convulsion is two or more. | 2/3 | added |
| convulsionLong | absentLabel | convulsion under 15 minutes | States no convulsion reached 15 minutes. | 2/3 | added |
| lethargic | absentLabel | conscious and alert | Neither unconscious nor lethargic. | 2/3 | dropped: contains a comma, "and" or "but", where a note is split, so it can never match |
| notAbleToDrink | absentLabel | breastfeeds well | The child sucks and swallows breast-milk, so the sign is absent. | 2/3 | added |
| vomitsEverything | altLabel | unable to keep anything down | The definition: not able to hold anything down at all. | 2/3 | added |
| vomitsEverything | absentLabel | able to keep fluids down | Holds something down, so not vomiting everything. | 2/3 | added |
| oralFluidTest | valueLabel (vomits immediately or everything) | vomits immediately after drinking | States the vomits-immediately outcome of the test. | 2/3 | added |
| oralFluidTest | valueLabel (drinks eagerly or thirstily) | drinking thirstily | The definition's sign: drinks and acts thirsty. | 2/3 | added |
| oralFluidTest | valueLabel (drinks eagerly or thirstily) | wants to drink more | The definition: unhappy when water is taken away because they want to drink more. | 2/3 | added |
| feverReported | absentLabel | no fever reported | Negates 'fever reported'. | 2/3 | added |
| axillaryTemperature | altLabel | armpit temperature | The definition: temperature taken under the armpit. | 2/3 | added |
| malariaRisk | valueLabel (high) | high malaria transmission | High transmission is high malaria risk. | 2/3 | added |
| malariaRisk | valueLabel (low) | low malaria transmission | Low transmission is low malaria risk. | 2/3 | added |
| malariaRisk | valueLabel (no) | malaria-free area | An area without malaria has no malaria risk. | 2/3 | added |
| travelToHighRiskArea | altLabel | recent travel to a high malaria risk area | Recent travel (last 2 weeks) to a high malaria risk area. | 2/3 | added |
| obviousCause | absentLabel | fever without focus | Clinical phrase for fever with no obvious cause. | 2/3 | added |
| feverDuration | altLabel | fever duration | Length of time the child has had fever. | 2/3 | added |
| feverDuration | valueLabel (7 days or less) | fever less than 7 days | Under 7 days is within 7 days or less. | 2/3 | added |
| feverDuration | valueLabel (7 days or less) | fever less than a week | Under 1 week is within 1 week or less. | 2/3 | added |
| feverDuration | valueLabel (more than 7 days) | fever for 2 weeks | 14 days is more than 7 days. | 2/3 | added |
| feverEveryDay | altLabel | fever daily for more than 7 days | Restates fever present every day for more than 7 days. | 2/3 | added |
| feverEveryDay | absentLabel | fever not daily | Negates fever present every day. | 2/3 | added |
| feverEveryDay | absentLabel | fever on some days only | Fever absent on some days, so not every day. | 2/3 | added |
| stiffNeck | altLabel | resistance to neck flexion | The definition: resistance to bending the head forward. | 2/3 | added |
| stiffNeck | absentLabel | no neck stiffness | Negates stiff neck. | 2/3 | added |
| refusalToUseLimb | altLabel | not using the arm | The child does not use an arm on examination. | 2/3 | added |
| refusalToUseLimb | altLabel | not using the leg | The child does not use a leg on examination. | 2/3 | added |
| painPassingUrine | altLabel | burning on urination | A form of pain passing urine. | 2/3 | added |
| redEyes | altLabel | conjunctival redness | Redness in the white part of the eye. | 2/3 | added |
| malariaTest | altLabel | blood smear for malaria | A malaria test by blood smear. | 2/3 | added |
| malariaTest | valueLabel (unknown) | rdt not done | No rapid test result, so unknown. | 2/3 | added |
| highParasiteDensity | altLabel | hyperparasitemia | Clinical term for high parasite density (US spelling). | 2/3 | added |
| highParasiteDensity | altLabel | high parasite count | High parasite density. | 2/3 | added |
| highParasiteDensity | absentLabel | low parasitaemia | Parasite density is not high. | 2/3 | added |
| skinProblem | valueLabel (generalized) | generalised rash | A skin problem affecting the whole body or a large area (UK spelling). | 2/3 | added |
| skinProblem | valueLabel (localized) | localised rash | A skin problem limited to one area (UK spelling). | 2/3 | added |
| skinProblem | valueLabel (none) | normal skin | No skin problem. | 2/3 | added |
| measlesRash | altLabel | rash starting behind the ears | The definition: the measles rash begins behind the ears and on the neck. | 2/3 | added |
| mouthUlcers | altLabel | ulcers in the mouth | Restates mouth ulcers. | 2/3 | added |
| corneaClouding | altLabel | clouded cornea | The definition: the cornea may appear clouded. | 2/3 | added |
| corneaClouding | altLabel | corneal haze | The cornea appears hazy. | 2/3 | added |
| corneaClouding | absentLabel | corneas clear | The definition: the cornea is usually clear. | 2/3 | added |
