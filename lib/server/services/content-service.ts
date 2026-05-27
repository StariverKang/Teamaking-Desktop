import { stringArray } from "@/lib/http";

import { publicUser } from "@/lib/server/services/user-service";

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

export function defaultDeveloperContactDocument(appVersionId: string) {
  const now = new Date();
  return {
    id: "default-developer-contact",
    appVersionId,
    kind: "developer_contact",
    parentId: null,
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
    ].join("\n"),
    imageUrls: [],
    status: "published",
    displayOrder: 0,
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
    children: []
  };
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
