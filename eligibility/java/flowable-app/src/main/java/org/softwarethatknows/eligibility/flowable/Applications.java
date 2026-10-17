package org.softwarethatknows.eligibility.flowable;

import static org.softwarethatknows.eligibility.flowable.Bpmn.CHECK;
import static org.softwarethatknows.eligibility.flowable.Bpmn.COMPLETE;
import static org.softwarethatknows.eligibility.flowable.Bpmn.DECIDE;
import static org.softwarethatknows.eligibility.flowable.Bpmn.PROCESS;
import static org.softwarethatknows.eligibility.flowable.Bpmn.STEPS;

import java.time.Instant;
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import org.flowable.common.engine.impl.identity.Authentication;
import org.flowable.engine.HistoryService;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.TaskService;
import org.flowable.engine.history.HistoricActivityInstance;
import org.flowable.engine.history.HistoricProcessInstance;
import org.flowable.task.api.TaskInfo;
import org.flowable.task.api.history.HistoricTaskInstance;
import org.springframework.stereotype.Service;

// The applications, as instances of the BPMN process "application", through Flowable's services:
// the runtime starts them, the task service holds the work of the applicant and of the office, and
// the history keeps everything that happened. Who may do what is Flowable's too: a task is
// assigned to a person or offered to a group, and must be claimed before it is done.
@Service
public class Applications {

    // The activities that the history shows: not the gateways and the flows.
    private static final Set<String> SHOWN = Set.of("startEvent", "serviceTask", "userTask", "endEvent");

    public record Summary(String id, String domain, String applicant, String state, Instant started) {}

    public record Detail(
            Summary summary,
            Map<String, Object> answers,
            Optional<Ruling> ruling,
            List<Check> checks,
            Optional<String> decision,
            Optional<String> reason,
            List<Activity> history,
            Set<String> done,
            Set<String> active,
            List<Task> tasks) {

        public Optional<Task> task(String activity) {
            return tasks.stream().filter(t -> t.activity().equals(activity)).findFirst();
        }
    }

    // A next step of the model, as one task of the office: open, or checked by a reviewer.
    public record Check(String step, String reviewer, Boolean fulfilled, String note, Optional<String> taskId) {}

    public record Activity(String id, String user, Instant start, Instant end) {}

    public record Task(
            String id, String application, String domain, String activity, String step, String assignee, Instant due) {

        public boolean overdue() {
            return due != null && due.isBefore(Instant.now());
        }
    }

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
            return runtime.createProcessInstanceBuilder()
                    .processDefinitionKey(PROCESS)
                    .businessKey(domain)
                    .variables(Map.of("domain", domain, "answers", new HashMap<>(answers)))
                    .start()
                    .getId();
        } finally {
            Authentication.setAuthenticatedUserId(null);
        }
    }

    // The applicant completes or corrects the answers; the model decides again.
    public void complete(String taskId, String user, Map<String, Object> answers) {
        final var task = assigned(taskId, user, COMPLETE);
        runtime.setVariable(task.getProcessInstanceId(), "answers", new HashMap<>(answers));
        tasks.complete(taskId);
    }

    public void claim(String taskId, String user) {
        if (tasks.createTaskQuery().taskId(taskId).taskCandidateUser(user).count() == 0) {
            throw new IllegalStateException(user + " may not claim task " + taskId);
        }
        tasks.claim(taskId, user);
    }

    // A reviewer takes every open next step of an application at once.
    public void claimSteps(String applicationId, String user) {
        tasks.createTaskQuery()
                .processInstanceId(applicationId)
                .taskDefinitionKey(STEPS)
                .taskCandidateUser(user)
                .list()
                .forEach(t -> tasks.claim(t.getId(), user));
    }

    public void unclaim(String taskId, String user) {
        assigned(taskId, user, null);
        tasks.unclaim(taskId);
    }

    // A reviewer checks one next step: fulfilled or not, with a note. Both stay on the task, in the history.
    public void check(String taskId, String user, boolean fulfilled, String note) {
        assigned(taskId, user, STEPS);
        tasks.setVariablesLocal(taskId, variables("fulfilled", fulfilled, "note", blankToNull(note)));
        tasks.complete(taskId);
    }

    // A reviewer decides: approve, reject (with a reason) or return to the applicant (with a note).
    public void decide(String taskId, String user, String decision, String reason) {
        assigned(taskId, user, DECIDE);
        if (!Set.of("approve", "reject", "return").contains(decision))
            throw new IllegalArgumentException("No decision " + decision);
        if (!decision.equals("approve") && blankToNull(reason) == null) {
            throw new IllegalArgumentException("A " + decision + " needs a reason");
        }
        tasks.complete(taskId, variables("decision", decision, "reason", blankToNull(reason)));
    }

    public List<Summary> all() {
        return summaries(history.createHistoricProcessInstanceQuery()
                .processDefinitionKey(PROCESS)
                .includeProcessVariables()
                .orderByProcessInstanceStartTime()
                .desc()
                .list());
    }

    public List<Summary> of(String applicant) {
        return summaries(history.createHistoricProcessInstanceQuery()
                .processDefinitionKey(PROCESS)
                .startedBy(applicant)
                .includeProcessVariables()
                .orderByProcessInstanceStartTime()
                .desc()
                .list());
    }

    // The tasks that a person can do: assigned to them, or offered to one of their groups.
    public List<Task> tasks(String user) {
        return tasks
                .createTaskQuery()
                .processDefinitionKey(PROCESS)
                .taskCandidateOrAssigned(user)
                .includeProcessVariables()
                .includeTaskLocalVariables()
                .orderByTaskCreateTime()
                .asc()
                .list()
                .stream()
                .map(Applications::task)
                .toList();
    }

    public Detail get(String id) {
        final var instance = history.createHistoricProcessInstanceQuery()
                .processInstanceId(id)
                .includeProcessVariables()
                .singleResult();
        if (instance == null) throw new IllegalArgumentException("No application " + id);
        final var vars = instance.getProcessVariables();
        final var activities = activities(id);
        final var running = instance.getEndTime() == null;
        @SuppressWarnings("unchecked")
        final var answers = (Map<String, Object>) vars.getOrDefault("answers", Map.of());
        return new Detail(
                summary(instance),
                answers,
                Optional.ofNullable((Ruling) vars.get("ruling")),
                checks(id, activities),
                Optional.ofNullable((String) vars.get("decision")),
                Optional.ofNullable((String) vars.get("reason")),
                activities.stream()
                        .filter(a -> SHOWN.contains(a.getActivityType()))
                        .map(Applications::activity)
                        .toList(),
                activities.stream()
                        .filter(a -> a.getEndTime() != null)
                        .map(HistoricActivityInstance::getActivityId)
                        .collect(Collectors.toSet()),
                running ? Set.copyOf(runtime.getActiveActivityIds(id)) : Set.of(),
                running ? openTasks(id) : List.of());
    }

    // In the order they happened: the activities of one transaction share a start time, so their
    // order in it decides.
    private List<HistoricActivityInstance> activities(String id) {
        final Comparator<HistoricActivityInstance> inOrder = Comparator.comparing(
                        HistoricActivityInstance::getStartTime)
                .thenComparing(a -> a.getTransactionOrder() == null ? 0 : a.getTransactionOrder());
        return history.createHistoricActivityInstanceQuery().processInstanceId(id).list().stream()
                .sorted(inOrder)
                .toList();
    }

    // The next steps of the last decision of the model: the step tasks created since it.
    private List<Check> checks(String id, List<HistoricActivityInstance> activities) {
        final var lastDecision = activities.stream()
                .filter(a -> a.getActivityId().equals(CHECK))
                .map(HistoricActivityInstance::getStartTime)
                .max(Comparator.naturalOrder());
        return lastDecision.map(since -> stepTasksSince(id, since)).orElse(List.of());
    }

    private List<Check> stepTasksSince(String id, Date since) {
        return history
                .createHistoricTaskInstanceQuery()
                .processInstanceId(id)
                .taskDefinitionKey(STEPS)
                .taskCreatedAfter(since)
                .includeTaskLocalVariables()
                .orderByHistoricTaskInstanceStartTime()
                .asc()
                .list()
                .stream()
                .map(Applications::check)
                .toList();
    }

    private List<Task> openTasks(String id) {
        return tasks
                .createTaskQuery()
                .processInstanceId(id)
                .includeProcessVariables()
                .includeTaskLocalVariables()
                .list()
                .stream()
                .map(Applications::task)
                .toList();
    }

    private List<Summary> summaries(List<HistoricProcessInstance> instances) {
        return instances.stream().map(this::summary).toList();
    }

    private Summary summary(HistoricProcessInstance instance) {
        final var domain = (String) instance.getProcessVariables().get("domain");
        return new Summary(
                instance.getId(),
                domain,
                instance.getStartUserId(),
                state(instance),
                instance.getStartTime().toInstant());
    }

    // An ended application is in the state of its end event; a running one waits for the applicant
    // (complete) or for the office (review).
    private String state(HistoricProcessInstance instance) {
        if (instance.getEndTime() != null) return instance.getEndActivityId();
        return runtime.getActiveActivityIds(instance.getId()).contains(COMPLETE) ? "complete" : "review";
    }

    private org.flowable.task.api.Task assigned(String taskId, String user, String activity) {
        final var task = tasks.createTaskQuery().taskId(taskId).singleResult();
        if (task == null) throw new IllegalArgumentException("No task " + taskId);
        if (!user.equals(task.getAssignee()))
            throw new IllegalStateException("Task " + taskId + " is not assigned to " + user);
        if (activity != null && !activity.equals(task.getTaskDefinitionKey())) {
            throw new IllegalArgumentException("Task " + taskId + " is not " + activity);
        }
        return task;
    }

    private static Task task(TaskInfo t) {
        final var domain = (String) t.getProcessVariables().get("domain");
        final var step = (String) t.getTaskLocalVariables().get("nextStep");
        return new Task(
                t.getId(),
                t.getProcessInstanceId(),
                domain,
                t.getTaskDefinitionKey(),
                step,
                t.getAssignee(),
                instant(t.getDueDate()));
    }

    private static Check check(HistoricTaskInstance t) {
        final var local = t.getTaskLocalVariables();
        final var open = t.getEndTime() == null ? Optional.of(t.getId()) : Optional.<String>empty();
        return new Check(
                (String) local.get("nextStep"),
                t.getAssignee(),
                (Boolean) local.get("fulfilled"),
                (String) local.get("note"),
                open);
    }

    private static Activity activity(HistoricActivityInstance a) {
        return new Activity(a.getActivityId(), a.getAssignee(), instant(a.getStartTime()), instant(a.getEndTime()));
    }

    private static Instant instant(Date date) {
        return date == null ? null : date.toInstant();
    }

    // Two variables, either of which may be null (Map.of refuses null).
    private static Map<String, Object> variables(String key, Object value, String otherKey, Object otherValue) {
        final var variables = new HashMap<String, Object>();
        variables.put(key, value);
        variables.put(otherKey, otherValue);
        return variables;
    }

    private static String blankToNull(String text) {
        return text == null || text.isBlank() ? null : text.strip();
    }
}
