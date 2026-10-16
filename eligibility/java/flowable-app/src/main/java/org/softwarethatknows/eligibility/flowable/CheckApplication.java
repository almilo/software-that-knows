package org.softwarethatknows.eligibility.flowable;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.softwarethatknows.eligibility.Catalog;
import org.softwarethatknows.eligibility.Evaluation;
import org.springframework.stereotype.Component;

// The service task "Decide with the knowledge model": the model decides on the application's
// answers, as in the other stacks. The gateway reads `missing` and `allowed`, the next steps become
// the office's tasks (`nextSteps`), and `ruling` keeps what the model found, with its sources, the
// day it decided and the version of the model, so that the decision can be traced later.
@Component("checkApplication")
public class CheckApplication implements JavaDelegate {

    private final Catalog catalog;

    public CheckApplication(Catalog catalog) {
        this.catalog = catalog;
    }

    @Override
    public void execute(DelegateExecution execution) {
        final var domain = (String) execution.getVariable("domain");
        @SuppressWarnings("unchecked")
        final var answers = (Map<String, Object>) execution.getVariable("answers");
        final var process = catalog.get(domain).orElseThrow(() -> new IllegalArgumentException("No process " + domain));
        final var today = LocalDate.now();
        final Evaluation evaluation = process.evaluate(answers, today);
        execution.setVariable("allowed", evaluation.allowed());
        execution.setVariable("missing", new ArrayList<>(evaluation.missing()));
        execution.setVariable("nextSteps", new ArrayList<>(evaluation.nextSteps().stream().map(Evaluation.NextStep::id).toList()));
        execution.setVariable("ruling", ruling(evaluation, today, process.version()));
    }

    // Also what the form shows while the applicant answers, so that both show the same.
    static HashMap<String, Object> ruling(Evaluation e, LocalDate today, String version) {
        final var ruling = new HashMap<String, Object>();
        ruling.put("decidedOn", today.toString());
        ruling.put("modelVersion", version);
        ruling.put("allowed", e.allowed());
        ruling.put("findings", new ArrayList<>(e.findings().stream().map(f -> item(f.id(), f.sources(), "severity", f.severity())).toList()));
        ruling.put("nextSteps", new ArrayList<>(e.nextSteps().stream().map(s -> item(s.id(), s.sources(), null, null)).toList()));
        ruling.put("values", new ArrayList<>(e.values().stream().map(v -> item(v.id(), v.sources(), "value", v.value() instanceof java.math.BigDecimal n ? n.toPlainString() : String.valueOf(v.value()))).toList()));
        return ruling;
    }

    private static HashMap<String, Object> item(String id, List<String> sources, String key, String value) {
        final var item = new HashMap<String, Object>();
        item.put("id", id);
        item.put("sources", new ArrayList<>(sources));
        if (key != null) item.put(key, value);
        return item;
    }
}
