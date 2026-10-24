package org.softwarethatknows.eligibility;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.api.DynamicContainer;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.TestFactory;

// The shared test cases (eligibility/conformance/<domain>.json): the Java core must decide each case
// as recorded, as the TypeScript core does. Numbers are compared as numbers: 75000 and 75000.0 are
// the same value.
class ConformanceTest {

    private static final ObjectMapper JSON =
            new ObjectMapper().enable(DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS);
    private static final Knowledge KNOWLEDGE = Knowledge.at(Path.of(System.getProperty("eligibility.knowledge")));
    private static final Path CASES = Path.of(System.getProperty("eligibility.conformance"));

    @TestFactory
    Stream<DynamicContainer> everyCaseIsDecidedAsRecorded() throws IOException {
        try (final var files = Files.list(CASES)) {
            return files
                    .filter(p -> p.toString().endsWith(".json") && !p.toString().endsWith(".examples.json"))
                    .sorted()
                    .toList()
                    .stream()
                    .map(ConformanceTest::domain);
        }
    }

    private static DynamicContainer domain(Path file) {
        final JsonNode content = read(file);
        final var engine = KNOWLEDGE.engine(content.get("domain").asText());
        final var tests = Stream.iterate(0, i -> i < content.get("cases").size(), i -> i + 1)
                .map(i -> content.get("cases").get(i))
                .map(c -> DynamicTest.dynamicTest(c.get("id").asText(), () -> {
                    @SuppressWarnings("unchecked")
                    final Map<String, Object> answers = JSON.convertValue(c.get("answers"), Map.class);
                    final var decided = engine.evaluate(
                            answers, LocalDate.parse(c.get("date").asText()));
                    assertEquals(normalize(c.get("expected")), normalize(JSON.valueToTree(decided)));
                }));
        return DynamicContainer.dynamicContainer(file.getFileName().toString(), tests);
    }

    // Numbers as exact decimals without trailing zeros, so that the comparison is by value.
    private static JsonNode normalize(JsonNode node) {
        if (node.isNumber())
            return JsonNodeFactory.instance.numberNode(node.decimalValue().stripTrailingZeros());
        if (node.isArray()) {
            final var array = JsonNodeFactory.instance.arrayNode();
            node.forEach(item -> array.add(normalize(item)));
            return array;
        }
        if (node.isObject()) {
            final var object = JsonNodeFactory.instance.objectNode();
            node.properties().forEach(e -> object.set(e.getKey(), normalize(e.getValue())));
            return object;
        }
        return node;
    }

    private static JsonNode read(Path file) {
        try {
            return JSON.readTree(file.toFile());
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
