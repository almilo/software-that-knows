package org.softwarethatknows.eligibility;

import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
import java.util.function.Function;
import java.util.stream.Collectors;

// The processes of a knowledge model, read once: for each domain, its form, its texts and its engine.
// Every Java application starts from it; adding a domain to the knowledge adds it, with no code.
public final class Catalog {

    public record Process(String name, Shape shape, Map<String, Map<String, String>> texts, Engine engine) {

        public List<String> languages() {
            return List.copyOf(texts.keySet());
        }

        public Evaluation evaluate(Map<String, ?> answers) {
            return engine.evaluate(answers, LocalDate.now());
        }

        public String text(String language, String key) {
            return texts.getOrDefault(language, texts.get(languages().getFirst())).getOrDefault(key, key);
        }

        public String title(String language) {
            return text(language, shape.name() + ".label");
        }

        // A value or an answer for a person: a number with at most two decimals, a date in long form,
        // in the language and the region of the process; a choice by its text.
        public String format(String language, String field, Object value) {
            final var locale = java.util.Locale.of(language, shape.region());
            final var text = String.valueOf(value);
            if (field != null && texts.getOrDefault(language, Map.of()).containsKey(field + "." + text)) return text(language, field + "." + text);
            if (text.matches("\\d{4}-\\d\\d-\\d\\d")) {
                return LocalDate.parse(text).format(java.time.format.DateTimeFormatter.ofLocalizedDate(java.time.format.FormatStyle.LONG).withLocale(locale));
            }
            if (text.matches("-?\\d+(\\.\\d+)?([eE]-?\\d+)?")) {
                final var format = java.text.NumberFormat.getNumberInstance(locale);
                format.setMaximumFractionDigits(2);
                return format.format(new java.math.BigDecimal(text));
            }
            return text;
        }
    }

    private final Map<String, Process> processes;

    public Catalog(Path knowledge) {
        final var model = Knowledge.at(knowledge);
        this.processes = model.domains().stream().map(name -> {
            final var engine = model.engine(name);
            return new Process(name, engine.shape(), Texts.read(engine.model(), engine.shape()), engine);
        }).collect(Collectors.toMap(Process::name, Function.identity(), (a, b) -> a, TreeMap::new));
    }

    public List<Process> all() {
        return List.copyOf(processes.values());
    }

    public Optional<Process> get(String name) {
        return Optional.ofNullable(processes.get(name));
    }

    // The languages that every process has.
    public List<String> commonLanguages() {
        return all().stream().map(Process::languages).reduce((a, b) -> a.stream().filter(b::contains).toList()).orElse(List.of());
    }
}
