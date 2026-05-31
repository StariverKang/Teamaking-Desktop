
import { prisma } from "@/lib/prisma";import { ApiError } from "@/lib/http";
import { ERROR_CODES } from "@/lib/error-codes";
import { isAdminRole } from "@/lib/session";

import { sendVerificationEmail } from "@/lib/email";
import { hashPassword } from "@/lib/password";import { defaultContactVisibility } from "@/lib/contact";

import { getActiveAppVersionId } from "@/lib/app-version";
import { toJson } from "@/lib/server/services/system-service";
import { emailDomain, userInclude } from "@/lib/server/services/user-service";
import { isDesktopRuntime } from "@/lib/server/runtime-paths";

export async function upsertVerifiedUser(input: {
  email: string;
  schoolId: string;
  role?: string;
  onboardingCompleted?: boolean;
  displayName?: string;
  passwordHash?: string;
}) {
  const appVersionId = await getActiveAppVersionId();
  const user = await prisma.user.upsert({
    where: { appVersionId_email: { appVersionId, email: input.email } },
    update: {
      schoolId: input.schoolId,
      ...(input.role ? { role: input.role } : {}),
      ...(input.passwordHash ? { passwordHash: input.passwordHash } : {}),
      status: "active",
      suspendedUntil: null,
      isEmailVerified: true,
      ...(input.onboardingCompleted !== undefined ? { onboardingCompleted: input.onboardingCompleted } : {})
    },
    create: {
      appVersionId,
      email: input.email,
      schoolId: input.schoolId,
      passwordHash: input.passwordHash,
      isEmailVerified: true,
      onboardingCompleted: input.onboardingCompleted ?? false,
      role: input.role ?? "verified_user"
    }
  });

  await prisma.userProfile.upsert({
    where: { userId: user.id },
    update: input.displayName ? { displayName: input.displayName } : {},
    create: {
      userId: user.id,
      displayName: input.displayName ?? input.email.split("@")[0],
      visibilitySettings: {
        profile: "same_school",
        portfolio: "same_school"
      }
    }
  });

  await prisma.contactInfo.upsert({
    where: { userId: user.id },
    update: { schoolEmail: user.email },
    create: {
      userId: user.id,
      schoolEmail: user.email,
      visibilitySettings: defaultContactVisibility
    }
  });

  return prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    include: userInclude
  });
}

export type VerificationPurpose = "register" | "reset_password" | "login";

export async function supportedSchoolDomainForEmail(email: string) {
  const domain = emailDomain(email);
  if (!domain) return null;
  const appVersionId = await getActiveAppVersionId();
  const existing = await prisma.schoolEmailDomain.findFirst({
    where: { domain, status: "active", school: { appVersionId } },
    include: { school: true }
  });
  if (existing || !isDesktopRuntime()) return existing;

  const school = await prisma.school.upsert({
    where: { appVersionId_shortName: { appVersionId, shortName: "LOCAL" } },
    update: { name: "Local Workspace", status: "active" },
    create: {
      appVersionId,
      name: "Local Workspace",
      shortName: "LOCAL",
      status: "active"
    }
  });

  return prisma.schoolEmailDomain.upsert({
    where: { schoolId_domain: { schoolId: school.id, domain } },
    update: { status: "active" },
    create: { schoolId: school.id, domain, status: "active" },
    include: { school: true }
  });
}

export function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function recordAuthEvent(input: {
  email: string;
  action: string;
  purpose: string;
  success: boolean;
  metadata?: unknown;
}) {
  await prisma.authEvent.create({
    data: {
      appVersionId: await getActiveAppVersionId(),
      email: input.email.toLowerCase(),
      action: input.action,
      purpose: input.purpose,
      success: input.success,
      metadata: toJson(input.metadata ?? {})
    }
  });
}

export async function assertVerificationCooldown(email: string, purpose: VerificationPurpose) {
  const appVersionId = await getActiveAppVersionId();
  const since = new Date(Date.now() - 2 * 60 * 1000);
  const recent = await prisma.authEvent.findFirst({
    where: {
      appVersionId,
      email: email.toLowerCase(),
      action: "verification_send",
      purpose,
      success: true,
      createdAt: { gt: since }
    },
    orderBy: { createdAt: "desc" }
  });

  if (recent) {
    throw new ApiError(429, "同一邮箱发送验证码后需要等待 2 分钟。", ERROR_CODES.AUTH_VERIFICATION_COOLDOWN, {
      email,
      purpose,
      retryAfterSeconds: Math.max(1, Math.ceil((recent.createdAt.getTime() + 2 * 60 * 1000 - Date.now()) / 1000))
    });
  }
}

export async function createVerification(email: string, purpose: VerificationPurpose, schoolName?: string) {
  await assertVerificationCooldown(email, purpose);
  const code = generateVerificationCode();
  const appVersionId = await getActiveAppVersionId();
  await prisma.emailVerification.create({
    data: {
      appVersionId,
      email,
      code,
      purpose,
      expiresAt: new Date(Date.now() + 1000 * 60 * 10)
    }
  });

  await sendVerificationEmail({
    email,
    code,
    purpose,
    schoolName
  });
  await recordAuthEvent({ email, action: "verification_send", purpose, success: true, metadata: { schoolName } });

  return code;
}

export async function consumeVerification(email: string, code: string, purpose: VerificationPurpose) {
  const appVersionId = await getActiveAppVersionId();
  const verification = await prisma.emailVerification.findFirst({
    where: {
      appVersionId,
      email,
      code,
      purpose,
      usedAt: null,
      expiresAt: { gt: new Date() }
    },
    orderBy: { createdAt: "desc" }
  });

  if (!verification) {
    throw new ApiError(400, "验证码无效或已过期。", ERROR_CODES.AUTH_VERIFICATION_INVALID, { email, purpose });
  }

  await prisma.emailVerification.update({
    where: { id: verification.id },
    data: { usedAt: new Date() }
  });
}

export function passwordHashFor(password: string) {
  try {
    return hashPassword(password);
  } catch (error) {
    throw new ApiError(400, error instanceof Error ? error.message : "密码不符合要求。");
  }
}

export type BootstrapAdminConfig = {
  email: string;
  password: string;
  role: string;
  displayName: string;
};

export function bootstrapAdminConfig(): BootstrapAdminConfig | null {
  const email = (process.env.ADMIN_BOOTSTRAP_EMAIL || process.env.DEVELOPER_LOGIN_EMAIL || "").trim().toLowerCase();
  const password = (process.env.ADMIN_BOOTSTRAP_PASSWORD || process.env.DEVELOPER_LOGIN_PASSWORD || "").trim();
  if (!email || !password) return null;

  const configuredRole = (process.env.ADMIN_BOOTSTRAP_ROLE || process.env.DEVELOPER_LOGIN_ROLE || "super_admin").trim();
  const role = isAdminRole(configuredRole) ? configuredRole : "super_admin";
  const displayName =
    (process.env.ADMIN_BOOTSTRAP_DISPLAY_NAME || process.env.DEVELOPER_LOGIN_DISPLAY_NAME || "").trim() ||
    email.split("@")[0] ||
    "TEAMAKING Admin";

  return { email, password, role, displayName };
}

export async function upsertBootstrapAdmin(config: BootstrapAdminConfig) {
  const appVersionId = await getActiveAppVersionId();
  const user = await prisma.user.upsert({
    where: { appVersionId_email: { appVersionId, email: config.email } },
    update: {
      role: config.role,
      passwordHash: passwordHashFor(config.password),
      status: "active",
      suspendedUntil: null,
      isEmailVerified: true,
      onboardingCompleted: true,
      adminNote: "Managed by ADMIN_BOOTSTRAP_* environment variables."
    },
    create: {
      appVersionId,
      email: config.email,
      role: config.role,
      passwordHash: passwordHashFor(config.password),
      status: "active",
      isEmailVerified: true,
      onboardingCompleted: true,
      adminNote: "Managed by ADMIN_BOOTSTRAP_* environment variables."
    }
  });

  await prisma.userProfile.upsert({
    where: { userId: user.id },
    update: { displayName: config.displayName },
    create: { userId: user.id, displayName: config.displayName }
  });

  return prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    include: userInclude
  });
}

export function assertAccountCanLogin(user: any) {
  if (user.status === "banned") {
    throw new ApiError(403, "这个账号已被封禁，请联系管理员。", ERROR_CODES.AUTH_ACCOUNT_RESTRICTED);
  }

  if (user.suspendedUntil && new Date(user.suspendedUntil).getTime() > Date.now()) {
    throw new ApiError(403, "这个账号当前处于限时禁止操作状态，请稍后再试。", ERROR_CODES.AUTH_ACCOUNT_RESTRICTED);
  }
}

export function restrictedAccountRedirect(user: any) {
  if (user.status === "banned") return "/account-restricted";
  if (user.suspendedUntil && new Date(user.suspendedUntil).getTime() > Date.now()) return "/account-restricted";
  return null;
}

export async function assertLoginFailureBudget(email: string) {
  const appVersionId = await getActiveAppVersionId();
  const failedAttempts = await prisma.authEvent.count({
    where: {
      appVersionId,
      email: email.toLowerCase(),
      action: "password_login",
      purpose: "login",
      success: false,
      createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) }
    }
  });

  if (failedAttempts >= 5) {
    throw new ApiError(429, "这个邮箱 1 小时内登录失败次数过多，请稍后再试。", ERROR_CODES.AUTH_LOGIN_RATE_LIMIT, {
      email,
      failedAttempts,
      windowMinutes: 60
    });
  }
}
