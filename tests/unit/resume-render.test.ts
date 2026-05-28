import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { renderResumeParsedData } from "@/components/pages/shared/portfolio-parts";
import { parseResumeText } from "@/lib/profile-assets";

describe("resume parsed data rendering", () => {
  it("renders emphasized AI summary, compact highlights, and manual editing controls", () => {
    const parsed = parseResumeText(`
      教育背景
      香港浸会大学（珠海校区） 媒体与传播学
      实习经历
      用户增长：建联10+KOL合作产出推广视频，并持续跟踪发布数据形成复盘。
      数据复盘：整理曝光、收藏、咨询和转化数据，帮助优化后续内容策略。
    `, "resume.txt");

    const html = renderToStaticMarkup(renderResumeParsedData(parsed, "resume.txt", { editable: true }));

    expect(html).toContain("Auto summary");
    expect(html).toContain("Highlights");
    expect(html).toContain("手动微调 AI Summary / Highlights");
    expect(html).toContain("恢复 AI 版本");
    expect(html).toContain("Fallback");
  });
});
