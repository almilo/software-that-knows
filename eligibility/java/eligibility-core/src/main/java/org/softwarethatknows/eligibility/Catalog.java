package org.softwarethatknows.eligibility;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.file.Path;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.FormatStyle;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
import java.util.function.Function;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

// The processes of a knowledge model, read once: for each domain, its form, its texts and its engine.
// Every Java application starts from it; adding a domain to the knowledge adds it, with no code.
public final class Catalog {

    private static final Pattern DATE = Pattern.compile("\\d{4}-\\d\\d-\\d\\d");
    private static final Pattern NUMBER = Pattern.compile("-?\\d+(\\.\\d+)?([eE][-+]?\\d+)?");
    private static final DateTimeFormatter LONG_DATE = DateTimeFormatter.ofLocalizedDate(FormatStyle.LONG);

    // version: the first 12 hex digits of the SHA-256 of the files that the process reads, so that a
    // decision can name the model that made it.
    public record Process(
            String name, Shape shape, Map<String, Map<String, String>> texts, Engine engine, String version) {

        public List<String> languages() {
            return List.copyOf(texts.keySet());
        }

        public Evaluation evaluate(Map<String, ?> answers) {
            return evaluate(answers, LocalDate.now());
        }

        public Evaluation evaluate(Map<String, ?> answers, LocalDate today) {
            return engine.evaluate(answers, today);
        }

        public String text(String language, String key) {
            return texts.getOrDefault(language, texts.get(languages().getFirst()))
                    .getOrDefault(key, key);
        }

        public String title(String language) {
            return text(language, shape.name() + ".label");
        }

        // A value or an answer for a person, as every stack writes it (conformance/format.json): a
        // choice by its text; a date in long form, in the language and region of the process; a
        // number with at most two decimals, rounded half away from zero, with the separators of the
        // model (form:NumberFormat).
        public String format(String language, String field, Object value) {
            final var text = String.valueOf(value);
            if (field != null && texts.getOrDefault(language, Map.of()).containsKey(field + "." + text)) {
                return text(language, field + "." + text);
            }
            if (DATE.matcher(text).matches())
                return LocalDate.parse(text).format(LONG_DATE.withLocale(locale(language)));
            if (NUMBER.matcher(text).matches()) return number(language).format(new BigDecimal(text));
            return text;
        }

        private java.text.NumberFormat number(String language) {
            final var numbers = shape.numbers().get(language);
            if (numbers == null) {
                final var format = java.text.NumberFormat.getNumberInstance(locale(language));
                format.setMaximumFractionDigits(2);
                format.setRoundingMode(RoundingMode.HALF_UP);
                return format;
            }
            final var symbols = DecimalFormatSymbols.getInstance(Locale.ROOT);
            symbols.setGroupingSeparator(numbers.group());
            symbols.setDecimalSeparator(numbers.decimal());
            final var format = new DecimalFormat("#,##0.##", symbols);
            format.setRoundingMode(RoundingMode.HALF_UP);
            return format;
        }

        private Locale locale(String language) {
            return Locale.of(language, shape.region());
        }
    }

    private final Map<String, Process> processes;

    public Catalog(Path knowledge) {
        final var model = Knowledge.at(knowledge);
        this.processes = model.domains().stream()
                .map(name -> {
                    final var engine = model.engine(name);
                    return new Process(
                            name,
                            engine.shape(),
                            Texts.read(engine.model(), engine.shape()),
                            engine,
                            version(model.texts(name)));
                })
                .collect(Collectors.toMap(Process::name, Function.identity(), (a, b) -> a, TreeMap::new));
    }

    public List<Process> all() {
        return List.copyOf(processes.values());
    }

    public Optional<Process> get(String name) {
        return Optional.ofNullable(processes.get(name));
    }

    // The languages that every process has.
    public List<String> commonLanguages() {
        return all().stream()
                .map(Process::languages)
                .reduce((a, b) -> a.stream().filter(b::contains).toList())
                .orElse(List.of());
    }

    private static String version(List<String> texts) {
        try {
            final var digest = java.security.MessageDigest.getInstance("SHA-256");
            texts.forEach(t -> digest.update(t.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
            return java.util.HexFormat.of().formatHex(digest.digest()).substring(0, 12);
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
