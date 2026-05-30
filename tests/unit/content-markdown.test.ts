import { describe, expect, it } from "vitest";
import {
  contentBreadcrumb,
  extractMarkdownHeadingIdByLine,
  extractMarkdownHeadings,
  parseContentMarkdownFile,
  relatedContentDocuments,
  searchContentDocuments
} from "@/lib/content-markdown";

describe("content markdown helpers", () => {
  it("parses frontmatter and markdown body into a content draft", () => {
    const draft = parseContentMarkdownFile({
      fileName: "onboarding.md",
      relativePath: "01-getting-started/onboarding.md",
      kind: "help",
      raw: [
        "---",
        "kind: help",
        "nodeType: document",
        "title: 首次设置与学业信息",
        "slug: onboarding",
        "summary: 说明 onboarding 字段。",
        "displayOrder: 140",
        "status: published",
        "parentSlug: getting-started",
        "---",
        "",
        "# 首次设置与学业信息",
        "",
        "正文内容。"
      ].join("\n")
    });

    expect(draft).toMatchObject({
      kind: "help",
      nodeType: "document",
      title: "首次设置与学业信息",
      slug: "onboarding",
      summary: "说明 onboarding 字段。",
      displayOrder: 140,
      status: "published",
      parentSlug: "getting-started",
      bodyMarkdown: "# 首次设置与学业信息\n\n正文内容。"
    });
  });

  it("infers folders, slugs, titles, parent slugs, and summaries when fields are missing", () => {
    const folder = parseContentMarkdownFile({
      fileName: "_folder.md",
      relativePath: "01-getting-started/_folder.md",
      kind: "help",
      raw: "# 开始使用\n\n这里是目录说明。"
    });
    const document = parseContentMarkdownFile({
      fileName: "quick-start.md",
      relativePath: "01-getting-started/quick-start.md",
      kind: "help",
      raw: "# 新用户快速开始\n\n第一段摘要会被自动提取。"
    });

    expect(folder).toMatchObject({ nodeType: "folder", slug: "getting-started", title: "开始使用", parentSlug: "" });
    expect(document).toMatchObject({ nodeType: "document", slug: "quick-start", title: "新用户快速开始", parentSlug: "getting-started", summary: "第一段摘要会被自动提取。" });
  });

  it("keeps archived drafts out of publishing by default", () => {
    const draft = parseContentMarkdownFile({
      fileName: "_archive-policy.md",
      relativePath: "99-archive/_archive-policy.md",
      kind: "help",
      raw: "---\nstatus: published\n---\n# 归档规则"
    });

    expect(draft.archived).toBe(true);
    expect(draft.status).toBe("draft");
  });

  it("extracts stable heading ids with duplicate handling", () => {
    expect(extractMarkdownHeadings("# Overview\n## FAQ\n### FAQ\n##### Ignored\n## FAQ")).toEqual([
      { depth: 1, text: "Overview", id: "overview", line: 1 },
      { depth: 2, text: "FAQ", id: "faq", line: 2 },
      { depth: 3, text: "FAQ", id: "faq-2", line: 3 },
      { depth: 2, text: "FAQ", id: "faq-3", line: 5 }
    ]);
    expect([...extractMarkdownHeadingIdByLine("# Overview\n## FAQ").entries()]).toEqual([[1, "overview"], [2, "faq"]]);
  });

  it("builds breadcrumbs, search results, and related article recommendations", () => {
    const folder = { id: "folder", kind: "help", nodeType: "folder", title: "课程", slug: "courses", parentId: null };
    const current = { id: "a", kind: "help", nodeType: "document", parentId: "folder", title: "查找课程", slug: "find-courses", summary: "搜索课程代码", bodyMarkdown: "Course Board 和课程代码", displayOrder: 10 };
    const sibling = { id: "b", kind: "help", nodeType: "document", parentId: "folder", title: "加入 Course Board", slug: "join-board", summary: "Course Board", bodyMarkdown: "加入课程", displayOrder: 20 };
    const duplicatedSibling = { ...sibling, id: "b-copy" };
    const other = { id: "c", kind: "help", nodeType: "document", parentId: null, title: "账号登录", slug: "login", summary: "学校邮箱", bodyMarkdown: "", displayOrder: 1 };
    const duplicatedCurrent = { ...current, id: "a-copy" };
    const documents = [folder, current, duplicatedCurrent, sibling, duplicatedSibling, other];

    expect(contentBreadcrumb(current, documents).map((item) => item.slug)).toEqual(["courses", "find-courses"]);
    expect(searchContentDocuments("课程代码", documents).map((item) => item.id)).toEqual(["a", "a-copy"]);
    expect(relatedContentDocuments(current, documents, 2).map((item) => item.id)).toEqual(["b", "c"]);
  });
});
