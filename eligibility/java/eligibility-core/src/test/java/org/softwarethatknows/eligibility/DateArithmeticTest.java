package org.softwarethatknows.eligibility;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.io.StringReader;
import java.util.List;
import org.apache.jena.query.QueryExecutionFactory;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

// The rules add durations to dates (xsd:duration, xsd:yearMonthDuration, xsd:dayTimeDuration).
// That is not plain SPARQL 1.1, so Jena must give the same dates as Oxigraph, the engine of the
// browser: the expected values here are Oxigraph's.
class DateArithmeticTest {

    record Case(String date, String duration, String type, String plus, String plusMinusOneDay) {}

    static List<Case> cases() {
        return List.of(
                new Case("1976-10-02", "P50Y", "duration", "2026-10-02", "2026-10-01"),
                new Case("1976-10-01", "P50Y", "duration", "2026-10-01", "2026-09-30"),
                new Case("1972-02-29", "P50Y", "duration", "2022-02-28", "2022-02-27"),
                new Case("1964-08-31", "P62Y6M", "duration", "2027-02-28", "2027-02-27"),
                new Case("1990-01-31", "P62Y1M", "duration", "2052-02-29", "2052-02-28"),
                new Case("1976-10-31", "P61Y9M", "duration", "2038-07-31", "2038-07-30"),
                new Case("2021-02-28", "P5Y", "duration", "2026-02-28", "2026-02-27"),
                new Case("2020-02-29", "P5Y", "duration", "2025-02-28", "2025-02-27"),
                new Case("2026-01-31", "P97D", "dayTimeDuration", "2026-05-08", "2026-05-07"),
                new Case("2026-08-31", "P6M", "yearMonthDuration", "2027-02-28", "2027-02-27"),
                new Case("2024-08-29", "P6M", "yearMonthDuration", "2025-02-28", "2025-02-27"),
                new Case("2024-02-29", "P18Y", "duration", "2042-02-28", "2042-02-27"),
                new Case("1976-10-02", "P0Y0M", "duration", "1976-10-02", "1976-10-01"));
    }

    @ParameterizedTest
    @MethodSource("cases")
    void addsDurationsAsOxigraphDoes(Case c) {
        final var xsd = "http://www.w3.org/2001/XMLSchema#";
        final Model model = ModelFactory.createDefaultModel();
        model.read(
                new StringReader("<urn:a> <urn:d> \"%s\"^^<%sdate> ; <urn:p> \"%s\"^^<%s%s> ."
                        .formatted(c.date(), xsd, c.duration(), xsd, c.type())),
                null,
                "TTL");
        final var query =
                "SELECT ?v ?w WHERE { <urn:a> <urn:d> ?d ; <urn:p> ?p BIND (?d + ?p AS ?v) BIND ((?d + ?p) - \"P1D\"^^<%sdayTimeDuration> AS ?w) }"
                        .formatted(xsd);
        try (final var execution = QueryExecutionFactory.create(query, model)) {
            final var row = execution.execSelect().next();
            assertEquals(c.plus(), lexical(row.get("v")), "date + duration");
            assertEquals(c.plusMinusOneDay(), lexical(row.get("w")), "date + duration - 1 day");
        }
    }

    private static String lexical(org.apache.jena.rdf.model.RDFNode node) {
        return node == null ? "(unbound)" : node.asLiteral().getLexicalForm();
    }
}
