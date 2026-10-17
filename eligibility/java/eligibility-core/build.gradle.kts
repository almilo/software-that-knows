// The core: loads a domain with its modules, runs its rules and reads its form, as core/ does in
// TypeScript. No UI and no Spring, so every Java application can use it.
plugins {
    `java-library`
    `java-test-fixtures`
    alias(libs.plugins.spotless)
}

java {
    toolchain { languageVersion = JavaLanguageVersion.of(21) }
}

repositories { mavenCentral() }

// One format for the Java code, checked by the build (spotlessCheck) and applied by spotlessApply.
spotless {
    java {
        target("src/*/java/**/*.java")
        palantirJavaFormat(libs.versions.palantir.java.format.get())
    }
}


dependencies {
    api(libs.jena.arq)
    testImplementation(libs.jackson.databind)
    testImplementation(platform(libs.junit.bom))
    testImplementation(libs.junit.jupiter)
    testImplementation(libs.junit.params)
    testRuntimeOnly(libs.junit.launcher)
}

// The knowledge model, the shared test cases and the test domain are outside this build, in eligibility/.
tasks.test {
    useJUnitPlatform()
    systemProperty("eligibility.knowledge", rootDir.resolve("../knowledge").canonicalPath)
    systemProperty("eligibility.conformance", rootDir.resolve("../conformance").canonicalPath)
    systemProperty("eligibility.fixtures", rootDir.resolve("../fixtures").canonicalPath)
    inputs.dir(rootDir.resolve("../knowledge"))
    inputs.dir(rootDir.resolve("../conformance"))
    inputs.dir(rootDir.resolve("../fixtures"))
    inputs.dir(rootDir.resolve("../react-bun/domains"))
    testLogging { events("failed"); showStandardStreams = true }
}
