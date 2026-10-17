package org.softwarethatknows.eligibility.flowable;

import java.util.List;
import org.softwarethatknows.eligibility.Catalog;
import org.softwarethatknows.eligibility.Evaluation;

// What the model found, for the page (templates/layout.html :: outcome): the findings with their
// severity, the next steps when nothing blocks the application, and the values, each with its
// sources, in the person's language.
public record Outcome(
        List<Finding> findings, boolean allowed, String allowedText, List<Item> nextSteps, List<Item> values) {

    public record Finding(String severity, String title, String comment, String sources) {}

    public record Item(String label, String value, String sources) {}

    public static Outcome of(Catalog.Process process, String language, Evaluation evaluation, String allowedText) {
        final var texts = new Texts(process, language);
        final var findings = evaluation.findings().stream()
                .map(f -> new Finding(
                        f.severity(),
                        texts.label(f.severity()) + ": " + texts.label(f.id()),
                        texts.text(f.id() + ".comment"),
                        texts.sources(f.sources())))
                .toList();
        final var nextSteps = evaluation.nextSteps().stream()
                .map(s -> new Item(texts.label(s.id()), null, texts.sources(s.sources())))
                .toList();
        final var values = evaluation.values().stream()
                .map(v -> new Item(
                        texts.label(v.id()), process.format(language, null, v.value()), texts.sources(v.sources())))
                .toList();
        return new Outcome(findings, evaluation.allowed(), allowedText, nextSteps, values);
    }

    // The texts of a process in one language.
    record Texts(Catalog.Process process, String language) {

        String text(String key) {
            return process.text(language, key);
        }

        String label(String id) {
            return text(id + ".label");
        }

        String sources(List<String> ids) {
            return String.join(", ", ids.stream().map(this::label).toList());
        }
    }
}
