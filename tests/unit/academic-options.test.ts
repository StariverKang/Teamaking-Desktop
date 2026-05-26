import { describe, expect, it } from "vitest";
import { filterUserFacingMajors, legacyBnbuMajorReplacementForName } from "@/lib/academic-options";

describe("academic option filtering", () => {
  it("hides legacy BNBU short programme names when canonical programmes exist", () => {
    const majors = [
      { id: "legacy-ats", name: "Applied Translation", code: null },
      { id: "canonical-ats", name: "Applied Translation Studies Programme", code: "ATS" },
      { id: "legacy-mcom", name: "Media and Communication", code: null },
      { id: "canonical-mcom", name: "Media and Communication Studies Programme", code: "MCOM" }
    ];

    expect(filterUserFacingMajors(majors).map((major) => major.name)).toEqual([
      "Applied Translation Studies Programme",
      "Media and Communication Studies Programme"
    ]);
  });

  it("keeps a legacy name if no canonical replacement exists yet", () => {
    const majors = [{ id: "legacy-ats", name: "Applied Translation", code: null }];

    expect(filterUserFacingMajors(majors)).toEqual(majors);
  });

  it("maps old pipeline aliases to canonical programme codes", () => {
    expect(legacyBnbuMajorReplacementForName("English Language and Literary Studies")?.code).toBe("ELLS");
    expect(legacyBnbuMajorReplacementForName("Public Relations and Advertising")?.code).toBe("PRA");
  });
});
