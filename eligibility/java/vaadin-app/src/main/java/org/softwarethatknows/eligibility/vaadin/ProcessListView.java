package org.softwarethatknows.eligibility.vaadin;

import com.vaadin.flow.component.html.Anchor;
import com.vaadin.flow.component.html.Div;
import com.vaadin.flow.component.html.H1;
import com.vaadin.flow.component.html.H2;
import com.vaadin.flow.component.html.Main;
import com.vaadin.flow.component.html.Paragraph;
import com.vaadin.flow.component.html.Span;
import com.vaadin.flow.i18n.LocaleChangeEvent;
import com.vaadin.flow.i18n.LocaleChangeObserver;
import com.vaadin.flow.router.HasDynamicTitle;
import com.vaadin.flow.router.Route;
import java.util.List;
import org.softwarethatknows.eligibility.Catalog.Process;

// The list of processes, as react-bun/app/index.tsx: a card for each, with its title and summary
// from the model, and a link to its wizard.
@Route("")
public class ProcessListView extends Main implements LocaleChangeObserver, HasDynamicTitle {

    private record Card(Process process, H2 title, Paragraph summary, Span open) {}

    private final H1 heading = new H1();
    private final Paragraph intro = new Paragraph();
    private final List<Card> cards;

    public ProcessListView(Processes processes) {
        intro.addClassName("intro");
        final var header = new Div(heading, new LanguageSelect(), intro);
        header.addClassName("header");
        cards = processes.all().stream()
                .map(p -> new Card(p, new H2(), new Paragraph(), new Span()))
                .toList();
        final var list = new Div(cards.stream()
                .map(c -> new Anchor("process/" + c.process().name(), c.title(), c.summary(), c.open()))
                .toArray(Anchor[]::new));
        list.addClassName("processes");
        add(header, list);
    }

    @Override
    public void localeChange(LocaleChangeEvent event) {
        heading.setText(getTranslation("processes.label"));
        intro.setText(getTranslation("processesIntro.label"));
        cards.forEach(c -> {
            c.title()
                    .setText(getTranslation(
                            c.process().name() + ":" + c.process().shape().name() + ".label"));
            c.summary()
                    .setText(getTranslation(
                            c.process().name() + ":" + c.process().shape().name() + ".summary"));
            c.open().setText(getTranslation("open.label"));
        });
        getUI().ifPresent(ui -> ui.getPage().setTitle(getPageTitle()));
    }

    @Override
    public String getPageTitle() {
        return getTranslation("processes.label");
    }
}
