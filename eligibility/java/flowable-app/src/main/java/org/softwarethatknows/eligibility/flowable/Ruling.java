package org.softwarethatknows.eligibility.flowable;

import java.io.Serializable;
import java.time.LocalDate;
import java.util.List;
import org.softwarethatknows.eligibility.Evaluation;

// What the knowledge model decided for an application, kept in the process as one variable: the
// evaluation as the core returns it, the day of the decision and the version of the model, so that
// the decision can be traced later. The gateways and the office's tasks read it.
public record Ruling(Evaluation evaluation, LocalDate decidedOn, String modelVersion) implements Serializable {

    public boolean complete() {
        return evaluation.missing().isEmpty();
    }

    public boolean allowed() {
        return evaluation.allowed();
    }

    // The collection of the multi-instance task "Check a next step": one task for each.
    public List<String> nextStepIds() {
        return evaluation.nextSteps().stream().map(Evaluation.NextStep::id).toList();
    }
}
