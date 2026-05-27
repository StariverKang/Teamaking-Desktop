import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertString, created, ok, optionalString, readBody } from "@/lib/http";
import { writeAudit } from "@/lib/server/services/system-service";

export async function handleAdminBoardsResource(method: string, path: string[], request: NextRequest, admin: any) {
  const resource = path[1];
  const id = path[2];

  if (method === "GET" && resource === "boards") {
    const [boards, offerings] = await Promise.all([
      prisma.courseBoard.findMany({
        include: { courseOffering: { include: { course: true, semester: true } }, memberships: true },
        orderBy: { createdAt: "desc" }
      }),
      prisma.courseOffering.findMany({
        where: { status: "active" },
        include: { course: true, semester: true, boards: true },
        orderBy: [{ updatedAt: "desc" }]
      })
    ]);
    return ok({ boards, offerings });
  }

  if (method === "POST" && resource === "boards") {
    const body = await readBody(request);
    const board = await prisma.courseBoard.create({
      data: {
        courseOfferingId: assertString(body.courseOfferingId, "courseOfferingId"),
        title: assertString(body.title, "title"),
        status: optionalString(body.status) ?? "active",
        rules: optionalString(body.rules) ?? undefined
      },
      include: { courseOffering: { include: { course: true, semester: true } } }
    });
    await writeAudit(admin.id, "admin.boards.create", "CourseBoard", board.id, null, board);
    return created({ board });
  }

  if (method === "PATCH" && resource === "boards" && id) {
    const body = await readBody(request);
    const before = await prisma.courseBoard.findUnique({ where: { id } });
    const board = await prisma.courseBoard.update({
      where: { id },
      data: {
        title: optionalString(body.title) ?? before?.title,
        status: optionalString(body.status) ?? before?.status,
        rules: optionalString(body.rules) ?? before?.rules
      }
    });
    await writeAudit(admin.id, "admin.boards.patch", "CourseBoard", id, before, board);
    return ok({ board });
  }

  return null;
}
