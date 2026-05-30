import { describe, expect, it } from "vitest";
import {
  academicTermForRelativeTermCode,
  curriculumRuleMatchesUser,
  defaultJoinMembershipAction,
  relativeTermCodeForProfile,
  ruleHasProgrammeScope,
  selectDefaultJoinUsers
} from "@/lib/server/course-import/curriculum-matching";

const semester = { year: 2026, term: "Spring" };
const aiUser = {
  id: "user-ai",
  profile: {
    entryYear: 2025,
    entryTerm: "Fall",
    grade: "2025",
    major: { code: "AI" },
    faculty: { code: "FST" }
  }
};

describe("curriculum matching", () => {
  it("maps Fall/Spring academic terms to relative terms", () => {
    expect(relativeTermCodeForProfile(aiUser.profile, { year: 2025, term: "Fall" })).toBe("Y1S1");
    expect(relativeTermCodeForProfile(aiUser.profile, semester)).toBe("Y1S2");
    expect(relativeTermCodeForProfile(aiUser.profile, { year: 2029, term: "Spring" })).toBe("Y4S2");
    expect(relativeTermCodeForProfile(aiUser.profile, { year: 2029, term: "Fall" })).toBeNull();
    expect(relativeTermCodeForProfile({ entryYear: 2024, entryTerm: "Fall" }, { year: 2026, term: "Fall" })).toBe("Y3S1");
    expect(relativeTermCodeForProfile({ entryYear: 2025, entryTerm: "Spring" }, semester)).toBe("Y1S2");
    expect(academicTermForRelativeTermCode(2025, "Fall", "Y2S1")).toMatchObject({ code: "2026-Fall", label: "2026 Fall" });
    expect(academicTermForRelativeTermCode(2025, "Spring", "Y2S1")).toMatchObject({ code: "2026-Fall", label: "2026 Fall" });
  });

  it("matches curriculum rules by relative term and programme scope", () => {
    const rule = {
      relativeTermCodes: ["Y1S2"],
      audience: { majorCodes: ["AI"], cohortYears: [2025] }
    };
    expect(curriculumRuleMatchesUser(rule, aiUser, semester)).toBe(true);
    expect(ruleHasProgrammeScope(rule)).toBe(true);
    expect(curriculumRuleMatchesUser({ ...rule, audience: { majorCodes: ["FIN"] } }, aiUser, semester)).toBe(false);
    expect(curriculumRuleMatchesUser({ ...rule, relativeTermCodes: ["Y5S1"] }, aiUser, { year: 2029, term: "Fall" })).toBe(false);
    expect(curriculumRuleMatchesUser({ audience: { allMajors: true }, relativeTermCodes: [] }, aiUser, { year: 2029, term: "Fall" })).toBe(false);
  });

  it("selects default join users and protects opted-out/manual memberships", () => {
    const users = [
      aiUser,
      { id: "user-old", profile: { entryYear: 2024, entryTerm: "Fall", major: { code: "AI" }, faculty: { code: "FST" } } },
      { id: "user-graduated", profile: { entryYear: 2021, entryTerm: "Fall", major: { code: "AI" }, faculty: { code: "FST" } } }
    ];
    expect(selectDefaultJoinUsers(users, ["Y1S2"], semester).map((user) => user.id)).toEqual(["user-ai"]);
    expect(selectDefaultJoinUsers(users, ["Y5S2"], semester).map((user) => user.id)).toEqual([]);
    expect(defaultJoinMembershipAction(null)).toBe("create");
    expect(defaultJoinMembershipAction({ status: "opted_out", source: "auto_major_required" })).toBe("skip");
    expect(defaultJoinMembershipAction({ status: "active", source: "manual" })).toBe("skip");
    expect(defaultJoinMembershipAction({ status: "left", source: "auto_major_required" })).toBe("update_auto");
  });
});
