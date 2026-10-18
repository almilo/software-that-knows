package org.softwarethatknows.eligibility.vaadin;

import com.vaadin.flow.component.AbstractField;
import com.vaadin.flow.component.Composite;
import com.vaadin.flow.component.HasHelper;
import com.vaadin.flow.component.HasLabel;
import com.vaadin.flow.component.HasValidation;
import com.vaadin.flow.component.datepicker.DatePicker;
import com.vaadin.flow.component.radiobutton.RadioButtonGroup;
import com.vaadin.flow.component.select.Select;
import com.vaadin.flow.component.textfield.BigDecimalField;
import com.vaadin.flow.component.textfield.IntegerField;
import com.vaadin.flow.i18n.LocaleChangeEvent;
import com.vaadin.flow.i18n.LocaleChangeObserver;
import java.time.LocalDate;
import java.util.Locale;
import java.util.function.Consumer;
import java.util.function.Function;
import org.softwarethatknows.eligibility.Catalog.Process;
import org.softwarethatknows.eligibility.Field;

// A question of the model, as the input that the core chooses for it: radio buttons or a list for a
// choice, a date, a whole number or an amount. Its label, help text and choices
// come from the model in the current language. Which questions are asked and which are missing is
// for the engine to decide, not for the field: the wizard tells it.
public class Question extends Composite<AbstractField<?, ?>> implements LocaleChangeObserver {

    private final Process process;
    private final Field field;
    private final AbstractField<?, ?> input;

    public Question(Process process, Field field, Consumer<Object> onAnswer) {
        this.process = process;
        this.field = field;
        this.input = input(field, onAnswer);
        input.setRequiredIndicatorVisible(field.required());
    }

    public String name() {
        return field.name();
    }

    @Override
    protected AbstractField<?, ?> initContent() {
        return input;
    }

    public void showMissing(boolean missing) {
        ((HasValidation) input).setInvalid(missing);
    }

    @Override
    public void localeChange(LocaleChangeEvent event) {
        ((HasLabel) input).setLabel(t(field.name() + ".label"));
        final var help = t(field.name() + ".description");
        ((HasHelper) input).setHelperText(help.equals(field.name() + ".description") ? null : help);
        ((HasValidation) input).setErrorMessage(getTranslation("answerError.label"));
        if (input instanceof Select<?> select) select.setPlaceholder(getTranslation("choose.label"));
        // Dates are typed as written in the process's region: 15.03.1986 in Swiss German, not 3/15/1986.
        if (input instanceof DatePicker picker) {
            picker.setLocale(
                    Locale.of(event.getLocale().getLanguage(), process.shape().region()));
        }
        refreshChoiceLabels();
    }

    // The input that the core chooses for the field (Field.input()).
    private AbstractField<?, ?> input(Field f, Consumer<Object> onAnswer) {
        return switch (f.input()) {
            case RADIO -> {
                final var radio = new RadioButtonGroup<String>();
                radio.setItems(f.choiceNames());
                yield listen(radio, value -> value, onAnswer);
            }
            case SELECT -> {
                final var select = new Select<String>();
                select.setItems(f.choiceNames());
                yield listen(select, value -> value, onAnswer);
            }
            case DATE -> listen(new DatePicker(), LocalDate::toString, onAnswer);
            case INTEGER -> {
                final var number = new IntegerField();
                f.minimum().ifPresent(m -> number.setMin(m.intValue()));
                f.maximum().ifPresent(m -> number.setMax(m.intValue()));
                yield listen(number, value -> value, onAnswer);
            }
            case DECIMAL -> listen(new BigDecimalField(), value -> value, onAnswer);
        };
    }

    private static <V> AbstractField<?, V> listen(
            AbstractField<?, V> input, Function<V, Object> toAnswer, Consumer<Object> onAnswer) {
        input.addValueChangeListener(e -> onAnswer.accept(e.getValue() == null ? null : toAnswer.apply(e.getValue())));
        return input;
    }

    @SuppressWarnings("unchecked")
    private void refreshChoiceLabels() {
        final var label = (com.vaadin.flow.component.ItemLabelGenerator<String>) c -> t(field.name() + "." + c);
        if (input instanceof RadioButtonGroup<?> group) ((RadioButtonGroup<String>) group).setItemLabelGenerator(label);
        if (input instanceof Select<?> select) ((Select<String>) select).setItemLabelGenerator(label);
    }

    private String t(String key) {
        return getTranslation(process.name() + ":" + key);
    }
}
