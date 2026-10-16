package org.softwarethatknows.eligibility.flowable;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrlPattern;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;

// The pages as a person uses them: the processes, the form that the server sends back after each
// change, a submission, the office's tasks, and the texts in the language of the session.
@SpringBootTest
@AutoConfigureMockMvc
class PagesTest {

    @Autowired
    MockMvc mvc;

    @Test
    void theProcessesAndTheDiagramAreListed() throws Exception {
        mvc.perform(get("/")).andExpect(status().isOk())
                .andExpect(content().string(containsString("Pension money for a home")))
                .andExpect(content().string(containsString("class=\"diagram\"")));
        mvc.perform(get("/process.bpmn").param("language", "de")).andExpect(status().isOk())
                .andExpect(content().string(containsString("name=\"Mit dem Wissensmodell entscheiden\"")))
                .andExpect(content().string(containsString("bpmndi:BPMNShape")));
    }

    // htmx posts the form on each change; the questions that the model asks now come back.
    @Test
    void theFormAsksWhatTheModelAsks() throws Exception {
        mvc.perform(post("/form/wef").param("_action", "/apply/wef").param("purpose", "cooperativeShares")).andExpect(status().isOk())
                .andExpect(content().string(not(containsString("name=\"propertyType\""))));
        mvc.perform(post("/form/wef").param("_action", "/apply/wef").param("purpose", "repayMortgage")).andExpect(status().isOk())
                .andExpect(content().string(containsString("name=\"propertyType\"")))
                .andExpect(content().string(containsString("name=\"fundUnderfunded\"")));
    }

    @Test
    void anIncompleteFormIsNotSubmitted() throws Exception {
        mvc.perform(post("/apply/wef").param("purpose", "buyOrBuild")).andExpect(status().isOk())
                .andExpect(content().string(containsString("Answer the questions marked above to continue.")));
    }

    @Test
    void aSubmittedApplicationWaitsForTheOffice() throws Exception {
        final var applicant = new MockHttpSession();
        final var location = mvc.perform(post("/apply/wef").session(applicant)
                        .param("birthDate", "1986-03-15").param("retirementAge", "65").param("married", "no").param("purpose", "buyOrBuild")
                        .param("propertyType", "apartment").param("ownership", "soleOwnership").param("ownUse", "yes")
                        .param("vestedBenefit", "150000").param("requestedAmount", "100000").param("withdrawnBefore", "no"))
                .andExpect(redirectedUrlPattern("/applications/*")).andReturn().getResponse().getRedirectedUrl();
        mvc.perform(get(location).session(applicant)).andExpect(status().isOk())
                .andExpect(content().string(containsString("In review")))
                .andExpect(content().string(containsString("Attach the purchase contract or the construction contract.")));

        final var reviewer = new MockHttpSession();
        mvc.perform(post("/me").session(reviewer).param("user", "maria"));
        mvc.perform(get("/tasks").session(reviewer)).andExpect(status().isOk())
                .andExpect(content().string(containsString("Check a next step")))
                .andExpect(content().string(containsString("Offered to the office")));
        mvc.perform(get(location).session(reviewer).param("language", "de")).andExpect(status().isOk())
                .andExpect(content().string(containsString("In Prüfung")))
                .andExpect(content().string(containsString("Übernehmen")));
    }
}
