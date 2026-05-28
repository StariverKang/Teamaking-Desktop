import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, assertString, created, ok, optionalString, readBody } from "@/lib/http";
import { getActiveAppVersionId } from "@/lib/app-version";
import { userInclude } from "@/lib/server/services/user-service";
import { contentImageUrls, serializeContentDocument, serializeAnnouncement } from "@/lib/server/services/content-service";
import { contentWriteApiError } from "@/lib/server/services/content-write-errors";
import { writeAudit } from "@/lib/server/services/system-service";

export async function handleAdminContentResource(method: string, path: string[], request: NextRequest, admin: any) {
  const resource = path[1];
  const id = path[2];
  const action = path[3];

  if (resource === "announcements") {
    const appVersionId = await getActiveAppVersionId();
    if (method === "GET" && !id) {
      const announcements = await prisma.siteAnnouncement.findMany({
        where: { appVersionId },
        include: {
          publishedBy: { include: userInclude },
          _count: { select: { reads: true } }
        },
        orderBy: [{ createdAt: "desc" }]
      });
      return ok({ announcements: announcements.map(serializeAnnouncement) });
    }

    if (method === "POST" && !id) {
      const body = await readBody(request);
      const status = optionalString(body.status) ?? "draft";
      const shouldPublish = status === "published";
      const announcement = await prisma.siteAnnouncement.create({
        data: {
          appVersionId,
          titleZh: assertString(body.titleZh, "titleZh"),
          titleEn: optionalString(body.titleEn),
          bodyZh: assertString(body.bodyZh, "bodyZh"),
          bodyEn: optionalString(body.bodyEn),
          audience: optionalString(body.audience) ?? "all",
          priority: Number(body.priority ?? 0) || 0,
          startsAt: optionalString(body.startsAt) ? new Date(assertString(body.startsAt, "startsAt")) : null,
          endsAt: optionalString(body.endsAt) ? new Date(assertString(body.endsAt, "endsAt")) : null,
          status: shouldPublish ? "published" : "draft",
          publishedAt: shouldPublish ? new Date() : null,
          publishedByUserId: shouldPublish ? admin.id : null
        },
        include: { publishedBy: { include: userInclude }, _count: { select: { reads: true } } }
      });
      await writeAudit(admin.id, "admin.announcements.create", "SiteAnnouncement", announcement.id, null, announcement);
      return created({ announcement: serializeAnnouncement(announcement), message: shouldPublish ? "公告已创建并发布。" : "公告草稿已创建。" });
    }

    if (method === "PATCH" && id) {
      const body = await readBody(request);
      const before = await prisma.siteAnnouncement.findUnique({ where: { id } });
      if (!before || before.appVersionId !== appVersionId) throw new ApiError(404, "找不到这条公告。");
      const announcement = await prisma.siteAnnouncement.update({
        where: { id },
        data: {
          titleZh: optionalString(body.titleZh) ?? before.titleZh,
          titleEn: Object.prototype.hasOwnProperty.call(body, "titleEn") ? optionalString(body.titleEn) : before.titleEn,
          bodyZh: optionalString(body.bodyZh) ?? before.bodyZh,
          bodyEn: Object.prototype.hasOwnProperty.call(body, "bodyEn") ? optionalString(body.bodyEn) : before.bodyEn,
          audience: optionalString(body.audience) ?? before.audience,
          priority: Object.prototype.hasOwnProperty.call(body, "priority") ? Number(body.priority ?? 0) || 0 : before.priority,
          startsAt: Object.prototype.hasOwnProperty.call(body, "startsAt") ? (optionalString(body.startsAt) ? new Date(assertString(body.startsAt, "startsAt")) : null) : before.startsAt,
          endsAt: Object.prototype.hasOwnProperty.call(body, "endsAt") ? (optionalString(body.endsAt) ? new Date(assertString(body.endsAt, "endsAt")) : null) : before.endsAt
        },
        include: { publishedBy: { include: userInclude }, _count: { select: { reads: true } } }
      });
      await writeAudit(admin.id, "admin.announcements.patch", "SiteAnnouncement", id, before, announcement);
      return ok({ announcement: serializeAnnouncement(announcement), message: "公告已更新。" });
    }

    if (method === "POST" && id && action === "publish") {
      const before = await prisma.siteAnnouncement.findUnique({ where: { id } });
      if (!before || before.appVersionId !== appVersionId) throw new ApiError(404, "找不到这条公告。");
      const announcement = await prisma.siteAnnouncement.update({
        where: { id },
        data: {
          status: "published",
          publishedAt: before.publishedAt ?? new Date(),
          publishedByUserId: admin.id,
          archivedAt: null
        },
        include: { publishedBy: { include: userInclude }, _count: { select: { reads: true } } }
      });
      await writeAudit(admin.id, "admin.announcements.publish", "SiteAnnouncement", id, before, announcement);
      return ok({ announcement: serializeAnnouncement(announcement), message: "公告已发布给所有用户。" });
    }

    if (method === "POST" && id && action === "archive") {
      const before = await prisma.siteAnnouncement.findUnique({ where: { id } });
      if (!before || before.appVersionId !== appVersionId) throw new ApiError(404, "找不到这条公告。");
      const announcement = await prisma.siteAnnouncement.update({
        where: { id },
        data: { status: "archived", archivedAt: new Date() },
        include: { publishedBy: { include: userInclude }, _count: { select: { reads: true } } }
      });
      await writeAudit(admin.id, "admin.announcements.archive", "SiteAnnouncement", id, before, announcement);
      return ok({ announcement: serializeAnnouncement(announcement), message: "公告已归档。" });
    }
  }

  if (resource === "content") {
    const appVersionId = await getActiveAppVersionId();
    if (method === "GET" && !id) {
      const kind = request.nextUrl.searchParams.get("kind") ?? undefined;
      const documents = await prisma.contentDocument.findMany({
        where: {
          appVersionId,
          ...(kind ? { kind } : {})
        },
        orderBy: [{ kind: "asc" }, { displayOrder: "asc" }, { updatedAt: "desc" }]
      });
      return ok({ documents: documents.map((document) => serializeContentDocument({ ...document, children: [] })) });
    }

    if (method === "POST" && !id) {
      const body = await readBody(request);
      const kind = optionalString(body.kind) ?? "help";
      if (!["help", "developer_log", "developer_contact"].includes(kind)) throw new ApiError(400, "内容类型无效。");
      const imageUrls = contentImageUrls(body.imageUrls);
      if (kind === "developer_log" && imageUrls.length > 3) throw new ApiError(400, "开发者日志最多支持 3 张图片。");
      const status = optionalString(body.status) ?? "draft";
      const parentId = await resolveContentParentId({
        appVersionId,
        kind,
        parentId: optionalString(body.parentId)
      });
      try {
        const document = await prisma.contentDocument.create({
          data: {
            appVersionId,
            kind,
            nodeType: optionalString(body.nodeType) === "folder" ? "folder" : "document",
            parentId,
            slug: optionalString(body.slug) ?? `${kind}-${Date.now()}`,
            title: assertString(body.title, "title"),
            summary: optionalString(body.summary),
            bodyMarkdown: optionalString(body.bodyMarkdown) ?? "",
            imageUrls,
            status,
            displayOrder: Number(body.displayOrder ?? 0) || 0,
            publishedAt: status === "published" ? new Date() : null,
            updatedByUserId: admin.id
          }
        });
        await writeAudit(admin.id, "admin.content.create", "ContentDocument", document.id, null, document);
        return created({ document: serializeContentDocument({ ...document, children: [] }), message: status === "published" ? "文档已发布。" : "文档草稿已创建。" });
      } catch (error) {
        throw contentWriteApiError(error) ?? error;
      }
    }

    if (method === "PATCH" && id) {
      const body = await readBody(request);
      const before = await prisma.contentDocument.findUnique({ where: { id } });
      if (!before || before.appVersionId !== appVersionId) throw new ApiError(404, "找不到这篇文档。");
      const status = optionalString(body.status) ?? before.status;
      const nextImageUrls = Object.prototype.hasOwnProperty.call(body, "imageUrls") ? contentImageUrls(body.imageUrls) : contentImageUrls(before.imageUrls);
      if ((optionalString(body.kind) ?? before.kind) === "developer_log" && nextImageUrls.length > 3) throw new ApiError(400, "开发者日志最多支持 3 张图片。");
      const nextKind = optionalString(body.kind) ?? before.kind;
      const parentId = Object.prototype.hasOwnProperty.call(body, "parentId")
        ? await resolveContentParentId({ appVersionId, kind: nextKind, parentId: optionalString(body.parentId), selfId: before.id })
        : before.parentId;
      try {
        const document = await prisma.contentDocument.update({
          where: { id },
          data: {
            kind: nextKind,
            nodeType: optionalString(body.nodeType) === "folder" ? "folder" : optionalString(body.nodeType) === "document" ? "document" : before.nodeType,
            parentId,
            slug: optionalString(body.slug) ?? before.slug,
            title: optionalString(body.title) ?? before.title,
            summary: Object.prototype.hasOwnProperty.call(body, "summary") ? optionalString(body.summary) : before.summary,
            bodyMarkdown: Object.prototype.hasOwnProperty.call(body, "bodyMarkdown") ? optionalString(body.bodyMarkdown) ?? "" : before.bodyMarkdown,
            imageUrls: nextImageUrls,
            status,
            displayOrder: Object.prototype.hasOwnProperty.call(body, "displayOrder") ? Number(body.displayOrder ?? 0) || 0 : before.displayOrder,
            publishedAt: status === "published" ? before.publishedAt ?? new Date() : before.publishedAt,
            updatedByUserId: admin.id
          }
        });
        await writeAudit(admin.id, "admin.content.patch", "ContentDocument", id, before, document);
        return ok({ document: serializeContentDocument({ ...document, children: [] }), message: "文档已更新。" });
      } catch (error) {
        throw contentWriteApiError(error) ?? error;
      }
    }

    if (method === "DELETE" && id) {
      const before = await prisma.contentDocument.findUnique({ where: { id } });
      if (!before || before.appVersionId !== appVersionId) throw new ApiError(404, "找不到这篇文档。");
      await prisma.contentDocument.delete({ where: { id } });
      await writeAudit(admin.id, "admin.content.delete", "ContentDocument", id, before, null);
      return ok({ message: "文档已删除。" });
    }
  }

  return null;
}

async function resolveContentParentId(input: { appVersionId: string; kind: string; parentId?: string; selfId?: string }) {
  if (!input.parentId) return null;
  if (input.parentId === input.selfId) throw new ApiError(400, "内容不能把自己设为父级。");
  const parent = await prisma.contentDocument.findUnique({ where: { id: input.parentId } });
  if (!parent || parent.appVersionId !== input.appVersionId || parent.kind !== input.kind) {
    throw new ApiError(400, "父级文件夹不存在或不属于当前内容类型。");
  }
  if (parent.nodeType !== "folder") {
    throw new ApiError(400, "父级必须是分类文件夹，不能挂在普通文档下面。");
  }
  return parent.id;
}
