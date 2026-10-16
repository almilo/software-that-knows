package org.softwarethatknows.eligibility.vaadin;

import java.nio.file.Path;
import org.softwarethatknows.eligibility.Catalog;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

// The processes of the knowledge model (eligibility/knowledge/), read once at startup.
@Service
public class Processes {

    private final Catalog catalog;

    public Processes(@Value("${eligibility.knowledge}") Path knowledge) {
        this.catalog = new Catalog(knowledge);
    }

    public java.util.List<Catalog.Process> all() {
        return catalog.all();
    }

    public java.util.Optional<Catalog.Process> get(String name) {
        return catalog.get(name);
    }

    public java.util.List<String> commonLanguages() {
        return catalog.commonLanguages();
    }
}
