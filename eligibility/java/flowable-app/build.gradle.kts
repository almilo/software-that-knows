// The Spring Boot + Flowable stack: one generic BPMN process for an application under any domain.
// A service task decides with the knowledge model through the core; the next steps of the model
// become tasks of the office; a person decides. Pages rendered on the server (Thymeleaf), with htmx
// for the form and bpmn-js for the diagram.
plugins {
    java
    alias(libs.plugins.spring.boot)
}

java {
    toolchain { languageVersion = JavaLanguageVersion.of(21) }
}

repositories { mavenCentral() }

dependencies {
    implementation(project(":eligibility-core"))
    implementation(platform(libs.spring.boot.bom))
    implementation(libs.spring.boot.starter.webmvc)
    implementation(libs.spring.boot.starter.thymeleaf)
    implementation(libs.flowable.starter.process)
    implementation(libs.webjars.locator.lite)
    runtimeOnly(libs.htmx)
    runtimeOnly(libs.bpmn.js)
    runtimeOnly(libs.h2)
    testImplementation(libs.spring.boot.starter.test)
    testImplementation(libs.spring.boot.starter.webmvc.test)
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

// The knowledge model and the shared test cases (examples to submit) are outside this build.
val knowledge = rootDir.resolve("../knowledge").canonicalPath
val conformance = rootDir.resolve("../conformance").canonicalPath

tasks.named<org.springframework.boot.gradle.tasks.run.BootRun>("bootRun") {
    systemProperty("eligibility.knowledge", knowledge)
    systemProperty("eligibility.conformance", conformance)
}

tasks.test {
    useJUnitPlatform()
    systemProperty("eligibility.knowledge", knowledge)
    systemProperty("eligibility.conformance", conformance)
}
