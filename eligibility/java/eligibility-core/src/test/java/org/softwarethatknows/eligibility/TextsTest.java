package org.softwarethatknows.eligibility;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.file.Path;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.TestFactory;

// The Java core reads the same texts from the model as the TypeScript generator writes into each
// domain's messages.json (react-bun/domains/<name>/generated/).
class TextsTest {

    private static final Knowledge KNOWLEDGE = Knowledge.at(Path.of(System.getProperty("eligibility.knowledge")));
    private static final Path REACT = Path.of(System.getProperty("eligibility.knowledge")).resolve("../react-bun");

    @TestFactory
    Stream<DynamicTest> theTextsAreThoseOfMessagesJson() {
        return KNOWLEDGE.domains().stream().map(name -> DynamicTest.dynamicTest(name, () -> {
            final var engine = KNOWLEDGE.engine(name);
            assertEquals(messages(name), Texts.read(engine.model(), engine.shape()));
        }));
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> messages(String name) throws IOException {
        final Map<String, Object> all = new ObjectMapper().readValue(REACT.resolve("domains/" + name + "/generated/messages.json").toFile(), Map.class);
        all.remove("$comment");
        return all;
    }
}
