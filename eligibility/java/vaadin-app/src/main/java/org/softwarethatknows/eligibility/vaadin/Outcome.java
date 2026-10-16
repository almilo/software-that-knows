package org.softwarethatknows.eligibility.vaadin;

import com.vaadin.flow.component.Component;
import com.vaadin.flow.component.Text;
import com.vaadin.flow.component.html.Div;
import com.vaadin.flow.component.html.H4;
import com.vaadin.flow.component.html.ListItem;
import com.vaadin.flow.component.html.Paragraph;
import com.vaadin.flow.component.html.Span;
import com.vaadin.flow.component.html.UnorderedList;
import java.util.List;
import java.util.function.Function;
import org.softwarethatknows.eligibility.Evaluation;

// What the rules found, as react-bun/app/Outcome.tsx: each finding in the colour of its severity,
// then the next steps when nothing blocks the application, and the values; each names its sources.
final class Outcome {

    private Outcome() {}

    static Component of(Evaluation e, Function<String, String> t, Function<Object, String> format) {
        final var outcome = new Div();
        e.findings().forEach(f -> outcome.add(card(f.severity(), t.apply(f.severity() + ".label") + ": " + t.apply(f.id() + ".label"),
                new Paragraph(t.apply(f.id() + ".comment")), sources(f.sources(), t))));
        if (e.allowed()) {
            final var steps = new UnorderedList(e.nextSteps().stream().map(s -> new ListItem(new Text(t.apply(s.id() + ".label") + " "), sources(s.sources(), t))).toArray(ListItem[]::new));
            outcome.add(card("allowed", t.apply("allowed.label"), new Paragraph(t.apply("nextSteps.label") + ":"), steps));
        }
        if (!e.values().isEmpty()) {
            final var values = new Div(e.values().stream().map(v -> new Div(new Span(t.apply(v.id() + ".label")), new Div(new Span(format.apply(v.value())), sources(v.sources(), t)))).toArray(Div[]::new));
            values.addClassName("values");
            outcome.add(values);
        }
        return outcome;
    }

    static Component card(String className, String title, Component... content) {
        final var card = new Div(new H4(title));
        card.add(content);
        card.addClassNames("card", className);
        return card;
    }

    private static Component sources(List<String> ids, Function<String, String> t) {
        final var sources = new Span(String.join(", ", ids.stream().map(id -> t.apply(id + ".label")).toList()));
        sources.addClassName("sources");
        return sources;
    }
}
