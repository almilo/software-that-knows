package org.softwarethatknows.eligibility.flowable;

import jakarta.servlet.http.HttpSession;
import java.util.Locale;
import java.util.Map;
import org.flowable.common.engine.api.FlowableException;
import org.softwarethatknows.eligibility.Catalog;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

// What a person does: apply (the form comes back from the server after each change, through htmx),
// complete an application, claim a task, check a next step, decide. Each action is a form post
// that redirects to the application; a refused action comes back as a message.
@Controller
class Actions {

    private final Catalog catalog;
    private final Applications applications;

    Actions(Catalog catalog, Applications applications) {
        this.catalog = catalog;
        this.applications = applications;
    }

    @GetMapping("/apply/{domain}")
    String apply(@PathVariable String domain, Locale locale, Model model) {
        model.addAttribute("form", Form.of(process(domain), locale.getLanguage(), Map.of(), false, "/apply/" + domain));
        return "apply";
    }

    // The form again, for the answers so far: htmx swaps it in after each change.
    @PostMapping("/form/{domain}")
    String form(
            @PathVariable String domain,
            @RequestParam MultiValueMap<String, String> params,
            Locale locale,
            Model model) {
        final var process = process(domain);
        final var reveal = Boolean.parseBoolean(params.getFirst("_reveal"));
        model.addAttribute(
                "form",
                Form.of(
                        process,
                        locale.getLanguage(),
                        Form.answers(process, params),
                        reveal,
                        params.getFirst("_action")));
        return "form :: form";
    }

    // Submitted only when the model asks for nothing more; the process decides again on its own.
    @PostMapping("/apply/{domain}")
    String submit(
            @PathVariable String domain,
            @RequestParam MultiValueMap<String, String> params,
            Locale locale,
            Model model,
            HttpSession session) {
        final var answers = Form.answers(process(domain), params);
        final var form = Form.of(process(domain), locale.getLanguage(), answers, true, "/apply/" + domain);
        if (!form.complete()) {
            model.addAttribute("form", form);
            return "apply";
        }
        return "redirect:/applications/"
                + applications.submit(domain, answers, Web.me(session).id());
    }

    @PostMapping("/tasks/{id}/complete")
    String complete(
            @PathVariable String id,
            @RequestParam String application,
            @RequestParam MultiValueMap<String, String> params,
            HttpSession session,
            RedirectAttributes flash) {
        final var process = process(applications.get(application).summary().domain());
        return act(
                application,
                flash,
                () -> applications.complete(id, Web.me(session).id(), Form.answers(process, params)));
    }

    @PostMapping("/tasks/{id}/claim")
    String claim(
            @PathVariable String id, @RequestParam String application, HttpSession session, RedirectAttributes flash) {
        return act(
                application, flash, () -> applications.claim(id, Web.me(session).id()));
    }

    @PostMapping("/applications/{application}/claim-steps")
    String claimSteps(@PathVariable String application, HttpSession session, RedirectAttributes flash) {
        return act(
                application,
                flash,
                () -> applications.claimSteps(application, Web.me(session).id()));
    }

    @PostMapping("/tasks/{id}/unclaim")
    String unclaim(
            @PathVariable String id, @RequestParam String application, HttpSession session, RedirectAttributes flash) {
        return act(
                application,
                flash,
                () -> applications.unclaim(id, Web.me(session).id()));
    }

    @PostMapping("/tasks/{id}/check")
    String check(
            @PathVariable String id,
            @RequestParam String application,
            @RequestParam boolean fulfilled,
            @RequestParam(required = false) String note,
            HttpSession session,
            RedirectAttributes flash) {
        return act(
                application, flash, () -> applications.check(id, Web.me(session).id(), fulfilled, note));
    }

    @PostMapping("/tasks/{id}/decide")
    String decide(
            @PathVariable String id,
            @RequestParam String application,
            @RequestParam String decision,
            @RequestParam(required = false) String reason,
            HttpSession session,
            RedirectAttributes flash) {
        return act(
                application,
                flash,
                () -> applications.decide(id, Web.me(session).id(), decision, reason));
    }

    private String act(String application, RedirectAttributes flash, Runnable action) {
        try {
            action.run();
        } catch (IllegalStateException | IllegalArgumentException | FlowableException e) {
            flash.addFlashAttribute("error", e.getMessage());
        }
        return "redirect:/applications/" + application;
    }

    private Catalog.Process process(String domain) {
        return catalog.get(domain).orElseThrow(() -> new IllegalArgumentException("No process " + domain));
    }
}
