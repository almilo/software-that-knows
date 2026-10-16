package org.softwarethatknows.eligibility.flowable;

import jakarta.servlet.http.HttpSession;
import java.io.InputStream;
import java.util.Map;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;
import org.flowable.engine.RepositoryService;
import org.softwarethatknows.eligibility.Catalog;
import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;
import org.w3c.dom.Element;

// What a person does: apply (the form comes back from the server after each change, through htmx),
// complete an application, claim a task, check a next step, decide. Each action is a form post
// that redirects to the application; a refused action comes back as a message.
@Controller
class Actions {

    private final Catalog catalog;
    private final Applications applications;
    private final RepositoryService repository;
    private final MessageSource messages;

    Actions(Catalog catalog, Applications applications, RepositoryService repository, MessageSource messages) {
        this.catalog = catalog;
        this.applications = applications;
        this.repository = repository;
        this.messages = messages;
    }

    @GetMapping("/apply/{domain}")
    String apply(@PathVariable String domain, Model model) {
        model.addAttribute("form", Form.of(process(domain), Map.of(), false, "/apply/" + domain));
        return "apply";
    }

    // The form again, for the answers so far: htmx swaps it in after each change.
    @PostMapping("/form/{domain}")
    String form(@PathVariable String domain, @RequestParam MultiValueMap<String, String> params, Model model) {
        model.addAttribute("form", Form.of(process(domain), Form.answers(process(domain), params), Boolean.parseBoolean(params.getFirst("_reveal")), params.getFirst("_action")));
        return "form :: form";
    }

    // Submitted only when the model asks for nothing more; the process decides again on its own.
    @PostMapping("/apply/{domain}")
    String submit(@PathVariable String domain, @RequestParam MultiValueMap<String, String> params, Model model, HttpSession session) {
        final var answers = Form.answers(process(domain), params);
        final var form = Form.of(process(domain), answers, true, "/apply/" + domain);
        if (!form.complete()) {
            model.addAttribute("form", form);
            return "apply";
        }
        return "redirect:/applications/" + applications.submit(domain, answers, Web.me(session).id());
    }

    @PostMapping("/tasks/{id}/complete")
    String complete(@PathVariable String id, @RequestParam String application, @RequestParam MultiValueMap<String, String> params, HttpSession session, RedirectAttributes flash) {
        final var domain = applications.get(application).domain();
        return act(application, flash, () -> applications.complete(id, Web.me(session).id(), Form.answers(process(domain), params)));
    }

    @PostMapping("/tasks/{id}/claim")
    String claim(@PathVariable String id, @RequestParam String application, HttpSession session, RedirectAttributes flash) {
        return act(application, flash, () -> applications.claim(id, Web.me(session).id()));
    }

    @PostMapping("/applications/{application}/claim-steps")
    String claimSteps(@PathVariable String application, HttpSession session, RedirectAttributes flash) {
        return act(application, flash, () -> applications.claimSteps(application, Web.me(session).id()));
    }

    @PostMapping("/tasks/{id}/unclaim")
    String unclaim(@PathVariable String id, @RequestParam String application, HttpSession session, RedirectAttributes flash) {
        return act(application, flash, () -> applications.unclaim(id, Web.me(session).id()));
    }

    @PostMapping("/tasks/{id}/check")
    String check(@PathVariable String id, @RequestParam String application, @RequestParam boolean fulfilled, @RequestParam(required = false) String note, HttpSession session, RedirectAttributes flash) {
        return act(application, flash, () -> applications.check(id, Web.me(session).id(), fulfilled, note));
    }

    @PostMapping("/tasks/{id}/decide")
    String decide(@PathVariable String id, @RequestParam String application, @RequestParam String decision, @RequestParam(required = false) String reason, HttpSession session, RedirectAttributes flash) {
        return act(application, flash, () -> applications.decide(id, Web.me(session).id(), decision, reason));
    }

    // The deployed process, with the names of its elements in the current language, for bpmn-js.
    @GetMapping(value = "/process.bpmn", produces = MediaType.APPLICATION_XML_VALUE)
    @ResponseBody
    String diagram() throws Exception {
        final var definition = repository.createProcessDefinitionQuery().processDefinitionKey(Applications.PROCESS).latestVersion().singleResult();
        final var factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        final org.w3c.dom.Document xml;
        try (InputStream in = repository.getProcessModel(definition.getId())) {
            xml = factory.newDocumentBuilder().parse(in);
        }
        final var named = xml.getElementsByTagNameNS("http://www.omg.org/spec/BPMN/20100524/MODEL", "*");
        java.util.stream.IntStream.range(0, named.getLength()).mapToObj(i -> (Element) named.item(i)).filter(e -> e.hasAttribute("name") && e.hasAttribute("id"))
                .forEach(e -> e.setAttribute("name", messages.getMessage("activity." + e.getAttribute("id"), null, e.getAttribute("name"), LocaleContextHolder.getLocale())));
        final var out = new java.io.StringWriter();
        TransformerFactory.newInstance().newTransformer().transform(new DOMSource(xml), new StreamResult(out));
        return out.toString();
    }

    private String act(String application, RedirectAttributes flash, Runnable action) {
        try {
            action.run();
        } catch (IllegalStateException | IllegalArgumentException | org.flowable.common.engine.api.FlowableException e) {
            flash.addFlashAttribute("error", e.getMessage());
        }
        return "redirect:/applications/" + application;
    }

    private Catalog.Process process(String domain) {
        return catalog.get(domain).orElseThrow(() -> new IllegalArgumentException("No process " + domain));
    }
}
