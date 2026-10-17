package org.softwarethatknows.eligibility.flowable;

import java.time.LocalDate;
import java.util.Map;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.softwarethatknows.eligibility.Catalog;
import org.springframework.stereotype.Component;

// The service task "Decide with the knowledge model": the model decides on the application's
// answers, as in the other stacks, and the process keeps the decision as `ruling`.
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
        execution.setVariable("ruling", new Ruling(process.evaluate(answers, today), today, process.version()));
    }
}
