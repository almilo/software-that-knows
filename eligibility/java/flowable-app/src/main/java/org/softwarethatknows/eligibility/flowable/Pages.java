package org.softwarethatknows.eligibility.flowable;

import jakarta.servlet.http.HttpSession;
import java.util.Locale;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

// The pages to read: the processes and the BPMN process, the applications, one application with
// its diagram, outcome, checks, decision and history, and the tasks of the person you act as.
@Controller
class Pages {

    private final Applications applications;
    private final Views views;
    private final Diagram diagram;

    Pages(Applications applications, Views views, Diagram diagram) {
        this.applications = applications;
        this.views = views;
        this.diagram = diagram;
    }

    @GetMapping("/")
    String index(Model model) {
        model.addAttribute("processes", views.processes());
        return "index";
    }

    @GetMapping("/applications")
    String applications(Model model, HttpSession session) {
        final var me = Web.me(session);
        model.addAttribute("rows", views.rows(me.office() ? applications.all() : applications.of(me.id())));
        return "applications";
    }

    @GetMapping("/applications/{id}")
    String application(@PathVariable String id, Model model, HttpSession session) {
        model.addAttribute("page", views.application(applications.get(id), Web.me(session)));
        return "application";
    }

    @GetMapping("/tasks")
    String tasks(Model model, HttpSession session) {
        model.addAttribute(
                "tasks", views.tasks(applications.tasks(Web.me(session).id())));
        return "tasks";
    }

    @PostMapping("/me")
    String me(@RequestParam String user, @RequestParam(defaultValue = "/") String back, HttpSession session) {
        People.get(user).ifPresent(p -> session.setAttribute(Web.ME, p.id()));
        return "redirect:" + (back.startsWith("/") && !back.startsWith("//") ? back : "/");
    }

    // The process for bpmn-js, its names in the current language.
    @GetMapping(value = "/process.bpmn", produces = MediaType.APPLICATION_XML_VALUE)
    @ResponseBody
    String diagram(Locale locale) throws Exception {
        return diagram.xml(locale);
    }
}
