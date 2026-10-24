package org.softwarethatknows.eligibility.vaadin;

import com.vaadin.flow.component.Composite;
import com.vaadin.flow.component.button.Button;
import com.vaadin.flow.component.button.ButtonVariant;
import com.vaadin.flow.component.html.Div;
import com.vaadin.flow.i18n.LocaleChangeEvent;
import com.vaadin.flow.i18n.LocaleChangeObserver;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;
import org.softwarethatknows.eligibility.Catalog.Process;
import org.softwarethatknows.eligibility.Evaluation;

// The wizard of one process, as react-bun/app/Wizard.tsx: a step for each group of questions of the
// model, then the review. After each answer the engine decides, on the server, which questions are
// asked and which answers are missing; the steps show what it decided.
class Wizard extends Composite<Div> implements LocaleChangeObserver {

    private final Process process;
    private final Map<String, Object> answers = new HashMap<>();
    private final List<Step> steps;
    private final Review review;
    private final List<Button> tabs;
    private Evaluation evaluation;
    private int at;
    private boolean revealMissing;

    Wizard(Process process) {
        this.process = process;
        this.evaluation = process.evaluate(answers);
        final var groups = process.shape().groups();
        steps = IntStream.range(0, groups.size())
                .mapToObj(i -> new Step(
                        process,
                        groups.get(i),
                        process.shape().fields().stream()
                                .filter(f -> f.group().equals(groups.get(i)))
                                .map(f -> new Question(process, f, value -> answer(f.name(), value)))
                                .toList(),
                        () -> go(i - 1),
                        () -> next(i)))
                .toList();
        review = new Review(process, this::go);
        tabs = IntStream.rangeClosed(0, groups.size())
                .mapToObj(i -> new Button("", click -> go(i)))
                .toList();
        final var nav = new Div(tabs.toArray(Button[]::new));
        nav.addClassName("steps");
        getContent().add(nav);
        steps.forEach(getContent()::add);
        getContent().add(review);
        update();
    }

    private void answer(String name, Object value) {
        if (value == null) answers.remove(name);
        else answers.put(name, value);
        evaluation = process.evaluate(answers);
        update();
    }

    private void next(int step) {
        if (steps.get(step).missing(evaluation).isEmpty()) go(step + 1);
        else {
            revealMissing = true;
            update();
        }
    }

    private void go(int step) {
        at = step;
        revealMissing = false;
        update();
    }

    private void update() {
        IntStream.range(0, steps.size()).forEach(i -> {
            steps.get(i).setVisible(i == at);
            steps.get(i).update(evaluation, revealMissing, i == 0);
        });
        review.setVisible(at == steps.size());
        if (at == steps.size()) review.show(evaluation);
        IntStream.range(0, tabs.size()).forEach(i -> {
            tabs.get(i)
                    .setEnabled(i == at
                            || IntStream.range(0, i)
                                    .allMatch(s -> s < steps.size()
                                            && steps.get(s).missing(evaluation).isEmpty()));
            if (i == at) tabs.get(i).addThemeVariants(ButtonVariant.LUMO_PRIMARY);
            else tabs.get(i).removeThemeVariants(ButtonVariant.LUMO_PRIMARY);
        });
    }

    @Override
    public void localeChange(LocaleChangeEvent event) {
        final var groups = process.shape().groups();
        IntStream.range(0, tabs.size())
                .forEach(i -> tabs.get(i)
                        .setText((i + 1) + ". "
                                + (i < groups.size()
                                        ? getTranslation(process.name() + ":" + groups.get(i) + ".label")
                                        : getTranslation("review.label"))));
        if (at == steps.size()) review.show(evaluation);
    }
}
