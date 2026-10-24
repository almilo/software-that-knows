package org.softwarethatknows.eligibility;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.stream.Stream;

// The knowledge model with the test domain added: a copy of eligibility/knowledge/ with the domains
// of eligibility/fixtures/domains/. The tests of every Java stack start from it, to check that a new
// domain runs without a change to their code.
public final class TestDomain {

    public static final String NAME = "library-card";

    private static Path knowledge;

    private TestDomain() {}

    public static synchronized Path knowledge() {
        if (knowledge == null) knowledge = copy();
        return knowledge;
    }

    private static Path copy() {
        try {
            final var target = Files.createTempDirectory("knowledge-with-test-domain");
            copyTree(Path.of(System.getProperty("eligibility.knowledge")), target);
            copyTree(Path.of(System.getProperty("eligibility.fixtures")).resolve("domains"), target.resolve("domains"));
            return target;
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static void copyTree(Path from, Path to) throws IOException {
        try (Stream<Path> files = Files.walk(from)) {
            files.filter(Files::isRegularFile)
                    .forEach(file ->
                            copyFile(file, to.resolve(from.relativize(file).toString())));
        }
    }

    private static void copyFile(Path file, Path target) {
        try {
            Files.createDirectories(target.getParent());
            Files.copy(file, target);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
