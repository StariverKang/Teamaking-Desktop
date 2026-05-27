import { stringArray } from "@/lib/http";

import { publicUser } from "@/lib/server/services/user-service";

export type PublicContentKind = "help" | "developer_contact" | "developer_log";

export function contentImageUrls(value: unknown) {
  return stringArray(value).slice(0, 3);
}

export function serializeContentDocument(document: any) {
  return {
    id: document.id,
    kind: document.kind,
    nodeType: document.nodeType ?? "document",
    parentId: document.parentId,
    slug: document.slug,
    title: document.title,
    summary: document.summary,
    bodyMarkdown: document.bodyMarkdown,
    imageUrls: contentImageUrls(document.imageUrls),
    status: document.status,
    displayOrder: document.displayOrder,
    publishedAt: document.publishedAt,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    children: (document.children ?? []).map((child: any) => serializeContentDocument(child))
  };
}

function defaultContentDocument(kind: PublicContentKind, appVersionId: string, data: {
  slug: string;
  title: string;
  summary: string;
  bodyMarkdown: string;
}) {
  const now = new Date();
  return {
    id: `default-${kind}`,
    appVersionId,
    kind,
    nodeType: "document",
    parentId: null,
    slug: data.slug,
    title: data.title,
    summary: data.summary,
    bodyMarkdown: data.bodyMarkdown,
    imageUrls: [],
    status: "published",
    displayOrder: 0,
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
    children: []
  };
}

export function defaultContentDocuments(kind: PublicContentKind, appVersionId = "legacy") {
  if (kind === "developer_contact") {
    return [defaultContentDocument(kind, appVersionId, {
      slug: "jayden-kang",
      title: "联系开发者",
      summary: "TEAMAKING 目前由 Jayden Kang 维护。你可以通过微信或邮箱联系开发者。",
      bodyMarkdown: [
        "## Jayden Kang / 康泓正",
        "",
        "BNBU 媒体与传播方向学生，关注产品原型、数据处理、内容运营和学生协作工具。TEAMAKING 当前用于把课程配置、Proof-of-Work Profile、Course Board 和轻量组队流程放在同一个校园场景里验证。",
        "",
        "- WeChat: Oboretastellar",
        "- Email: wojiaonzj2005@163.com",
        "- Skills: product operations, content systems, SQL/SPSS data analysis, Figma, writing, presentation, community operations",
        "- Experience: sports media operation, AI marketing, Web3 product operation, social media operation, language teaching"
      ].join("\n")
    })];
  }

  if (kind === "developer_log") {
    return [defaultContentDocument(kind, appVersionId, {
      slug: "content-unavailable",
      title: "开发者日志暂时不可用",
      summary: "内容服务正在准备中，部署或数据库迁移完成后会恢复显示管理员发布的日志。",
      bodyMarkdown: [
        "## 开发者日志暂时不可用",
        "",
        "当前部署还没有读取到已发布的开发者日志。若刚完成部署，请先确认生产数据库 migration 已执行，然后刷新页面。",
        "",
        "这不会影响核心注册、课程、组队和管理员功能的代码加载；它只表示公开内容文档暂时没有可读取的数据。"
      ].join("\n")
    })];
  }

  return [defaultContentDocument(kind, appVersionId, {
    slug: "content-unavailable",
    title: "帮助文档暂时不可用",
    summary: "内容服务正在准备中，部署或数据库迁移完成后会恢复显示管理员发布的帮助文档。",
    bodyMarkdown: [
      "## 帮助文档暂时不可用",
      "",
      "当前部署还没有读取到已发布的帮助文档。若刚完成部署，请先确认生产数据库 migration 已执行，然后刷新页面。",
      "",
      "你仍可以通过 Support / 工单入口提交问题；管理员发布帮助文档后，本页会自动显示文档目录和正文。"
    ].join("\n")
  })];
}

export function defaultDeveloperContactDocument(appVersionId: string) {
  return defaultContentDocuments("developer_contact", appVersionId)[0];
}

export function contentDocumentPayload(documents: any[]) {
  const byParent = new Map<string | null, any[]>();
  for (const document of documents) {
    const key = document.parentId ?? null;
    byParent.set(key, [...(byParent.get(key) ?? []), document]);
  }
  const attachChildren = (document: any): any => ({ ...document, children: (byParent.get(document.id) ?? []).map(attachChildren) });
  return {
    documents: (byParent.get(null) ?? []).map(attachChildren).map(serializeContentDocument),
    flatDocuments: documents.map((document: any) => serializeContentDocument({ ...document, children: [] }))
  };
}

export function isRecoverableContentStoreError(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  return ["P1001", "P1002", "P1017", "P2021", "P2022"].includes(code);
}

export function activeAnnouncementWhere(appVersionId: string, now = new Date()) {
  return {
    appVersionId,
    status: "published",
    OR: [{ startsAt: null }, { startsAt: { lte: now } }],
    AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }]
  };
}

export function serializeAnnouncement(announcement: any) {
  const read = Array.isArray(announcement.reads) ? announcement.reads[0] : null;
  return {
    id: announcement.id,
    titleZh: announcement.titleZh,
    titleEn: announcement.titleEn,
    bodyZh: announcement.bodyZh,
    bodyEn: announcement.bodyEn,
    status: announcement.status,
    audience: announcement.audience,
    priority: announcement.priority,
    startsAt: announcement.startsAt,
    endsAt: announcement.endsAt,
    publishedAt: announcement.publishedAt,
    publishedBy: announcement.publishedBy ? publicUser(announcement.publishedBy) : null,
    archivedAt: announcement.archivedAt,
    readAt: read?.readAt ?? null,
    dismissedAt: read?.dismissedAt ?? null,
    createdAt: announcement.createdAt,
    updatedAt: announcement.updatedAt,
    readCount: announcement._count?.reads
  };
}
