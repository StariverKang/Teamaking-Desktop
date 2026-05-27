import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, ok, optionalString, readBody } from "@/lib/http";
import { writeAudit } from "@/lib/server/services/system-service";

export async function handleAdminSupportTicketsResource(method: string, path: string[], request: NextRequest, admin: any) {
  const resource = path[1];
  const id = path[2];

  if (method === "GET" && resource === "support-tickets") {
    const query = (request.nextUrl.searchParams.get("query") ?? "").trim().toLowerCase();
    const status = request.nextUrl.searchParams.get("status") ?? "all";
    const category = request.nextUrl.searchParams.get("category") ?? "all";
    const tickets = await prisma.supportTicket.findMany({
      include: { submittedBy: { include: { profile: true } } },
      orderBy: { createdAt: "desc" }
    });
    const filtered = tickets.filter((ticket) => {
      const matchesStatus = status === "all" || ticket.status === status;
      const matchesCategory = category === "all" || ticket.category === category;
      const haystack = [
        ticket.id,
        ticket.email,
        ticket.category,
        ticket.title,
        ticket.description,
        ticket.relatedUrl,
        ticket.adminNote,
        ticket.adminReply,
        ticket.submittedBy?.email,
        ticket.submittedBy?.profile?.displayName
      ].filter(Boolean).join(" ").toLowerCase();
      return matchesStatus && matchesCategory && (!query || haystack.includes(query));
    });
    const countBy = (field: "status" | "category") => tickets.reduce<Record<string, number>>((acc, ticket) => {
      const key = ticket[field] || "unknown";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
    return ok({
      tickets: filtered,
      summary: {
        total: tickets.length,
        visible: filtered.length,
        byStatus: countBy("status"),
        byCategory: countBy("category")
      }
    });
  }

  if (method === "PATCH" && resource === "support-tickets" && id) {
    const body = await readBody(request);
    const before = await prisma.supportTicket.findUnique({ where: { id } });
    if (!before) throw new ApiError(404, "找不到这个工单。");

    const allowedStatuses = ["open", "in_progress", "resolved", "closed"];
    const requestedStatus = optionalString(body.status);
    const ticket = await prisma.supportTicket.update({
      where: { id },
      data: {
        status: requestedStatus && allowedStatuses.includes(requestedStatus) ? requestedStatus : before.status,
        adminNote: optionalString(body.adminNote) ?? before.adminNote,
        adminReply: optionalString(body.adminReply) ?? before.adminReply,
        adminRepliedAt: optionalString(body.adminReply) ? new Date() : before.adminRepliedAt
      }
    });
    await writeAudit(admin.id, "admin.support_tickets.patch", "SupportTicket", id, before, ticket);
    return ok({ ticket });
  }

  return null;
}
