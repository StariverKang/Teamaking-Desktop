import { describe, expect, it } from "vitest";
import { normalizeAdmissionSemesterActivationInput } from "@/lib/server/course-import/workflows/semester-activation-workflow";

describe("semester activation workflow helpers", () => {
  it("normalizes real academic terms separately from admission plan imports", () => {
    expect(normalizeAdmissionSemesterActivationInput({
      academicYear: "2026",
      term: "秋",
      cohortYears: "2025, 2024",
      makeCurrent: false
    })).toMatchObject({
      academicYear: 2026,
      term: "Fall",
      semesterCode: "2026-Fall",
      semesterName: "2026 Fall",
      cohortYears: [2025, 2024],
      makeCurrent: false
    });
  });
});
