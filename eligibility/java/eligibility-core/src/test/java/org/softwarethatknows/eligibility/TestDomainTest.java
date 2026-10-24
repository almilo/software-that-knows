package org.softwarethatknows.eligibility;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

// A new domain needs only its model: the core reads the test domain (eligibility/fixtures/) from a
// copy of the knowledge model, with its form, rules, texts and values, and no code knows it.
class TestDomainTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 10, 17);
    private static final Catalog.Process LIBRARY =
            new Catalog(TestDomain.knowledge()).get(TestDomain.NAME).orElseThrow();

    @Test
    void itsFormHasEveryKindOfInput() {
        assertEquals(
                List.of(
                        Field.Input.DATE,
                        Field.Input.RADIO,
                        Field.Input.RADIO,
                        Field.Input.SELECT,
                        Field.Input.INTEGER,
                        Field.Input.DECIMAL),
                LIBRARY.shape().fields().stream().map(Field::input).toList());
        assertEquals("Library card", LIBRARY.title("en"));
        assertEquals("Bibliotheksausweis", LIBRARY.title("de"));
    }

    @Test
    void itsRulesAskDecideAndDerive() {
        final var child =
                LIBRARY.evaluate(Map.of("birthDate", "2015-01-01", "resident", "yes", "cardType", "student"), TODAY);
        assertTrue(child.shown().contains("parentConsent"));
        assertEquals(List.of("parentConsent"), child.missing());

        final var adult =
                LIBRARY.evaluate(Map.of("birthDate", "1990-01-01", "resident", "yes", "cardType", "adult"), TODAY);
        assertFalse(adult.shown().contains("parentConsent"));
        assertTrue(adult.allowed());
        assertEquals(
                List.of("BringId"),
                adult.nextSteps().stream().map(Evaluation.NextStep::id).toList());
        assertEquals("30", LIBRARY.format("en", null, adult.values().getFirst().value()));

        final var away =
                LIBRARY.evaluate(Map.of("birthDate", "1990-01-01", "resident", "no", "cardType", "adult"), TODAY);
        assertEquals(
                List.of("NotResident"),
                away.findings().stream().map(Evaluation.Finding::id).toList());
        assertFalse(away.allowed());
    }

    @Test
    void theKnowledgeModelItselfDoesNotHaveIt() {
        assertTrue(new Catalog(java.nio.file.Path.of(System.getProperty("eligibility.knowledge")))
                .get(TestDomain.NAME)
                .isEmpty());
    }

    @Test
    void answersAreReadWithTheTypeOfTheirField() {
        final var books = LIBRARY.shape().fields().stream()
                .filter(f -> f.name().equals("books"))
                .findFirst()
                .orElseThrow();
        assertEquals(java.util.Optional.of(5), books.parse(" 5 "));
        assertTrue(books.parse("five").isEmpty());
        assertTrue(books.parse("").isEmpty());
    }
}
