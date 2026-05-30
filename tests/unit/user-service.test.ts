import { describe, expect, it } from "vitest";
import { academicLockForUser, gradeFromEntryYear } from "@/lib/server/services/user-service";

describe("user academic labels", () => {
  it("keeps spring of the fourth academic year as Year 4 and fall after that as Graduated", () => {
    expect(gradeFromEntryYear(2025, new Date(2029, 2, 1))).toBe("Year 4");
    expect(gradeFromEntryYear(2025, new Date(2029, 8, 1))).toBe("Graduated");
  });

  it("serializes student entry term as Fall for BNBU admission logic", () => {
    const lock = academicLockForUser({
      email: "s523456@mail.bnbu.edu.cn",
      profile: { entryYear: 2025, entryTerm: "Spring" }
    });

    expect(lock).toMatchObject({
      entryYear: 2025,
      entryTerm: "Fall"
    });
  });

  it("does not let stale profile grade hide a graduated label", () => {
    const lock = academicLockForUser({
      email: "s123456@mail.bnbu.edu.cn",
      profile: { entryYear: 2021, entryTerm: "Fall", grade: "Year 4", academicOverrideAt: new Date() }
    });

    expect(lock.grade).toBe("Graduated");
  });
});
