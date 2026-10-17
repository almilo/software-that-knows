# flowable-app

The Spring Boot + Flowable stack of [eligibility](../../README.md): applications to every process of
the knowledge model run through one BPMN process in Flowable. The model decides; Flowable keeps the
state, the work of the people, and the history. Pages are rendered on the server (Thymeleaf), with
[htmx](https://htmx.org) for the form and [bpmn-js](https://bpmn.io) for the diagram.

```
cd ../ && ./gradlew :flowable-app:bootRun      # http://localhost:3521/
```

Demonstration only: there is no login (the header lets you act as any person), and the database is
in memory, so a restart forgets everything.

## The process

`src/main/resources/processes/application.bpmn20.xml`, the same for every domain:

| Element | What it does |
| --- | --- |
| Start event | The applicant submits (`flowable:initiator` records who) |
| Service task *Decide with the knowledge model* | `CheckApplication` evaluates the answers with the core and keeps the decision as one variable, `ruling` (`Ruling`): the core's evaluation, the date of the decision and the version of the model |
| Gateway *What does the model decide?* | Incomplete: back to the applicant. Refused: ends. Allowed: to the office |
| User task *Complete the application* | Assigned to the applicant, who changes the answers; the model decides again |
| User task *Check a next step* | Parallel multi-instance over `${ruling.nextStepIds()}`: one task for each next step that the model derived, offered to the group `office`, due in 3 days. The reviewer marks it fulfilled or not, with a note |
| User task *Decide on the application* | Offered to `office`, due in 5 days: approve, reject (with a reason) or return to the applicant (with a note) |

Nothing in the process knows a domain. A new domain in the knowledge model gets its form, its
decision and its office tasks without a change here.

## What Flowable does here

| Feature | Where |
| --- | --- |
| Process state and variables | `Applications.submit`, `CheckApplication` |
| Users and groups (identity service) | `People`: one applicant, two reviewers |
| Assigned and candidate tasks, claiming | `Applications.claim`, `tasks(user)` (`taskCandidateOrAssigned`) |
| Multi-instance tasks from a collection | the next steps of the model |
| Due dates | the office's tasks |
| History: activities, tasks, task variables | the application page: the history, the checks of the last decision, the diagram's marks |

The pages read everything from Flowable's services; the app keeps no state of its own.

## Classes

| Class | What it is |
| --- | --- |
| `CheckApplication`, `Ruling` | The service task, and the decision that it keeps in the process |
| `Applications`, `Bpmn`, `People` | The applications through Flowable's runtime, task, history and identity services; the ids of the process |
| `Views`, `Form`, `Outcome` | What the pages show, with the texts of the model in the person's language |
| `Pages`, `Actions`, `Diagram`, `Web` | The controllers (reading, acting), the translated process for bpmn-js, the language and the person you act as |

## Pages

| Path | What |
| --- | --- |
| `/` | The processes (from the model) and the BPMN diagram |
| `/apply/<domain>` | The form, generated from the model. On each change htmx posts it to `/form/<domain>`, and the server sends back the questions that the model asks now and the outcome so far. It is submitted when nothing is missing |
| `/applications`, `/applications/<id>` | The applications (the office sees all, the applicant their own); one application with its diagram (steps done in green, the current one in yellow), what the model decided, the checks, the decision, the answers and the history |
| `/tasks` | The tasks of the person you act as |
| `/process.bpmn` | The deployed process, its names in the current language, for bpmn-js |

Texts: the model's texts (questions, findings, next steps, articles, the form's buttons) come from
the knowledge model; the texts of this stack (the process, the tasks) are in
`src/main/resources/messages*.properties`, in the same four languages.

## Choices

- **BPMN, not CMMN.** The life of an application is fixed, and the model already decides which
  next steps apply. The review is the part that is like a case; if reviewers came to add steps or
  correct answers so that the model decides again, a CMMN case task could take it over.
- **The model decides, not DMN.** The rules use the model's classes and derive values from other
  values; tables in FEEL would be a second copy of the rules. The service task calls the model.
- **What is Flowable's.** The process is BPMN 2.0, with Flowable's attributes for the service task,
  the assignments, the multi-instance collection, the due dates and the task listener; the
  conditions are JUEL. The knowledge model and the core do not depend on Flowable: only
  `CheckApplication` and `Applications` use its API.

## Tests

`./gradlew :flowable-app:test`: `ApplicationProcessTest` runs the process (approval after the
checks, refusal, an incomplete application, a return and its correction, a rejection that needs a
reason, and every domain with cases from `conformance/`); `PagesTest` checks the pages through
MockMvc (the form that follows the model, a submission, the office's tasks, German);
`TestDomainTest` runs the test domain of `fixtures/` through the pages and the process.
