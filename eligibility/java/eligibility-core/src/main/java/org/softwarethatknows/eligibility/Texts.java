package org.softwarethatknows.eligibility;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;
import org.apache.jena.rdf.model.Model;

// The texts of a domain for the person who uses the app, by language and by key, as
// react-bun/generator/generate-messages.ts writes them into messages.json: every literal with a
// language tag in rdfs:label, rdfs:comment, sh:name, sh:description or form:summary. The languages
// are those of the shape's title (its rdfs:label), and each text must exist in each of them.
// Keys: <field>.label, <field>.description, <field>.<choice> for the questions; <name>.label,
// <name>.comment, <name>.summary for everything else (local names).
public final class Texts {

    private static final Map<String, String> KINDS = Map.of("label", "label", "comment", "comment", "name", "label", "description", "description", "summary", "summary");

    private Texts() {}

    public static Map<String, Map<String, String>> read(Model model, Shape shape) {
        final var languages = Rdf.select(model, "SELECT DISTINCT (LANG(?title) AS ?language) WHERE { <%s> rdfs:label ?title FILTER (LANG(?title) != \"\") }".formatted(shape.iri()))
                .stream().map(r -> r.getLiteral("language").getLexicalForm()).sorted().toList();
        if (languages.isEmpty()) throw new IllegalArgumentException("The shape " + shape.name() + " needs an rdfs:label with a language tag: its title");
        final var texts = new TreeMap<String, Map<String, String>>(); // key → language → text
        final var owners = new HashMap<String, String>(); // key → the term whose texts it holds

        Rdf.select(model, """
                SELECT ?subject ?path ?predicate ?text WHERE {
                  VALUES ?predicate { rdfs:label rdfs:comment sh:name sh:description form:summary }
                  ?subject ?predicate ?text .
                  FILTER (LANG(?text) != "")
                  OPTIONAL { ?subject sh:path ?path }
                }""").stream()
                .filter(r -> !r.get("subject").isAnon() || r.get("path") != null) // a property shape's texts take the name of its field
                .forEach(r -> {
                    final var owner = r.get("path") != null ? r.get("path") : r.get("subject");
                    final var literal = r.getLiteral("text");
                    add(texts, owners, languages, Rdf.local(owner) + "." + KINDS.get(Rdf.local(r.get("predicate"))), owner.toString(), literal.getLanguage(), literal.getLexicalForm());
                });
        // The choices of a question, under the question's name.
        shape.fields().forEach(field -> field.choices().orElse(List.of()).forEach(choice ->
                Map.copyOf(texts.getOrDefault(Rdf.local(choice) + ".label", Map.of()))
                        .forEach((language, text) -> add(texts, owners, languages, field.name() + "." + Rdf.local(choice), choice, language, text))));

        final var incomplete = texts.entrySet().stream().filter(e -> e.getValue().size() < languages.size())
                .map(e -> e.getKey() + ": no " + languages.stream().filter(l -> !e.getValue().containsKey(l)).collect(Collectors.joining(", ")))
                .toList();
        if (!incomplete.isEmpty()) throw new IllegalArgumentException("Texts missing: " + String.join("; ", incomplete));
        return languages.stream().collect(Collectors.toMap(l -> l, l -> texts.entrySet().stream().collect(Collectors.toMap(Map.Entry::getKey, e -> e.getValue().get(l), (a, b) -> a, TreeMap::new)), (a, b) -> a, TreeMap::new));
    }

    private static void add(Map<String, Map<String, String>> texts, Map<String, String> owners, List<String> languages, String key, String owner, String language, String text) {
        if (!languages.contains(language)) return;
        final var known = owners.putIfAbsent(key, owner);
        if (known != null && !known.equals(owner)) throw new IllegalArgumentException("Two terms have the key " + key + ": " + known + " and " + owner);
        texts.computeIfAbsent(key, k -> new HashMap<>()).put(language, text);
    }
}
