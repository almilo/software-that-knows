package org.softwarethatknows.eligibility.flowable;

import jakarta.servlet.http.HttpSession;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.softwarethatknows.eligibility.Catalog;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.servlet.LocaleResolver;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.i18n.LocaleChangeInterceptor;
import org.springframework.web.servlet.i18n.SessionLocaleResolver;

// What every page knows: the language (in the session, changed with ?language=, as Spring MVC does
// it) and the person you act as (in the session too). The languages are those of the model.
@Configuration
public class Web implements WebMvcConfigurer {

    public static final String ME = "me";

    @Bean
    LocaleResolver localeResolver() {
        final var resolver = new SessionLocaleResolver();
        resolver.setDefaultLocale(Locale.ENGLISH);
        return resolver;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        final var change = new LocaleChangeInterceptor();
        change.setParamName("language");
        registry.addInterceptor(change);
    }

    public static People.Person me(HttpSession session) {
        return People.get((String) session.getAttribute(ME)).orElse(People.ALL.getFirst());
    }

    @ControllerAdvice
    static class Everywhere {

        private final Catalog catalog;

        Everywhere(Catalog catalog) {
            this.catalog = catalog;
        }

        @ModelAttribute("me")
        People.Person me(HttpSession session) {
            return Web.me(session);
        }

        // The path of the page, to come back to it after a change of language or person.
        @ModelAttribute("path")
        String path(jakarta.servlet.http.HttpServletRequest request) {
            return request.getRequestURI();
        }

        @ModelAttribute("people")
        List<People.Person> people() {
            return People.ALL;
        }

        @ModelAttribute("language")
        String language() {
            return LocaleContextHolder.getLocale().getLanguage();
        }

        // Each language of the model, named in itself.
        @ModelAttribute("languages")
        Map<String, String> languages() {
            final var first = catalog.all().getFirst();
            final var languages = new LinkedHashMap<String, String>();
            catalog.commonLanguages().forEach(l -> languages.put(l, first.text(l, "language.label")));
            return languages;
        }
    }
}
