package org.softwarethatknows.eligibility.flowable;

import java.io.InputStream;
import java.io.StringWriter;
import java.util.Locale;
import java.util.stream.IntStream;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;
import org.flowable.engine.RepositoryService;
import org.springframework.context.MessageSource;
import org.springframework.stereotype.Component;
import org.w3c.dom.Document;
import org.w3c.dom.Element;

// The deployed process for bpmn-js, with the names of its elements in a language: messages*.properties
// has a text "activity.<id>" for each.
@Component
public class Diagram {

    private static final String BPMN = "http://www.omg.org/spec/BPMN/20100524/MODEL";

    private final RepositoryService repository;
    private final MessageSource messages;

    public Diagram(RepositoryService repository, MessageSource messages) {
        this.repository = repository;
        this.messages = messages;
    }

    public String xml(Locale locale) throws Exception {
        final var xml = deployed();
        final var elements = xml.getElementsByTagNameNS(BPMN, "*");
        IntStream.range(0, elements.getLength())
                .mapToObj(i -> (Element) elements.item(i))
                .filter(e -> e.hasAttribute("name") && e.hasAttribute("id"))
                .forEach(e -> e.setAttribute(
                        "name",
                        messages.getMessage("activity." + e.getAttribute("id"), null, e.getAttribute("name"), locale)));
        final var out = new StringWriter();
        TransformerFactory.newInstance().newTransformer().transform(new DOMSource(xml), new StreamResult(out));
        return out.toString();
    }

    private Document deployed() throws Exception {
        final var definition = repository
                .createProcessDefinitionQuery()
                .processDefinitionKey(Bpmn.PROCESS)
                .latestVersion()
                .singleResult();
        final var factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        try (InputStream in = repository.getProcessModel(definition.getId())) {
            return factory.newDocumentBuilder().parse(in);
        }
    }
}
