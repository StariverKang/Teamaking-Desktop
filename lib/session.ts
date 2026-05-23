import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/http";
import { DEMO_SESSION_PREFIX, demoUserForAccount, isDemoAccessEnabled } from "@/lib/demo-data";

export const SESSION_COOKIE = "teamaking_session";

export function setSessionCookie(response: NextResponse, userId: string) {
  response.cookies.set(SESSION_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
}

export function setDemoSessionCookie(response: NextResponse, account: string) {
  response.cookies.set(SESSION_COOKIE, `${DEMO_SESSION_PREFIX}${account}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });
}

export async function getCurrentUser() {
  const userId = cookies().get(SESSION_COOKIE)?.value;
  if (!userId) return null;

  if (userId.startsWith(DEMO_SESSION_PREFIX)) {
    if (!isDemoAccessEnabled()) return null;
    return demoUserForAccount(userId.slice(DEMO_SESSION_PREFIX.length));
  }

  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      school: true,
      profile: { include: { faculty: true, major: true } },
      contactInfo: true,
      skills: { include: { skill: true } }
    }
  });
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new ApiError(401, "请先完成学校邮箱登录。");
  }

  return user;
}

export function isAdminRole(role: string) {
  return ["course_moderator", "school_admin", "super_admin"].includes(role);
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!isAdminRole(user.role)) {
    throw new ApiError(403, "当前账号没有管理后台权限。");
  }

  return user;
}
