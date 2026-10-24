package org.softwarethatknows.eligibility.vaadin;

import com.vaadin.flow.component.html.Anchor;
import com.vaadin.flow.component.html.Div;
import com.vaadin.flow.component.html.H1;
import com.vaadin.flow.component.html.Main;
import com.vaadin.flow.component.html.Paragraph;
import com.vaadin.flow.i18n.LocaleChangeEvent;
import com.vaadin.flow.i18n.LocaleChangeObserver;
import com.vaadin.flow.router.BeforeEnterEvent;
import com.vaadin.flow.router.BeforeEnterObserver;
import com.vaadin.flow.router.HasDynamicTitle;
import com.vaadin.flow.router.NotFoundException;
import com.vaadin.flow.router.Route;
import org.softwarethatknows.eligibility.Catalog.Process;

// The page of one process: a link back to the list, its title, the notice of the model, and its wizard.
@Route("process/:domain")
public class ProcessView extends Main implements BeforeEnterObserver, LocaleChangeObserver, HasDynamicTitle {

    private final Processes processes;
    private final Anchor back = new Anchor("", "");
    private final H1 title = new H1();
    private final Paragraph notice = new Paragraph();
    private Process process;

    public ProcessView(Processes processes) {
        this.processes = processes;
        back.addClassName("back");
        notice.addClassName("warning");
    }

    @Override
    public void beforeEnter(BeforeEnterEvent event) {
        final var name = event.getRouteParameters().get("domain").orElse("");
        process = processes.get(name).orElseThrow(() -> new NotFoundException("No process " + name));
        final var header = new Div(back, title, new LanguageSelect(), notice);
        header.addClassName("header");
        removeAll();
        add(header, new Wizard(process));
    }

    @Override
    public void localeChange(LocaleChangeEvent event) {
        back.setText("← " + getTranslation("allProcesses.label"));
        title.setText(t(process.shape().name() + ".label"));
        notice.setText(t(process.shape().name() + ".comment"));
        getUI().ifPresent(ui -> ui.getPage().setTitle(getPageTitle()));
    }

    @Override
    public String getPageTitle() {
        return process == null ? "" : t(process.shape().name() + ".label");
    }

    private String t(String key) {
        return getTranslation(process.name() + ":" + key);
    }
}
