package org.softwarethatknows.eligibility.vaadin;

import com.vaadin.flow.component.Composite;
import com.vaadin.flow.component.Text;
import com.vaadin.flow.component.button.Button;
import com.vaadin.flow.component.button.ButtonVariant;
import com.vaadin.flow.component.html.Div;
import com.vaadin.flow.component.html.H2;
import com.vaadin.flow.component.html.H3;
import com.vaadin.flow.component.html.Paragraph;
import com.vaadin.flow.component.html.Span;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import java.util.function.IntConsumer;
import org.softwarethatknows.eligibility.Catalog.Process;
import org.softwarethatknows.eligibility.Evaluation;

// The last step: the answers of each step, with a link back to it, the outcome, and the submission.
// It is read-only, so it is drawn again from the evaluation each time it is shown.
class Review extends Composite<Div> {

    private final Process process;
    private final IntConsumer onChange;

    Review(Process process, IntConsumer onChange) {
        this.process = process;
        this.onChange = onChange;
        getContent().addClassName("step");
    }

    void show(Evaluation e) {
        final var content = getContent();
        content.removeAll();
        content.add(new H2(getTranslation("review.label")));
        final var groups = process.shape().groups();
        java.util.stream.IntStream.range(0, groups.size()).forEach(i -> {
            final var change = new Button(getTranslation("change.label"), click -> onChange.accept(i));
            change.addThemeVariants(ButtonVariant.LUMO_SMALL, ButtonVariant.LUMO_TERTIARY);
            final var answers = new Div(process.shape().fields().stream()
                    .filter(f -> f.group().equals(groups.get(i)) && e.answers().containsKey(f.name()))
                    .map(f -> new Div(new Span(t(f.name() + ".label")), new Span(format(f.name(), e.answers().get(f.name())))))
                    .toArray(Div[]::new));
            answers.addClassName("summary");
            content.add(new H3(new Text(t(groups.get(i) + ".label") + " "), change), answers);
        });
        content.add(new H3(getTranslation("outcome.label")), Outcome.of(e, this::t, value -> format(null, value)));
        if (e.allowed()) content.add(submission());
        final var back = new Button(getTranslation("back.label"), click -> onChange.accept(groups.size() - 1));
        final var nav = new Div(back);
        nav.addClassName("nav");
        content.add(nav);
    }

    // The submission of the demo: the engine has decided on the server already, and nothing is stored.
    private Div submission() {
        final var submission = new Div();
        submission.addClassName("apply");
        final var submit = new Button(getTranslation("submit.label"));
        submit.addThemeVariants(ButtonVariant.LUMO_PRIMARY);
        submit.addClickListener(click -> submission.replace(submit, Outcome.card("receipt", getTranslation("received.label"),
                new Paragraph(getTranslation("receipt.label", Map.of("reference", UUID.randomUUID().toString().substring(0, 8).toUpperCase(), "date", format(null, LocalDate.now().toString())))))));
        final var hint = new Paragraph(getTranslation("demo.label"));
        hint.addClassName("hint");
        submission.add(submit, hint);
        return submission;
    }

    private String t(String key) {
        return getTranslation(process.name() + ":" + key);
    }

    private String format(String field, Object value) {
        return process.format(getLocale().getLanguage(), field, value);
    }
}
