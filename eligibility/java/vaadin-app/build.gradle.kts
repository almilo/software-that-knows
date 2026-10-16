// The Vaadin + Spring Boot stack: the same wizard as react-bun, rendered on the server. The form is
// read from the knowledge model at startup, through the core; nothing is generated for it.
plugins {
    java
    alias(libs.plugins.spring.boot)
    alias(libs.plugins.vaadin)
}

java {
    toolchain { languageVersion = JavaLanguageVersion.of(21) }
}

repositories { mavenCentral() }

dependencies {
    implementation(project(":eligibility-core"))
    implementation(platform(libs.spring.boot.bom))
    implementation(platform(libs.vaadin.bom))
    implementation(libs.vaadin.spring.boot.starter)
    developmentOnly(platform(libs.vaadin.bom))
    developmentOnly(libs.vaadin.dev)
    testImplementation(libs.spring.boot.starter.test)
    testImplementation(libs.vaadin.browserless.spring)
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

// The knowledge model is outside this build, in eligibility/knowledge/.
tasks.named<org.springframework.boot.gradle.tasks.run.BootRun>("bootRun") {
    systemProperty("eligibility.knowledge", rootDir.resolve("../knowledge").canonicalPath)
}

tasks.test {
    useJUnitPlatform()
    systemProperty("eligibility.knowledge", rootDir.resolve("../knowledge").canonicalPath)
}
