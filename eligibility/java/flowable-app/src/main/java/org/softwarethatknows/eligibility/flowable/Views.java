package org.softwarethatknows.eligibility.flowable;

import static org.softwarethatknows.eligibility.flowable.Bpmn.COMPLETE;
import static org.softwarethatknows.eligibility.flowable.Bpmn.DECIDE;
import static org.softwarethatknows.eligibility.flowable.Bpmn.STEPS;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.FormatStyle;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import org.softwarethatknows.eligibility.Catalog;
import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.stereotype.Component;

// What the pages show, in the person's language: the applications, the tasks and one application,
// from Flowable (Applications) and the model's texts (Catalog). The templates only lay it out.
@Component
public class Views {

    private static final ZoneId ZONE = ZoneId.of("Europe/Zurich");

    public record Process(String name, String title, String summary) {}

    public record Row(String id, String title, String applicant, String state, String started) {}

    public record TaskRow(
            String application,
            String activity,
            String step,
            String title,
            String assignee,
            String due,
            boolean overdue) {}

    public record Application(
            String id,
            String title,
            String state,
            String applicant,
            String started,
            String done,
            String active,
            Optional<Form> form,
            Optional<String> returned,
            Optional<Trace> trace,
            List<Check> checks,
            boolean canClaimSteps,
            Optional<Task> decide,
            Optional<String> reason,
            List<Answer> answers,
            List<Step> history) {

        public boolean inReview() {
            return state.equals("review");
        }

        public boolean decided() {
            return state.equals("approved") || state.equals("rejected");
        }
    }

    public record Trace(String decidedOn, String modelVersion, Outcome outcome) {}

    public record Check(
            String label, String sources, Boolean fulfilled, String reviewer, String note, Optional<Task> task) {}

    public record Task(String id, String assignee, String due, boolean overdue, boolean claimable, boolean mine) {}

    public record Answer(String label, String value) {}

    public record Step(String activity, String user, String start, String end) {}

    private final Catalog catalog;
    private final MessageSource messages;

    public Views(Catalog catalog, MessageSource messages) {
        this.catalog = catalog;
        this.messages = messages;
    }

    public List<Process> processes() {
        return catalog.all().stream()
                .map(p -> new Process(
                        p.name(),
                        p.title(language()),
                        p.text(language(), p.shape().name() + ".summary")))
                .toList();
    }

    public List<Row> rows(List<Applications.Summary> summaries) {
        return summaries.stream()
                .map(s -> new Row(
                        s.id(),
                        process(s.domain()).title(language()),
                        People.name(s.applicant()),
                        s.state(),
                        time(s.started())))
                .toList();
    }

    public List<TaskRow> tasks(List<Applications.Task> tasks) {
        return tasks.stream()
                .map(t -> {
                    final var process = process(t.domain());
                    final var step = t.step() == null ? null : process.text(language(), t.step() + ".label");
                    return new TaskRow(
                            t.application(),
                            t.activity(),
                            step,
                            process.title(language()),
                            People.name(t.assignee()),
                            time(t.due()),
                            t.overdue());
                })
                .toList();
    }

    public Application application(Applications.Detail detail, People.Person me) {
        final var summary = detail.summary();
        final var process = process(summary.domain());
        final var language = language();
        final var completeTask = detail.task(COMPLETE).filter(t -> me.id().equals(t.assignee()));
        final var form = completeTask.map(t -> Form.of(
                process,
                language,
                detail.answers(),
                true,
                "/tasks/" + t.id() + "/complete?application=" + summary.id()));
        final var returned =
                detail.decision().filter("return"::equals).flatMap(d -> completeTask.flatMap(t -> detail.reason()));
        final var trace = detail.ruling()
                .map(r -> new Trace(
                        process.format(language, null, r.decidedOn().toString()),
                        r.modelVersion(),
                        Outcome.of(
                                process,
                                language,
                                r.evaluation(),
                                messages.getMessage("ruling.allowed", null, locale()))));
        final var checks = detail.checks().stream()
                .map(c -> new Check(
                        process.text(language, c.step() + ".label"),
                        sources(detail, process, c.step()),
                        c.fulfilled(),
                        People.name(c.reviewer()),
                        c.note(),
                        c.taskId()
                                .flatMap(id -> detail.tasks().stream()
                                        .filter(t -> t.id().equals(id))
                                        .findFirst())
                                .map(t -> task(t, me))))
                .toList();
        final var canClaimSteps = me.office()
                && detail.tasks().stream().anyMatch(t -> t.activity().equals(STEPS) && t.assignee() == null);
        final var answers = process.shape().fields().stream()
                .filter(f -> detail.answers().containsKey(f.name()))
                .map(f -> new Answer(
                        process.text(language, f.name() + ".label"),
                        process.format(language, f.name(), detail.answers().get(f.name()))))
                .toList();
        final var history = detail.history().stream()
                .map(a -> new Step(a.id(), People.name(a.user()), time(a.start()), time(a.end())))
                .toList();
        return new Application(
                summary.id(),
                process.title(language),
                summary.state(),
                People.name(summary.applicant()),
                time(summary.started()),
                String.join(",", detail.done()),
                String.join(",", detail.active()),
                form,
                returned,
                trace,
                checks,
                canClaimSteps,
                detail.task(DECIDE).map(t -> task(t, me)),
                detail.reason(),
                answers,
                history);
    }

    // The sources of a next step, from the decision that derived it.
    private static String sources(Applications.Detail detail, Catalog.Process process, String step) {
        final var ids = detail.ruling().stream()
                .flatMap(r -> r.evaluation().nextSteps().stream())
                .filter(s -> s.id().equals(step))
                .flatMap(s -> s.sources().stream())
                .toList();
        return new Outcome.Texts(process, language()).sources(ids);
    }

    private Task task(Applications.Task t, People.Person me) {
        return new Task(
                t.id(),
                People.name(t.assignee()),
                time(t.due()),
                t.overdue(),
                t.assignee() == null && me.office(),
                me.id().equals(t.assignee()));
    }

    private Catalog.Process process(String domain) {
        return catalog.get(domain).orElseThrow(() -> new IllegalArgumentException("No process " + domain));
    }

    private String time(Instant instant) {
        if (instant == null) return "";
        final var region = catalog.all().getFirst().shape().region();
        return DateTimeFormatter.ofLocalizedDateTime(FormatStyle.SHORT)
                .withLocale(Locale.of(language(), region))
                .withZone(ZONE)
                .format(instant);
    }

    private static Locale locale() {
        return LocaleContextHolder.getLocale();
    }

    private static String language() {
        return locale().getLanguage();
    }
}
