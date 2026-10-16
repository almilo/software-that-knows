package org.softwarethatknows.eligibility.flowable;

import java.nio.file.Path;
import org.softwarethatknows.eligibility.Catalog;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

// The Spring Boot + Flowable stack of eligibility: an application to any process of the knowledge
// model runs through one BPMN process (processes/application.bpmn20.xml), decided by the model and
// reviewed by a person. The page at / submits applications and shows the review tasks.
@SpringBootApplication
public class FlowableApplication {

    public static void main(String[] args) {
        SpringApplication.run(FlowableApplication.class, args);
    }

    @Bean
    Catalog catalog(@Value("${eligibility.knowledge}") Path knowledge) {
        return new Catalog(knowledge);
    }
}
