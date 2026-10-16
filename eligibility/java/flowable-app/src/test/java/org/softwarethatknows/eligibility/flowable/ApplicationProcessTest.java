package org.softwarethatknows.eligibility.flowable;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.softwarethatknows.eligibility.Catalog;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.json.JsonParserFactory;
import org.springframework.boot.test.context.SpringBootTest;

// The BPMN process with Flowable and the knowledge model: what the model refuses ends at once, what
// is missing goes back to the applicant, each next step of the model is a task of the office, and a
// reviewer decides: approve, reject with a reason, or return to the applicant, who corrects it.
@SpringBootTest
class ApplicationProcessTest {

    private static final Map<String, Object> ALLOWED = Map.of("birthDate", "1986-03-15", "retirementAge", 65, "married", "no", "purpose", "buyOrBuild",
            "propertyType", "apartment", "ownership", "soleOwnership", "ownUse", "yes", "vestedBenefit", 150000, "requestedAmount", 100000, "withdrawnBefore", "no");

    @Autowired
    Applications applications;

    @Autowired
    Catalog catalog;

    @Value("${eligibility.conformance}")
    Path conformance;

    @Test
    void anAllowedApplicationIsCheckedStepByStepAndApproved() {
        final var id = applications.submit("wef", ALLOWED, "alex");
        final var submitted = applications.get(id);
        assertEquals("review", submitted.state());
        assertEquals("alex", submitted.applicant());
        assertEquals(LocalDate.now().toString(), submitted.ruling().get("decidedOn"));
        assertEquals(catalog.get("wef").orElseThrow().version(), submitted.ruling().get("modelVersion"));
        assertEquals(6, submitted.checks().size());
        assertEquals("AttachPurchaseContract", submitted.checks().getFirst().step());

        final var step = submitted.checks().getFirst().taskId();
        assertThrows(IllegalStateException.class, () -> applications.claim(step, "alex"));
        assertThrows(IllegalStateException.class, () -> applications.check(step, "maria", true, null));
        checkAll(id, "maria");
        assertTrue(applications.get(id).checks().stream().allMatch(c -> c.taskId() == null && c.fulfilled() && "maria".equals(c.reviewer())));

        final var decide = applications.get(id).task("decide", null);
        assertNull(decide.assignee());
        applications.claim(decide.id(), "luca");
        applications.decide(decide.id(), "luca", "approve", null);
        final var approved = applications.get(id);
        assertEquals("approved", approved.state());
        assertEquals(List.of("submitted", "check", "steps", "decide", "approved"), approved.history().stream().map(Applications.Activity::id).distinct().toList());
        assertTrue(approved.done().containsAll(List.of("check", "steps", "decide", "approved")));
    }

    @Test
    void anApplicationThatTheRulesRefuseEndsWithoutReview() {
        final var answers = new HashMap<>(ALLOWED);
        answers.put("requestedAmount", 5000);
        final var refused = applications.get(applications.submit("wef", answers, "alex"));
        assertEquals("refused", refused.state());
        assertTrue(findings(refused).contains("BelowMinimum"));
        assertTrue(refused.tasks().isEmpty());
    }

    @Test
    void anIncompleteApplicationGoesBackToTheApplicant() {
        final var answers = new HashMap<>(ALLOWED);
        answers.remove("vestedBenefit");
        final var id = applications.submit("wef", answers, "alex");
        final var incomplete = applications.get(id);
        assertEquals("complete", incomplete.state());
        assertEquals(List.of("vestedBenefit"), incomplete.missing());
        final var task = incomplete.task("complete", "alex");
        assertThrows(IllegalStateException.class, () -> applications.complete(task.id(), "maria", ALLOWED));
        applications.complete(task.id(), "alex", ALLOWED);
        assertEquals("review", applications.get(id).state());
    }

    @Test
    void aReturnedApplicationIsCorrectedAndDecidedAgain() {
        final var id = applications.submit("wef", ALLOWED, "alex");
        checkAll(id, "maria");
        final var decide = applications.get(id).task("decide", null).id();
        applications.claim(decide, "maria");
        assertThrows(IllegalArgumentException.class, () -> applications.decide(decide, "maria", "return", " "));
        applications.decide(decide, "maria", "return", "The amount is too high for the contract.");
        final var returned = applications.get(id);
        assertEquals("complete", returned.state());
        assertEquals("return", returned.decision());

        final var corrected = new HashMap<>(ALLOWED);
        corrected.put("requestedAmount", 10000);
        applications.complete(returned.task("complete", "alex").id(), "alex", corrected);
        final var decidedAgain = applications.get(id);
        assertEquals("refused", decidedAgain.state());
        assertTrue(findings(decidedAgain).contains("BelowMinimum"));
    }

    @Test
    void aRejectionNeedsAReason() {
        final var id = applications.submit("wef", ALLOWED, "alex");
        checkAll(id, "luca");
        final var decide = applications.get(id).task("decide", null).id();
        applications.claim(decide, "luca");
        assertThrows(IllegalArgumentException.class, () -> applications.decide(decide, "luca", "reject", null));
        applications.decide(decide, "luca", "reject", "The property is not used by the applicant.");
        final var rejected = applications.get(id);
        assertEquals("rejected", rejected.state());
        assertEquals("The property is not used by the applicant.", rejected.reason());
    }

    // Every domain runs through the same process: an application of the shared test cases that the
    // model allows today gets one task for each of its next steps; one that it refuses ends at once.
    @Test
    void everyDomainRunsThroughTheSameProcess() throws IOException {
        catalog.all().forEach(process -> {
            final var cases = cases(process.name());
            final var allowed = cases.stream().filter(a -> process.evaluate(a).allowed()).findFirst().orElseThrow();
            final var review = applications.get(applications.submit(process.name(), allowed, "alex"));
            assertEquals("review", review.state(), process.name());
            assertEquals(process.evaluate(allowed).nextSteps().size(), review.checks().size(), process.name());
            final var refused = cases.stream().filter(a -> process.evaluate(a).missing().isEmpty() && !process.evaluate(a).allowed()).findFirst().orElseThrow();
            assertEquals("refused", applications.get(applications.submit(process.name(), refused, "alex")).state(), process.name());
        });
        assertFalse(applications.of("alex").isEmpty());
        assertTrue(applications.of("maria").isEmpty());
    }

    private void checkAll(String id, String reviewer) {
        applications.get(id).checks().forEach(c -> {
            applications.claim(c.taskId(), reviewer);
            applications.check(c.taskId(), reviewer, true, null);
        });
    }

    @SuppressWarnings("unchecked")
    private static List<String> findings(Applications.Detail detail) {
        return ((List<Map<String, Object>>) detail.ruling().get("findings")).stream().map(f -> (String) f.get("id")).toList();
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> cases(String domain) {
        try {
            final var json = JsonParserFactory.getJsonParser().parseMap(Files.readString(conformance.resolve(domain + ".json")));
            return ((List<Map<String, Object>>) json.get("cases")).stream().map(c -> (Map<String, Object>) c.get("answers")).toList();
        } catch (IOException e) {
            throw new java.io.UncheckedIOException(e);
        }
    }
}
