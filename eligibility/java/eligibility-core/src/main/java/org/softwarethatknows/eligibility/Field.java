package org.softwarethatknows.eligibility;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

// A question of the form, as react-bun/core/model.ts reads it from a SHACL property shape.
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
) {}
