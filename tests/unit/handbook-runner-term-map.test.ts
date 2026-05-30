import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";

async function handbookRunnerModule() {
  return import(new URL("../../scripts/bnbu-crawler/run-handbook-preview.mjs", import.meta.url).href);
}

const staticHandbookFixtures = [
  new URL("../../course_imports/bnbu/bnbu-2024-admission-handbook.teamaking.json", import.meta.url),
  new URL("../../course_imports/bnbu/bnbu-2025-admission-handbook.teamaking.json", import.meta.url)
];

describe("programme handbook runner term mapping", () => {
  it("maps PDF semester-table coordinates to relative term codes", async () => {
    const { courseTermMapFromPositionedText } = await handbookRunnerModule();

    const termsByCode = courseTermMapFromPositionedText([
      { str: "Sem 1", x: 300, y: 720 },
      { str: "Sem 2", x: 350, y: 720 },
      { str: "Sem 1", x: 400, y: 720 },
      { str: "Sem 2", x: 450, y: 720 },
      { str: "Semester 1", x: 500, y: 720 },
      { str: "Semester 2", x: 550, y: 720 },
      { str: "Sem 1", x: 600, y: 720 },
      { str: "Sem 2", x: 650, y: 720 },
      { str: "MCOM1003", x: 54, y: 650 },
      { str: "3", x: 358, y: 650 },
      { str: "MCOM2013", x: 54, y: 625 },
      { str: "3", x: 408, y: 625 },
      { str: "AI3023", x: 72, y: 575 },
      { str: "3", x: 558, y: 575 },
      { str: "CAP4003", x: 118, y: 550 },
      { str: "3", x: 658, y: 550 },
      { str: "UCHL1XX3", x: 54, y: 600 },
      { str: "3", x: 308, y: 600 },
      { str: "3", x: 358, y: 600 },
      { str: "3", x: 458, y: 600 }
    ]);

    expect(termsByCode.get("MCOM1003")).toEqual(["Y1S2"]);
    expect(termsByCode.get("MCOM2013")).toEqual(["Y2S1"]);
    expect(termsByCode.get("AI3023")).toEqual(["Y3S2"]);
    expect(termsByCode.get("CAP4003")).toEqual(["Y4S2"]);
    expect(termsByCode.get("UCHL1XX3")).toEqual(["Y1S1", "Y1S2", "Y2S2"]);
  });

  it("uses parsed term-map data instead of code-prefix fallback for handbook rules", async () => {
    const { parseCourses } = await handbookRunnerModule();
    const termsByCode = new Map([
      ["MCOM1003", ["Y1S2"]],
      ["MCOM2013", ["Y2S1"]]
    ]);

    const parsed = parseCourses(
      [
        "Major Required Courses",
        "MCOM1003 Visual Communication 3",
        "MCOM2013 Communication Theories I 3"
      ].join("\n"),
      {
        code: "MCOM",
        facultyCode: "FHSS",
        facultyName: "Faculty of Humanities and Social Sciences"
      },
      "handbook-2025-mcom",
      "2025",
      termsByCode
    );

    expect(parsed.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        courseCode: "MCOM1003",
        relativeTermCodes: ["Y1S2"],
        confidence: "medium",
        audience: expect.objectContaining({ majorCodes: ["MCOM"], cohortYears: [2025] })
      }),
      expect.objectContaining({
        courseCode: "MCOM2013",
        relativeTermCodes: ["Y2S1"],
        confidence: "medium"
      })
    ]));
  });

  it("keeps Spring relative-term recommendations for every programme in static handbook fixtures", () => {
    const payloads = staticHandbookFixtures
      .filter((fixture) => existsSync(fixture))
      .map((fixture) => JSON.parse(readFileSync(fixture, "utf8")));

    expect(payloads.length).toBeGreaterThan(0);

    for (const payload of payloads) {
      const cohortYear = payload.cohortYears?.[0];
      expect(payload.majors.length).toBeGreaterThan(20);

      for (const major of payload.majors) {
        const rules = payload.curriculumRules.filter((rule: any) => {
          return Array.isArray(rule.audience?.majorCodes) && rule.audience.majorCodes.includes(major.code);
        });
        const terms = new Set(rules.flatMap((rule: any) => rule.relativeTermCodes ?? []));

        expect.soft(
          terms.has("Y1S2"),
          `${cohortYear} ${major.code} should have Year 1 Spring recommendations`
        ).toBe(true);
        expect.soft(
          terms.has("Y2S2"),
          `${cohortYear} ${major.code} should have Year 2 Spring recommendations`
        ).toBe(true);
        expect.soft(
          terms.has("Y3S2"),
          `${cohortYear} ${major.code} should have Year 3 Spring recommendations`
        ).toBe(true);
        expect.soft(
          [...terms].some((term) => /S1$/.test(String(term))),
          `${cohortYear} ${major.code} should still keep Fall recommendations`
        ).toBe(true);
      }
    }
  });
});
