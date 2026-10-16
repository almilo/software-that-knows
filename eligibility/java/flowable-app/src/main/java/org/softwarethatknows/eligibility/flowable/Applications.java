package org.softwarethatknows.eligibility.flowable;

import java.time.Instant;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.flowable.common.engine.impl.identity.Authentication;
import org.flowable.engine.HistoryService;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.TaskService;
import org.flowable.engine.history.HistoricActivityInstance;
import org.flowable.engine.history.HistoricProcessInstance;
import org.flowable.task.api.TaskInfo;
import org.springframework.stereotype.Service;

// The applications, as instances of the BPMN process "application", through Flowable's services:
// the runtime starts them, the task service holds the work of the applicant and of the office, and
// the history keeps everything that happened. Who may do what is Flowable's too: a task is
// assigned to a person or offered to a group, and must be claimed before it is done.
@Service
public class Applications {

    public static final String PROCESS = "application";

    // The activities that the history shows: not the gateways and the flows.
    private static final Set<String> SHOWN = Set.of("startEvent", "serviceTask", "userTask", "endEvent");

    public record Summary(String id, String domain, String applicant, String state, Instant started) {}

    public record Detail(String id, String domain, String applicant, String state, Instant started, Map<String, Object> answers, Map<String, Object> ruling,
            List<String> missing, List<Check> checks, String decision, String reason, List<Activity> history, Set<String> done, Set<String> active, List<Task> tasks) {

        public Task task(String id) {
            return tasks.stream().filter(t -> t.id().equals(id)).findFirst().orElse(null);
        }

        public boolean unclaimed(String activity) {
            return tasks.stream().anyMatch(t -> t.activity().equals(activity) && t.assignee() == null);
        }

        public Task task(String activity, String assignee) {
            return tasks.stream().filter(t -> t.activity().equals(activity) && (assignee == null || assignee.equals(t.assignee()))).findFirst().orElse(null);
        }
    }

    // A next step of the model, as one task of the office: open, or checked by a reviewer.
    public record Check(String step, String reviewer, Boolean fulfilled, String note, String taskId) {}

    public record Activity(String id, String type, String user, Instant start, Instant end) {}

    public record Task(String id, String application, String domain, String activity, String step, String assignee, Instant due, boolean overdue) {}

    private final RuntimeService runtime;
    private final TaskService tasks;
    private final HistoryService history;

    public Applications(RuntimeService runtime, TaskService tasks, HistoryService history) {
        this.runtime = runtime;
        this.tasks = tasks;
        this.history = history;
    }

    // The applicant submits: the start event records who (flowable:initiator), and the model decides
    // in the same transaction.
    public String submit(String domain, Map<String, Object> answers, String user) {
        Authentication.setAuthenticatedUserId(user);
        try {
            return runtime.createProcessInstanceBuilder().processDefinitionKey(PROCESS).businessKey(domain)
                    .variables(Map.of("domain", domain, "answers", new HashMap<>(answers))).start().getId();
        } finally {
            Authentication.setAuthenticatedUserId(null);
        }
    }

    // The applicant completes or corrects the answers; the model decides again.
    public void complete(String taskId, String user, Map<String, Object> answers) {
        final var task = assigned(taskId, user, "complete");
        runtime.setVariable(task.getProcessInstanceId(), "answers", new HashMap<>(answers));
        tasks.complete(taskId);
    }

    public void claim(String taskId, String user) {
        if (tasks.createTaskQuery().taskId(taskId).taskCandidateUser(user).count() == 0) throw new IllegalStateException(user + " may not claim task " + taskId);
        tasks.claim(taskId, user);
    }

    // A reviewer takes every open next step of an application at once.
    public void claimSteps(String applicationId, String user) {
        tasks.createTaskQuery().processInstanceId(applicationId).taskDefinitionKey("steps").taskCandidateUser(user).list().forEach(t -> tasks.claim(t.getId(), user));
    }

    public void unclaim(String taskId, String user) {
        assigned(taskId, user, null);
        tasks.unclaim(taskId);
    }

    // A reviewer checks one next step: fulfilled or not, with a note. Both stay on the task, in the history.
    public void check(String taskId, String user, boolean fulfilled, String note) {
        assigned(taskId, user, "steps");
        final var result = new HashMap<String, Object>();
        result.put("fulfilled", fulfilled);
        result.put("note", blankToNull(note));
        tasks.setVariablesLocal(taskId, result);
        tasks.complete(taskId);
    }

    // A reviewer decides: approve, reject (with a reason) or return to the applicant (with a note).
    public void decide(String taskId, String user, String decision, String reason) {
        assigned(taskId, user, "decide");
        if (!Set.of("approve", "reject", "return").contains(decision)) throw new IllegalArgumentException("No decision " + decision);
        if (!decision.equals("approve") && blankToNull(reason) == null) throw new IllegalArgumentException("A " + decision + " needs a reason");
        final var result = new HashMap<String, Object>();
        result.put("decision", decision);
        result.put("reason", blankToNull(reason));
        tasks.complete(taskId, result);
    }

    public List<Summary> all() {
        return history.createHistoricProcessInstanceQuery().processDefinitionKey(PROCESS).includeProcessVariables()
                .orderByProcessInstanceStartTime().desc().list().stream().map(this::summary).toList();
    }

    public List<Summary> of(String applicant) {
        return history.createHistoricProcessInstanceQuery().processDefinitionKey(PROCESS).startedBy(applicant).includeProcessVariables()
                .orderByProcessInstanceStartTime().desc().list().stream().map(this::summary).toList();
    }

    // The tasks that a person can do: assigned to them, or offered to one of their groups.
    public List<Task> tasks(String user) {
        return tasks.createTaskQuery().processDefinitionKey(PROCESS).taskCandidateOrAssigned(user).includeProcessVariables().includeTaskLocalVariables()
                .orderByTaskCreateTime().asc().list().stream().map(this::task).toList();
    }

    public Detail get(String id) {
        final HistoricProcessInstance instance = history.createHistoricProcessInstanceQuery().processInstanceId(id).includeProcessVariables().singleResult();
        if (instance == null) throw new IllegalArgumentException("No application " + id);
        final var vars = instance.getProcessVariables();
        // In the order they happened: activities of one transaction share a start time, so their order in it decides.
        final var activities = history.createHistoricActivityInstanceQuery().processInstanceId(id).list().stream()
                .sorted(Comparator.comparing(HistoricActivityInstance::getStartTime).thenComparing(a -> a.getTransactionOrder() == null ? 0 : a.getTransactionOrder())).toList();
        final var running = instance.getEndTime() == null;
        final Set<String> active = running ? Set.copyOf(runtime.getActiveActivityIds(id)) : Set.of();
        @SuppressWarnings("unchecked")
        final var ruling = (Map<String, Object>) vars.getOrDefault("ruling", Map.of());
        @SuppressWarnings("unchecked")
        final var answers = (Map<String, Object>) vars.getOrDefault("answers", Map.of());
        @SuppressWarnings("unchecked")
        final var missing = (List<String>) vars.getOrDefault("missing", List.of());
        return new Detail(id, (String) vars.get("domain"), instance.getStartUserId(), state(instance, active), instance.getStartTime().toInstant(), answers, ruling, missing,
                checks(id, activities), (String) vars.get("decision"), (String) vars.get("reason"),
                activities.stream().filter(a -> SHOWN.contains(a.getActivityType())).map(Applications::activity).toList(),
                activities.stream().filter(a -> a.getEndTime() != null).map(HistoricActivityInstance::getActivityId).collect(Collectors.toSet()), active,
                running ? tasks.createTaskQuery().processInstanceId(id).includeProcessVariables().includeTaskLocalVariables().list().stream().map(this::task).toList() : List.of());
    }

    // The next steps of the last decision of the model: the step tasks created since it.
    private List<Check> checks(String id, List<HistoricActivityInstance> activities) {
        final var lastCheck = activities.stream().filter(a -> a.getActivityId().equals("check")).map(HistoricActivityInstance::getStartTime).max(Comparator.naturalOrder());
        if (lastCheck.isEmpty()) return List.of();
        return history.createHistoricTaskInstanceQuery().processInstanceId(id).taskDefinitionKey("steps").taskCreatedAfter(lastCheck.get()).includeTaskLocalVariables()
                .orderByHistoricTaskInstanceStartTime().asc().list().stream()
                .map(t -> new Check((String) t.getTaskLocalVariables().get("nextStep"), t.getAssignee(), (Boolean) t.getTaskLocalVariables().get("fulfilled"),
                        (String) t.getTaskLocalVariables().get("note"), t.getEndTime() == null ? t.getId() : null))
                .toList();
    }

    private Summary summary(HistoricProcessInstance instance) {
        final Set<String> active = instance.getEndTime() == null ? Set.copyOf(runtime.getActiveActivityIds(instance.getId())) : Set.of();
        return new Summary(instance.getId(), (String) instance.getProcessVariables().get("domain"), instance.getStartUserId(), state(instance, active), instance.getStartTime().toInstant());
    }

    // An ended application is in the state of its end event; a running one waits for the applicant
    // (complete) or for the office (review).
    private static String state(HistoricProcessInstance instance, Set<String> active) {
        if (instance.getEndTime() != null) return instance.getEndActivityId();
        return active.contains("complete") ? "complete" : "review";
    }

    private Task task(TaskInfo t) {
        final var due = t.getDueDate() == null ? null : t.getDueDate().toInstant();
        return new Task(t.getId(), t.getProcessInstanceId(), (String) t.getProcessVariables().get("domain"), t.getTaskDefinitionKey(),
                (String) t.getTaskLocalVariables().get("nextStep"), t.getAssignee(), due, due != null && due.isBefore(Instant.now()));
    }

    private org.flowable.task.api.Task assigned(String taskId, String user, String activity) {
        final var task = tasks.createTaskQuery().taskId(taskId).singleResult();
        if (task == null) throw new IllegalArgumentException("No task " + taskId);
        if (!user.equals(task.getAssignee())) throw new IllegalStateException("Task " + taskId + " is not assigned to " + user);
        if (activity != null && !activity.equals(task.getTaskDefinitionKey())) throw new IllegalArgumentException("Task " + taskId + " is not " + activity);
        return task;
    }

    private static Activity activity(HistoricActivityInstance a) {
        return new Activity(a.getActivityId(), a.getActivityType(), a.getAssignee(), a.getStartTime().toInstant(), a.getEndTime() == null ? null : a.getEndTime().toInstant());
    }

    private static String blankToNull(String text) {
        return text == null || text.isBlank() ? null : text.strip();
    }
}
