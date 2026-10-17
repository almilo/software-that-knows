package org.softwarethatknows.eligibility;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

// A question of the form, as react-bun/core/model.ts reads it from a SHACL property shape, with
// what every Java UI needs to show it: the kind of input, and how to read an answer typed into it.
public record Field(
        String name, // the local name of sh:path: the property in the JSON data
        String path, // sh:path
        String group, // the local name of sh:group
        Optional<String> datatype, // sh:datatype
        Optional<List<String>> choices, // sh:in, as IRIs
        Optional<BigDecimal> minimum, // sh:minInclusive
        Optional<BigDecimal> maximum, // sh:maxInclusive
        boolean required, // sh:minCount 1: when the field is asked, it needs an answer
        Optional<String> askedWhen // form:askedWhen: an ASK query, with its PREFIX lines
        ) {

    // Up to three choices are shown at once (radio buttons), more as a list.
    public enum Input {
        RADIO,
        SELECT,
        DATE,
        INTEGER,
        DECIMAL
    }

    public Input input() {
        if (choices.isPresent()) return choices.get().size() <= 3 ? Input.RADIO : Input.SELECT;
        final var type = datatype.orElse("");
        if (type.endsWith("#date")) return Input.DATE;
        if (type.endsWith("#integer")) return Input.INTEGER;
        return Input.DECIMAL;
    }

    // The local names of the choices, as the answers hold them.
    public List<String> choiceNames() {
        return choices.map(c -> c.stream().map(Rdf::local).toList()).orElse(List.of());
    }

    // An answer typed as text, with the type of the field: empty when it is blank or not a number.
    public Optional<Object> parse(String text) {
        if (text == null || text.isBlank()) return Optional.empty();
        final var answer = text.strip();
        try {
            return Optional.of(
                    switch (input()) {
                        case INTEGER -> Integer.valueOf(answer);
                        case DECIMAL -> new BigDecimal(answer);
                        default -> answer;
                    });
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }
}
