package org.softwarethatknows.eligibility.flowable;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.FormatStyle;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.softwarethatknows.eligibility.Catalog;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.stereotype.Component;

// The model's texts for the templates, in the current language: ${@model.text(domain, key)}. The
// texts of the app itself (buttons, headings) are in the model too, under any domain; the texts of
// this stack (the process, the tasks) are in messages*.properties.
@Component("model")
public class ModelTexts {

    private static final ZoneId ZONE = ZoneId.of("Europe/Zurich");

    private final Catalog catalog;

    public ModelTexts(Catalog catalog) {
        this.catalog = catalog;
    }

    public String text(String domain, String key) {
        return process(domain).text(language(), key);
    }

    public String app(String key) {
        return catalog.all().getFirst().text(language(), key + ".label");
    }

    public String title(String domain) {
        return process(domain).title(language());
    }

    // The short description of a process, for the list of processes.
    public String summary(String domain) {
        return text(domain, process(domain).shape().name() + ".summary");
    }

    // The answers with the labels of their questions, in the order of the form.
    public List<Map.Entry<String, String>> answered(String domain, Map<String, Object> answers) {
        return process(domain).shape().fields().stream().filter(f -> answers.containsKey(f.name()))
                .map(f -> Map.entry(text(domain, f.name() + ".label"), format(domain, f.name(), answers.get(f.name())))).toList();
    }

    // The help text of a question, or null when it has none.
    public String help(String domain, String field) {
        final var key = field + ".description";
        final var help = text(domain, key);
        return help.equals(key) ? null : help;
    }

    public String format(String domain, String field, Object value) {
        return process(domain).format(language(), field, value);
    }

    // The labels of some terms of the model (legal articles, for instance), separated by commas.
    public String labels(String domain, List<String> ids) {
        return String.join(", ", ids.stream().map(id -> text(domain, id + ".label")).toList());
    }

    public String time(Instant instant) {
        return instant == null ? "" : DateTimeFormatter.ofLocalizedDateTime(FormatStyle.SHORT).withLocale(locale()).withZone(ZONE).format(instant);
    }

    public String join(java.util.Collection<String> ids) {
        return String.join(",", ids);
    }

    public String person(String id) {
        return People.name(id);
    }

    private Catalog.Process process(String domain) {
        return catalog.get(domain).orElseThrow(() -> new IllegalArgumentException("No process " + domain));
    }

    private static String language() {
        return LocaleContextHolder.getLocale().getLanguage();
    }

    private Locale locale() {
        return Locale.of(language(), catalog.all().getFirst().shape().region());
    }
}
