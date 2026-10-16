package org.softwarethatknows.eligibility.vaadin;

import com.vaadin.flow.component.Composite;
import com.vaadin.flow.component.select.Select;
import com.vaadin.flow.i18n.LocaleChangeEvent;
import com.vaadin.flow.i18n.LocaleChangeObserver;
import com.vaadin.flow.server.VaadinService;
import com.vaadin.flow.server.VaadinSession;
import java.util.Locale;

// The languages of the model, each named in itself. A choice changes the locale of the session, and
// every component that observes it shows its texts in the new language.
public class LanguageSelect extends Composite<Select<Locale>> implements LocaleChangeObserver {

    public LanguageSelect() {
        final var translations = VaadinService.getCurrent().getInstantiator().getI18NProvider();
        getContent().setItems(translations.getProvidedLocales());
        getContent().setItemLabelGenerator(l -> translations.getTranslation("language.label", l));
        getContent().setAriaLabel("Language");
        getContent().addValueChangeListener(e -> {
            if (e.isFromClient()) VaadinSession.getCurrent().setLocale(e.getValue());
        });
    }

    @Override
    public void localeChange(LocaleChangeEvent event) {
        getContent().setValue(Locale.of(event.getLocale().getLanguage()));
    }
}
