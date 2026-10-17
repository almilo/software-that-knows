package org.softwarethatknows.eligibility;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestFactory;

// The catalog formats values for a person, in the language and region of the process, and names the
// version of the model that each process reads.
class CatalogTest {

    private static final Catalog CATALOG = new Catalog(Path.of(System.getProperty("eligibility.knowledge")));

    // The shared cases (conformance/format.json): every stack writes a value as the others do.
    @TestFactory
    @SuppressWarnings("unchecked")
    Stream<DynamicTest> formatsAsEveryStack() throws IOException {
        final Map<String, Object> file = new ObjectMapper()
                .readValue(
                        Path.of(System.getProperty("eligibility.conformance"), "display", "format.json")
                                .toFile(),
                        Map.class);
        final var process = CATALOG.get((String) file.get("domain")).orElseThrow();
        return ((List<Map<String, Object>>) file.get("cases"))
                .stream()
                        .map(c -> DynamicTest.dynamicTest(
                                c.get("language") + " " + c.get("value"),
                                () -> assertEquals(
                                        c.get("expected"),
                                        process.format(
                                                (String) c.get("language"), (String) c.get("field"), c.get("value")))));
    }

    // Jena writes large decimals with an exponent.
    @Test
    void formatsADecimalWithAnExponent() {
        assertEquals(
                CATALOG.get("wef").orElseThrow().format("de", null, 150000),
                CATALOG.get("wef").orElseThrow().format("de", null, new BigDecimal("1.5E+5")));
    }

    @Test
    void version() {
        assertEquals(12, CATALOG.get("wef").orElseThrow().version().length());
        assertNotEquals(
                CATALOG.get("wef").orElseThrow().version(),
                CATALOG.get("vested-benefits").orElseThrow().version());
    }
}
