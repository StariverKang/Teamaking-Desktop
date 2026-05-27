import { describe, expect, it } from "vitest";

async function commonCatalogModule() {
  return import(new URL("../../scripts/bnbu-crawler/common-curriculum-catalog.mjs", import.meta.url).href);
}

describe("common curriculum course catalog parsing", () => {
  it("chooses the PDF that matches the cohort group instead of older broader PDFs", async () => {
    const { selectCommonCurriculumPdfLink } = await commonCatalogModule();

    const selected = selectCommonCurriculumPdfLink([
      {
        label: "",
        href: "https://ar.bnbu.edu.cn/dfiles/HB2404/University%20Core%20(2022%20cohort%20and%20onwards)_20240516.pdf"
      },
      {
        label: "University Core (for 2022 - 2024 cohorts)",
        href: "https://ar.bnbu.edu.cn/dfiles/HB2505/University%20Core-2022%20to%202024%20cohorts_20240516.pdf"
      }
    ], "University Core (for 2022 - 2024 cohorts)");

    expect(selected.href).toContain("2022%20to%202024");
  });

  it("parses University Core and General Education PDFs as course catalog rows only", async () => {
    const { parseCommonCurriculumCourses } = await commonCatalogModule();

    const universityCore = parseCommonCurriculumCourses([
      "Chinese",
      "UCLC1003 University Chinese 3 units",
      "AI Literacy",
      "UCAI1003 Introduction to AI Literacy 3 units",
      "Whole Person Education Experiential Learning Modules",
      "(iii) WPEX2023 Voluntary Service (3), or WPEX2033 Environmental Awareness (3) 1 unit",
      "Healthy Lifestyle",
      "Courses under this category are coded as UCHL1XX3.",
      "3 units"
    ], { sourceKind: "university_core", sourceId: "common-university-core-2025" });

    const generalEducation = parseCommonCurriculumCourses([
      "2.2. Level 2: Interdisciplinary Thematic Courses (2)",
      "GTCU2153 Global Surrealism: Building Transnational Networks across Art History,",
      "Literature, and Culture",
      "3 units",
      "2.3. Level 3: GE Capstone Courses (4)",
      "GCAP3003 Service Learning and Community Engagement 3 units"
    ], { sourceKind: "general_education", sourceId: "common-general-education-2021-onwards" });

    expect(universityCore.courses).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "UCLC1003", categoryTags: ["University Core - Chinese"] }),
      expect.objectContaining({ code: "UCAI1003", categoryTags: ["University Core - AI Literacy"] }),
      expect.objectContaining({ code: "WPEX2023", title: "Voluntary Service", credits: 1 }),
      expect.objectContaining({ code: "WPEX2033", title: "Environmental Awareness", credits: 1 }),
      expect.objectContaining({ code: "UCHL1XX3", title: "Healthy Lifestyle Courses", credits: 3 })
    ]));
    expect(generalEducation.courses).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "GTCU2153",
        title: "Global Surrealism: Building Transnational Networks across Art History, Literature, and Culture",
        categoryTags: ["GE Level 2 - Interdisciplinary Thematic Courses"]
      }),
      expect.objectContaining({ code: "GCAP3003", categoryTags: ["GE Level 3 - Capstone"] })
    ]));
    expect("rules" in universityCore).toBe(false);
    expect("rules" in generalEducation).toBe(false);
  });
});
