import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, assertString, created, handleApi, ok, optionalString, readBody, stringArray } from "@/lib/http";
import { getCurrentUser, isAdminRole, requireAdmin, requireUser, setDemoSessionCookie, setSessionCookie } from "@/lib/session";
import { sendVerificationEmail, shouldExposeVerificationCode } from "@/lib/email";
import { hashPassword, verifyPassword } from "@/lib/password";
import { allowedRequestTransitions } from "@/lib/constants";
import { contactSnapshot, defaultContactVisibility } from "@/lib/contact";
import {
  demoAccounts,
  demoAdminData,
  demoBoardById,
  demoCourseById,
  demoCourses,
  demoOnboardingOptions,
  demoPeople,
  demoPortfolioItems,
  demoPosts,
  demoRequests,
  demoUserForAccount,
  isDemoAccessEnabled,
  isDemoUser,
  normalizeDemoAccount
} from "@/lib/demo-data";
import {
  createDemoFollowRequest,
  createDemoPost,
  createDemoTeamUpInterest,
  demoAdminResource,
  demoContactContext,
  demoFollowInbox,
  demoInterestsForPost,
  demoPostById,
  demoPostsForBoard,
  demoReceivedTeamUpInterests,
  resetDemoState,
  sanitizeDemoPost,
  sanitizeDemoUser,
  updateDemoFollowRequest,
  updateDemoInterest
} from "@/lib/demo-store";
import {
  extractReadableText,
  fileExtensionOf,
  isAllowedProfileFile,
  parseResumeText,
  portfolioTypeOptions,
  previewKindForFile,
  profileUploadPurposeOptions,
  safeUploadName
} from "@/lib/profile-assets";

type RouteContext = {
  params: {
    route?: string[];
  };
};

export const runtime = "nodejs";

const profileInclude = {
  faculty: true,
  major: true
};

const userInclude = {
  school: true,
  profile: { include: profileInclude },
  contactInfo: true,
  skills: { include: { skill: true } }
};

const adminUserInclude = {
  ...userInclude,
  memberships: { include: { board: { include: { courseOffering: { include: { course: true, semester: true } } } } } },
  submittedCourses: true,
  teamakingPosts: true,
  sentTeamUpRequests: true,
  receivedRequests: true,
  portfolioItems: true,
  supportTickets: true
};

const courseInclude = {
  school: true,
  offerings: {
    include: {
      semester: true,
      boards: true
    }
  },
  mappings: {
    include: {
      major: true
    }
  }
};

function routeOf(context: RouteContext) {
  return context.params.route ?? [];
}

function emailDomain(email: string) {
  const pieces = email.toLowerCase().split("@");
  return pieces.length === 2 ? pieces[1] : "";
}

function publicUser(user: any, contactContext?: Parameters<typeof contactSnapshot>[1]) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
    onboardingCompleted: user.onboardingCompleted,
    school: user.school,
    profile: user.profile,
    contactInfo: user.contactInfo ? contactSnapshot(user.contactInfo, contactContext) : null,
    skills: user.skills ?? []
  };
}

function listFromJson(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

function scoreCourseMatch(course: { code: string; title: string }, query: string) {
  const q = normalizeSearch(query);
  const code = normalizeSearch(course.code);
  const title = normalizeSearch(course.title);
  const compactCode = code.replace(/[\s-]/g, "");
  const compactQuery = q.replace(/[\s-]/g, "");
  const words = q.split(/\s+/).filter(Boolean);

  if (!q) return { score: 1, matchReason: "显示同校可加入课程" };
  if (code === q || compactCode === compactQuery) return { score: 100, matchReason: "课程代码完全匹配" };
  if (code.startsWith(q) || compactCode.startsWith(compactQuery)) return { score: 88, matchReason: "课程代码前缀匹配" };
  if (title === q) return { score: 82, matchReason: "课程名称完全匹配" };
  if (title.includes(q)) return { score: 72, matchReason: "课程名称包含输入内容" };
  if (code.includes(q) || compactCode.includes(compactQuery)) return { score: 64, matchReason: "课程代码部分匹配" };

  const wordHits = words.filter((word) => code.includes(word) || title.includes(word)).length;
  if (wordHits > 0) {
    return { score: 42 + wordHits * 6, matchReason: `命中 ${wordHits} 个关键词` };
  }

  return { score: 0, matchReason: "未匹配" };
}

function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null));
}

async function writeAudit(adminUserId: string, action: string, targetType: string, targetId?: string | null, beforeValue?: unknown, afterValue?: unknown) {
  await prisma.adminAuditLog.create({
    data: {
      adminUserId,
      action,
      targetType,
      targetId,
      beforeValue: beforeValue === undefined ? undefined : toJson(beforeValue),
      afterValue: afterValue === undefined ? undefined : toJson(afterValue)
    }
  });
}

async function getBoardForUser(boardId: string) {
  const board = await prisma.courseBoard.findUnique({
    where: { id: boardId },
    include: {
      courseOffering: {
        include: {
          course: true,
          semester: true
        }
      },
      memberships: true
    }
  });

  if (!board) throw new ApiError(404, "找不到这个课程板。");
  return board;
}

function assertSameSchool(user: { schoolId: string | null }, schoolId?: string | null) {
  if (!user.schoolId || !schoolId || user.schoolId !== schoolId) {
    throw new ApiError(403, "只能查看同校范围内的数据。");
  }
}

async function ensureBoardMember(userId: string, boardId: string) {
  const membership = await prisma.courseBoardMembership.findUnique({
    where: { userId_boardId: { userId, boardId } }
  });

  if (!membership) {
    throw new ApiError(403, "请先加入这个 Course Board，再创建 Teamaking Post。");
  }
}

function enrichPost(post: any) {
  const portfolioIds = listFromJson(post.portfolioItemIds);

  return {
    ...post,
    portfolioEvidenceCount: portfolioIds.length,
    contactInfo: post.user?.contactInfo ? contactSnapshot(post.user.contactInfo, { isSameSchool: true }) : {}
  };
}

function publicPortfolioItems(items: any[] = [], ownerId: string, viewerId?: string | null) {
  return items.filter((item) => ownerId === viewerId || item.visibility !== "private");
}

async function contactContextForViewer(ownerId: string, viewer: any, postId?: string) {
  if (ownerId === viewer.id) return { isOwner: true, isSameSchool: true };

  const [sentInterest, mutualInterest, mutualFollow] = await Promise.all([
    prisma.teamUpRequest.findFirst({
      where: {
        senderId: viewer.id,
        receiverId: ownerId,
        status: { in: ["sent", "viewed", "mutual"] },
        ...(postId ? { postId } : {})
      }
    }),
    prisma.teamUpRequest.findFirst({
      where: {
        status: "mutual",
        OR: [
          { senderId: viewer.id, receiverId: ownerId },
          { senderId: ownerId, receiverId: viewer.id }
        ]
      }
    }),
    prisma.followRequest.findFirst({
      where: {
        status: "accepted",
        OR: [
          { senderId: viewer.id, receiverId: ownerId },
          { senderId: ownerId, receiverId: viewer.id }
        ]
      }
    })
  ]);

  return {
    isOwner: false,
    isSameSchool: true,
    hasSentTeamUp: Boolean(sentInterest),
    hasMutualTeamUp: Boolean(mutualInterest),
    hasMutualFollow: Boolean(mutualFollow)
  };
}

async function publicUserForViewer(user: any, viewer: any, postId?: string) {
  const context = await contactContextForViewer(user.id, viewer, postId);
  return {
    ...publicUser(user, context),
    portfolioItems: publicPortfolioItems(user.portfolioItems ?? [], user.id, viewer.id)
  };
}

async function enrichPostForViewer(post: any, viewer: any) {
  const portfolioIds = listFromJson(post.portfolioItemIds);
  const context = await contactContextForViewer(post.userId, viewer, post.id);
  return {
    ...post,
    user: {
      ...post.user,
      contactInfo: post.user?.contactInfo ? contactSnapshot(post.user.contactInfo, context) : null,
      portfolioItems: publicPortfolioItems(post.user?.portfolioItems ?? [], post.userId, viewer.id)
    },
    portfolioEvidenceCount: portfolioIds.length,
    contactInfo: post.user?.contactInfo ? contactSnapshot(post.user.contactInfo, context) : {}
  };
}

async function schoolDomainForEmail(email: string) {
  const domain = emailDomain(email);
  if (!domain) return null;

  const existing = await prisma.schoolEmailDomain.findFirst({
    where: { domain, status: "active" },
    include: { school: true }
  });

  if (existing) return existing;

  const school = await prisma.school.upsert({
    where: { shortName: "TEAMAKING" },
    update: { name: "TEAMAKING", status: "active" },
    create: { name: "TEAMAKING", shortName: "TEAMAKING", status: "active" }
  });

  return prisma.schoolEmailDomain.upsert({
    where: { domain },
    update: { schoolId: school.id, status: "active" },
    create: { schoolId: school.id, domain, status: "active" },
    include: { school: true }
  });
}

async function upsertVerifiedUser(input: {
  email: string;
  schoolId: string;
  role?: string;
  onboardingCompleted?: boolean;
  displayName?: string;
  passwordHash?: string;
}) {
  const user = await prisma.user.upsert({
    where: { email: input.email },
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

type VerificationPurpose = "register" | "reset_password" | "login";

async function supportedSchoolDomainForEmail(email: string) {
  const domain = emailDomain(email);
  if (!domain) return null;
  return prisma.schoolEmailDomain.findFirst({
    where: { domain, status: "active" },
    include: { school: true }
  });
}

function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function createVerification(email: string, purpose: VerificationPurpose, schoolName?: string) {
  const code = generateVerificationCode();
  await prisma.emailVerification.create({
    data: {
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

  return code;
}

async function consumeVerification(email: string, code: string, purpose: VerificationPurpose) {
  const verification = await prisma.emailVerification.findFirst({
    where: {
      email,
      code,
      purpose,
      usedAt: null,
      expiresAt: { gt: new Date() }
    },
    orderBy: { createdAt: "desc" }
  });

  if (!verification) {
    throw new ApiError(400, "验证码无效或已过期。");
  }

  await prisma.emailVerification.update({
    where: { id: verification.id },
    data: { usedAt: new Date() }
  });
}

function passwordHashFor(password: string) {
  try {
    return hashPassword(password);
  } catch (error) {
    throw new ApiError(400, error instanceof Error ? error.message : "密码不符合要求。");
  }
}

function assertAccountCanLogin(user: any) {
  if (user.status === "banned") {
    throw new ApiError(403, "这个账号已被封禁，请联系管理员。");
  }

  if (user.suspendedUntil && new Date(user.suspendedUntil).getTime() > Date.now()) {
    throw new ApiError(403, "这个账号当前处于限时禁止操作状态，请稍后再试。");
  }
}

async function ensureSystemIsActive(root?: string) {
  if (!root || ["auth", "admin", "demo"].includes(root)) return;

  const config = await prisma.siteConfig.findUnique({ where: { key: "system_status" } });
  const value = config?.value && typeof config.value === "object" && !Array.isArray(config.value) ? (config.value as Record<string, unknown>) : null;

  if (value?.status === "paused") {
    throw new ApiError(503, typeof value.message === "string" && value.message ? value.message : "系统当前处于维护暂停状态，请稍后再试。");
  }
}

async function handleAuth(method: string, path: string[], request: NextRequest) {
  if (method === "POST" && path[1] === "developer-login") {
    const configuredEmail = process.env.DEVELOPER_LOGIN_EMAIL?.trim().toLowerCase();
    const configuredPassword = process.env.DEVELOPER_LOGIN_PASSWORD;

    if (!configuredEmail || !configuredPassword) {
      throw new ApiError(503, "开发者登录尚未配置。");
    }

    const body = await readBody(request);
    const email = assertString(body.email, "email").toLowerCase();
    const password = assertString(body.password, "password");

    if (email !== configuredEmail || password !== configuredPassword) {
      throw new ApiError(401, "开发者账号或密码不正确。");
    }

    const schoolDomain = await schoolDomainForEmail(email);
    if (!schoolDomain) {
      throw new ApiError(400, "请输入有效的开发者邮箱。");
    }

    const fullUser = await upsertVerifiedUser({
      email,
      schoolId: schoolDomain.schoolId,
      role: process.env.DEVELOPER_LOGIN_ROLE || "school_admin",
      onboardingCompleted: true,
      displayName: process.env.DEVELOPER_LOGIN_DISPLAY_NAME || "TEAMAKING Developer"
    });

    const response = ok({ user: publicUser(fullUser) });
    setSessionCookie(response, fullUser.id);
    return response;
  }

  if (method === "POST" && path[1] === "register" && path[2] === "send-code") {
    const body = await readBody(request);
    const email = assertString(body.email, "email").toLowerCase();
    const schoolDomain = await supportedSchoolDomainForEmail(email);

    if (!schoolDomain) {
      throw new ApiError(400, "当前学校邮箱域名还没有被 TEAMAKING 支持。");
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
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
    const code = assertString(body.code, "code");
    const password = assertString(body.password, "password");
    const schoolDomain = await supportedSchoolDomainForEmail(email);

    if (!schoolDomain) {
      throw new ApiError(400, "当前学校邮箱域名还没有被 TEAMAKING 支持。");
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
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

    const response = ok({ user: publicUser(fullUser) });
    setSessionCookie(response, fullUser.id);
    return response;
  }

  if (method === "POST" && path[1] === "password-login") {
    const body = await readBody(request);
    const email = assertString(body.email, "email").toLowerCase();
    const password = assertString(body.password, "password");
    const user = await prisma.user.findUnique({ where: { email }, include: userInclude });

    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new ApiError(401, "邮箱或密码不正确。");
    }

    assertAccountCanLogin(user);

    const response = ok({ user: publicUser(user) });
    setSessionCookie(response, user.id);
    return response;
  }

  if (method === "POST" && path[1] === "password-reset" && path[2] === "send-code") {
    const body = await readBody(request);
    const email = assertString(body.email, "email").toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email },
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
    const code = assertString(body.code, "code");
    const password = assertString(body.password, "password");
    const before = await prisma.user.findUnique({ where: { email }, include: userInclude });

    if (!before || !before.passwordHash) {
      throw new ApiError(404, "找不到已注册账号，请先注册。");
    }

    await consumeVerification(email, code, "reset_password");

    const user = await prisma.user.update({
      where: { email },
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
    return ok({ user: user ? publicUser(user) : null });
  }

  throw new ApiError(404, "找不到认证接口。");
}

async function ensureDemoUser(account: string) {
  const selected = demoAccounts[normalizeDemoAccount(account)];
  const school = await prisma.school.upsert({
    where: { shortName: "BNBU" },
    update: { name: "BNBU", status: "active" },
    create: { name: "BNBU", shortName: "BNBU", status: "active" }
  });

  await prisma.schoolEmailDomain.upsert({
    where: { domain: "mail.bnbu.edu.cn" },
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
    where: { email: selected.email },
    update: {
      schoolId: school.id,
      role: selected.role,
      isEmailVerified: true,
      onboardingCompleted: true
    },
    create: {
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
      facultyId: faculty.id,
      majorId: major.id,
      openToBeDiscovered: true
    },
    create: {
      userId: user.id,
      displayName: selected.displayName,
      bio: selected.bio,
      grade: selected.grade,
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

async function handleDemo(method: string, path: string[], request: NextRequest) {
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

async function handleOnboarding(method: string, request: NextRequest) {
  const user = await requireUser();

  if (isDemoUser(user)) {
    if (method === "GET") {
      return ok({ user: publicUser(user), ...demoOnboardingOptions() });
    }
    if (method === "POST") {
      return ok({ profile: user.profile, message: "本地视觉演示模式已模拟保存 onboarding。" });
    }
  }

  if (method === "GET") {
    const [faculties, majors, semesters] = await Promise.all([
      prisma.faculty.findMany({ where: { schoolId: user.schoolId ?? undefined }, orderBy: { name: "asc" } }),
      prisma.major.findMany({ where: { schoolId: user.schoolId ?? undefined }, include: { faculty: true }, orderBy: { name: "asc" } }),
      prisma.semester.findMany({ where: { schoolId: user.schoolId ?? undefined }, orderBy: [{ year: "desc" }, { term: "asc" }] })
    ]);

    return ok({ user: publicUser(user), faculties, majors, semesters });
  }

  if (method === "POST") {
    const body = await readBody(request);
    const grade = assertString(body.grade, "grade");
    const facultyId = assertString(body.facultyId, "facultyId");
    const majorId = assertString(body.majorId, "majorId");
    const displayName = optionalString(body.displayName) ?? user.profile?.displayName ?? user.email.split("@")[0];

    const profile = await prisma.userProfile.upsert({
      where: { userId: user.id },
      update: {
        displayName,
        grade,
        facultyId,
        majorId,
        openToBeDiscovered: true
      },
      create: {
        userId: user.id,
        displayName,
        grade,
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

    return ok({ profile });
  }

  throw new ApiError(405, "这个 onboarding 接口不支持当前请求方式。");
}

function jsonObject(value: unknown, fallback: Record<string, unknown> = {}): any {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
  return JSON.parse(JSON.stringify(source));
}

function portfolioPayload(body: Record<string, unknown>, existing?: any) {
  const requestedType = optionalString(body.type) ?? existing?.type ?? "portfolio";
  const type = portfolioTypeOptions().includes(requestedType) ? requestedType : "other";
  const fileName = optionalString(body.fileName) ?? existing?.fileName;
  const fileExtension = optionalString(body.fileExtension) ?? (fileName ? fileExtensionOf(fileName) : existing?.fileExtension);
  const previewKind = optionalString(body.previewKind) ?? (fileName ? previewKindForFile(fileName) : existing?.previewKind ?? "link");
  const isPinned = typeof body.isPinned === "boolean" ? body.isPinned : existing?.isPinned ?? false;

  return {
    title: optionalString(body.title) ?? existing?.title ?? "Untitled evidence",
    type,
    relatedCourseId: optionalString(body.relatedCourseId) ?? existing?.relatedCourseId,
    semesterText: optionalString(body.semesterText) ?? existing?.semesterText,
    myRole: optionalString(body.myRole) ?? existing?.myRole,
    contributionDescription: optionalString(body.contributionDescription) ?? existing?.contributionDescription ?? "用户上传的作品或证明材料。",
    isGroupWork: typeof body.isGroupWork === "boolean" ? body.isGroupWork : existing?.isGroupWork ?? false,
    fileName,
    fileMimeType: optionalString(body.fileMimeType) ?? existing?.fileMimeType,
    fileSize: typeof body.fileSize === "number" ? body.fileSize : existing?.fileSize,
    fileExtension,
    storageKey: optionalString(body.storageKey) ?? existing?.storageKey,
    fileUrl: optionalString(body.fileUrl) ?? existing?.fileUrl,
    externalUrl: optionalString(body.externalUrl) ?? existing?.externalUrl,
    previewKind,
    outcome: optionalString(body.outcome) ?? existing?.outcome,
    reflection: optionalString(body.reflection) ?? existing?.reflection,
    parsedText: optionalString(body.parsedText) ?? existing?.parsedText,
    metadata: jsonObject(body.metadata, existing?.metadata ?? {}),
    visibility: optionalString(body.visibility) ?? existing?.visibility ?? "same_school",
    isPinned
  };
}

async function handleProfile(method: string, path: string[], request: NextRequest) {
  const user = await requireUser();

  if (method === "POST" && path[2] === "follow-request") {
    const receiverId = path[1];
    if (!receiverId) throw new ApiError(404, "缺少关注对象。");
    if (isDemoUser(user)) {
      const result = createDemoFollowRequest(user, receiverId);
      if (result.error) throw new ApiError(400, result.error);
      return created({ request: result.request, existing: result.existing });
    }

    if (receiverId === user.id) throw new ApiError(400, "不能关注自己。");
    const target = await prisma.user.findUnique({ where: { id: receiverId } });
    if (!target) throw new ApiError(404, "找不到这个用户。");
    assertSameSchool(user, target.schoolId);
    const requestRow = await prisma.followRequest.upsert({
      where: { senderId_receiverId: { senderId: user.id, receiverId } },
      update: { status: "pending" },
      create: { senderId: user.id, receiverId, status: "pending" }
    });
    return created({ request: requestRow });
  }

  if (isDemoUser(user)) {
    if (path[1] === "me") {
      if (path[2] === "portfolio-items") {
        if (method === "POST") {
          const body = await readBody(request);
          return created({
            portfolioItem: {
              id: "demo-portfolio-created",
              userId: user.id,
              ...portfolioPayload(body)
            },
            message: "本地视觉演示模式已模拟保存作品/证明材料。"
          });
        }
        if (method === "PATCH" && path[3]) {
          const body = await readBody(request);
          return ok({
            portfolioItem: {
              id: path[3],
              userId: user.id,
              ...portfolioPayload(body)
            },
            message: "本地视觉演示模式已模拟更新作品/证明材料。"
          });
        }
        if (method === "DELETE" && path[3]) {
          return ok({ message: "本地视觉演示模式已模拟删除作品/证明材料。" });
        }
      }
      if (method === "GET") return ok({ user: publicUser(user), contactInfo: user.contactInfo, portfolioItems: demoPortfolioItems(user.id.replace("demo-user-", "")) });
      if (method === "PATCH") return ok({ profile: { ...user.profile, ...(await readBody(request)) }, message: "本地视觉演示模式已模拟保存 Profile。" });
    }
    if (method === "GET" && path[1]) {
      const account = path[1].includes("cs") ? "cs" : path[1].includes("admin") ? "admin" : "media";
      const target = { ...demoUserForAccount(account), portfolioItems: demoPortfolioItems(account) };
      const sanitized = sanitizeDemoUser(target, user.id);
      return ok({
        user: publicUser(sanitized),
        portfolioItems: sanitized.portfolioItems ?? [],
        contactInfo: sanitized.contactInfo ?? {}
      });
    }
  }

  if (path[1] === "me") {
    if (path[2] === "portfolio-items") {
      if (method === "POST") {
        const body = await readBody(request);
        const portfolioItem = await prisma.portfolioItem.create({
          data: {
            userId: user.id,
            ...portfolioPayload(body)
          }
        });
        return created({ portfolioItem });
      }

      if (method === "PATCH" && path[3]) {
        const existing = await prisma.portfolioItem.findUnique({ where: { id: path[3] } });
        if (!existing || existing.userId !== user.id) throw new ApiError(404, "找不到这个作品或证明材料。");
        const body = await readBody(request);
        const portfolioItem = await prisma.portfolioItem.update({
          where: { id: path[3] },
          data: portfolioPayload(body, existing)
        });
        return ok({ portfolioItem });
      }

      if (method === "DELETE" && path[3]) {
        await prisma.portfolioItem.deleteMany({ where: { id: path[3], userId: user.id } });
        return ok({ message: "作品或证明材料已删除。" });
      }
    }

    if (method === "GET") {
      const fullUser = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        include: {
          ...userInclude,
          portfolioItems: { include: { relatedCourse: true }, orderBy: { createdAt: "desc" } }
        }
      });
      return ok({ user: publicUser(fullUser), contactInfo: fullUser.contactInfo, portfolioItems: fullUser.portfolioItems });
    }

    if (method === "PATCH") {
      const body = await readBody(request);
      const profile = await prisma.userProfile.upsert({
        where: { userId: user.id },
        update: {
          displayName: optionalString(body.displayName) ?? user.profile?.displayName ?? user.email.split("@")[0],
          nickname: optionalString(body.nickname),
          avatarUrl: optionalString(body.avatarUrl),
          backgroundImageUrl: optionalString(body.backgroundImageUrl),
          headline: optionalString(body.headline),
          bio: optionalString(body.bio) ?? "",
          grade: optionalString(body.grade),
          facultyId: optionalString(body.facultyId),
          majorId: optionalString(body.majorId),
          outputTags: stringArray(body.outputTags),
          resumeUrl: optionalString(body.resumeUrl),
          resumeFileName: optionalString(body.resumeFileName),
          resumeParsedData: jsonObject(body.resumeParsedData),
          openToBeDiscovered: typeof body.openToBeDiscovered === "boolean" ? body.openToBeDiscovered : true
        },
        create: {
          userId: user.id,
          displayName: optionalString(body.displayName) ?? user.email.split("@")[0],
          nickname: optionalString(body.nickname),
          avatarUrl: optionalString(body.avatarUrl),
          backgroundImageUrl: optionalString(body.backgroundImageUrl),
          headline: optionalString(body.headline),
          bio: optionalString(body.bio) ?? "",
          grade: optionalString(body.grade),
          facultyId: optionalString(body.facultyId),
          majorId: optionalString(body.majorId),
          outputTags: stringArray(body.outputTags),
          resumeUrl: optionalString(body.resumeUrl),
          resumeFileName: optionalString(body.resumeFileName),
          resumeParsedData: jsonObject(body.resumeParsedData)
        }
      });

      const contactBody = jsonObject(body.contactInfo);
      if (Object.keys(contactBody).length > 0) {
        await prisma.contactInfo.upsert({
          where: { userId: user.id },
          update: {
            schoolEmail: user.email,
            wechatId: optionalString(contactBody.wechatId),
            wechatQrImageUrl: optionalString(contactBody.wechatQrImageUrl),
            linkedinUrl: optionalString(contactBody.linkedinUrl),
            personalEmail: optionalString(contactBody.personalEmail),
            visibilitySettings: jsonObject(contactBody.visibilitySettings, defaultContactVisibility)
          },
          create: {
            userId: user.id,
            schoolEmail: user.email,
            wechatId: optionalString(contactBody.wechatId),
            wechatQrImageUrl: optionalString(contactBody.wechatQrImageUrl),
            linkedinUrl: optionalString(contactBody.linkedinUrl),
            personalEmail: optionalString(contactBody.personalEmail),
            visibilitySettings: jsonObject(contactBody.visibilitySettings, defaultContactVisibility)
          }
        });
      }

      const skills = stringArray(body.skills);
      if (skills.length > 0) {
        await prisma.userSkill.deleteMany({ where: { userId: user.id } });
        for (const skillName of skills) {
          const skill = await prisma.skill.upsert({
            where: { name: skillName },
            update: {},
            create: { name: skillName, category: "user_defined" }
          });
          await prisma.userSkill.create({
            data: {
              userId: user.id,
              skillId: skill.id,
              level: "intermediate",
              evidenceNote: "用户在个人资料中填写"
            }
          });
        }
      }

      return ok({ profile });
    }
  }

  if (method === "GET" && path[1]) {
    const target = await prisma.user.findUnique({
      where: { id: path[1] },
      include: {
        ...userInclude,
        portfolioItems: { include: { relatedCourse: true }, orderBy: { createdAt: "desc" } }
      }
    });

    if (!target) throw new ApiError(404, "找不到这个用户。");
    if (target.schoolId !== user.schoolId) {
      throw new ApiError(403, "MVP 中仅允许同校已验证用户互相查看基础资料。");
    }

    const publicTarget = await publicUserForViewer(target, user);
    return ok({
      user: publicTarget,
      portfolioItems: publicTarget.portfolioItems ?? [],
      contactInfo: publicTarget.contactInfo ?? {}
    });
  }

  throw new ApiError(404, "找不到个人资料接口。");
}

async function handleContactInfo(method: string, request: NextRequest) {
  const user = await requireUser();

  if (isDemoUser(user)) {
    if (method === "GET") return ok({ contactInfo: user.contactInfo });
    if (method === "PATCH") return ok({ contactInfo: user.contactInfo, message: "本地视觉演示模式已模拟保存联系方式。" });
  }

  if (method === "GET") {
    const contactInfo = await prisma.contactInfo.upsert({
      where: { userId: user.id },
      update: { schoolEmail: user.email },
      create: {
        userId: user.id,
        schoolEmail: user.email,
        visibilitySettings: defaultContactVisibility
      }
    });
    return ok({ contactInfo });
  }

  if (method === "PATCH") {
    const body = await readBody(request);
    const contactInfo = await prisma.contactInfo.upsert({
      where: { userId: user.id },
      update: {
        schoolEmail: user.email,
        wechatId: optionalString(body.wechatId),
        wechatQrImageUrl: optionalString(body.wechatQrImageUrl),
        linkedinUrl: optionalString(body.linkedinUrl),
        personalEmail: optionalString(body.personalEmail),
        visibilitySettings:
          body.visibilitySettings && typeof body.visibilitySettings === "object"
            ? (body.visibilitySettings as object)
            : defaultContactVisibility
      },
      create: {
        userId: user.id,
        schoolEmail: user.email,
        wechatId: optionalString(body.wechatId),
        wechatQrImageUrl: optionalString(body.wechatQrImageUrl),
        linkedinUrl: optionalString(body.linkedinUrl),
        personalEmail: optionalString(body.personalEmail),
        visibilitySettings:
          body.visibilitySettings && typeof body.visibilitySettings === "object"
            ? (body.visibilitySettings as object)
            : defaultContactVisibility
      }
    });

    return ok({ contactInfo });
  }

  throw new ApiError(405, "这个联系方式接口不支持当前请求方式。");
}

async function hasMutualFollow(userId: string, otherUserId: string) {
  const request = await prisma.followRequest.findFirst({
    where: {
      status: "accepted",
      OR: [
        { senderId: userId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: userId }
      ]
    }
  });
  return Boolean(request);
}

async function handleCourses(method: string, path: string[], request: NextRequest) {
  if (method === "GET" && path[1] === "recommended") {
    const user = await requireUser();
    if (isDemoUser(user)) {
      return ok({
        courses: demoCourses.slice(0, 3).map((course) => ({
          ...course,
          recommendation: {
            recommendedGrade: user.profile?.grade ?? "Year 2",
            isRequired: course.code.startsWith("COM"),
            reason: "本地视觉演示：根据 demo 学校、专业和年级推荐"
          }
        }))
      });
    }

    const majorId = user.profile?.majorId;
    const grade = user.profile?.grade;

    const mappings = majorId
      ? await prisma.courseMajorMapping.findMany({
          where: {
            majorId,
            ...(grade ? { recommendedGrade: grade } : {})
          },
          include: { course: { include: courseInclude } },
          orderBy: { isRequired: "desc" }
        })
      : [];

    return ok({
      courses: mappings.map((mapping) => ({
        ...mapping.course,
        recommendation: {
          recommendedGrade: mapping.recommendedGrade,
          isRequired: mapping.isRequired,
          reason: "根据你的学校、专业、年级和当前学期推荐"
        }
      }))
    });
  }

  if (method === "GET" && path[1] === "search") {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const user = await requireUser();
    if (isDemoUser(user)) {
      const courses = demoCourses
        .map((course) => ({ ...course, ...scoreCourseMatch(course, q) }))
        .filter((course) => !q || course.score > 0)
        .sort((a, b) => b.score - a.score || a.code.localeCompare(b.code));
      return ok({ courses });
    }

    const rawCourses = await prisma.course.findMany({
      where: {
        schoolId: user.schoolId ?? "",
        status: "active",
      },
      include: courseInclude,
      orderBy: { code: "asc" },
    });
    const courses = rawCourses
      .map((course) => ({ ...course, ...scoreCourseMatch(course, q) }))
      .filter((course) => !q || course.score > 0)
      .sort((a, b) => b.score - a.score || a.code.localeCompare(b.code))
      .slice(0, 50);

    return ok({ courses });
  }

  if (method === "POST" && path[1] === "submit") {
    const user = await requireUser();
    if (isDemoUser(user)) {
      return created({
        ticket: {
          id: "demo-ticket-created",
          submittedByUserId: user.id,
          email: user.email,
          category: "missing_course",
          status: "open"
        },
        message: "本地视觉演示模式已模拟创建缺失课程工单。"
      });
    }

    const body = await readBody(request);
    const ticket = await prisma.supportTicket.create({
      data: {
        submittedByUserId: user.id,
        email: user.email,
        category: "missing_course",
        title: `缺失课程：${assertString(body.code, "code")} ${assertString(body.title, "title")}`,
        description: [
          `课程代码：${body.code}`,
          `课程名称：${body.title}`,
          optionalString(body.teacherName) ? `任课老师：${body.teacherName}` : null,
          optionalString(body.semesterText) ? `学期：${body.semesterText}` : null
        ]
          .filter(Boolean)
          .join("\n"),
        status: "open"
      }
    });

    return created({ ticket, message: "已转为管理员工单，后续不再走课程审核流程。" });
  }

  if (method === "GET" && path[1]) {
    const user = await requireUser();
    if (isDemoUser(user)) {
      return ok({ course: demoCourseById(path[1]) });
    }

    const course = await prisma.course.findUnique({
      where: { id: path[1] },
      include: courseInclude
    });

    if (!course) throw new ApiError(404, "找不到这门课程。");
    assertSameSchool(user, course.schoolId);
    return ok({ course });
  }

  throw new ApiError(404, "找不到课程接口。");
}

async function handleBoards(method: string, path: string[], request: NextRequest) {
  const boardId = path[1];
  if (!boardId) throw new ApiError(404, "缺少课程板编号。");

  if (method === "GET" && path.length === 2) {
    const user = await requireUser();
    if (isDemoUser(user)) {
      const board = demoBoardById(boardId);
      return ok({ board, isJoined: true, memberCount: demoPeople(boardId).length });
    }

    const board = await getBoardForUser(boardId);
    assertSameSchool(user, board.courseOffering.course.schoolId);
    const isJoined = user
      ? board.memberships.some((membership) => membership.userId === user.id)
      : false;
    return ok({ board, isJoined, memberCount: board.memberships.length });
  }

  if (method === "POST" && path[2] === "join") {
    const user = await requireUser();
    if (isDemoUser(user)) {
      return ok({
        membership: { id: "demo-membership-current", userId: user.id, boardId },
        message: "本地视觉演示模式已模拟加入 Course Board。"
      });
    }

    const board = await getBoardForUser(boardId);
    const membership = await prisma.courseBoardMembership.upsert({
      where: { userId_boardId: { userId: user.id, boardId } },
      update: {},
      create: {
        userId: user.id,
        boardId
      }
    });

    return ok({
      membership,
      message: `你已加入 ${board.title}。Course People 只代表平台内自选加入，不代表官方选课名单。`
    });
  }

  if (method === "DELETE" && path[2] === "leave") {
    const user = await requireUser();
    if (isDemoUser(user)) {
      return ok({ message: "本地视觉演示模式已模拟离开这个 Course Board。" });
    }

    await prisma.courseBoardMembership.deleteMany({
      where: { userId: user.id, boardId }
    });

    return ok({ message: "已离开这个 Course Board。" });
  }

  if (method === "GET" && path[2] === "open-to-team") {
    const user = await requireUser();
    if (isDemoUser(user)) {
      return ok({ posts: demoPostsForBoard(boardId, user.id) });
    }

    const board = await getBoardForUser(boardId);
    assertSameSchool(user, board.courseOffering.course.schoolId);
    const posts = await prisma.teamakingPost.findMany({
      where: { boardId, status: "open" },
      include: {
        board: { include: { courseOffering: { include: { course: true, semester: true } } } },
        user: {
          include: {
            profile: { include: profileInclude },
            contactInfo: true,
            portfolioItems: true,
            skills: { include: { skill: true } }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return ok({ posts: await Promise.all(posts.map((post) => enrichPostForViewer(post, user))) });
  }

  if (method === "GET" && path[2] === "people") {
    const user = await requireUser();
    if (isDemoUser(user)) {
      return ok({ people: demoPeople(boardId) });
    }

    const board = await getBoardForUser(boardId);
    assertSameSchool(user, board.courseOffering.course.schoolId);
    const members = await prisma.courseBoardMembership.findMany({
      where: { boardId },
      include: {
        user: {
          include: {
            profile: { include: profileInclude },
            contactInfo: true,
            skills: { include: { skill: true } }
          }
        }
      },
      orderBy: { joinedAt: "desc" }
    });

    return ok({
      people: members.map((membership) => ({
        ...membership,
        user: publicUser(membership.user)
      }))
    });
  }

  if (method === "POST" && path[2] === "teamaking-posts") {
    const user = await requireUser();
    if (isDemoUser(user)) {
      const body = await readBody(request);
      return created({ post: createDemoPost(boardId, user, body), message: "本地共享 demo state 已创建 Teamaking Post。" });
    }

    const board = await getBoardForUser(boardId);
    await ensureBoardMember(user.id, boardId);

    const body = await readBody(request);
    const post = await prisma.teamakingPost.create({
      data: {
        boardId,
        userId: user.id,
        courseOfferingId: board.courseOfferingId,
        title: assertString(body.title, "title"),
        strengths: stringArray(body.strengths),
        contributionTypes: stringArray(body.contributionTypes),
        expectedOutcome: assertString(body.expectedOutcome, "expectedOutcome"),
        portfolioItemIds: stringArray(body.portfolioItemIds),
        visibility: optionalString(body.visibility) ?? "same_course_board"
      }
    });

    return created({ post });
  }

  throw new ApiError(404, "找不到课程板接口。");
}

async function handleTeamakingPosts(method: string, path: string[], request: NextRequest) {
  const postId = path[1];
  if (!postId) throw new ApiError(404, "缺少 Teamaking Post 编号。");

  const include = {
    board: { include: { courseOffering: { include: { course: true, semester: true } } } },
    user: {
      include: {
        profile: { include: profileInclude },
        contactInfo: true,
        portfolioItems: { include: { relatedCourse: true } },
        skills: { include: { skill: true } }
      }
    }
  };

  if (method === "GET" && path.length === 2) {
    const user = await requireUser();
    if (isDemoUser(user)) {
      return ok({ post: demoPostById(postId, user.id) });
    }

    const post = await prisma.teamakingPost.findUnique({
      where: { id: postId },
      include
    });
    if (!post) throw new ApiError(404, "找不到这个 Teamaking Post。");
    assertSameSchool(user, post.board.courseOffering.course.schoolId);
    if (post.visibility === "same_course_board") {
      await ensureBoardMember(user.id, post.boardId);
    }
    return ok({ post: await enrichPostForViewer(post, user) });
  }

  if (method === "GET" && path[2] === "interests") {
    const user = await requireUser();
    if (isDemoUser(user)) {
      return ok({ interests: demoInterestsForPost(postId, user) });
    }

    const post = await prisma.teamakingPost.findUnique({ where: { id: postId }, include: { board: { include: { courseOffering: { include: { course: true } } } } } });
    if (!post) throw new ApiError(404, "找不到这个 Teamaking Post。");
    assertSameSchool(user, post.board.courseOffering.course.schoolId);

    if (post.userId === user.id) {
      await prisma.teamUpRequest.updateMany({
        where: { postId, receiverId: user.id, status: "sent" },
        data: { status: "viewed" }
      });
    }

    const interests = await prisma.teamUpRequest.findMany({
      where: { postId, status: { not: "deleted" } },
      include: {
        post: { include: { board: { include: { courseOffering: { include: { course: true, semester: true } } } } } },
        sender: { include: { ...userInclude, portfolioItems: { include: { relatedCourse: true } } } },
        receiver: { include: { profile: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    const enriched = await Promise.all(interests.map(async (interest) => ({
      ...interest,
      post: await enrichPostForViewer(interest.post, user),
      sender: await publicUserForViewer(interest.sender, user, postId)
    })));
    return ok({ interests: enriched });
  }

  if (method === "PATCH" && path.length === 2) {
    const user = await requireUser();
    if (isDemoUser(user)) {
      return ok({ post: { ...(demoPosts().find((post) => post.id === postId) ?? demoPosts()[0]), id: postId }, message: "本地视觉演示模式已模拟修改 Teamaking Post。" });
    }

    const existing = await prisma.teamakingPost.findUnique({ where: { id: postId } });
    if (!existing) throw new ApiError(404, "找不到这个 Teamaking Post。");
    if (existing.userId !== user.id && !isAdminRole(user.role)) {
      throw new ApiError(403, "只有发布者或管理员可以修改这个 Teamaking Post。");
    }

    const body = await readBody(request);
    const updateData: any = {
      title: optionalString(body.title) ?? existing.title,
      status: optionalString(body.status) ?? existing.status,
      expectedOutcome: optionalString(body.expectedOutcome) ?? existing.expectedOutcome,
      showWechatId: typeof body.showWechatId === "boolean" ? body.showWechatId : existing.showWechatId,
      showWechatQr: typeof body.showWechatQr === "boolean" ? body.showWechatQr : existing.showWechatQr,
      showLinkedin: typeof body.showLinkedin === "boolean" ? body.showLinkedin : existing.showLinkedin,
      showPersonalEmail: typeof body.showPersonalEmail === "boolean" ? body.showPersonalEmail : existing.showPersonalEmail,
      visibility: optionalString(body.visibility) ?? existing.visibility
    };

    if (Array.isArray(body.strengths)) {
      updateData.strengths = stringArray(body.strengths);
    }
    if (Array.isArray(body.contributionTypes)) {
      updateData.contributionTypes = stringArray(body.contributionTypes);
    }
    if (Array.isArray(body.portfolioItemIds)) {
      updateData.portfolioItemIds = stringArray(body.portfolioItemIds);
    }

    const post = await prisma.teamakingPost.update({
      where: { id: postId },
      data: updateData
    });

    return ok({ post });
  }

  if (method === "DELETE" && path.length === 2) {
    const user = await requireUser();
    if (isDemoUser(user)) {
      return ok({ message: "本地视觉演示模式已模拟删除 Teamaking Post。" });
    }

    const existing = await prisma.teamakingPost.findUnique({ where: { id: postId } });
    if (!existing) throw new ApiError(404, "找不到这个 Teamaking Post。");
    if (existing.userId !== user.id && !isAdminRole(user.role)) {
      throw new ApiError(403, "只有发布者或管理员可以删除这个 Teamaking Post。");
    }

    await prisma.teamakingPost.delete({ where: { id: postId } });
    return ok({ message: "Teamaking Post 已删除。" });
  }

  if (method === "POST" && path[2] === "team-up") {
    const sender = await requireUser();
    if (isDemoUser(sender)) {
      const body = await readBody(request);
      const result = createDemoTeamUpInterest(postId, sender, {
        message: assertString(body.message, "message"),
        senderContribution: assertString(body.senderContribution, "senderContribution")
      });
      if (result.error) throw new ApiError(400, result.error);
      return created({ request: result.interest, existing: result.existing, message: result.existing ? "你已经对这条 Teamaking Post 发过 TeamUp Interest。" : "TeamUp Interest 已发送。" });
    }

    if (!sender.onboardingCompleted) {
      throw new ApiError(403, "请先完成基础 onboarding，再发送 Team Up 请求。");
    }

    const post = await prisma.teamakingPost.findUnique({
      where: { id: postId },
      include: {
        user: { include: { contactInfo: true } },
        board: true
      }
    });
    if (!post) throw new ApiError(404, "找不到这个 Teamaking Post。");
    if (post.userId === sender.id) {
      throw new ApiError(400, "不能给自己的 Teamaking Post 发送 Team Up。");
    }

    const body = await readBody(request);
    const existing = await prisma.teamUpRequest.findUnique({
      where: { postId_senderId: { postId, senderId: sender.id } }
    });
    if (existing && existing.status !== "deleted") {
      return ok({ request: existing, existing: true, message: "你已经对这条 Teamaking Post 发过 TeamUp Interest。" });
    }

    const senderContact = await prisma.contactInfo.findUnique({ where: { userId: sender.id } });
    const requestData = {
        postId,
        senderId: sender.id,
        receiverId: post.userId,
        message: assertString(body.message, "message"),
        senderContribution: assertString(body.senderContribution, "senderContribution"),
        senderContactSnapshot: contactSnapshot(senderContact, { isOwner: true, isSameSchool: true }),
        receiverContactSnapshot: contactSnapshot(post.user.contactInfo, await contactContextForViewer(post.userId, sender, postId)),
        status: "sent"
    };
    const requestRow = existing
      ? await prisma.teamUpRequest.update({ where: { id: existing.id }, data: requestData })
      : await prisma.teamUpRequest.create({ data: requestData });

    return created({ request: requestRow });
  }

  throw new ApiError(404, "找不到 Teamaking Post 接口。");
}

async function handleTeamUpRequests(method: string, path: string[], request: NextRequest) {
  const user = await requireUser();
  if (isDemoUser(user)) {
    if (method === "GET" && path[1] === "inbox") return ok({ requests: demoReceivedTeamUpInterests(user.id) });
    if (method === "GET" && path[1] === "sent") return ok({ requests: [] });
    if (method === "PATCH" && path[2] === "status") {
      return ok({ request: demoReceivedTeamUpInterests(user.id).find((item) => item.id === path[1]) ?? null });
    }
  }

  const include = {
    post: {
      include: {
        board: { include: { courseOffering: { include: { course: true, semester: true } } } },
        user: { include: { profile: true } }
      }
    },
    sender: { include: { profile: true } },
    receiver: { include: { profile: true } }
  };

  if (method === "GET" && path[1] === "inbox") {
    const requests = await prisma.teamUpRequest.findMany({
      where: { receiverId: user.id },
      include,
      orderBy: { createdAt: "desc" }
    });
    return ok({ requests });
  }

  if (method === "GET" && path[1] === "sent") {
    return ok({ requests: [] });
  }

  if (method === "PATCH" && path[2] === "status") {
    const requestId = path[1];
    const body = await readBody(request);
    const nextStatus = assertString(body.status, "status");
    const existing = await prisma.teamUpRequest.findUnique({ where: { id: requestId } });
    if (!existing) throw new ApiError(404, "找不到这个 Team Up Request。");
    if (existing.receiverId !== user.id && existing.senderId !== user.id && !isAdminRole(user.role)) {
      throw new ApiError(403, "不能修改不属于你的 Team Up Request。");
    }

    const allowed = allowedRequestTransitions[existing.status] ?? [];
    if (!allowed.includes(nextStatus) && !isAdminRole(user.role)) {
      throw new ApiError(400, `不允许从 ${existing.status} 变更为 ${nextStatus}。`);
    }

  const updated = await prisma.teamUpRequest.update({
      where: { id: requestId },
      data: { status: nextStatus }
    });

    return ok({ request: updated });
  }

  throw new ApiError(404, "找不到 Team Up Request 接口。");
}

async function handleTeamUpInterests(method: string, path: string[]) {
  const user = await requireUser();

  if (method === "GET" && path[1] === "received") {
    if (isDemoUser(user)) return ok({ interests: demoReceivedTeamUpInterests(user.id) });

    const interests = await prisma.teamUpRequest.findMany({
      where: { receiverId: user.id, status: { not: "deleted" } },
      include: {
        post: { include: { board: { include: { courseOffering: { include: { course: true, semester: true } } } }, user: { include: userInclude } } },
        sender: { include: { ...userInclude, portfolioItems: { include: { relatedCourse: true } } } },
        receiver: { include: { profile: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    const enriched = await Promise.all(interests.map(async (interest) => ({
      ...interest,
      post: await enrichPostForViewer(interest.post, user),
      sender: await publicUserForViewer(interest.sender, user, interest.postId)
    })));
    return ok({ interests: enriched });
  }

  if (method === "POST" && path[1] && ["mutual", "refuse", "withdraw", "report"].includes(path[2] ?? "")) {
    const action = path[2] as "mutual" | "refuse" | "withdraw" | "report";
    if (isDemoUser(user)) {
      const result = updateDemoInterest(path[1], user, action);
      if (result.error) throw new ApiError(403, result.error);
      return ok({ interest: result.interest });
    }

    const interest = await prisma.teamUpRequest.findUnique({ where: { id: path[1] } });
    if (!interest) throw new ApiError(404, "找不到这个 TeamUp Interest。");
    if (action === "withdraw" && interest.senderId !== user.id) throw new ApiError(403, "只有发出者可以撤回。");
    if ((action === "mutual" || action === "refuse") && interest.receiverId !== user.id) throw new ApiError(403, "只有 Post 发起者可以处理这个 TeamUp Interest。");
    if (action === "report" && interest.senderId !== user.id && interest.receiverId !== user.id) throw new ApiError(403, "不能举报不属于你的 TeamUp Interest。");

    const nextStatus = action === "mutual" ? "mutual" : action === "refuse" ? "refused" : action === "withdraw" ? "withdrawn" : "reported";
    const updated = await prisma.teamUpRequest.update({
      where: { id: interest.id },
      data: { status: nextStatus }
    });
    return ok({ interest: updated });
  }

  throw new ApiError(404, "找不到 TeamUp Interest 接口。");
}

async function handleFollowRequests(method: string, path: string[]) {
  const user = await requireUser();

  if (method === "GET" && path[1] === "inbox") {
    if (isDemoUser(user)) return ok({ requests: demoFollowInbox(user.id) });
    const requests = await prisma.followRequest.findMany({
      where: { receiverId: user.id, status: "pending" },
      include: { sender: { include: userInclude }, receiver: { include: userInclude } },
      orderBy: { createdAt: "desc" }
    });
    return ok({ requests });
  }

  if (method === "POST" && path[1] && ["accept", "refuse", "withdraw"].includes(path[2] ?? "")) {
    const action = path[2] as "accept" | "refuse" | "withdraw";
    if (isDemoUser(user)) {
      const result = updateDemoFollowRequest(path[1], user, action);
      if (result.error) throw new ApiError(403, result.error);
      return ok({ request: result.request });
    }

    const existing = await prisma.followRequest.findUnique({ where: { id: path[1] } });
    if (!existing) throw new ApiError(404, "找不到这个关注申请。");
    if (action === "withdraw" && existing.senderId !== user.id) throw new ApiError(403, "只有发出者可以撤回关注申请。");
    if ((action === "accept" || action === "refuse") && existing.receiverId !== user.id) throw new ApiError(403, "只有接收者可以处理关注申请。");
    const status = action === "accept" ? "accepted" : action === "refuse" ? "refused" : "withdrawn";
    const requestRow = await prisma.followRequest.update({ where: { id: existing.id }, data: { status } });
    return ok({ request: requestRow });
  }

  throw new ApiError(404, "找不到关注申请接口。");
}

async function handleMatches() {
  const user = await requireUser();
  if (isDemoUser(user)) {
    return ok({
      posts: demoPosts().map((post, index) => ({
        ...post,
        score: index === 0 ? 90 : 62,
        reasons: index === 0 ? ["Joined the same course board", "Open to Team"] : ["Same school", "Cross-major collaboration"]
      })),
      users: demoPeople().map((membership, index) => ({
        user: publicUser(membership.user),
        score: index === 0 ? 70 : 45,
        reasons: index === 0 ? ["Same major", "Open to be discovered"] : ["Same school", "Cross-major collaboration"]
      }))
    });
  }

  const memberships = await prisma.courseBoardMembership.findMany({ where: { userId: user.id } });
  const boardIds = memberships.map((membership) => membership.boardId);

  const posts = await prisma.teamakingPost.findMany({
    where: {
      status: "open",
      OR: [
        { boardId: { in: boardIds } },
        { visibility: "same_school", user: { schoolId: user.schoolId ?? "" } }
      ]
    },
    include: {
      board: { include: { courseOffering: { include: { course: true } } } },
      user: { include: { profile: { include: profileInclude }, contactInfo: true, skills: { include: { skill: true } } } }
    },
    orderBy: { createdAt: "desc" },
    take: 20
  });

  const sameMajorUsers = user.profile?.majorId
    ? await prisma.user.findMany({
        where: {
          schoolId: user.schoolId,
          id: { not: user.id },
          profile: { majorId: user.profile.majorId, openToBeDiscovered: true }
        },
        include: userInclude,
        take: 12
      })
    : [];

  const crossMajorUsers = await prisma.user.findMany({
    where: {
      schoolId: user.schoolId,
      id: { not: user.id },
      profile: {
        openToBeDiscovered: true,
        ...(user.profile?.majorId ? { majorId: { not: user.profile.majorId } } : {})
      }
    },
    include: userInclude,
    take: 12
  });

  return ok({
    posts: posts.map((post) => ({
      ...enrichPost(post),
      score: boardIds.includes(post.boardId) ? 90 : 60,
      reasons: [
        ...(boardIds.includes(post.boardId) ? ["Joined the same course board"] : ["Same school"]),
        "Open to Team",
        ...(post.user.profile?.majorId === user.profile?.majorId ? ["Same major"] : [])
      ]
    })),
    users: [
      ...sameMajorUsers.map((matchedUser) => ({
        user: publicUser(matchedUser),
        score: 70,
        reasons: ["Same major", "Open to be discovered"]
      })),
      ...crossMajorUsers.map((matchedUser) => ({
        user: publicUser(matchedUser),
        score: 45,
        reasons: ["Same school", "Cross-major collaboration"]
      }))
    ]
  });
}

async function handleSupportTickets(method: string, request: NextRequest) {
  if (method === "POST") {
    let user = null;
    try {
      user = await getCurrentUser();
    } catch {
      user = null;
    }
    const body = await readBody(request);
    const category = optionalString(body.category) ?? "other";
    const allowedCategories = ["bug", "missing_course", "error_report", "admin_request", "other"];

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

async function handleUploads(method: string, request: NextRequest) {
  if (method !== "POST") throw new ApiError(405, "这个上传接口不支持当前请求方式。");

  const user = await requireUser();
  const formData = await request.formData();
  const file = formData.get("file");
  const purposeRaw = formData.get("purpose");
  const purpose = typeof purposeRaw === "string" && profileUploadPurposeOptions().includes(purposeRaw) ? purposeRaw : "portfolio";

  if (!(file instanceof File)) {
    throw new ApiError(400, "请上传一个文件。");
  }

  if (file.size > 30 * 1024 * 1024) {
    throw new ApiError(400, "单个文件暂时限制为 30MB。");
  }

  if (!isAllowedProfileFile(file.name)) {
    throw new ApiError(400, `暂不支持这个文件后缀：${fileExtensionOf(file.name) || "unknown"}`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const safeName = safeUploadName(file.name);
  const parsedText = await extractReadableText(file.name, buffer);
  const resumeParsedData = purpose === "resume" ? parseResumeText(parsedText, file.name) : undefined;
  const shouldUseInlineStorage = process.env.VERCEL === "1" || process.env.UPLOAD_STORAGE_MODE === "inline";

  if (shouldUseInlineStorage) {
    if (file.size > 4 * 1024 * 1024) {
      throw new ApiError(400, "线上测试环境暂时只支持 4MB 以内的文件上传；较大文件后续会接入对象存储。");
    }

    return created({
      upload: {
        fileUrl: `data:${file.type || "application/octet-stream"};base64,${buffer.toString("base64")}`,
        storageKey: `inline/${user.id}/${safeName}`,
        fileName: file.name,
        fileMimeType: file.type || "application/octet-stream",
        fileSize: file.size,
        fileExtension: fileExtensionOf(file.name),
        previewKind: previewKindForFile(file.name),
        parsedText,
        resumeParsedData,
        purpose,
        storageMode: "inline_data_url"
      }
    });
  }

  const relativeDir = `/uploads/${user.id}`;
  const storageKey = `${relativeDir}/${safeName}`;
  const targetDir = `${process.cwd()}/public${relativeDir}`;
  const targetPath = `${process.cwd()}/public${storageKey}`;
  const fs = await import("node:fs/promises");

  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(targetPath, buffer);

  const upload = {
    fileUrl: storageKey,
    storageKey,
    fileName: file.name,
    fileMimeType: file.type || "application/octet-stream",
    fileSize: file.size,
    fileExtension: fileExtensionOf(file.name),
    previewKind: previewKindForFile(file.name),
    parsedText,
    resumeParsedData,
    purpose,
    storageMode: "local_public_uploads"
  };

  return created({ upload });
}

function dateRangeFromRequest(request: NextRequest) {
  const url = new URL(request.url);
  const toParam = optionalString(url.searchParams.get("to"));
  const fromParam = optionalString(url.searchParams.get("from"));
  const to = toParam ? new Date(`${toParam}T23:59:59.999Z`) : new Date();
  const from = fromParam ? new Date(`${fromParam}T00:00:00.000Z`) : new Date(to.getTime() - 1000 * 60 * 60 * 24 * 30);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new ApiError(400, "日期格式不正确，请使用 YYYY-MM-DD。");
  }

  return { from, to, format: url.searchParams.get("format") };
}

function csvResponse(rows: Record<string, unknown>[], filename: string) {
  const headers = Object.keys(rows[0] ?? {});
  const escapeCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.join(","), ...rows.map((row) => headers.map((header) => escapeCell(row[header])).join(","))].join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}

async function handleAdmin(method: string, path: string[], request: NextRequest) {
  const admin = await requireAdmin();
  const resource = path[1];
  const id = path[2];
  const action = path[3];

  if (isDemoUser(admin)) {
    if (method === "GET") return ok(demoAdminResource(resource));
    if (method === "PATCH" && resource && id) {
      const body = await readBody(request);
      return ok({
        item: { id, ...body },
        message: `本地视觉演示模式已模拟更新 ${resource}。`
      });
    }
    if (method === "POST" && resource) {
      const body = await readBody(request);
      return created({
        item: { id: `demo-${resource}-created`, action, ...body },
        message: `本地视觉演示模式已模拟创建/处理 ${resource}。`
      });
    }
  }

  if (method === "GET" && resource === "users") {
    const users = await prisma.user.findMany({
      include: adminUserInclude,
      orderBy: { createdAt: "desc" },
      take: 100
    });
    return ok({ users });
  }

  if (method === "PATCH" && resource === "users" && id) {
    const body = await readBody(request);
    const before = await prisma.user.findUnique({ where: { id } });
    const requestedStatus = optionalString(body.status);
    const suspendedUntilText = optionalString(body.suspendedUntil);
    const user = await prisma.user.update({
      where: { id },
      data: {
        role: optionalString(body.role) ?? before?.role,
        status: requestedStatus ?? before?.status,
        suspendedUntil: suspendedUntilText ? new Date(suspendedUntilText) : requestedStatus === "active" ? null : before?.suspendedUntil,
        adminNote: optionalString(body.adminNote) ?? before?.adminNote,
        onboardingCompleted: typeof body.onboardingCompleted === "boolean" ? body.onboardingCompleted : before?.onboardingCompleted
      },
      include: adminUserInclude
    });
    await writeAudit(admin.id, "admin.users.patch", "User", id, before, user);
    return ok({ user });
  }

  if (method === "GET" && resource === "schools") {
    const schools = await prisma.school.findMany({ include: { domains: true, faculties: true, majors: true }, orderBy: { createdAt: "desc" } });
    return ok({ schools });
  }

  if (method === "POST" && resource === "schools") {
    const body = await readBody(request);
    const school = await prisma.school.create({
      data: {
        name: assertString(body.name, "name"),
        shortName: assertString(body.shortName, "shortName"),
        status: optionalString(body.status) ?? "active",
        domains: {
          create: stringArray(body.domains).map((domain) => ({ domain, status: "active" }))
        }
      },
      include: { domains: true }
    });
    await writeAudit(admin.id, "admin.schools.create", "School", school.id, null, school);
    return created({ school });
  }

  if (method === "PATCH" && resource === "schools" && id) {
    const body = await readBody(request);
    const before = await prisma.school.findUnique({ where: { id }, include: { domains: true } });
    const school = await prisma.school.update({
      where: { id },
      data: {
        name: optionalString(body.name) ?? before?.name,
        shortName: optionalString(body.shortName) ?? before?.shortName,
        status: optionalString(body.status) ?? before?.status
      },
      include: { domains: true }
    });
    await writeAudit(admin.id, "admin.schools.patch", "School", id, before, school);
    return ok({ school });
  }

  if (method === "GET" && resource === "majors") {
    const [faculties, majors, semesters] = await Promise.all([
      prisma.faculty.findMany({ include: { school: true }, orderBy: { name: "asc" } }),
      prisma.major.findMany({ include: { school: true, faculty: true }, orderBy: { name: "asc" } }),
      prisma.semester.findMany({ include: { school: true }, orderBy: [{ year: "desc" }, { name: "asc" }] })
    ]);
    return ok({ faculties, majors, semesters });
  }

  if (method === "POST" && resource === "majors") {
    const body = await readBody(request);
    const type = optionalString(body.type) ?? "major";
    if (type === "faculty") {
      const faculty = await prisma.faculty.create({
        data: { schoolId: assertString(body.schoolId, "schoolId"), name: assertString(body.name, "name") }
      });
      await writeAudit(admin.id, "admin.faculties.create", "Faculty", faculty.id, null, faculty);
      return created({ faculty });
    }
    if (type === "semester") {
      const semester = await prisma.semester.create({
        data: {
          schoolId: assertString(body.schoolId, "schoolId"),
          name: assertString(body.name, "name"),
          year: Number(body.year),
          term: assertString(body.term, "term"),
          isCurrent: Boolean(body.isCurrent)
        }
      });
      await writeAudit(admin.id, "admin.semesters.create", "Semester", semester.id, null, semester);
      return created({ semester });
    }

    const major = await prisma.major.create({
      data: {
        schoolId: assertString(body.schoolId, "schoolId"),
        facultyId: assertString(body.facultyId, "facultyId"),
        name: assertString(body.name, "name"),
        degreeType: optionalString(body.degreeType) ?? "undergraduate"
      }
    });
    await writeAudit(admin.id, "admin.majors.create", "Major", major.id, null, major);
    return created({ major });
  }

  if (method === "GET" && resource === "courses") {
    const courses = await prisma.course.findMany({ include: courseInclude, orderBy: { code: "asc" }, take: 100 });
    return ok({ courses });
  }

  if (method === "POST" && resource === "courses") {
    const body = await readBody(request);
    const course = await prisma.course.create({
      data: {
        schoolId: assertString(body.schoolId, "schoolId"),
        code: assertString(body.code, "code"),
        title: assertString(body.title, "title"),
        description: optionalString(body.description) ?? "",
        courseType: optionalString(body.courseType) ?? "coursework",
        source: "admin"
      }
    });
    const semesterId = optionalString(body.semesterId);
    const offering = semesterId
      ? await prisma.courseOffering.create({
          data: {
            courseId: course.id,
            semesterId,
            teacherName: optionalString(body.teacherName),
            section: optionalString(body.section)
          }
        })
      : null;
    const board =
      offering && body.createBoard !== false
        ? await prisma.courseBoard.create({
            data: {
              courseOfferingId: offering.id,
              title: optionalString(body.boardTitle) ?? `${course.code} ${course.title}`,
              rules: optionalString(body.boardRules) ?? undefined
            }
          })
        : null;
    await writeAudit(admin.id, "admin.courses.create", "Course", course.id, null, { course, offering, board });
    return created({ course, offering, board });
  }

  if (method === "PATCH" && resource === "courses" && id) {
    const body = await readBody(request);
    const before = await prisma.course.findUnique({ where: { id } });
    const course = await prisma.course.update({
      where: { id },
      data: {
        code: optionalString(body.code) ?? before?.code,
        title: optionalString(body.title) ?? before?.title,
        description: optionalString(body.description) ?? before?.description,
        status: optionalString(body.status) ?? before?.status
      }
    });
    await writeAudit(admin.id, "admin.courses.patch", "Course", id, before, course);
    return ok({ course });
  }

  if (method === "POST" && resource === "courses" && id && action === "merge") {
    const body = await readBody(request);
    await writeAudit(admin.id, "admin.courses.merge", "Course", id, null, body);
    return ok({ message: "课程合并记录已写入审计日志。MVP 中保留人工合并扩展点。" });
  }

  if (method === "GET" && resource === "course-submissions") {
    const submissions = await prisma.userSubmittedCourse.findMany({
      include: { submittedBy: { include: { profile: true } }, school: true },
      orderBy: { createdAt: "desc" }
    });
    return ok({ submissions });
  }

  if (method === "GET" && resource === "support-tickets") {
    const tickets = await prisma.supportTicket.findMany({
      include: { submittedBy: { include: { profile: true } } },
      orderBy: { createdAt: "desc" }
    });
    return ok({ tickets });
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

  if (method === "POST" && resource === "course-submissions" && id && ["approve", "reject", "merge"].includes(action ?? "")) {
    const submission = await prisma.userSubmittedCourse.findUnique({ where: { id } });
    if (!submission) throw new ApiError(404, "找不到课程提交记录。");

    if (action === "reject") {
      const body = await readBody(request);
      const updated = await prisma.userSubmittedCourse.update({
        where: { id },
        data: { status: "rejected", adminNote: optionalString(body.adminNote) }
      });
      await writeAudit(admin.id, "admin.course_submissions.reject", "UserSubmittedCourse", id, submission, updated);
      return ok({ submission: updated });
    }

    if (action === "merge") {
      const body = await readBody(request);
      const updated = await prisma.userSubmittedCourse.update({
        where: { id },
        data: {
          status: "merged",
          matchedCourseId: assertString(body.matchedCourseId, "matchedCourseId"),
          adminNote: optionalString(body.adminNote)
        }
      });
      await writeAudit(admin.id, "admin.course_submissions.merge", "UserSubmittedCourse", id, submission, updated);
      return ok({ submission: updated });
    }

    const currentSemester = await prisma.semester.findFirst({ where: { schoolId: submission.schoolId, isCurrent: true } });
    const course = await prisma.course.upsert({
      where: { schoolId_code: { schoolId: submission.schoolId, code: submission.code } },
      update: { title: submission.title, status: "active" },
      create: {
        schoolId: submission.schoolId,
        code: submission.code,
        title: submission.title,
        source: "user_submission"
      }
    });

    if (currentSemester) {
      const offering = await prisma.courseOffering.create({
        data: {
          courseId: course.id,
          semesterId: currentSemester.id,
          teacherName: submission.teacherName,
          section: "User Submitted"
        }
      });
      await prisma.courseBoard.create({
        data: {
          courseOfferingId: offering.id,
          title: `${submission.code} ${submission.title}`
        }
      });
    }

    const updated = await prisma.userSubmittedCourse.update({
      where: { id },
      data: { status: "approved", matchedCourseId: course.id }
    });
    await writeAudit(admin.id, "admin.course_submissions.approve", "UserSubmittedCourse", id, submission, updated);
    return ok({ submission: updated, course });
  }

  if (method === "GET" && resource === "boards") {
    const boards = await prisma.courseBoard.findMany({
      include: { courseOffering: { include: { course: true, semester: true } }, memberships: true },
      orderBy: { createdAt: "desc" }
    });
    return ok({ boards });
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

  if (method === "GET" && resource === "teamaking-posts") {
    const posts = await prisma.teamakingPost.findMany({
      include: { user: { include: { profile: true } }, board: { include: { courseOffering: { include: { course: true } } } } },
      orderBy: { createdAt: "desc" }
    });
    return ok({ posts });
  }

  if (method === "PATCH" && resource === "teamaking-posts" && id) {
    const body = await readBody(request);
    const before = await prisma.teamakingPost.findUnique({ where: { id } });
    const post = await prisma.teamakingPost.update({
      where: { id },
      data: { status: optionalString(body.status) ?? before?.status }
    });
    await writeAudit(admin.id, "admin.teamaking_posts.patch", "TeamakingPost", id, before, post);
    return ok({ post });
  }

  if (method === "GET" && resource === "team-up-requests" && id === "reported") {
    const requests = await prisma.teamUpRequest.findMany({
      where: { status: "reported" },
      include: { sender: { include: { profile: true } }, receiver: { include: { profile: true } }, post: true },
      orderBy: { createdAt: "desc" }
    });
    return ok({ requests });
  }

  if (method === "PATCH" && resource === "team-up-requests" && id) {
    const body = await readBody(request);
    const before = await prisma.teamUpRequest.findUnique({ where: { id } });
    const requestRow = await prisma.teamUpRequest.update({
      where: { id },
      data: { status: optionalString(body.status) ?? before?.status }
    });
    await writeAudit(admin.id, "admin.team_up_requests.patch", "TeamUpRequest", id, before, requestRow);
    return ok({ request: requestRow });
  }

  if (method === "GET" && resource === "metrics") {
    const { from, to, format } = dateRangeFromRequest(request);
    const whereCreated = { createdAt: { gte: from, lte: to } };
    const [users, verifiedUsers, posts, teamUpRequests, supportTickets, memberships, uploads] = await Promise.all([
      prisma.user.count({ where: whereCreated }),
      prisma.user.count({ where: { ...whereCreated, isEmailVerified: true } }),
      prisma.teamakingPost.count({ where: whereCreated }),
      prisma.teamUpRequest.count({ where: whereCreated }),
      prisma.supportTicket.count({ where: whereCreated }),
      prisma.courseBoardMembership.count({ where: { joinedAt: { gte: from, lte: to } } }),
      prisma.portfolioItem.count({ where: whereCreated })
    ]);
    const rows = [
      { metric: "new_users", label: "新增用户", value: users, from: from.toISOString(), to: to.toISOString() },
      { metric: "verified_users", label: "已验证用户", value: verifiedUsers, from: from.toISOString(), to: to.toISOString() },
      { metric: "teamaking_posts", label: "Teamaking Posts", value: posts, from: from.toISOString(), to: to.toISOString() },
      { metric: "team_up_requests", label: "Team Up Requests", value: teamUpRequests, from: from.toISOString(), to: to.toISOString() },
      { metric: "support_tickets", label: "Support Tickets", value: supportTickets, from: from.toISOString(), to: to.toISOString() },
      { metric: "board_memberships", label: "Course Board Joins", value: memberships, from: from.toISOString(), to: to.toISOString() },
      { metric: "portfolio_items", label: "Portfolio Uploads", value: uploads, from: from.toISOString(), to: to.toISOString() }
    ];

    if (format === "csv") {
      return csvResponse(rows, `teamaking-metrics-${from.toISOString().slice(0, 10)}-${to.toISOString().slice(0, 10)}.csv`);
    }

    return ok({ metrics: rows, range: { from, to } });
  }

  if (method === "GET" && resource === "configs") {
    const configs = await prisma.siteConfig.findMany({ orderBy: { key: "asc" } });
    return ok({ configs });
  }

  if (method === "PATCH" && resource === "configs" && id) {
    const body = await readBody(request);
    const before = await prisma.siteConfig.findUnique({ where: { key: id } });
    const config = await prisma.siteConfig.upsert({
      where: { key: id },
      update: {
        value: body.value && typeof body.value === "object" ? (body.value as object) : { text: optionalString(body.value) ?? "" },
        updatedByUserId: admin.id
      },
      create: {
        key: id,
        value: body.value && typeof body.value === "object" ? (body.value as object) : { text: optionalString(body.value) ?? "" },
        updatedByUserId: admin.id
      }
    });
    await writeAudit(admin.id, "admin.configs.patch", "SiteConfig", id, before, config);
    return ok({ config });
  }

  if (method === "GET" && resource === "logs") {
    const logs = await prisma.adminAuditLog.findMany({
      include: { adminUser: { include: { profile: true } } },
      orderBy: { createdAt: "desc" },
      take: 100
    });
    return ok({ logs });
  }

  throw new ApiError(404, "找不到管理后台接口。");
}

async function dispatch(method: string, context: RouteContext, request: NextRequest) {
  const path = routeOf(context);
  const root = path[0];

  await ensureSystemIsActive(root);

  if (root === "auth") return handleAuth(method, path, request);
  if (root === "demo") return handleDemo(method, path, request);
  if (root === "onboarding") return handleOnboarding(method, request);
  if (root === "profile") return handleProfile(method, path, request);
  if (root === "contact-info" && path[1] === "me") return handleContactInfo(method, request);
  if (root === "courses") return handleCourses(method, path, request);
  if (root === "boards") return handleBoards(method, path, request);
  if (root === "teamaking-posts") return handleTeamakingPosts(method, path, request);
  if (root === "team-up-interests") return handleTeamUpInterests(method, path);
  if (root === "team-up-requests") return handleTeamUpRequests(method, path, request);
  if (root === "follow-requests") return handleFollowRequests(method, path);
  if (root === "support-tickets") return handleSupportTickets(method, request);
  if (root === "uploads") return handleUploads(method, request);
  if (root === "matches" && method === "GET") return handleMatches();
  if (root === "admin") return handleAdmin(method, path, request);

  throw new ApiError(404, "找不到这个 API 路径。");
}

export async function GET(request: NextRequest, context: RouteContext) {
  return handleApi(() => dispatch("GET", context, request));
}

export async function POST(request: NextRequest, context: RouteContext) {
  return handleApi(() => dispatch("POST", context, request));
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return handleApi(() => dispatch("PATCH", context, request));
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return handleApi(() => dispatch("DELETE", context, request));
}
