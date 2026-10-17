package org.softwarethatknows.eligibility.vaadin;

import com.vaadin.flow.component.dependency.StyleSheet;
import com.vaadin.flow.component.page.AppShellConfigurator;
import com.vaadin.flow.theme.lumo.Lumo;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

// The Vaadin + Spring Boot stack of eligibility: the list of processes at / and a wizard for each
// process at /process/<name>, both built from the knowledge model (eligibility/knowledge/).
@SpringBootApplication
@StyleSheet(Lumo.STYLESHEET)
@StyleSheet("styles.css")
public class EligibilityApplication implements AppShellConfigurator {

    public static void main(String[] args) {
        SpringApplication.run(EligibilityApplication.class, args);
    }
}
