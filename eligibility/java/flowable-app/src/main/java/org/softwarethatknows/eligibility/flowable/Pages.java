package org.softwarethatknows.eligibility.flowable;

import jakarta.servlet.http.HttpSession;
import org.softwarethatknows.eligibility.Catalog;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;

// The pages to read: the processes and the BPMN process, the applications, one application with
// its diagram, outcome, checks, decision and history, and the tasks of the person you act as.
@Controller
class Pages {

    private final Catalog catalog;
    private final Applications applications;

    Pages(Catalog catalog, Applications applications) {
        this.catalog = catalog;
        this.applications = applications;
    }

    @GetMapping("/")
    String index(Model model) {
        model.addAttribute("processes", catalog.all().stream().map(Catalog.Process::name).toList());
        return "index";
    }

    @GetMapping("/applications")
    String applications(Model model, HttpSession session) {
        final var me = Web.me(session);
        model.addAttribute("applications", me.office() ? applications.all() : applications.of(me.id()));
        return "applications";
    }

    @GetMapping("/applications/{id}")
    String application(@PathVariable String id, Model model, HttpSession session) {
        final var application = applications.get(id);
        model.addAttribute("detail", application);
        // The applicant's task to complete the answers: the form, with what is missing marked.
        final var task = application.task("complete", Web.me(session).id());
        if (task != null) model.addAttribute("form", Form.of(catalog.get(application.domain()).orElseThrow(), application.answers(), true, "/tasks/" + task.id() + "/complete?application=" + id));
        return "application";
    }

    @GetMapping("/tasks")
    String tasks(Model model, HttpSession session) {
        model.addAttribute("tasks", applications.tasks(Web.me(session).id()));
        return "tasks";
    }

    @PostMapping("/me")
    String me(@RequestParam String user, @RequestParam(defaultValue = "/") String back, HttpSession session) {
        People.get(user).ifPresent(p -> session.setAttribute(Web.ME, p.id()));
        return "redirect:" + (back.startsWith("/") && !back.startsWith("//") ? back : "/");
    }
}
