package org.softwarethatknows.eligibility.flowable;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.softwarethatknows.eligibility.Catalog;
import org.softwarethatknows.eligibility.Evaluation;
import org.softwarethatknows.eligibility.Field;
import org.springframework.util.MultiValueMap;

// The form of a process for the page (templates/form.html), in the person's language: its groups of
// questions, each with the input that the core chooses for it (Field.input()), and the outcome so
// far. The page posts the whole form on each change; the server reads the answers, the model
// decides, and the form comes back with the questions that are asked. Answers to questions that
// are not asked stay in hidden inputs, so they come back when the question does.
public record Form(
        String domain,
        String title,
        String action,
        List<Group> groups,
        List<Hidden> hidden,
        Evaluation evaluation,
        Outcome outcome,
        Texts texts,
        boolean reveal) {

    public record Group(String label, List<Question> questions) {}

    public record Question(
            String name,
            String label,
            String help,
            String input,
            List<Choice> choices,
            String value,
            boolean required,
            boolean missing,
            BigDecimal min,
            BigDecimal max) {}

    public record Choice(String value, String label) {}

    public record Hidden(String name, String value) {}

    // The texts of the form itself, from the model (form.ttl).
    public record Texts(String choose, String answerError, String outcome, String openQuestions, String submit) {}

    public static Form of(
            Catalog.Process process, String language, Map<String, Object> answers, boolean reveal, String action) {
        final var evaluation = process.evaluate(answers, LocalDate.now());
        final var texts = new Outcome.Texts(process, language);
        final var groups = process.shape().groups().stream()
                .map(g -> new Group(
                        texts.label(g),
                        process.shape().fields().stream()
                                .filter(f -> f.group().equals(g)
                                        && evaluation.shown().contains(f.name()))
                                .map(f -> question(
                                        f,
                                        texts,
                                        answers.get(f.name()),
                                        reveal && evaluation.missing().contains(f.name())))
                                .toList()))
                .filter(g -> !g.questions().isEmpty())
                .toList();
        final var hidden = process.shape().fields().stream()
                .filter(f -> !evaluation.shown().contains(f.name()) && answers.containsKey(f.name()))
                .map(f -> new Hidden(f.name(), answers.get(f.name()).toString()))
                .toList();
        final var outcome = Outcome.of(process, language, evaluation, texts.label("allowed"));
        final var own = new Texts(
                texts.label("choose"),
                texts.label("answerError"),
                texts.label("outcome"),
                texts.label("openQuestions"),
                texts.label("submit"));
        return new Form(
                process.name(), process.title(language), action, groups, hidden, evaluation, outcome, own, reveal);
    }

    // The answers in a posted form, with the types of the model's fields (Field.parse()).
    public static Map<String, Object> answers(Catalog.Process process, MultiValueMap<String, String> params) {
        final var answers = new HashMap<String, Object>();
        process.shape()
                .fields()
                .forEach(f -> f.parse(params.getFirst(f.name())).ifPresent(a -> answers.put(f.name(), a)));
        return answers;
    }

    public boolean complete() {
        return evaluation.missing().isEmpty();
    }

    private static Question question(Field f, Outcome.Texts texts, Object value, boolean missing) {
        final var help = texts.text(f.name() + ".description");
        final var choices = f.choiceNames().stream()
                .map(c -> new Choice(c, texts.text(f.name() + "." + c)))
                .toList();
        return new Question(
                f.name(),
                texts.label(f.name()),
                help.equals(f.name() + ".description") ? null : help,
                f.input().name().toLowerCase(Locale.ROOT),
                choices,
                value == null ? null : value.toString(),
                f.required(),
                missing,
                f.minimum().orElse(null),
                f.maximum().orElse(null));
    }
}
