import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, assertString, ok, optionalString, readBody } from "@/lib/http";
import { ERROR_CODES } from "@/lib/error-codes";
import { clearSessionCookie, getCurrentUser, isAdminRole, requireUser, setDemoSessionCookie, setSessionCookie } from "@/lib/session";
import { shouldExposeVerificationCode } from "@/lib/email";
import { verifyPassword } from "@/lib/password";
import { defaultContactVisibility } from "@/lib/contact";
import { getActiveAppVersionId } from "@/lib/app-version";
import { filterUserFacingMajors } from "@/lib/academic-options";
import { demoAccounts, demoOnboardingOptions, demoUserForAccount, isDemoAccessEnabled, isDemoUser, normalizeDemoAccount } from "@/lib/demo-data";
import { resetDemoState } from "@/lib/demo-store";
import { userInclude, academicLockForUser, publicUser } from "@/lib/server/services/user-service";
import { operationLog, safeStringEqual } from "@/lib/server/services/system-service";
import { upsertVerifiedUser, supportedSchoolDomainForEmail, recordAuthEvent, createVerification, consumeVerification, passwordHashFor, bootstrapAdminConfig, upsertBootstrapAdmin, assertAccountCanLogin, restrictedAccountRedirect, assertLoginFailureBudget } from "@/lib/server/services/auth-service";
import { defaultOnboardingGuide, onboardingGuideFromConfig } from "@/lib/onboarding-guide";

export async function handleAuth(method: string, path: string[], request: NextRequest) {
  if (method === "POST" && (path[1] === "admin-login" || path[1] === "developer-login")) {
    const body = await readBody(request);
    const email = assertString(body.email, "email").toLowerCase();
    const password = assertString(body.password, "password");
    await assertLoginFailureBudget(email);
    const appVersionId = await getActiveAppVersionId();
    const user = await prisma.user.findUnique({
      where: { appVersionId_email: { appVersionId, email } },
      include: userInclude
    });

    if (!user || !isAdminRole(user.role) || !verifyPassword(password, user.passwordHash)) {
      const bootstrapConfig = bootstrapAdminConfig();
      if (bootstrapConfig && email === bootstrapConfig.email && safeStringEqual(password, bootstrapConfig.password)) {
        const bootstrappedUser = await upsertBootstrapAdmin(bootstrapConfig);
        assertAccountCanLogin(bootstrappedUser);
        await recordAuthEvent({ email, action: "password_login", purpose: "login", success: true, metadata: { route: "admin-bootstrap" } });
        const response = ok({ user: publicUser(bootstrappedUser), message: "管理员账号已按环境变量同步。" });
        setSessionCookie(response, bootstrappedUser.id);
        return response;
      }
      await recordAuthEvent({ email, action: "password_login", purpose: "login", success: false, metadata: { route: "admin-login" } });
      throw new ApiError(401, "管理员账号或密码不正确。", ERROR_CODES.AUTH_ADMIN_LOGIN_INVALID, { email });
    }

    assertAccountCanLogin(user);
    await recordAuthEvent({ email, action: "password_login", purpose: "login", success: true, metadata: { route: "admin-login" } });
    const response = ok({ user: publicUser(user) });
    setSessionCookie(response, user.id);
    return response;
  }

  if (method === "POST" && path[1] === "register" && path[2] === "send-code") {
    const body = await readBody(request);
    const email = assertString(body.email, "email").toLowerCase();
    const appVersionId = await getActiveAppVersionId();
    const schoolDomain = await supportedSchoolDomainForEmail(email);

    if (!schoolDomain) {
      throw new ApiError(400, "当前学校邮箱域名还没有被 TEAMAKING 支持。");
    }

    const existingUser = await prisma.user.findUnique({
      where: { appVersionId_email: { appVersionId, email } },
      select: { id: true, passwordHash: true }
    });

    if (existingUser?.passwordHash) {
      throw new ApiError(409, "这个邮箱已经注册，请直接使用账号密码登录，或通过找回密码重设密码。");
    }

    const code = await createVerification(email, "register", schoolDomain.school.name);

    return ok({
      message: "注册验证码已发送，请查看你的学校邮箱。",
      code: shouldExposeVerificationCode() ? code : undefined,
      school: schoolDomain.school
    });
  }

  if (method === "POST" && path[1] === "register" && path[2] === "complete") {
    const body = await readBody(request);
    const email = assertString(body.email, "email").toLowerCase();
    const appVersionId = await getActiveAppVersionId();
    const code = assertString(body.code, "code");
    const password = assertString(body.password, "password");
    const schoolDomain = await supportedSchoolDomainForEmail(email);

    if (!schoolDomain) {
      throw new ApiError(400, "当前学校邮箱域名还没有被 TEAMAKING 支持。");
    }

    const existingUser = await prisma.user.findUnique({
      where: { appVersionId_email: { appVersionId, email } },
      select: { id: true, passwordHash: true }
    });

    if (existingUser?.passwordHash) {
      throw new ApiError(409, "这个邮箱已经注册，请直接登录。");
    }

    await consumeVerification(email, code, "register");

    const fullUser = await upsertVerifiedUser({
      email,
      schoolId: schoolDomain.schoolId,
      passwordHash: passwordHashFor(password)
    });

    return ok({
      user: publicUser(fullUser),
      redirectPath: "/login",
      message: "注册已完成，请使用刚设置的密码登录。"
    });
  }

  if (method === "POST" && path[1] === "password-login") {
    const body = await readBody(request);
    const email = assertString(body.email, "email").toLowerCase();
    const password = assertString(body.password, "password");
    const appVersionId = await getActiveAppVersionId();
    await assertLoginFailureBudget(email);
    const user = await prisma.user.findUnique({ where: { appVersionId_email: { appVersionId, email } }, include: userInclude });

    if (!user || !verifyPassword(password, user.passwordHash)) {
      await recordAuthEvent({ email, action: "password_login", purpose: "login", success: false });
      throw new ApiError(401, "邮箱或密码不正确。", ERROR_CODES.AUTH_LOGIN_INVALID_CREDENTIALS, { email });
    }

    await recordAuthEvent({ email, action: "password_login", purpose: "login", success: true });
    const redirectPath = restrictedAccountRedirect(user);
    const response = ok({ user: publicUser(user), redirectPath });
    setSessionCookie(response, user.id);
    return response;
  }

  if (method === "POST" && path[1] === "password-reset" && path[2] === "send-code") {
    const body = await readBody(request);
    const email = assertString(body.email, "email").toLowerCase();
    const appVersionId = await getActiveAppVersionId();
    const user = await prisma.user.findUnique({
      where: { appVersionId_email: { appVersionId, email } },
      include: { school: true }
    });

    if (!user || !user.passwordHash) {
      throw new ApiError(404, "找不到已注册账号，请先注册。");
    }

    const code = await createVerification(email, "reset_password", user.school?.name);
    return ok({
      message: "密码重置验证码已发送，请查看你的学校邮箱。",
      code: shouldExposeVerificationCode() ? code : undefined
    });
  }

  if (method === "POST" && path[1] === "password-reset" && path[2] === "complete") {
    const body = await readBody(request);
    const email = assertString(body.email, "email").toLowerCase();
    const appVersionId = await getActiveAppVersionId();
    const code = assertString(body.code, "code");
    const password = assertString(body.password, "password");
    const before = await prisma.user.findUnique({ where: { appVersionId_email: { appVersionId, email } }, include: userInclude });

    if (!before || !before.passwordHash) {
      throw new ApiError(404, "找不到已注册账号，请先注册。");
    }

    await consumeVerification(email, code, "reset_password");

    const user = await prisma.user.update({
      where: { appVersionId_email: { appVersionId, email } },
      data: { passwordHash: passwordHashFor(password) },
      include: userInclude
    });
    assertAccountCanLogin(user);

    const response = ok({ user: publicUser(user) });
    setSessionCookie(response, user.id);
    return response;
  }

  if (method === "GET" && path[1] === "me") {
    let user = null;
    try {
      user = await getCurrentUser();
    } catch {
      user = null;
    }
    return ok({ user: user ? publicUser(user, undefined, { includeMemberships: true }) : null });
  }

  if (method === "POST" && path[1] === "logout") {
    const response = ok({ message: "已退出登录。" });
    clearSessionCookie(response);
    return response;
  }

  throw new ApiError(404, "找不到认证接口。");
}

export async function ensureDemoUser(account: string) {
  const selected = demoAccounts[normalizeDemoAccount(account)];
  const appVersionId = await getActiveAppVersionId();
  const school = await prisma.school.upsert({
    where: { appVersionId_shortName: { appVersionId, shortName: "BNBU" } },
    update: { name: "BNBU", status: "active" },
    create: { appVersionId, name: "BNBU", shortName: "BNBU", status: "active" }
  });

  await prisma.schoolEmailDomain.upsert({
    where: { schoolId_domain: { schoolId: school.id, domain: "mail.bnbu.edu.cn" } },
    update: { schoolId: school.id, status: "active" },
    create: { schoolId: school.id, domain: "mail.bnbu.edu.cn", status: "active" }
  });

  const faculty = await prisma.faculty.upsert({
    where: { schoolId_name: { schoolId: school.id, name: selected.faculty } },
    update: {},
    create: { schoolId: school.id, name: selected.faculty }
  });

  const major = await prisma.major.upsert({
    where: { schoolId_name: { schoolId: school.id, name: selected.major } },
    update: { facultyId: faculty.id },
    create: { schoolId: school.id, facultyId: faculty.id, name: selected.major, degreeType: "undergraduate" }
  });

  const user = await prisma.user.upsert({
    where: { appVersionId_email: { appVersionId, email: selected.email } },
    update: {
      schoolId: school.id,
      role: selected.role,
      isEmailVerified: true,
      onboardingCompleted: true
    },
    create: {
      appVersionId,
      email: selected.email,
      schoolId: school.id,
      role: selected.role,
      isEmailVerified: true,
      onboardingCompleted: true
    }
  });

  await prisma.userProfile.upsert({
    where: { userId: user.id },
    update: {
      displayName: selected.displayName,
      bio: selected.bio,
      grade: selected.grade,
      entryYear: 2025,
      entryTerm: "Fall",
      facultyId: faculty.id,
      majorId: major.id,
      openToBeDiscovered: true
    },
    create: {
      userId: user.id,
      displayName: selected.displayName,
      bio: selected.bio,
      grade: selected.grade,
      entryYear: 2025,
      entryTerm: "Fall",
      facultyId: faculty.id,
      majorId: major.id,
      openToBeDiscovered: true,
      visibilitySettings: { profile: "same_school", portfolio: "same_school" }
    }
  });

  await prisma.contactInfo.upsert({
    where: { userId: user.id },
    update: { schoolEmail: selected.email },
    create: {
      userId: user.id,
      schoolEmail: selected.email,
      wechatId: `${account}_teamaking_demo`,
      visibilitySettings: defaultContactVisibility
    }
  });

  const fullUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, include: userInclude });
  return { user: fullUser, redirectPath: selected.redirectPath };
}

export async function handleDemo(method: string, path: string[], request: NextRequest) {
  if (method === "POST" && path[1] === "reset") {
    if (!isDemoAccessEnabled()) throw new ApiError(403, "生产环境不允许重置 demo state。");
    return ok({ state: resetDemoState(), message: "本地共享 demo state 已重置。" });
  }

  if (method === "POST" && path[1] === "login") {
    if (!isDemoAccessEnabled()) {
      throw new ApiError(403, "生产环境未开启演示访问。");
    }

    const body = await readBody(request);
    const account = normalizeDemoAccount(optionalString(body.account));
    try {
      const demo = await ensureDemoUser(account);
      const response = ok({ user: publicUser(demo.user), redirectPath: demo.redirectPath, mode: "database" });
      setSessionCookie(response, demo.user.id);
      return response;
    } catch {
      const user = demoUserForAccount(account);
      const response = ok({
        user: publicUser(user),
        redirectPath: demoAccounts[account].redirectPath,
        mode: "local_visual_demo",
        message: "当前未连接 PostgreSQL，已进入本地视觉演示模式；真实数据写入需要启动数据库。"
      });
      setDemoSessionCookie(response, account);
      return response;
    }
  }

  throw new ApiError(404, "找不到演示访问接口。");
}

export async function handleOnboarding(method: string, path: string[], request: NextRequest) {
  const user = await requireUser();

  if (isDemoUser(user)) {
    if (method === "GET") {
      return ok({ user: publicUser(user), academicLock: academicLockForUser(user), guide: defaultOnboardingGuide, ...demoOnboardingOptions() });
    }
    if (method === "POST" && path[1] === "tour-dismiss") return ok({ message: "本地视觉演示模式已模拟关闭新手引导。" });
    if (method === "POST" && path[1] === "tour-reset") return ok({ message: "本地视觉演示模式已模拟重启新手引导。" });
    if (method === "POST") {
      return ok({ profile: user.profile, message: "本地视觉演示模式已模拟保存 onboarding。" });
    }
  }

  if (method === "POST" && path[1] === "tour-dismiss") {
    const profile = await prisma.userProfile.upsert({
      where: { userId: user.id },
      update: { onboardingTourDismissedAt: new Date() },
      create: {
        userId: user.id,
        displayName: user.email.split("@")[0],
        onboardingTourDismissedAt: new Date()
      }
    });
    await operationLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: "onboarding.tour.dismiss",
      targetType: "UserProfile",
      targetId: profile.id,
      method,
      path: request.nextUrl.pathname
    });
    return ok({ profile, message: "新手引导已关闭。" });
  }

  if (method === "POST" && path[1] === "tour-reset") {
    const profile = await prisma.userProfile.upsert({
      where: { userId: user.id },
      update: { onboardingTourDismissedAt: null },
      create: {
        userId: user.id,
        displayName: user.email.split("@")[0],
        onboardingTourDismissedAt: null
      }
    });
    await operationLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: "onboarding.tour.reset",
      targetType: "UserProfile",
      targetId: profile.id,
      method,
      path: request.nextUrl.pathname
    });
    return ok({ profile, message: "新手引导已重置，可以重新查看。" });
  }

  if (method === "GET") {
    const [faculties, rawMajors, semesters, guideConfig] = await Promise.all([
      prisma.faculty.findMany({ where: { schoolId: user.schoolId ?? undefined }, orderBy: { name: "asc" } }),
      prisma.major.findMany({ where: { schoolId: user.schoolId ?? undefined }, include: { faculty: true }, orderBy: { name: "asc" } }),
      prisma.semester.findMany({ where: { schoolId: user.schoolId ?? undefined }, orderBy: [{ year: "desc" }, { term: "asc" }] }),
      prisma.siteConfig.findUnique({ where: { key: "onboarding_guide" } })
    ]);
    const majors = filterUserFacingMajors(rawMajors);

    return ok({ user: publicUser(user), academicLock: academicLockForUser(user), faculties, majors, semesters, guide: onboardingGuideFromConfig(guideConfig?.value) });
  }

  if (method === "POST") {
    const body = await readBody(request);
    const academic = academicLockForUser(user);
    const grade = academic.grade ?? assertString(body.grade, "grade");
    const facultyId = assertString(body.facultyId, "facultyId");
    const majorId = assertString(body.majorId, "majorId");
    const displayName = optionalString(body.displayName) ?? user.profile?.displayName ?? user.email.split("@")[0];
    const entryYear = academic.entryYear ?? (typeof body.entryYear === "number" && Number.isFinite(body.entryYear) ? Math.trunc(body.entryYear) : undefined);
    const entryTerm = academic.entryTerm ?? optionalString(body.entryTerm) ?? "Fall";

    const profile = await prisma.userProfile.upsert({
      where: { userId: user.id },
      update: {
        displayName,
        grade,
        entryYear,
        entryTerm,
        facultyId,
        majorId,
        openToBeDiscovered: true
      },
      create: {
        userId: user.id,
        displayName,
        grade,
        entryYear,
        entryTerm,
        facultyId,
        majorId,
        openToBeDiscovered: true
      }
    });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        onboardingCompleted: true,
        role: user.role === "verified_user" ? "profile_completed_user" : user.role
      }
    });

    await operationLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: "onboarding.complete",
      targetType: "UserProfile",
      targetId: profile.id,
      method,
      path: request.nextUrl.pathname,
      summary: { grade, entryYear, entryTerm, facultyId, majorId }
    });
    return ok({ profile });
  }

  throw new ApiError(405, "这个 onboarding 接口不支持当前请求方式。");
}
