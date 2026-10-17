package org.softwarethatknows.eligibility;

import java.io.Serializable;
import java.util.List;
import java.util.Map;

// What the engine decides for some answers, as react-bun/core/engine.ts returns it. Serializable, so
// that a process engine can keep it as it is.
public record Evaluation(
        Map<String, Object> answers, // the answers to the fields that are asked; the others do not count
        List<String> shown, // the fields that are asked, in the order of the form
        List<String> missing, // the fields that are asked and need an answer, but have none
        List<Value> values,
        List<Finding> findings,
        List<NextStep> nextSteps,
        boolean allowed // nothing is missing, and no finding blocks the application
        ) implements Serializable {
    public record Value(String id, Object value, String datatype, List<String> sources) implements Serializable {}

    public record Finding(String id, String severity, boolean blocks, List<String> sources) implements Serializable {}

    public record NextStep(String id, List<String> sources) implements Serializable {}
}
