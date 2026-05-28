import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const create = vi.fn();
  const OpenAI = vi.fn(function OpenAIMock() {
    return { responses: { create } };
  });
  return { create, OpenAI };
});

vi.mock("openai", () => ({ default: mocks.OpenAI }));

async function loadAssistant() {
  return import(new URL("../../scripts/bnbu-crawler/ai-catalog-assistant.mjs", import.meta.url).href);
}

describe("crawler AI assistant", () => {
  it("uses caller params and fills missing course fields without overwriting existing crawler data", async () => {
    mocks.create.mockReset();
    mocks.OpenAI.mockClear();
    mocks.create.mockResolvedValue({
      output_text: JSON.stringify({
        status: "ok",
        fieldsFixed: 4,
        invalidCount: 0,
        errors: [],
        warnings: [],
        courses: [{
          code: "UCLC1003",
          description: "Academic English for university study.",
          credits: 3,
          categoryTags: ["university_core_english"],
          ownerUnit: { type: "school", code: "GE", name: "School of General Education" }
        }],
        curriculumRules: []
      })
    });
    const { applyCrawlerAiAssist } = await loadAssistant();
    const payload = {
      courses: [{
        code: "UCLC1003",
        title: "University English I",
        description: "",
        credits: 0,
        categoryTags: [],
        ownerUnit: null
      }],
      curriculumRules: []
    };

    const result = await applyCrawlerAiAssist({
      target: "course_catalog",
      payload,
      mode: "enrich",
      model: "gpt-test",
      apiKey: "sk-test",
      maxOutputTokens: 600
    });

    expect(mocks.OpenAI).toHaveBeenCalledWith(expect.objectContaining({ apiKey: "sk-test" }));
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      model: "gpt-test",
      max_output_tokens: 600
    }));
    expect(result.summary).toMatchObject({ status: "ok", mode: "enrich", fieldsFixed: 4, invalidCount: 0 });
    expect(result.payload.courses[0]).toMatchObject({
      code: "UCLC1003",
      title: "University English I",
      description: "Academic English for university study.",
      credits: 3,
      categoryTags: ["university_core_english"],
      ownerUnit: { type: "school", code: "GE", name: "School of General Education" }
    });
  });

  it("records disabled mode without calling OpenAI when admin config is paused", async () => {
    mocks.create.mockReset();
    mocks.OpenAI.mockClear();
    const { applyCrawlerAiAssist } = await loadAssistant();

    const result = await applyCrawlerAiAssist({
      target: "course_catalog",
      payload: { courses: [], curriculumRules: [] },
      mode: "validate",
      enabled: false,
      apiKey: "sk-test"
    });

    expect(mocks.OpenAI).not.toHaveBeenCalled();
    expect(result.summary).toMatchObject({
      status: "disabled",
      mode: "validate"
    });
  });
});
