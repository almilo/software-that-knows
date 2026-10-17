package org.softwarethatknows.eligibility.vaadin;

import com.vaadin.flow.i18n.I18NProvider;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Component;

// Vaadin's translations, from the texts of the knowledge model. A key "<process>:<key>" is a text of
// that process (each process has its own, for example its title "ApplicationShape.label"); a key
// without a process is a text of the app itself (form.ttl), the same in every process.
// A text with {name} takes its value from a Map passed as the first parameter.
@Component
public class ModelTranslations implements I18NProvider {

    private final Processes processes;

    public ModelTranslations(Processes processes) {
        this.processes = processes;
    }

    @Override
    public List<Locale> getProvidedLocales() {
        final var languages = processes.commonLanguages();
        return languages.stream()
                .sorted((a, b) -> a.equals("en") ? -1 : b.equals("en") ? 1 : a.compareTo(b))
                .map(Locale::of)
                .toList();
    }

    @Override
    public String getTranslation(String key, Locale locale, Object... params) {
        final var separator = key.indexOf(':');
        final var process = separator < 0
                ? processes.all().getFirst()
                : processes.get(key.substring(0, separator)).orElseThrow();
        final var text = process.text(locale.getLanguage(), key.substring(separator + 1));
        if (params.length == 0 || !(params[0] instanceof Map<?, ?> values)) return text;
        return values.entrySet().stream()
                .reduce(text, (t, e) -> t.replace("{" + e.getKey() + "}", String.valueOf(e.getValue())), (a, b) -> a);
    }
}
