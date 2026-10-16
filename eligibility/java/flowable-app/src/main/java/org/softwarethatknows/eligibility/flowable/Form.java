package org.softwarethatknows.eligibility.flowable;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.softwarethatknows.eligibility.Catalog;
import org.softwarethatknows.eligibility.Evaluation;
import org.softwarethatknows.eligibility.Field;
import org.softwarethatknows.eligibility.Rdf;
import org.springframework.util.MultiValueMap;

// The form of a process for the template (templates/form.html): its groups of questions, each with
// the input that its type needs, and what the model decided for the answers so far. The page posts
// the whole form on each change; the server reads the answers, the model decides, and the form
// comes back with the questions that are asked. Answers to questions that are not asked stay in
// hidden inputs, so they come back when the question does.
public record Form(String domain, String action, List<Group> groups, List<Question> hidden, Evaluation evaluation, Map<String, Object> ruling, boolean reveal) {

    public record Group(String name, List<Question> questions) {}

    public record Question(String name, String input, List<String> choices, String value, boolean required, boolean missing, BigDecimal min, BigDecimal max) {}

    public static Form of(Catalog.Process process, Map<String, Object> answers, boolean reveal, String action) {
        final var today = java.time.LocalDate.now();
        final var evaluation = process.evaluate(answers, today);
        final var questions = process.shape().fields().stream().map(f -> question(f, answers.get(f.name()), reveal && evaluation.missing().contains(f.name()))).toList();
        final var groups = process.shape().groups().stream()
                .map(g -> new Group(g, process.shape().fields().stream().filter(f -> f.group().equals(g) && evaluation.shown().contains(f.name()))
                        .map(f -> questions.stream().filter(q -> q.name().equals(f.name())).findFirst().orElseThrow()).toList()))
                .filter(g -> !g.questions().isEmpty())
                .toList();
        final var hidden = questions.stream().filter(q -> !evaluation.shown().contains(q.name()) && q.value() != null).toList();
        return new Form(process.name(), action, groups, hidden, evaluation, CheckApplication.ruling(evaluation, today, process.version()), reveal);
    }

    // The answers in a posted form, with the types of the model's fields; empty inputs are no answer.
    public static Map<String, Object> answers(Catalog.Process process, MultiValueMap<String, String> params) {
        final var answers = new HashMap<String, Object>();
        process.shape().fields().forEach(f -> {
            final var text = params.getFirst(f.name());
            if (text == null || text.isBlank()) return;
            try {
                answers.put(f.name(), switch (input(f)) {
                    case "integer" -> Integer.valueOf(text.strip());
                    case "decimal" -> new BigDecimal(text.strip());
                    default -> text.strip();
                });
            } catch (NumberFormatException e) {
                // not a number: no answer, so the model asks for it again
            }
        });
        return answers;
    }

    public boolean complete() {
        return evaluation.missing().isEmpty();
    }

    private static Question question(Field f, Object value, boolean missing) {
        final var choices = f.choices().map(c -> c.stream().map(Rdf::local).toList()).orElse(List.of());
        return new Question(f.name(), input(f), choices, value == null ? null : value.toString(), f.required(), missing, f.minimum().orElse(null), f.maximum().orElse(null));
    }

    private static String input(Field f) {
        if (f.choices().isPresent()) return f.choices().get().size() <= 3 ? "radio" : "select";
        final var type = f.datatype().orElse("");
        if (type.endsWith("#date")) return "date";
        if (type.endsWith("#integer")) return "integer";
        return "decimal";
    }
}
