import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, assertString, created, ok, optionalString, readBody } from "@/lib/http";
import { ERROR_CODES } from "@/lib/error-codes";
import { getCurrentUser } from "@/lib/session";
import { getActiveAppVersionId } from "@/lib/app-version";
import { isDemoUser } from "@/lib/demo-data";
import { userInclude } from "@/lib/server/services/user-service";
import { serializeContentDocument, defaultDeveloperContactDocument, activeAnnouncementWhere, serializeAnnouncement } from "@/lib/server/services/content-service";
import { operationLog } from "@/lib/server/services/system-service";

export async function handleContent(method: string, request: NextRequest) {
  if (method !== "GET") throw new ApiError(405, "内容接口不支持当前请求方式。");
  const appVersionId = await getActiveAppVersionId();
  const kind = request.nextUrl.searchParams.get("kind") ?? "help";
  const allowed = new Set(["help", "developer_log", "developer_contact"]);
  if (!allowed.has(kind)) throw new ApiError(400, "内容类型无效。");

  const rows = await prisma.contentDocument.findMany({
    where: { appVersionId, kind, status: "published" },
    orderBy: [{ displayOrder: "asc" }, { publishedAt: "desc" }, { createdAt: "desc" }]
  });
  const documents = rows.length || kind !== "developer_contact" ? rows : [defaultDeveloperContactDocument(appVersionId)];
  const byParent = new Map<string | null, any[]>();
  for (const document of documents) {
    const key = document.parentId ?? null;
    byParent.set(key, [...(byParent.get(key) ?? []), document]);
  }
  const attachChildren = (document: any): any => ({ ...document, children: (byParent.get(document.id) ?? []).map(attachChildren) });
  return ok({
    documents: (byParent.get(null) ?? []).map(attachChildren).map(serializeContentDocument),
    flatDocuments: documents.map((document: any) => serializeContentDocument({ ...document, children: [] }))
  });
}

export async function handleSupportTickets(method: string, request: NextRequest) {
  if (method === "GET") {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "请先登录后查看自己的工单。", ERROR_CODES.API_UNAUTHORIZED);
    const tickets = await prisma.supportTicket.findMany({
      where: { submittedByUserId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100
    });
    return ok({ tickets });
  }

  if (method === "POST") {
    let user = null;
    try {
      user = await getCurrentUser();
    } catch {
      user = null;
    }
    const body = await readBody(request);
    const category = optionalString(body.category) ?? "other";
    const allowedCategories = ["bug", "missing_course", "course_config_error", "error_report", "admin_request", "other"];

    const ticketData = {
        submittedByUserId: user?.id,
        email: optionalString(body.email) ?? user?.email,
        category: allowedCategories.includes(category) ? category : "other",
        title: assertString(body.title, "title"),
        description: assertString(body.description, "description"),
        relatedUrl: optionalString(body.relatedUrl),
        status: "open"
    };

    try {
      const ticket = await prisma.supportTicket.create({ data: ticketData });
      await operationLog({
        actorUserId: user?.id ?? null,
        actorRole: user?.role ?? "anonymous",
        action: "support_tickets.create",
        targetType: "SupportTicket",
        targetId: ticket.id,
        method,
        path: request.nextUrl.pathname,
        summary: { category: ticket.category, title: ticket.title }
      });
      return created({ ticket, message: "工单已提交。管理员会在后台处理，缺失课程、bug、报错都走这里。" });
    } catch {
      return created({
        ticket: { id: "demo-ticket-created", ...ticketData },
        message: "当前未连接 PostgreSQL，已模拟提交工单；真实保存需要启动数据库。"
      });
    }

  }

  throw new ApiError(405, "这个工单接口不支持当前请求方式。");
}

export async function handleAnnouncements(method: string, path: string[]) {
  const appVersionId = await getActiveAppVersionId();

  if (method === "GET") {
    const viewer = await getCurrentUser().catch(() => null);
    const announcements = await prisma.siteAnnouncement.findMany({
      where: activeAnnouncementWhere(appVersionId),
      include: {
        publishedBy: { include: userInclude },
        ...(viewer ? { reads: { where: { userId: viewer.id }, take: 1 } } : {}),
        _count: { select: { reads: true } }
      },
      orderBy: [{ priority: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
      take: 50
    });
    return ok({ announcements: announcements.map(serializeAnnouncement) });
  }

  if (method === "POST" && path[1] && path[2] === "read") {
    const user = await getCurrentUser().catch(() => null);
    if (!user || isDemoUser(user)) return ok({ message: "公告已在本地标记为已读。" });
    const announcement = await prisma.siteAnnouncement.findFirst({
      where: { id: path[1], appVersionId, status: "published" }
    });
    if (!announcement) throw new ApiError(404, "找不到这条公告。");
    const read = await prisma.userAnnouncementRead.upsert({
      where: { announcementId_userId: { announcementId: announcement.id, userId: user.id } },
      update: { readAt: new Date(), dismissedAt: new Date() },
      create: { announcementId: announcement.id, userId: user.id, dismissedAt: new Date() }
    });
    await operationLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: "announcements.read",
      targetType: "SiteAnnouncement",
      targetId: announcement.id
    });
    return ok({ read, message: "公告已标记为已读。" });
  }

  throw new ApiError(404, "找不到公告接口。");
}
