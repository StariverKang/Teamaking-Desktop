import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";import { ApiError, ok, optionalString, readBody } from "@/lib/http";
import { getActiveAppVersionId } from "@/lib/app-version";
import { adminUserInclude, gradeFromEntryYear } from "@/lib/server/services/user-service";
import { writeAudit } from "@/lib/server/services/system-service";

export async function handleAdminUsersResource(method: string, path: string[], request: NextRequest, admin: any) {
  const resource = path[1];
  const id = path[2];
  const action = path[3];

  if (method === "GET" && resource === "users" && !id) {
    const appVersionId = await getActiveAppVersionId();
    const users = await prisma.user.findMany({
      where: { appVersionId },
      include: adminUserInclude,
      orderBy: { createdAt: "desc" },
      take: 100
    });
    return ok({ users });
  }

  if (method === "PATCH" && resource === "users" && id) {
    const body = await readBody(request);
    const before = await prisma.user.findUnique({ where: { id }, include: { profile: true } });
    if (!before) throw new ApiError(404, "找不到这个用户。");
    const requestedStatus = optionalString(body.status);
    const suspendedUntilText = optionalString(body.suspendedUntil);
    const user = await prisma.user.update({
      where: { id },
      data: {
        role: optionalString(body.role) ?? before.role,
        status: requestedStatus ?? before.status,
        suspendedUntil: suspendedUntilText ? new Date(suspendedUntilText) : requestedStatus === "active" ? null : before.suspendedUntil,
        adminNote: optionalString(body.adminNote) ?? before.adminNote,
        onboardingCompleted: typeof body.onboardingCompleted === "boolean" ? body.onboardingCompleted : before.onboardingCompleted
      },
      include: adminUserInclude
    });
    if (
      Object.prototype.hasOwnProperty.call(body, "entryYear") ||
      Object.prototype.hasOwnProperty.call(body, "entryTerm") ||
      Object.prototype.hasOwnProperty.call(body, "grade") ||
      Object.prototype.hasOwnProperty.call(body, "academicOverrideReason")
    ) {
      const entryYear = Number(body.entryYear ?? before.profile?.entryYear);
      const entryTerm = optionalString(body.entryTerm) ?? before.profile?.entryTerm ?? "Fall";
      const grade = optionalString(body.grade) ?? gradeFromEntryYear(Number.isFinite(entryYear) ? entryYear : before.profile?.entryYear) ?? before.profile?.grade ?? null;
      await prisma.userProfile.upsert({
        where: { userId: id },
        update: {
          entryYear: Number.isFinite(entryYear) ? entryYear : before.profile?.entryYear,
          entryTerm,
          grade,
          academicOverrideReason: optionalString(body.academicOverrideReason) ?? "管理员手动覆盖邮箱推断年级",
          academicOverrideByUserId: admin.id,
          academicOverrideAt: new Date()
        },
        create: {
          userId: id,
          displayName: user.profile?.displayName ?? user.email.split("@")[0],
          entryYear: Number.isFinite(entryYear) ? entryYear : null,
          entryTerm,
          grade,
          academicOverrideReason: optionalString(body.academicOverrideReason) ?? "管理员手动覆盖邮箱推断年级",
          academicOverrideByUserId: admin.id,
          academicOverrideAt: new Date()
        }
      });
    }
    await writeAudit(admin.id, "admin.users.patch", "User", id, before, user);
    return ok({ user });
  }

  if (method === "GET" && resource === "users" && id === "logs") {
    const appVersionId = await getActiveAppVersionId();
    const logs = await prisma.operationLog.findMany({
      where: { appVersionId, actorUserId: action },
      include: { actor: { include: { profile: true } } },
      orderBy: { createdAt: "desc" },
      take: 200
    });
    return ok({ logs });
  }

  return null;
}
