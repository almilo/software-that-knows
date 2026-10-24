package org.softwarethatknows.eligibility.vaadin;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vaadin.browserless.SpringBrowserlessTest;
import com.vaadin.flow.component.button.Button;
import com.vaadin.flow.component.datepicker.DatePicker;
import com.vaadin.flow.component.html.H1;
import com.vaadin.flow.component.html.H2;
import com.vaadin.flow.component.html.Paragraph;
import com.vaadin.flow.component.radiobutton.RadioButtonGroup;
import com.vaadin.flow.component.select.Select;
import com.vaadin.flow.component.textfield.BigDecimalField;
import com.vaadin.flow.component.textfield.IntegerField;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Locale;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

// The Vaadin views without a browser: the list of processes, and the wizard of wef from the first
// answer to the outcome, the questions that the engine asks, the open questions, and the languages.
@SpringBootTest
class WizardTest extends SpringBrowserlessTest {

    @Test
    void theListShowsEveryProcessOfTheModel() {
        navigate(ProcessListView.class);
        assertEquals(
                java.util.List.of(
                        "Maternity and other parent's allowance",
                        "Your vested benefit in cash",
                        "Pension money for a home"),
                find(H2.class).all().stream().map(H2::getText).toList());
    }

    @Test
    void wefAsksForTheHomeOnlyForAPurchaseAndAllowsACompleteApplication() {
        navigate("process/wef", ProcessView.class);
        find(DatePicker.class).withCaption("Date of birth").single().setValue(LocalDate.of(1986, 3, 15));
        find(IntegerField.class)
                .withCaption("Reference age in your pension fund's regulations (years)")
                .single()
                .setValue(65);
        test(radio("Are you married or in a registered partnership?")).selectItem("No");
        click("Next");

        assertFalse(find(RadioButtonGroup.class)
                .withCaption("What kind of home is it?")
                .exists());
        test(radio("What is the money for?")).selectItem("Buy or build a home");
        assertTrue(radio("What kind of home is it?").isVisible());
        test(radio("What kind of home is it?")).selectItem("An apartment");
        test(select("How will you own it?")).selectItem("Sole ownership");
        test(radio("Will you live there yourself?")).selectItem("Yes");
        click("Next");

        find(BigDecimalField.class)
                .withCaption("Your vested benefit today (CHF)")
                .single()
                .setValue(new BigDecimal("150000"));
        find(BigDecimalField.class)
                .withCaption("The amount you want to withdraw (CHF)")
                .single()
                .setValue(new BigDecimal("100000"));
        test(radio("Did you withdraw pension money for a home before?")).selectItem("No");
        click("Next");

        assertTrue(find(com.vaadin.flow.component.html.H4.class)
                .withText("No rule stops this application. You can submit it.")
                .exists());
        assertTrue(find(com.vaadin.flow.component.html.Span.class)
                .withText("150’000")
                .exists());
    }

    @Test
    void nextWithAnOpenQuestionStaysAndSaysSo() {
        navigate("process/wef", ProcessView.class);
        click("Next");
        assertTrue(find(Paragraph.class)
                .withText("Answer the questions marked above to continue.")
                .single()
                .isVisible());
        assertTrue(find(DatePicker.class).withCaption("Date of birth").single().isInvalid());
    }

    @Test
    void anotherLanguageTranslatesThePageKeepsTheAnswersAndWritesDatesAsInTheRegion() {
        navigate("process/wef", ProcessView.class);
        assertEquals(
                Locale.of("en", "CH"),
                find(DatePicker.class).withCaption("Date of birth").single().getLocale());
        find(IntegerField.class)
                .withCaption("Reference age in your pension fund's regulations (years)")
                .single()
                .setValue(64);
        test(find(Select.class).single()).selectItem("Deutsch");
        assertEquals("Vorsorgegeld für Wohneigentum", find(H1.class).single().getText());
        assertEquals(Locale.GERMAN, com.vaadin.flow.component.UI.getCurrent().getLocale());
        assertEquals(
                Locale.of("de", "CH"),
                find(DatePicker.class).withCaption("Geburtsdatum").single().getLocale());
        assertEquals(
                64,
                find(IntegerField.class)
                        .withCaption("Referenzalter gemäss Reglement Ihrer Pensionskasse (Jahre)")
                        .single()
                        .getValue());
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
