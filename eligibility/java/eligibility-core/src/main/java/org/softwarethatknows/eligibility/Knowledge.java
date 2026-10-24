package org.softwarethatknows.eligibility;

import java.io.IOException;
import java.io.StringReader;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.stream.Stream;
import org.apache.jena.rdf.model.ModelFactory;

// The knowledge model (eligibility/knowledge/), shared by every stack: the form vocabulary
// (ontology/form.ttl), the domains (domains/<name>/ontology/*.ttl) and the shared modules
// (modules/**/*.ttl) that they import, as react-bun/generator/generate.ts finds them.
public final class Knowledge {

    private final Path root;

    private Knowledge(Path root) {
        this.root = root;
    }

    public static Knowledge at(Path root) {
        if (!Files.isRegularFile(root.resolve("ontology/form.ttl")))
            throw new IllegalArgumentException("No knowledge model at " + root.toAbsolutePath());
        return new Knowledge(root);
    }

    public Path root() {
        return root;
    }

    // The names of the domains, in alphabetical order.
    public List<String> domains() {
        return files().keySet().stream().toList();
    }

    // The Turtle files of each domain, by domain name: its own and the modules that they import,
    // directly or through another module. Paths relative to the knowledge.
    public Map<String, List<String>> files() {
        final var index = moduleIndex();
        final var own = new TreeMap<String, List<String>>();
        glob("domains")
                .filter(p -> p.getParent().getFileName().toString().equals("ontology"))
                .forEach(p -> own.computeIfAbsent(p.getName(1).toString(), k -> new ArrayList<>())
                        .add(p.toString()));
        final var all = new LinkedHashMap<String, List<String>>();
        own.forEach((name, files) -> {
            final var sorted = files.stream().sorted().toList();
            all.put(
                    name,
                    Stream.concat(sorted.stream(), imported(sorted, index, new LinkedHashSet<>()).stream())
                            .toList());
        });
        return all;
    }

    // The form vocabulary and the Turtle files of a domain, as text.
    public List<String> texts(String domain) {
        final var files = files().get(domain);
        if (files == null) throw new IllegalArgumentException("No domain " + domain + " in " + root);
        return Stream.concat(Stream.of("ontology/form.ttl"), files.stream())
                .map(this::text)
                .toList();
    }

    public Engine engine(String domain) {
        return new Engine(KnowledgeModel.load(texts(domain)));
    }

    // Each module by the IRI of its ontology.
    private Map<String, String> moduleIndex() {
        final var index = new LinkedHashMap<String, String>();
        glob("modules")
                .sorted()
                .forEach(p -> select(text(p.toString()), "SELECT ?o WHERE { ?o a owl:Ontology }", "o")
                        .forEach(iri -> index.put(iri, p.toString())));
        return index;
    }

    // The modules that the files import, and the modules that those import, without repeats.
    private List<String> imported(List<String> files, Map<String, String> index, Set<String> seen) {
        final var next = files.stream()
                .flatMap(f -> select(text(f), "SELECT ?i WHERE { ?o owl:imports ?i }", "i").stream())
                .filter(index::containsKey)
                .map(index::get)
                .filter(seen::add)
                .toList();
        return next.isEmpty()
                ? List.of()
                : Stream.concat(next.stream(), imported(next, index, seen).stream())
                        .toList();
    }

    private static List<String> select(String turtle, String query, String variable) {
        final var model = ModelFactory.createDefaultModel();
        model.read(new StringReader(turtle), null, "TTL");
        return Rdf.select(model, query).stream()
                .map(r -> r.get(variable).asResource().getURI())
                .toList();
    }

    private Stream<Path> glob(String folder) {
        try (final var walk = Files.walk(root.resolve(folder))) {
            return walk.filter(p -> p.toString().endsWith(".ttl")).map(root::relativize).sorted().toList().stream();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private String text(String path) {
        try {
            return Files.readString(root.resolve(path));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
