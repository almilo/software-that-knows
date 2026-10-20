// The happy path of the task, through the form data and the SHACL engine.
import { expect, test } from "bun:test";
import { appModel, choice, engine, FZ, SK } from "./helpers.ts";

test("employed parent, own child in an apprenticeship: education allowance", async () => {
  const formData = {
    applicationDate: "2026-10-19",
    employmentStatus: choice("employmentStatus", "Employee"),
    annualIncome: 60000,
    childRelation: choice("childRelation", "My own child (also adopted)"),
    childBirthDate: "2009-03-10",
    inPostCompulsoryEducation: true,
    educationStartDate: "2025-08-01",
  };

  const evaluation = await engine.evaluate(formData);

  // No answer is dropped: all answers are relevant.
  expect(evaluation.answers).toEqual(formData);
  expect(evaluation.problems).toEqual([]);

  const education = evaluation.results.find((r) => r.rule.iri === FZ + "rule_EducationAllowance");
  expect(education).toBeDefined();
  expect(education!.rule.kind).toBe(SK + "Value");

  // At least CHF 268 a month, at the latest until 2034-03-31.
  expect(Number(education!.args.amount.value)).toBeGreaterThanOrEqual(268);
  expect(education!.args.end.value).toBe("2034-03-31");
  expect(education!.args.start.value).toBe("2025-08-01");
  expect(education!.message).toContain("at least CHF 268 a month");
  expect(education!.message).toContain("until 2034-03-31 at the latest");

  // Sources: FamZG Art. 3 para. 1 b and Art. 5 para. 2.
  const sourceLabels = education!.rule.sources.map((s) => appModel.sources[s].label);
  expect(sourceLabels).toContain("FamZG Art. 3 para. 1 b");
  expect(sourceLabels).toContain("FamZG Art. 5 para. 2");

  // No refusal, and no child allowance (the child is older than 16).
  expect(evaluation.results.some((r) => r.rule.kind === SK + "Refusal")).toBe(false);
  expect(evaluation.results.some((r) => r.rule.iri === FZ + "rule_ChildAllowance")).toBe(false);
  // Next steps: the application and the income of the child.
  expect(evaluation.results.filter((r) => r.rule.kind === SK + "NextStep").map((r) => r.rule.iri).sort()).toEqual([
    FZ + "rule_ApplyEmployee",
    FZ + "rule_ConfirmChildIncome",
  ]);
});
