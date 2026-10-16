package org.softwarethatknows.eligibility.vaadin;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

// The Vaadin app reads every process of the knowledge model, with its texts, and decides with it.
class ProcessesTest {

    private final Processes processes = new Processes(Path.of(System.getProperty("eligibility.knowledge")));

    @Test
    void readsEveryProcessOfTheModelInFourLanguages() {
        assertEquals(List.of("parental-allowance", "vested-benefits", "wef"), processes.all().stream().map(org.softwarethatknows.eligibility.Catalog.Process::name).toList());
        assertEquals(List.of("de", "en", "fr", "it"), processes.commonLanguages());
    }

    @Test
    void decidesAnApplicationWithTheEngineOfItsProcess() {
        final Map<String, Object> answers = Map.of("birthDate", "1986-03-15", "retirementAge", 65, "married", "no", "purpose", "buyOrBuild", "propertyType", "apartment",
                "ownership", "soleOwnership", "ownUse", "yes", "vestedBenefit", 150000.0, "requestedAmount", 100000.0, "withdrawnBefore", "no");
        assertTrue(processes.get("wef").orElseThrow().evaluate(answers).allowed());
    }
}
