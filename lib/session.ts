import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/http";
import { ERROR_CODES } from "@/lib/error-codes";
import { DEMO_SESSION_PREFIX, demoUserForAccount, isDemoAccessEnabled } from "@/lib/demo-data";

export const SESSION_COOKIE = "teamaking_session";

function sessionCookieDomain() {
  return (process.env.SESSION_COOKIE_DOMAIN ?? "").trim() || undefined;
}

export function setSessionCookie(response: NextResponse, userId: string) {
  response.cookies.set(SESSION_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    ...(sessionCookieDomain() ? { domain: sessionCookieDomain(), secure: true } : {}),
    maxAge: 60 * 60 * 24 * 30
  });
}

export function setDemoSessionCookie(response: NextResponse, account: string) {
  response.cookies.set(SESSION_COOKIE, `${DEMO_SESSION_PREFIX}${account}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    ...(sessionCookieDomain() ? { domain: sessionCookieDomain(), secure: true } : {}),
    maxAge: 60 * 60 * 24 * 7
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    ...(sessionCookieDomain() ? { domain: sessionCookieDomain(), secure: true } : {}),
    maxAge: 0
  });
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const userId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!userId) return null;

  if (userId.startsWith(DEMO_SESSION_PREFIX)) {
    if (!isDemoAccessEnabled()) return null;
    return demoUserForAccount(userId.slice(DEMO_SESSION_PREFIX.length));
  }

  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      appVersion: true,
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
    throw new ApiError(401, "请先完成学校邮箱登录。", ERROR_CODES.API_UNAUTHORIZED);
  }
  if ("status" in user && user.status === "banned") {
    throw new ApiError(403, "这个账号已被封禁，请联系管理员。", ERROR_CODES.AUTH_ACCOUNT_RESTRICTED);
  }
  if ("suspendedUntil" in user && user.suspendedUntil && new Date(user.suspendedUntil).getTime() > Date.now()) {
    throw new ApiError(403, "这个账号当前处于限时禁止操作状态，请稍后再试。", ERROR_CODES.AUTH_ACCOUNT_RESTRICTED);
  }

  return user;
}

export function isAdminRole(role: string) {
  return ["course_moderator", "school_admin", "super_admin"].includes(role);
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!isAdminRole(user.role)) {
    throw new ApiError(403, "当前账号没有管理后台权限。", ERROR_CODES.AUTH_ADMIN_LOGIN_REQUIRED);
  }

  return user;
}
