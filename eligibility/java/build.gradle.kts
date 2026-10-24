// The plugins that several subprojects apply, declared once here, so that they share one class
// loader (Spotless needs it).
plugins {
    alias(libs.plugins.spotless) apply false
}
