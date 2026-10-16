package org.softwarethatknows.eligibility.vaadin;

import com.vaadin.flow.component.Composite;
import com.vaadin.flow.component.button.Button;
import com.vaadin.flow.component.button.ButtonVariant;
import com.vaadin.flow.component.formlayout.FormLayout;
import com.vaadin.flow.component.html.Div;
import com.vaadin.flow.component.html.H2;
import com.vaadin.flow.component.html.Paragraph;
import com.vaadin.flow.i18n.LocaleChangeEvent;
import com.vaadin.flow.i18n.LocaleChangeObserver;
import java.util.List;
import org.softwarethatknows.eligibility.Catalog.Process;
import org.softwarethatknows.eligibility.Evaluation;

// One step of the wizard: the questions of one group of the model, in one column. The questions are
// made once; after each answer the step shows the ones that the engine asks.
class Step extends Composite<Div> implements LocaleChangeObserver {

    private final Process process;
    private final String group;
    private final List<Question> questions;
    private final H2 title = new H2();
    private final Paragraph open = new Paragraph();
    private final Button back = new Button();
    private final Button next = new Button();

    Step(Process process, String group, List<Question> questions, Runnable onBack, Runnable onNext) {
        this.process = process;
        this.group = group;
        this.questions = questions;
        final var form = new FormLayout(questions.toArray(Question[]::new));
        form.setResponsiveSteps(new FormLayout.ResponsiveStep("0", 1));
        open.addClassName("error");
        back.addClickListener(e -> onBack.run());
        next.addThemeVariants(ButtonVariant.LUMO_PRIMARY);
        next.addClickListener(e -> onNext.run());
        final var nav = new Div(back, next);
        nav.addClassName("nav");
        getContent().add(title, form, open, nav);
        getContent().addClassName("step");
    }

    void update(Evaluation e, boolean revealMissing, boolean first) {
        questions.forEach(q -> {
            q.setVisible(e.shown().contains(q.name()));
            q.showMissing(revealMissing && e.missing().contains(q.name()));
        });
        open.setVisible(revealMissing && !missing(e).isEmpty());
        back.setVisible(!first);
    }

    // The questions of this step that are asked and need an answer, but have none.
    List<String> missing(Evaluation e) {
        return questions.stream().map(Question::name).filter(e.missing()::contains).toList();
    }

    @Override
    public void localeChange(LocaleChangeEvent event) {
        title.setText(getTranslation(process.name() + ":" + group + ".label"));
        open.setText(getTranslation("openQuestions.label"));
        back.setText(getTranslation("back.label"));
        next.setText(getTranslation("next.label"));
    }
}
