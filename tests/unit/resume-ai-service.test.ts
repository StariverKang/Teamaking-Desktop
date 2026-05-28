import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseResumeText } from "@/lib/profile-assets";
import { analyzeResumeParsedData } from "@/lib/server/services/resume-ai-service";

const mocks = vi.hoisted(() => {
  const create = vi.fn();
  const OpenAI = vi.fn(function OpenAIMock() {
    return { responses: { create } };
  });
  return {
    create,
    OpenAI,
    siteConfigFindUnique: vi.fn(),
    operationLog: vi.fn()
  };
});

vi.mock("openai", () => ({ default: mocks.OpenAI }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    siteConfig: {
      findUnique: mocks.siteConfigFindUnique
    }
  }
}));
vi.mock("@/lib/server/services/system-service", () => ({
  operationLog: mocks.operationLog
}));

const originalApiKey = process.env.OPENAI_API_KEY;
const originalModel = process.env.OPENAI_RESUME_MODEL;

describe("resume AI service", () => {
  beforeEach(() => {
    mocks.create.mockReset();
    mocks.OpenAI.mockClear();
    mocks.siteConfigFindUnique.mockReset();
    mocks.siteConfigFindUnique.mockResolvedValue(null);
    mocks.operationLog.mockReset();
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_RESUME_MODEL;
  });

  afterEach(() => {
    if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalApiKey;
    if (originalModel === undefined) delete process.env.OPENAI_RESUME_MODEL;
    else process.env.OPENAI_RESUME_MODEL = originalModel;
  });

  it("falls back without calling OpenAI when the API key is missing", async () => {
    const parsed = parseResumeText("实习经历\n用户增长：建联10+KOL并复盘数据。", "resume.txt");

    const analysis = await analyzeResumeParsedData(parsed);

    expect(mocks.OpenAI).not.toHaveBeenCalled();
    expect(mocks.operationLog).not.toHaveBeenCalled();
    expect(analysis.status).toBe("fallback");
    expect(analysis.highlights.length).toBeGreaterThan(0);
  });

  it("uses OpenAI structured output when configured", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_RESUME_MODEL = "gpt-test";
    mocks.create.mockResolvedValue({
      output_text: JSON.stringify({
        summaryTitle: "内容运营增长候选人",
        summaryBody: "围绕社媒增长、KOL合作和数据复盘形成可验证的项目执行能力。",
        keywordGroups: [{ label: "核心能力", keywords: ["KOL合作", "数据复盘"] }],
        highlights: [{
          title: "KOL增长执行",
          evidence: "职位：市场部实习生；公司：MEXC；动作：建联10+KOL并跟踪内容发布数据；结果：形成推广复盘证据。",
          position: "市场部实习生",
          company: "MEXC",
          action: "建联10+KOL并跟踪内容发布数据",
          result: "形成推广复盘证据",
          category: "增长运营",
          keywords: ["KOL合作"]
        },
        {
          title: "教学体验输出",
          evidence: "职位：线上兼职教师；公司：北京世纪好未来；动作：重构授课SOP并推进周度复盘；结果：学生平均考取6.5+。",
          position: "线上兼职教师",
          company: "北京世纪好未来",
          action: "重构授课SOP并推进周度复盘",
          result: "学生平均考取6.5+。",
          category: "教学与体系化",
          keywords: ["教学体系"]
        },
        {
          title: "活动运营",
          evidence: "职位：产品运营实习生；公司：KuCoin；动作：联动KOL完成拉新活动配置；结果：提高活动响应率。",
          position: "产品运营实习生",
          company: "KuCoin",
          action: "联动KOL完成拉新活动配置",
          result: "提高活动响应率。",
          category: "活动运营",
          keywords: ["活动运营"]
        }]
      })
    });
    const parsed = parseResumeText("实习经历\n用户增长：建联10+KOL并复盘数据。", "resume.txt");

    const analysis = await analyzeResumeParsedData(parsed);

    expect(mocks.OpenAI).toHaveBeenCalledWith({ apiKey: "test-key" });
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      model: "gpt-test",
      store: false,
      text: expect.objectContaining({
        format: expect.objectContaining({ type: "json_schema", strict: true })
      })
    }));
    expect(analysis.status).toBe("generated");
    expect(analysis.provider).toBe("openai");
    expect(analysis.highlights.length).toBeGreaterThanOrEqual(3);
    const calledPayload = mocks.create.mock.calls[0]?.[0];
    const joinedInput = Array.isArray(calledPayload.input) ? calledPayload.input.join("\n") : calledPayload.input;
    expect(joinedInput).toContain("待补充");
    expect(joinedInput).not.toContain("未明确");
  });

  it("lets admin SiteConfig override the environment model and API key", async () => {
    process.env.OPENAI_API_KEY = "env-key";
    process.env.OPENAI_RESUME_MODEL = "env-model";
    mocks.siteConfigFindUnique.mockResolvedValue({
      value: {
        enabled: true,
        apiKey: "db-key",
        model: "gpt-admin",
        inputLimit: 4000
      }
    });
    mocks.create.mockResolvedValue({
      output_text: JSON.stringify({
        summaryTitle: "产品运营候选人",
        summaryBody: "以活动运营、用户反馈和数据复盘形成产品增长证据。",
        keywordGroups: [{ label: "核心能力", keywords: ["活动运营"] }],
        highlights: [{
          title: "活动运营落地",
          evidence: "职位：产品运营实习生；公司：KuCoin；动作：跟进活动配置、文案校对和数据复盘；结果：提升上线效率。",
          position: "产品运营实习生",
          company: "KuCoin",
          action: "跟进活动配置、文案校对和数据复盘",
          result: "提升上线效率",
          category: "活动运营",
          keywords: ["活动运营"]
        }]
      })
    });
    const parsed = parseResumeText("实习经历\n活动运营：跟进活动配置、文案校对和数据复盘。", "resume.txt");

    const analysis = await analyzeResumeParsedData(parsed);

    expect(mocks.OpenAI).toHaveBeenCalledWith({ apiKey: "db-key" });
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ model: "gpt-admin" }));
    expect(analysis.model).toBe("gpt-admin");
  });

  it("returns fallback analysis if OpenAI fails", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    mocks.create.mockRejectedValue(new Error("rate limited"));
    const parsed = parseResumeText("实习经历\n数据复盘：整理曝光、收藏和转化数据。", "resume.txt");

    const analysis = await analyzeResumeParsedData(parsed);

    expect(analysis.status).toBe("fallback");
    expect(analysis.error).toContain("rate limited");
  });

  it("logs structured analysis metadata without raw resume text when context is provided", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    mocks.create.mockResolvedValue({
      output_text: JSON.stringify({
        summaryTitle: "内容运营候选人",
        summaryBody: "围绕 KOL 协作和数据复盘形成可验证运营成果。",
        keywordGroups: [{ label: "核心能力", keywords: ["KOL协作"] }],
        highlights: [{
          title: "KOL 协作",
          evidence: "职位：市场部实习生；公司：MEXC；动作：建联10+KOL并跟踪内容发布数据；结果：形成高频发布机制。",
          position: "市场部实习生",
          company: "MEXC",
          action: "建联10+KOL并跟踪内容发布数据",
          result: "形成高频发布机制",
          category: "增长运营",
          keywords: ["KOL协作"]
        },
        {
          title: "活动推动",
          evidence: "职位：活动执行；公司：KuCoin；动作：协同多个角色推进A/B试验与复盘；结果：活动执行效率提升。",
          position: "活动执行",
          company: "KuCoin",
          action: "协同多个角色推进A/B试验与复盘",
          result: "活动执行效率提升。",
          category: "活动运营",
          keywords: ["活动运营"]
        },
        {
          title: "用户运营",
          evidence: "职位：运营实习生；公司：MEXC；动作：搭建周报追踪看板并汇总发布数据；结果：建立复盘频率。",
          position: "运营实习生",
          company: "MEXC",
          action: "搭建周报追踪看板并汇总发布数据",
          result: "建立复盘频率。",
          category: "数据分析",
          keywords: ["数据复盘"]
        }]
      })
    });
    const parsed = parseResumeText("实习经历\n用户增长：建联10+KOL并复盘数据。", "resume.txt");

    await analyzeResumeParsedData(parsed, {
      actorUserId: "user-1",
      actorRole: "profile_completed_user",
      targetId: "profile-1",
      trigger: "resume_upload",
      method: "POST",
      path: "/api/uploads"
    });

    expect(mocks.operationLog).toHaveBeenCalledWith(expect.objectContaining({
      action: "profile.resume.ai_analysis",
      targetId: "profile-1",
      status: "success",
      summary: expect.objectContaining({
        trigger: "resume_upload",
        model: "gpt-4.1-mini",
        summaryTitle: "内容运营候选人",
        apiKeySource: "env"
      }),
      metadata: expect.objectContaining({
        analysisResult: expect.objectContaining({
          summaryTitle: "内容运营候选人",
          highlights: expect.any(Array)
        })
      })
    }));
    expect(JSON.stringify(mocks.operationLog.mock.calls[0][0])).not.toContain("用户增长：建联10+KOL并复盘数据");
  });
});
