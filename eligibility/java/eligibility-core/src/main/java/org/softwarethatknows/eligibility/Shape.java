package org.softwarethatknows.eligibility;

import java.util.List;
import java.util.Map;

// The form of a domain: its one sh:NodeShape with a form:region, and the fields and rules of every
// shape whose sh:targetClass is its class or a superclass (SHACL applies a shape for a class to the
// members of its subclasses, which is how the shared modules add their fields and rules).
public record Shape(
        String iri, // the sh:NodeShape
        String name, // its local name
        String region, // form:region: how dates are written
        Map<String, Numbers> numbers, // the form:NumberFormat of the region, by language: how numbers are written
        String targetClass, // sh:targetClass: the class of $this
        List<String> groups, // the local names of the sh:PropertyGroups, in sh:order
        List<Field> fields, // in the order of their groups, then in sh:order
        List<String> rules // the CONSTRUCT queries of the sh:SPARQLRules, in sh:order, with their PREFIX lines
        ) {

    public record Numbers(char group, char decimal) {}
}
