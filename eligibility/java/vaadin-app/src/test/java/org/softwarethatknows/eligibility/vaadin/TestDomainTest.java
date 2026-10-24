package org.softwarethatknows.eligibility.vaadin;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vaadin.browserless.SpringBrowserlessTest;
import com.vaadin.flow.component.button.Button;
import com.vaadin.flow.component.datepicker.DatePicker;
import com.vaadin.flow.component.html.H2;
import com.vaadin.flow.component.html.H4;
import com.vaadin.flow.component.html.Span;
import com.vaadin.flow.component.radiobutton.RadioButtonGroup;
import com.vaadin.flow.component.select.Select;
import com.vaadin.flow.component.textfield.BigDecimalField;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.softwarethatknows.eligibility.TestDomain;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

// A new domain needs only its model: with the test domain added to the knowledge model, the list
// shows it and its wizard asks, decides and derives, with no change to the code of this app.
@SpringBootTest
class TestDomainTest extends SpringBrowserlessTest {

    @DynamicPropertySource
    static void knowledge(DynamicPropertyRegistry registry) {
        registry.add("eligibility.knowledge", () -> TestDomain.knowledge().toString());
    }

    @Test
    void theListAndTheWizardRunTheTestDomain() {
        navigate(ProcessListView.class);
        assertTrue(find(H2.class).all().stream().anyMatch(h -> h.getText().equals("Library card")));

        navigate("process/" + TestDomain.NAME, ProcessView.class);
        find(DatePicker.class)
                .withCaption("Date of birth")
                .single()
                .setValue(LocalDate.now().minusYears(10));
        assertTrue(radio("Does a parent agree?").isVisible());
        find(DatePicker.class).withCaption("Date of birth").single().setValue(LocalDate.of(1990, 1, 1));
        assertFalse(
                find(RadioButtonGroup.class).withCaption("Does a parent agree?").exists());
        test(radio("Do you live in the town?")).selectItem("Yes");
        click("Next");

        assertFalse(find(BigDecimalField.class).withCaption("Deposit (CHF)").exists());
        test(select("Which card?")).selectItem("Visitor");
        assertTrue(find(BigDecimalField.class)
                .withCaption("Deposit (CHF)")
                .single()
                .isVisible());
        test(select("Which card?")).selectItem("Adult");
        click("Next");

        assertTrue(find(H4.class)
                .withText("No rule stops this application. You can submit it.")
                .exists());
        assertTrue(find(Span.class).withText("30").exists());
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private RadioButtonGroup<String> radio(String label) {
        return find(RadioButtonGroup.class).withCaption(label).single();
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private Select<String> select(String label) {
        return find(Select.class).withCaption(label).single();
    }

    private void click(String text) {
        test(find(Button.class).withText(text).all().stream()
                        .filter(Button::isVisible)
                        .findFirst()
                        .orElseThrow())
                .click();
    }
}
