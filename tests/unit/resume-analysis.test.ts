import { describe, expect, it } from "vitest";
import { buildFallbackResumeAnalysis, resolveResumeAnalysis, resumeNeedsAiAnalysis, withManualResumeAnalysis, withoutManualResumeAnalysis } from "@/lib/resume-analysis";
import { parseResumeText } from "@/lib/profile-assets";

const longResume = `
教育背景
香港浸会大学（珠海校区） 媒体与传播学 2025.09 至今
实习经历
新腾（珠海）体育文化发展有限公司 格盛一号项目 新媒体运营 2025.09-2025.10
项目背景：“格盛一号”作为新腾体育旗下的旗舰级体育文化综合体，旨在打造区域性的体育+商业地标。
用户增长：根据旅行项目内容，设计宣发海报，用于美团、携程等平台上的产品主页信息；建联10+KOL合作产出推广视频，并撰写10+图文物料。
Kaze AI 市场营销实习生 2025.10-2025.11
用户增长：在TikTok、Instagram等海外社交平台上建联100+KOL，定制化策划产品推广视频10+；每周回访追踪视频发布数据。
北京世纪好未来教育科技有限公司 雅思口语线上兼职教师 2025.10 至今
教学教研：原创口语教学体系，整理授课SOP，学生平均考取6.5+总分。
KuCoin Web3钱包团队 产品运营实习生 2026.02-2026.04
活动运营与标准化落地：跟进Web3钱包拉新与空投活动，负责后台活动规则与资源位配置、UI文案补充及多语言校验。
KOL拓展与数据追踪：结合TG社群活跃度、粉丝量等指标筛查潜在合作KOL，撰写定制化合作邀请及跟进文案。
竞对调研与产品迭代：追踪 Binance、Gate 等头部 Web3 钱包产品，从UX、活动曝光链路及拉新转化效果等核心维度开展竞品拆解。
MEXC 市场部 社媒实习生 2026.02-2026.05
物料产出：捕捉节日热点、市场动向，并据此输出每日 GM 图与节日贺图的设计需求，负责各竞对官方账号的宣传物料收集与创意整理。
日常运营：负责 X 平台官号与 Telegram 频道的日常上市内容与常规宣发、文案起草、撰写美股交易等活动视频的英文 Copywriting。
市场调研：针对黄金、白银等大宗商品交易产品和零费率特性开展调研，通过量化分析Binance、Bitget等竞对宣发内容。
`;

describe("resume analysis normalization", () => {
  it("builds concise fallback highlights instead of copying the full resume", () => {
    const parsed = parseResumeText(longResume, "resume.txt");
    const analysis = buildFallbackResumeAnalysis(parsed);

    expect(analysis.highlights.length).toBeGreaterThanOrEqual(3);
    expect(analysis.highlights.length).toBeLessThanOrEqual(8);
    expect(analysis.summaryBody).not.toContain("香港浸会大学（珠海校区） 媒体与传播学 2025.09 至今 新腾");
    expect(analysis.keywordGroups.flatMap((group) => group.keywords)).not.toEqual(expect.arrayContaining(["python", "figma"]));
    expect(analysis.highlights.every((item) => item.evidence.includes("动作：") && item.evidence.includes("结果："))).toBe(true);
    expect(analysis.highlights.every((item) => item.evidence.length <= 180)).toBe(true);
    expect(analysis.highlights.some((item) => item.evidence === "用户增长：根据旅行项目内容，设计宣发海报，用于美团、携程等平台上的产品主页信息；建联10+KOL合作产出推广视频，并撰写10+图文物料。")).toBe(false);
  });

  it("prefers manual edits and can restore the generated analysis", () => {
    const parsed = parseResumeText(longResume, "resume.txt");
    const withManual = withManualResumeAnalysis(parsed, {
      summaryTitle: "手动候选人定位",
      summaryBody: "手动摘要正文。",
      highlights: [{ title: "手动高光", evidence: "手动证据。", category: "编辑", keywords: [] }]
    });

    expect(resolveResumeAnalysis(withManual).source).toBe("manual");
    expect(resolveResumeAnalysis(withManual).analysis.summaryTitle).toBe("手动候选人定位");
    expect(resolveResumeAnalysis(withoutManualResumeAnalysis(withManual)).source).toBe("fallback");
  });

  it("uses neutral fallback values instead of '未明确' when fields are missing", () => {
    const parsed = parseResumeText("实习经历\n项目中负责推进活动，协同团队推进。", "resume.txt");
    const analysis = buildFallbackResumeAnalysis(parsed);

    expect(analysis.highlights.every((item) => item.position !== "职位/公司未明确")).toBe(true);
    expect(analysis.highlights.every((item) => item.company !== "职位/公司未明确")).toBe(true);
    expect(analysis.highlights.every((item) => item.action !== "动作未明确")).toBe(true);
    expect(analysis.highlights.every((item) => item.result !== "结果未在文本中明确写出")).toBe(true);
    expect(analysis.highlights.every((item) => !item.evidence.includes("未明确"))).toBe(true);
  });

  it("detects legacy parsed data that has not received AI analysis", () => {
    expect(resumeNeedsAiAnalysis({ summary: "old", highlights: ["old line"] })).toBe(true);
    expect(resumeNeedsAiAnalysis(parseResumeText(longResume, "resume.txt"))).toBe(false);
  });
});
