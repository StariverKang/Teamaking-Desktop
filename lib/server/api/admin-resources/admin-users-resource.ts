import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, assertString, created, ok, optionalString, readBody } from "@/lib/http";
import { ERROR_CODES } from "@/lib/error-codes";
import { isAdminRole } from "@/lib/session";
import { getActiveAppVersionId } from "@/lib/app-version";
import { userInclude, publicUser } from "@/lib/server/services/user-service";
import { writeAudit } from "@/lib/server/services/system-service";
import { passwordHashFor } from "@/lib/server/services/auth-service";

export async function handleAdminAdminUsersResource(method: string, path: string[], request: NextRequest, admin: any) {
  const resource = path[1];
  const id = path[2];

  if (resource === "admin-users") {
    if (admin.role !== "super_admin") {
      throw new ApiError(403, "只有 super_admin 可以维护管理员账号。", ERROR_CODES.AUTH_ADMIN_LOGIN_REQUIRED);
    }

    if (method === "GET" && !id) {
      const appVersionId = await getActiveAppVersionId();
      const users = await prisma.user.findMany({
        where: { appVersionId, role: { in: ["course_moderator", "school_admin", "super_admin"] } },
        include: userInclude,
        orderBy: { createdAt: "desc" }
      });
      return ok({ adminUsers: users.map((user) => publicUser(user)) });
    }

    if (method === "POST" && !id) {
      const body = await readBody(request);
      const appVersionId = await getActiveAppVersionId();
      const email = assertString(body.email, "email").toLowerCase();
      const role = optionalString(body.role) ?? "school_admin";
      if (!isAdminRole(role)) throw new ApiError(400, "管理员角色无效。", ERROR_CODES.AUTH_ADMIN_LOGIN_REQUIRED, { role });
      const password = assertString(body.password, "password");
      const user = await prisma.user.upsert({
        where: { appVersionId_email: { appVersionId, email } },
        update: {
          role,
          passwordHash: passwordHashFor(password),
          status: "active",
          suspendedUntil: null,
          isEmailVerified: true,
          onboardingCompleted: true
        },
        create: {
          appVersionId,
          email,
          role,
          passwordHash: passwordHashFor(password),
          status: "active",
          isEmailVerified: true,
          onboardingCompleted: true
        },
        include: userInclude
      });
      await prisma.userProfile.upsert({
        where: { userId: user.id },
        update: { displayName: optionalString(body.displayName) ?? user.profile?.displayName ?? email.split("@")[0] },
        create: { userId: user.id, displayName: optionalString(body.displayName) ?? email.split("@")[0] }
      });
      await writeAudit(admin.id, "admin.admin_users.create", "User", user.id, null, { email, role });
      return created({ adminUser: publicUser(user), message: "管理员账号已创建或更新。" });
    }

    if (method === "PATCH" && id) {
      const body = await readBody(request);
      const before = await prisma.user.findUnique({ where: { id }, include: userInclude });
      if (!before || !isAdminRole(before.role)) throw new ApiError(404, "找不到这个管理员账号。");
      const role = optionalString(body.role);
      if (role && !isAdminRole(role)) throw new ApiError(400, "管理员角色无效。", ERROR_CODES.AUTH_ADMIN_LOGIN_REQUIRED, { role });
      const password = optionalString(body.password);
      const user = await prisma.user.update({
        where: { id },
        data: {
          ...(role ? { role } : {}),
          ...(password ? { passwordHash: passwordHashFor(password) } : {}),
          status: optionalString(body.status) ?? before.status,
          suspendedUntil: optionalString(body.suspendedUntil) ? new Date(assertString(body.suspendedUntil, "suspendedUntil")) : before.suspendedUntil
        },
        include: userInclude
      });
      if (optionalString(body.displayName)) {
        await prisma.userProfile.upsert({
          where: { userId: user.id },
          update: { displayName: assertString(body.displayName, "displayName") },
          create: { userId: user.id, displayName: assertString(body.displayName, "displayName") }
        });
      }
      await writeAudit(admin.id, "admin.admin_users.patch", "User", id, before, { id, role, status: user.status, passwordChanged: Boolean(password) });
      return ok({ adminUser: publicUser(user), message: "管理员账号已更新。" });
    }
  }

  return null;
}
