package org.softwarethatknows.eligibility.flowable;

import java.util.List;
import java.util.Optional;
import org.flowable.engine.IdentityService;
import org.springframework.stereotype.Component;

// The people of the demo, as users and groups of Flowable's identity service: one applicant and two
// reviewers of the office. Tasks are offered to the group "office" and assigned to the applicant;
// Flowable resolves who may claim what. The page lets you act as any of them, without a login.
@Component
public class People {

    public record Person(String id, String name, String group) {
        public boolean office() {
            return group.equals("office");
        }
    }

    public static final List<Person> ALL = List.of(new Person("alex", "Alex Meier", "applicants"), new Person("maria", "Maria Rossi", "office"), new Person("luca", "Luca Brunner", "office"));

    public People(IdentityService identity) {
        ALL.stream().map(Person::group).distinct().filter(g -> identity.createGroupQuery().groupId(g).count() == 0).forEach(g -> {
            final var group = identity.newGroup(g);
            group.setName(g);
            identity.saveGroup(group);
        });
        ALL.stream().filter(p -> identity.createUserQuery().userId(p.id()).count() == 0).forEach(p -> {
            final var user = identity.newUser(p.id());
            user.setDisplayName(p.name());
            identity.saveUser(user);
            identity.createMembership(p.id(), p.group());
        });
    }

    public static Optional<Person> get(String id) {
        return ALL.stream().filter(p -> p.id().equals(id)).findFirst();
    }

    public static String name(String id) {
        return id == null ? "" : get(id).map(Person::name).orElse(id);
    }
}
