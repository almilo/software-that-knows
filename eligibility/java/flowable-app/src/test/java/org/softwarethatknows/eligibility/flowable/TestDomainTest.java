package org.softwarethatknows.eligibility.flowable;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.softwarethatknows.eligibility.TestDomain;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

// A new domain needs only its model: with the test domain added to the knowledge model, its form is
// on the pages, and its applications run through the same process, with its next steps as the
// office's tasks, with no change to the code of this app.
@SpringBootTest
@AutoConfigureMockMvc
class TestDomainTest {

    private static final Map<String, Object> ADULT =
            Map.of("birthDate", "1990-01-01", "resident", "yes", "cardType", "adult");

    @DynamicPropertySource
    static void knowledge(DynamicPropertyRegistry registry) {
        registry.add("eligibility.knowledge", () -> TestDomain.knowledge().toString());
    }

    @Autowired
    Applications applications;

    @Autowired
    MockMvc mvc;

    @Test
    void itsFormIsOnThePages() throws Exception {
        mvc.perform(get("/")).andExpect(content().string(containsString("Library card")));
        mvc.perform(post("/form/" + TestDomain.NAME)
                        .param("_action", "/apply/" + TestDomain.NAME)
                        .param("cardType", "visitor"))
                .andExpect(content().string(containsString("name=\"deposit\"")))
                .andExpect(content().string(containsString("<option value=\"family\">Family</option>")));
    }

    @Test
    void itsApplicationsRunThroughTheSameProcess() {
        final var id = applications.submit(TestDomain.NAME, ADULT, "alex");
        final var review = applications.get(id);
        assertEquals("review", review.summary().state());
        assertEquals(
                List.of("BringId"),
                review.checks().stream().map(Applications.Check::step).toList());

        final var away = new java.util.HashMap<>(ADULT);
        away.put("resident", "no");
        assertEquals(
                "refused",
                applications
                        .get(applications.submit(TestDomain.NAME, away, "alex"))
                        .summary()
                        .state());
    }
}
