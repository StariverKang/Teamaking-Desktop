import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { createHash, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { ApiError, assertString, created, handleApi, ok, optionalString, readBody, stringArray } from "@/lib/http";
import { ERROR_CODES, type ErrorCode } from "@/lib/error-codes";
import { getCurrentUser, isAdminRole, requireAdmin, requireUser, setDemoSessionCookie, setSessionCookie } from "@/lib/session";
import { sendVerificationEmail, shouldExposeVerificationCode } from "@/lib/email";
import { hashPassword, verifyPassword } from "@/lib/password";
import { allowedRequestTransitions, teamUpInterestStatuses } from "@/lib/constants";
import { contactSnapshot, defaultContactVisibility } from "@/lib/contact";
import { getActiveAppVersion, getActiveAppVersionId, getActiveSchool } from "@/lib/app-version";
import {
  bnbuClassificationLabels,
  membershipSourceForClassification,
  normalizedRuleStudentAction,
  relativeTermCodesForRule,
  validateBnbuCourseImportPayload
} from "@/lib/bnbu-course-import";
import {
  demoAccounts,
  demoBoardById,
  demoCourseById,
  demoCourses,
  demoOnboardingOptions,
  demoPeople,
  demoPortfolioItems,
  demoPosts,
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
  demoFollowInbox,
  demoInterestsForPost,
  demoPostById,
  demoPostsForBoard,
  demoReceivedTeamUpInterests,
  resetDemoState,
  sanitizeDemoUser,
  updateDemoFollowRequest,
  updateDemoInterest
} from "@/lib/demo-store";
import {
  extractReadableText,
  fileExtensionOf,
  hasAcceptableMimeForExtension,
  isAllowedProfileFile,
  isRiskyProfileFile,
  parseResumeText,
  portfolioTypeOptions,
  previewKindForFile,
  profileUploadPurposeOptions,
  safeUploadName
} from "@/lib/profile-assets";
import { storeProfileUpload } from "@/lib/upload-storage";

type RouteContext = {
  params: Promise<{
    route?: string[];
  }>;
};

export const runtime = "nodejs";

const profileInclude = {
  faculty: true,
  major: true
};

const userInclude = {
  appVersion: true,
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

const BNBU_PROGRAMMES_URL = "https://www.bnbu.edu.cn/en/faculties_and_schools.htm";
const BNBU_HANDBOOK_URL = "https://ar.bnbu.edu.cn/current_students/student_handbook/programme_handbook.htm";
const BNBU_MIS_URL = "https://mis.bnbu.edu.cn";
const handbookLinkCache = new Map<string, { expiresAt: number; ref: HandbookSourceRef | null }>();
const programmeIntroCache = new Map<string, { expiresAt: number; ref: ProgrammeIntroRef | null }>();
const BNBU_FACULTY_PROGRAMME_PAGES = [
  { code: "FBM", url: "https://fbm.bnbu.edu.cn/en" },
  { code: "FHSS", url: "https://fhss.bnbu.edu.cn/en" },
  { code: "FST", url: "https://fst.bnbu.edu.cn/en" },
  { code: "SCC", url: "https://scc.bnbu.edu.cn/en" },
  { code: "SAI", url: "https://sai.bnbu.edu.cn/en" },
  { code: "SGE", url: "https://sge.bnbu.edu.cn/en" }
];

async function routeOf(context: RouteContext) {
  const params = await context.params;
  return params.route ?? [];
}

function emailDomain(email: string) {
  const pieces = email.toLowerCase().split("@");
  return pieces.length === 2 ? pieces[1] : "";
}

function inferredEntryYearFromEmail(email: string) {
  const localPart = email.toLowerCase().split("@")[0] ?? "";
  const yearDigit = localPart[1];
  if (!yearDigit || !/^\d$/.test(yearDigit)) return null;
  return 2020 + Number(yearDigit);
}

function gradeFromEntryYear(entryYear?: number | null, now = new Date()) {
  if (!entryYear || !Number.isFinite(entryYear)) return null;
  const academicYear = now.getMonth() + 1 >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const level = Math.max(1, Math.min(4, academicYear - entryYear + 1));
  return `Year ${level}`;
}

function academicLockForUser(user: any) {
  const inferredEntryYear = inferredEntryYearFromEmail(user.email);
  const hasAdminOverride = Boolean(user.profile?.academicOverrideAt);
  const entryYear = hasAdminOverride ? user.profile?.entryYear ?? inferredEntryYear : inferredEntryYear ?? user.profile?.entryYear;
  const entryTerm = hasAdminOverride ? user.profile?.entryTerm ?? "Fall" : "Fall";
  const grade = hasAdminOverride ? user.profile?.grade ?? gradeFromEntryYear(entryYear) : gradeFromEntryYear(entryYear) ?? user.profile?.grade ?? null;
  return {
    locked: Boolean(inferredEntryYear) && !hasAdminOverride,
    source: hasAdminOverride ? "admin_override" : inferredEntryYear ? "email_second_digit" : "profile_fallback",
    inferredEntryYear,
    entryYear,
    entryTerm,
    grade,
    overrideReason: user.profile?.academicOverrideReason ?? null,
    overrideAt: user.profile?.academicOverrideAt ?? null
  };
}

function profileWithAcademicLock(user: any) {
  if (!user.profile) return user.profile;
  const academic = academicLockForUser(user);
  return {
    ...user.profile,
    grade: academic.grade,
    entryYear: academic.entryYear,
    entryTerm: academic.entryTerm,
    academicLock: academic
  };
}

function isCourseReviewDeleted(comment: any) {
  return comment.status === "deleted" || Boolean(comment.deletedAt);
}

function serializeCourseReviewComment(comment: any, childMap: Map<string | null, any[]>): any {
  const deleted = isCourseReviewDeleted(comment);
  return {
    id: comment.id,
    courseId: comment.courseId,
    userId: comment.userId,
    parentId: comment.parentId,
    body: deleted ? "评论已删除" : comment.body,
    status: comment.status,
    deleted,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    user: comment.user ? publicUser(comment.user) : null,
    replies: (childMap.get(comment.id) ?? []).map((reply) => serializeCourseReviewComment(reply, childMap))
  };
}

function contentImageUrls(value: unknown) {
  return stringArray(value).slice(0, 3);
}

function serializeContentDocument(document: any) {
  return {
    id: document.id,
    kind: document.kind,
    nodeType: document.nodeType ?? "document",
    parentId: document.parentId,
    slug: document.slug,
    title: document.title,
    summary: document.summary,
    bodyMarkdown: document.bodyMarkdown,
    imageUrls: contentImageUrls(document.imageUrls),
    status: document.status,
    displayOrder: document.displayOrder,
    publishedAt: document.publishedAt,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    children: (document.children ?? []).map((child: any) => serializeContentDocument(child))
  };
}

function defaultDeveloperContactDocument(appVersionId: string) {
  const now = new Date();
  return {
    id: "default-developer-contact",
    appVersionId,
    kind: "developer_contact",
    parentId: null,
    slug: "jayden-kang",
    title: "联系开发者",
    summary: "TEAMAKING 目前由 Jayden Kang 维护。你可以通过微信或邮箱联系开发者。",
    bodyMarkdown: [
      "## Jayden Kang / 康泓正",
      "",
      "BNBU 媒体与传播方向学生，关注产品原型、数据处理、内容运营和学生协作工具。TEAMAKING 当前用于把课程配置、Proof-of-Work Profile、Course Board 和轻量组队流程放在同一个校园场景里验证。",
      "",
      "- WeChat: Oboretastellar",
      "- Email: wojiaonzj2005@163.com",
      "- Skills: product operations, content systems, SQL/SPSS data analysis, Figma, writing, presentation, community operations",
      "- Experience: sports media operation, AI marketing, Web3 product operation, social media operation, language teaching"
    ].join("\n"),
    imageUrls: [],
    status: "published",
    displayOrder: 0,
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
    children: []
  };
}

function publicUser(user: any, contactContext?: Parameters<typeof contactSnapshot>[1]) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    suspendedUntil: user.suspendedUntil,
    isEmailVerified: user.isEmailVerified,
    onboardingCompleted: user.onboardingCompleted,
    school: user.school,
    profile: profileWithAcademicLock(user),
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

async function persistErrorEvent(
  request: NextRequest,
  error: {
    requestId: string;
    errorCode: ErrorCode;
    message: string;
    status: number;
    stackDigest?: string;
    metadata?: unknown;
  }
) {
  try {
    const [appVersionId, user] = await Promise.all([
      getActiveAppVersionId().catch(() => "legacy"),
      getCurrentUser().catch(() => null)
    ]);
    await prisma.errorEvent.create({
      data: {
        appVersionId,
        requestId: error.requestId,
        errorCode: error.errorCode,
        message: error.message,
        status: error.status,
        path: request.nextUrl.pathname,
        method: request.method,
        userId: user?.id ?? null,
        actorRole: user?.role ?? null,
        stackDigest: error.stackDigest,
        metadata: toJson(error.metadata ?? {})
      }
    });
  } catch (logError) {
    console.error("Failed to persist API error event", logError);
  }
}

async function operationLog(input: {
  actorUserId?: string | null;
  actorRole?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  method?: string | null;
  path?: string | null;
  status?: string;
  summary?: unknown;
  metadata?: unknown;
  appVersionId?: string;
}) {
  const appVersionId = input.appVersionId ?? (await getActiveAppVersionId());
  await prisma.operationLog.create({
    data: {
      appVersionId,
      actorUserId: input.actorUserId ?? null,
      actorRole: input.actorRole ?? null,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      method: input.method ?? null,
      path: input.path ?? null,
      status: input.status ?? "success",
      summary: toJson(input.summary ?? {}),
      metadata: toJson(input.metadata ?? {})
    }
  });
}

async function safeOperationLog(input: Parameters<typeof operationLog>[0]) {
  try {
    await operationLog(input);
  } catch (error) {
    console.error("Failed to write operation log", error);
  }
}

async function writeAudit(adminUserId: string, action: string, targetType: string, targetId?: string | null, beforeValue?: unknown, afterValue?: unknown) {
  const appVersionId = await getActiveAppVersionId();
  await prisma.adminAuditLog.create({
    data: {
      appVersionId,
      adminUserId,
      action,
      targetType,
      targetId,
      beforeValue: beforeValue === undefined ? undefined : toJson(beforeValue),
      afterValue: afterValue === undefined ? undefined : toJson(afterValue)
    }
  });
  await operationLog({
    appVersionId,
    actorUserId: adminUserId,
    actorRole: "admin",
    action,
    targetType,
    targetId,
    summary: { targetType, targetId }
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
      memberships: true,
      sections: {
        include: {
          members: { where: { status: "active" }, select: { id: true } }
        },
        orderBy: { code: "asc" }
      }
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

  if (!membership || membership.status !== "active") {
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

async function shareActiveBoard(ownerId: string, viewerId: string) {
  const membership = await prisma.courseBoardMembership.findFirst({
    where: {
      userId: ownerId,
      status: "active",
      board: {
        status: "active",
        memberships: {
          some: {
            userId: viewerId,
            status: "active"
          }
        }
      }
    },
    select: { id: true }
  });
  return Boolean(membership);
}

async function publicPortfolioItems(items: any[] = [], owner: any, viewer: any) {
  if (!owner?.id || !viewer?.id) return [];
  if (owner.id === viewer.id) return items;

  const isVerifiedSameSchool = Boolean(owner.schoolId && viewer.schoolId && owner.schoolId === viewer.schoolId && viewer.isEmailVerified);
  const needsSharedBoard = items.some((item) => item.visibility === "same_course_board");
  const hasSharedBoard = needsSharedBoard ? await shareActiveBoard(owner.id, viewer.id) : false;

  return items.filter((item) => {
    if (item.visibility === "private") return false;
    if (item.visibility === "same_course_board") return hasSharedBoard;
    if (item.visibility === "same_school" || item.visibility === "public") return isVerifiedSameSchool;
    return false;
  });
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
    portfolioItems: await publicPortfolioItems(user.portfolioItems ?? [], user, viewer)
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
      portfolioItems: await publicPortfolioItems(post.user?.portfolioItems ?? [], post.user, viewer)
    },
    portfolioEvidenceCount: portfolioIds.length,
    contactInfo: post.user?.contactInfo ? contactSnapshot(post.user.contactInfo, context) : {}
  };
}

async function upsertVerifiedUser(input: {
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

type VerificationPurpose = "register" | "reset_password" | "login";

async function supportedSchoolDomainForEmail(email: string) {
  const domain = emailDomain(email);
  if (!domain) return null;
  const appVersionId = await getActiveAppVersionId();
  return prisma.schoolEmailDomain.findFirst({
    where: { domain, status: "active", school: { appVersionId } },
    include: { school: true }
  });
}

function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function recordAuthEvent(input: {
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

async function assertVerificationCooldown(email: string, purpose: VerificationPurpose) {
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

async function createVerification(email: string, purpose: VerificationPurpose, schoolName?: string) {
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

async function consumeVerification(email: string, code: string, purpose: VerificationPurpose) {
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

function passwordHashFor(password: string) {
  try {
    return hashPassword(password);
  } catch (error) {
    throw new ApiError(400, error instanceof Error ? error.message : "密码不符合要求。");
  }
}

type BootstrapAdminConfig = {
  email: string;
  password: string;
  role: string;
  displayName: string;
};

function safeStringEqual(left: string, right: string) {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

function bootstrapAdminConfig(): BootstrapAdminConfig | null {
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

async function upsertBootstrapAdmin(config: BootstrapAdminConfig) {
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

function assertAccountCanLogin(user: any) {
  if (user.status === "banned") {
    throw new ApiError(403, "这个账号已被封禁，请联系管理员。", ERROR_CODES.AUTH_ACCOUNT_RESTRICTED);
  }

  if (user.suspendedUntil && new Date(user.suspendedUntil).getTime() > Date.now()) {
    throw new ApiError(403, "这个账号当前处于限时禁止操作状态，请稍后再试。", ERROR_CODES.AUTH_ACCOUNT_RESTRICTED);
  }
}

function restrictedAccountRedirect(user: any) {
  if (user.status === "banned") return "/account-restricted";
  if (user.suspendedUntil && new Date(user.suspendedUntil).getTime() > Date.now()) return "/account-restricted";
  return null;
}

async function assertLoginFailureBudget(email: string) {
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

async function ensureSystemIsActive(root?: string) {
  if (!root || ["auth", "admin", "demo", "support-tickets"].includes(root)) return;

  const config = await prisma.siteConfig.findUnique({ where: { key: "system_status" } });
  const value = config?.value && typeof config.value === "object" && !Array.isArray(config.value) ? (config.value as Record<string, unknown>) : null;

  if (value?.status === "paused") {
    throw new ApiError(503, typeof value.message === "string" && value.message ? value.message : "系统当前处于维护暂停状态，请稍后再试。", ERROR_CODES.API_SYSTEM_PAUSED);
  }
}

async function handleAuth(method: string, path: string[], request: NextRequest) {
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
    return ok({ user: user ? publicUser(user) : null });
  }

  throw new ApiError(404, "找不到认证接口。");
}

async function ensureDemoUser(account: string) {
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

async function handleOnboarding(method: string, path: string[], request: NextRequest) {
  const user = await requireUser();

  if (isDemoUser(user)) {
    if (method === "GET") {
      return ok({ user: publicUser(user), academicLock: academicLockForUser(user), ...demoOnboardingOptions() });
    }
    if (method === "POST" && path[1] === "tour-dismiss") return ok({ message: "本地视觉演示模式已模拟关闭新手引导。" });
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

  if (method === "GET") {
    const [faculties, majors, semesters] = await Promise.all([
      prisma.faculty.findMany({ where: { schoolId: user.schoolId ?? undefined }, orderBy: { name: "asc" } }),
      prisma.major.findMany({ where: { schoolId: user.schoolId ?? undefined }, include: { faculty: true }, orderBy: { name: "asc" } }),
      prisma.semester.findMany({ where: { schoolId: user.schoolId ?? undefined }, orderBy: [{ year: "desc" }, { term: "asc" }] })
    ]);

    return ok({ user: publicUser(user), academicLock: academicLockForUser(user), faculties, majors, semesters });
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
  const fieldText = (field: string, fallback?: string | null) => {
    if (Object.prototype.hasOwnProperty.call(body, field)) return typeof body[field] === "string" ? (body[field] as string).trim() : "";
    return fallback ?? "";
  };

  return {
    title: optionalString(body.title) ?? existing?.title ?? "Untitled evidence",
    type,
    relatedCourseId: optionalString(body.relatedCourseId) ?? existing?.relatedCourseId,
    semesterText: optionalString(body.semesterText) ?? existing?.semesterText,
    myRole: optionalString(body.myRole) ?? existing?.myRole,
    contributionDescription: fieldText("contributionDescription", existing?.contributionDescription),
    isGroupWork: typeof body.isGroupWork === "boolean" ? body.isGroupWork : existing?.isGroupWork ?? false,
    fileName,
    fileMimeType: optionalString(body.fileMimeType) ?? existing?.fileMimeType,
    fileSize: typeof body.fileSize === "number" ? body.fileSize : existing?.fileSize,
    fileExtension,
    storageKey: optionalString(body.storageKey) ?? existing?.storageKey,
    storageMode: optionalString(body.storageMode) ?? existing?.storageMode,
    storageProvider: optionalString(body.storageProvider) ?? existing?.storageProvider,
    objectKey: optionalString(body.objectKey) ?? existing?.objectKey,
    scanStatus: optionalString(body.scanStatus) ?? existing?.scanStatus ?? "not_scanned",
    fileUrl: optionalString(body.fileUrl) ?? existing?.fileUrl,
    externalUrl: optionalString(body.externalUrl) ?? existing?.externalUrl,
    previewKind,
    outcome: fieldText("outcome", existing?.outcome),
    reflection: fieldText("reflection", existing?.reflection),
    parsedText: optionalString(body.parsedText) ?? existing?.parsedText,
    metadata: jsonObject(body.metadata, existing?.metadata ?? {}),
    visibility: optionalString(body.visibility) ?? existing?.visibility ?? "same_school",
    isPinned
  };
}

async function resumeBufferFromUrl(resumeUrl: string) {
  if (resumeUrl.startsWith("data:")) {
    const base64 = resumeUrl.split(",")[1] ?? "";
    return Buffer.from(base64, "base64");
  }

  if (resumeUrl.startsWith("/uploads/") || resumeUrl.startsWith("uploads/")) {
    const normalized = resumeUrl.startsWith("/") ? resumeUrl : `/${resumeUrl}`;
    const publicRoot = path.resolve(/*turbopackIgnore: true*/ process.cwd(), "public", "uploads");
    const absolutePath = path.resolve(/*turbopackIgnore: true*/ process.cwd(), "public", `.${normalized}`);
    if (!absolutePath.startsWith(`${publicRoot}${path.sep}`)) throw new ApiError(403, "简历文件路径不允许重新解析。");
    return readFile(absolutePath);
  }

  if (/^https?:\/\//i.test(resumeUrl)) {
    const response = await fetch(resumeUrl);
    if (!response.ok) throw new ApiError(400, `无法读取简历 URL：${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > 30 * 1024 * 1024) throw new ApiError(400, "简历文件超过 30MB，无法重新解析。");
    return buffer;
  }

  throw new ApiError(400, "当前简历 URL 不是可重新解析的文件地址。");
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
    await operationLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: "follow_requests.create",
      targetType: "FollowRequest",
      targetId: requestRow.id,
      method,
      path: request.nextUrl.pathname,
      summary: { receiverId }
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
      if (method === "POST" && path[2] === "reparse-resume") {
        const resumeText = user.profile?.resumeParsedData && typeof user.profile.resumeParsedData === "object" && "rawText" in user.profile.resumeParsedData
          ? String((user.profile.resumeParsedData as Record<string, unknown>).rawText ?? "")
          : "";
        const resumeParsedData = parseResumeText(resumeText, user.profile?.resumeFileName ?? "demo-resume.txt");
        return ok({ resumeParsedData, message: "本地视觉演示模式已模拟重新整理简历。" });
      }
      if (method === "GET") return ok({ user: publicUser(user), contactInfo: user.contactInfo, portfolioItems: demoPortfolioItems(user.id.replace("demo-user-", "")), officialLinks: [] });
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
        await operationLog({
          actorUserId: user.id,
          actorRole: user.role,
          action: "portfolio_items.create",
          targetType: "PortfolioItem",
          targetId: portfolioItem.id,
          method,
          path: request.nextUrl.pathname,
          summary: { title: portfolioItem.title, type: portfolioItem.type }
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
        await operationLog({
          actorUserId: user.id,
          actorRole: user.role,
          action: "portfolio_items.patch",
          targetType: "PortfolioItem",
          targetId: portfolioItem.id,
          method,
          path: request.nextUrl.pathname,
          summary: { title: portfolioItem.title, type: portfolioItem.type }
        });
        return ok({ portfolioItem });
      }

      if (method === "DELETE" && path[3]) {
        await prisma.portfolioItem.deleteMany({ where: { id: path[3], userId: user.id } });
        await operationLog({
          actorUserId: user.id,
          actorRole: user.role,
          action: "portfolio_items.delete",
          targetType: "PortfolioItem",
          targetId: path[3],
          method,
          path: request.nextUrl.pathname
        });
        return ok({ message: "作品或证明材料已删除。" });
      }
    }

    if (method === "POST" && path[2] === "reparse-resume") {
      const fullUser = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        include: { profile: true }
      });
      const resumeUrl = fullUser.profile?.resumeUrl;
      const resumeFileName = fullUser.profile?.resumeFileName ?? "resume";
      if (!resumeUrl) throw new ApiError(400, "当前 Profile 还没有简历 URL。");
      const buffer = await resumeBufferFromUrl(resumeUrl);
      const parsedText = await extractReadableText(resumeFileName, buffer);
      const resumeParsedData = parseResumeText(parsedText, resumeFileName);
      const profile = await prisma.userProfile.update({
        where: { userId: user.id },
        data: { resumeParsedData: toJson(resumeParsedData) }
      });
      await operationLog({
        actorUserId: user.id,
        actorRole: user.role,
        action: "profile.resume.reparse",
        targetType: "UserProfile",
        targetId: profile.id,
        method,
        path: request.nextUrl.pathname,
        summary: {
          resumeFileName,
          parser: resumeParsedData.parser,
          skills: resumeParsedData.skills,
          sections: Object.keys(resumeParsedData.sections ?? {})
        }
      });
      return ok({ resumeParsedData, message: "简历已重新整理。" });
    }

    if (method === "GET") {
      const fullUser = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        include: {
          ...userInclude,
          portfolioItems: { include: { relatedCourse: true }, orderBy: { createdAt: "desc" } }
        }
      });
      return ok({
        user: publicUser(fullUser),
        contactInfo: fullUser.contactInfo,
        portfolioItems: fullUser.portfolioItems,
        officialLinks: await officialAcademicLinksForUser(fullUser)
      });
    }

    if (method === "PATCH") {
      const body = await readBody(request);
      const academic = academicLockForUser(user);
      const profile = await prisma.userProfile.upsert({
        where: { userId: user.id },
        update: {
          displayName: optionalString(body.displayName) ?? user.profile?.displayName ?? user.email.split("@")[0],
          nickname: optionalString(body.nickname),
          avatarUrl: optionalString(body.avatarUrl),
          backgroundImageUrl: optionalString(body.backgroundImageUrl),
          headline: optionalString(body.headline),
          bio: optionalString(body.bio) ?? "",
          grade: academic.grade,
          entryYear: academic.entryYear ?? null,
          entryTerm: academic.entryTerm,
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
          grade: academic.grade,
          entryYear: academic.entryYear ?? null,
          entryTerm: academic.entryTerm,
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

      await operationLog({
        actorUserId: user.id,
        actorRole: user.role,
        action: "profile.patch",
        targetType: "UserProfile",
        targetId: profile.id,
        method,
        path: request.nextUrl.pathname,
        summary: { displayName: profile.displayName, grade: profile.grade, entryYear: profile.entryYear, entryTerm: profile.entryTerm }
      });
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

    await operationLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: "contact_info.patch",
      targetType: "ContactInfo",
      targetId: contactInfo.id,
      method,
      path: request.nextUrl.pathname,
      summary: { visibilitySettings: contactInfo.visibilitySettings }
    });
    return ok({ contactInfo });
  }

  throw new ApiError(405, "这个联系方式接口不支持当前请求方式。");
}

async function handleFriends(method: string, request: NextRequest) {
  const user = await requireUser();
  if (method !== "GET") throw new ApiError(405, "好友接口不支持当前请求方式。");

  const query = normalizeSearch(request.nextUrl.searchParams.get("query") ?? "");
  if (isDemoUser(user)) {
    const friends = ["cs", "media", "admin"]
      .map((account) => sanitizeDemoUser(demoUserForAccount(account), user.id))
      .filter((friend) => friend.id !== user.id)
      .map((friend) => publicUser(friend))
      .filter((friend) => {
        const haystack = [friend.email, friend.profile?.displayName, friend.profile?.major?.name, friend.profile?.grade].filter(Boolean).join(" ").toLowerCase();
        return !query || haystack.includes(query);
      });
    return ok({ friends, total: friends.length });
  }

  const accepted = await prisma.followRequest.findMany({
    where: {
      status: "accepted",
      OR: [{ senderId: user.id }, { receiverId: user.id }]
    },
    include: {
      sender: { include: userInclude },
      receiver: { include: userInclude }
    },
    orderBy: { updatedAt: "desc" }
  });
  const friends = accepted
    .map((requestRow) => (requestRow.senderId === user.id ? requestRow.receiver : requestRow.sender))
    .filter((friend) => friend.schoolId === user.schoolId)
    .map((friend) => publicUser(friend))
    .filter((friend) => {
      const haystack = [friend.email, friend.profile?.displayName, friend.profile?.major?.name, friend.profile?.grade, friend.role].filter(Boolean).join(" ").toLowerCase();
      return !query || haystack.includes(query);
    });

  return ok({ friends, total: friends.length });
}

async function handleNotifications(method: string) {
  const user = await requireUser();
  if (method !== "GET") throw new ApiError(405, "通知接口不支持当前请求方式。");

  if (isDemoUser(user)) {
    const teamUpCount = demoReceivedTeamUpInterests(user.id).filter((item) => item.status === "sent").length;
    const followRequestCount = demoFollowInbox(user.id).filter((item) => item.status === "pending").length;
    return ok({
      summary: {
        teamUpInterests: teamUpCount,
        followRequests: followRequestCount,
        total: teamUpCount + followRequestCount
      }
    });
  }

  const [teamUpInterests, followRequests] = await Promise.all([
    prisma.teamUpRequest.count({ where: { receiverId: user.id, status: "sent" } }),
    prisma.followRequest.count({ where: { receiverId: user.id, status: "pending" } })
  ]);

  return ok({
    summary: {
      teamUpInterests,
      followRequests,
      total: teamUpInterests + followRequests
    }
  });
}

async function commentsForCourse(courseId: string, page: number, pageSize: number) {
  const comments = await prisma.courseReviewComment.findMany({
    where: { courseId },
    include: { user: { include: userInclude } },
    orderBy: { createdAt: "asc" }
  });
  const childMap = new Map<string | null, any[]>();
  for (const comment of comments) {
    const key = comment.parentId ?? null;
    childMap.set(key, [...(childMap.get(key) ?? []), comment]);
  }
  const topLevel = childMap.get(null) ?? [];
  const total = topLevel.length;
  const safePageSize = Math.min(50, Math.max(1, pageSize || 10));
  const safePage = Math.max(1, page || 1);
  const visible = topLevel.slice((safePage - 1) * safePageSize, safePage * safePageSize);
  return {
    comments: visible.map((comment) => serializeCourseReviewComment(comment, childMap)),
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / safePageSize))
    }
  };
}

async function handleCourseCommentReplies(method: string, path: string[], request: NextRequest) {
  const user = await requireUser();
  const commentId = path[1];
  const action = path[2];
  if (!commentId) throw new ApiError(404, "缺少评论编号。");

  const parent = await prisma.courseReviewComment.findUnique({
    where: { id: commentId },
    include: { course: true }
  });
  if (!parent) throw new ApiError(404, "找不到这条评论。");
  if (!isDemoUser(user)) assertSameSchool(user, parent.course.schoolId);

  if (method === "POST" && action === "replies") {
    const body = await readBody(request);
    const text = assertString(body.body, "body").trim();
    if (!text) throw new ApiError(400, "回复内容不能为空。");
    if (text.length > 2000) throw new ApiError(400, "回复内容不能超过 2000 字。");
    if (isDemoUser(user)) {
      return created({
        comment: {
          id: `demo-reply-${Date.now()}`,
          courseId: parent.courseId,
          parentId: parent.id,
          userId: user.id,
          body: text,
          status: "active",
          user: publicUser(user),
          replies: [],
          createdAt: new Date()
        }
      });
    }
    const reply = await prisma.courseReviewComment.create({
      data: {
        courseId: parent.courseId,
        parentId: parent.id,
        userId: user.id,
        body: text
      },
      include: { user: { include: userInclude } }
    });
    await operationLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: "course_review.reply.create",
      targetType: "CourseReviewComment",
      targetId: reply.id,
      method,
      path: request.nextUrl.pathname,
      summary: { courseId: parent.courseId, parentId: parent.id }
    });
    return created({ comment: serializeCourseReviewComment(reply, new Map()) });
  }

  if (method === "DELETE" && !action) {
    const canDelete = parent.userId === user.id || isAdminRole(user.role);
    if (!canDelete) throw new ApiError(403, "只有评论者本人或管理员可以删除评论。");
    if (isDemoUser(user)) return ok({ message: "本地视觉演示模式已模拟删除课程评论。" });
    const deleted = await prisma.courseReviewComment.update({
      where: { id: commentId },
      data: {
        status: "deleted",
        deletedAt: new Date(),
        deletedByUserId: user.id
      }
    });
    await operationLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: "course_review.comment.delete",
      targetType: "CourseReviewComment",
      targetId: commentId,
      method,
      path: request.nextUrl.pathname,
      summary: { courseId: parent.courseId }
    });
    return ok({ comment: deleted, message: "评论已删除，楼层结构已保留。" });
  }

  throw new ApiError(404, "找不到课程评论接口。");
}

async function handleContent(method: string, request: NextRequest) {
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
    const currentSemester = user.schoolId
      ? await prisma.semester.findFirst({ where: { schoolId: user.schoolId, isCurrent: true } })
      : null;
    const officialLinks = await officialAcademicLinksForUser(user);

    if (currentSemester) {
      const rules = await prisma.courseCurriculumRule.findMany({
        where: {
          status: "active",
          studentAction: { in: ["default_join", "recommend_only"] },
          course: { schoolId: user.schoolId ?? "" }
        },
        include: { semester: true, course: { include: courseInclude } },
        orderBy: [{ studentAction: "asc" }, { classification: "asc" }]
      });
      const matchedRules = rules.filter((rule) => {
        return curriculumRuleMatchesUser(rule, user, currentSemester);
      });
      if (matchedRules.length) {
        const seenCourseIds = new Set<string>();
        return ok({
          officialLinks,
          academicContext: {
            semester: currentSemester,
            relativeTermCode: relativeTermCodeForProfile(user.profile, currentSemester)
          },
          courses: matchedRules
            .filter((rule) => {
              if (seenCourseIds.has(rule.courseId)) return false;
              seenCourseIds.add(rule.courseId);
              return true;
            })
            .map((rule) => ({
              ...rule.course,
              recommendation: {
                recommendedGrade: grade ?? "未填写年级",
                isRequired: rule.studentAction === "default_join",
                classification: rule.classification,
                classificationLabel: rule.classificationLabel,
                studentAction: rule.studentAction,
                reason: rule.studentAction === "default_join" ? "根据 BNBU 课程配置默认加入" : "根据 BNBU 课程配置推荐"
              }
            }))
        });
      }
    }

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
      officialLinks,
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

  if (method === "GET" && path[1] === "my") {
    const user = await requireUser();
    if (isDemoUser(user)) {
      const course = demoCourses[0];
      return ok({
        memberships: [
          {
            id: "demo-membership-current",
            source: "manual",
            status: "active",
            sectionCode: "1001",
            joinedAt: new Date(),
            board: course.offerings?.[0]?.boards?.[0]
              ? {
                  ...course.offerings[0].boards[0],
                  courseOffering: {
                    ...course.offerings[0],
                    course,
                    semester: course.offerings[0].semester
                  }
                }
              : null
          }
        ],
        officialLinks: []
      });
    }

    const currentSemester = user.schoolId
      ? await prisma.semester.findFirst({ where: { schoolId: user.schoolId, isCurrent: true } })
      : null;
    const rows = await prisma.courseBoardMembership.findMany({
      where: { userId: user.id, status: "active" },
      include: {
        board: {
          include: {
            courseOffering: {
              include: {
                semester: true,
                course: { include: courseInclude }
              }
            }
          }
        }
      },
      orderBy: { joinedAt: "desc" }
    });
    const memberships = await Promise.all(rows.map(async (membership) => ({
      ...membership,
      advisory: await courseJoinAdvisory(membership.board.courseOffering.courseId, user, currentSemester)
    })));
    return ok({
      memberships,
      officialLinks: await officialAcademicLinksForUser(user),
      academicContext: currentSemester
        ? { semester: currentSemester, relativeTermCode: relativeTermCodeForProfile(user.profile, currentSemester) }
        : null
    });
  }

  if (method === "GET" && path[1] === "search") {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(50, Math.max(1, Number.parseInt(url.searchParams.get("pageSize") ?? "10", 10) || 10));
    const start = (page - 1) * pageSize;
    const user = await requireUser();
    if (isDemoUser(user)) {
      const courses = demoCourses
        .map((course) => ({ ...course, ...scoreCourseMatch(course, q) }))
        .filter((course) => !q || course.score > 0)
        .sort((a, b) => b.score - a.score || a.code.localeCompare(b.code));
      return ok({
        courses: courses.slice(start, start + pageSize),
        pagination: {
          page,
          pageSize,
          total: courses.length,
          totalPages: Math.max(1, Math.ceil(courses.length / pageSize))
        }
      });
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
      .sort((a, b) => b.score - a.score || a.code.localeCompare(b.code));

    return ok({
      courses: courses.slice(start, start + pageSize),
      pagination: {
        page,
        pageSize,
        total: courses.length,
        totalPages: Math.max(1, Math.ceil(courses.length / pageSize))
      }
    });
  }

  if (method === "POST" && path[1] && path[2] === "join") {
    const user = await requireUser();
    const courseId = path[1];
    if (isDemoUser(user)) {
      const course = demoCourseById(courseId);
      const board = course.offerings?.[0]?.boards?.[0];
      return ok({
        board,
        membership: { id: "demo-membership-current", userId: user.id, boardId: board?.id },
        message: "本地视觉演示模式已模拟加入 Course Board。"
      });
    }

    const body = await readBody(request);
    const sectionCode = normalizeSectionCode(body.sectionCode);
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course || course.status !== "active") throw new ApiError(404, "找不到可加入的课程。");
    assertSameSchool(user, course.schoolId);

    const currentSemester = await prisma.semester.findFirst({
      where: { schoolId: course.schoolId, isCurrent: true }
    });
    if (!currentSemester) {
      throw new ApiError(400, "当前学校还没有配置 current semester，暂时无法创建 Course Board。");
    }

    const result = await prisma.$transaction(async (tx) => {
      const offeringWithBoard = await tx.courseOffering.findFirst({
        where: {
          courseId: course.id,
          semesterId: currentSemester.id,
          status: { not: "cancelled" },
          boards: { some: { status: "active" } }
        },
        include: { boards: { where: { status: "active" }, orderBy: { createdAt: "asc" }, take: 1 } },
        orderBy: { createdAt: "asc" }
      });
      let board = offeringWithBoard?.boards?.[0] ?? null;
      let offeringId = offeringWithBoard?.id ?? "";

      if (!board) {
        const reusableOffering = await tx.courseOffering.findFirst({
          where: {
            courseId: course.id,
            semesterId: currentSemester.id,
            status: { not: "cancelled" }
          },
          orderBy: { createdAt: "asc" }
        });
        const offering = reusableOffering ?? await tx.courseOffering.create({
          data: {
            courseId: course.id,
            semesterId: currentSemester.id,
            teacherName: null,
            section: null,
            sourceRefIds: ["manual_search_join"],
            status: "active"
          }
        });
        offeringId = offering.id;
        board = await tx.courseBoard.findFirst({
          where: { courseOfferingId: offeringId, status: "active" },
          orderBy: { createdAt: "asc" }
        });
        if (!board) {
          board = await tx.courseBoard.create({
            data: {
              courseOfferingId: offeringId,
              title: `${course.code} ${course.title}`,
              rules: "这是 TEAMAKING 平台内自选加入的 Course Board，可用于自由选修、跨专业合作或兴趣组队；不代表官方选课名单。"
            }
          });
        }
      }

      const section = await findOrCreateBoardSection(tx, board.id, sectionCode, user.id);
      const membership = await tx.courseBoardMembership.upsert({
        where: { userId_boardId: { userId: user.id, boardId: board.id } },
        update: { status: "active", source: "manual", sectionId: section.id, sectionCode, leftAt: null },
        create: {
          userId: user.id,
          boardId: board.id,
          sectionId: section.id,
          sectionCode,
          source: "manual",
          status: "active"
        }
      });
      return { board, membership };
    });

    await operationLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: "course.manual_join",
      targetType: "Course",
      targetId: course.id,
      method,
      path: request.nextUrl.pathname,
      summary: {
        courseCode: course.code,
        boardId: result.board.id,
        sectionCode,
        reason: "student_search_or_free_elective"
      }
    });

    return ok({
      board: result.board,
      membership: result.membership,
      message: `你已加入 ${result.board.title} 的 ${sectionCode} section。自由选修/手动加入只代表平台内自选，不代表官方选课名单。`
    });
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

  if (path[1] && path[2] === "comments") {
    const user = await requireUser();
    const courseId = path[1];

    if (isDemoUser(user)) {
      if (method === "GET") {
        return ok({
          comments: [],
          pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 },
          message: "本地视觉演示模式暂未保存课程评论。"
        });
      }
      if (method === "POST") {
        const body = await readBody(request);
        const text = assertString(body.body, "body").trim();
        return created({
          comment: {
            id: `demo-course-comment-${Date.now()}`,
            courseId,
            userId: user.id,
            parentId: null,
            body: text,
            status: "active",
            user: publicUser(user),
            replies: [],
            createdAt: new Date()
          },
          message: "本地视觉演示模式已模拟发布课程评价。"
        });
      }
    }

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new ApiError(404, "找不到这门课程。");
    assertSameSchool(user, course.schoolId);

    if (method === "GET") {
      const page = Number(request.nextUrl.searchParams.get("page") ?? "1") || 1;
      const pageSize = Number(request.nextUrl.searchParams.get("pageSize") ?? "10") || 10;
      return ok(await commentsForCourse(courseId, page, pageSize));
    }

    if (method === "POST") {
      const body = await readBody(request);
      const text = assertString(body.body, "body").trim();
      if (!text) throw new ApiError(400, "评论内容不能为空。");
      if (text.length > 2000) throw new ApiError(400, "评论内容不能超过 2000 字。");
      const comment = await prisma.courseReviewComment.create({
        data: {
          courseId,
          userId: user.id,
          body: text
        },
        include: { user: { include: userInclude } }
      });
      await operationLog({
        actorUserId: user.id,
        actorRole: user.role,
        action: "course_review.comment.create",
        targetType: "CourseReviewComment",
        targetId: comment.id,
        method,
        path: request.nextUrl.pathname,
        summary: { courseId }
      });
      return created({ comment: serializeCourseReviewComment(comment, new Map()), message: "课程评价已发布。" });
    }
  }

  if (method === "GET" && path[1]) {
    const user = await requireUser();
    if (isDemoUser(user)) {
      return ok({ course: demoCourseById(path[1]), officialLinks: [] });
    }

    const course = await prisma.course.findUnique({
      where: { id: path[1] },
      include: courseInclude
    });

    if (!course) throw new ApiError(404, "找不到这门课程。");
    assertSameSchool(user, course.schoolId);
    return ok({ course, officialLinks: await officialAcademicLinksForUser(user) });
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
      return ok({ board, isJoined: true, memberCount: demoPeople(boardId).length, sections: [{ code: "1001", memberCount: demoPeople(boardId).length }], myMembership: { sectionCode: "1001" } });
    }

    const board = await getBoardForUser(boardId);
    assertSameSchool(user, board.courseOffering.course.schoolId);
    const activeMemberships = board.memberships.filter((membership) => membership.status === "active");
    const isJoined = user
      ? activeMemberships.some((membership) => membership.userId === user.id)
      : false;
    const myMembership = activeMemberships.find((membership) => membership.userId === user.id) ?? null;
    const sectionCounts = new Map<string, number>();
    activeMemberships.forEach((membership) => {
      if (membership.sectionCode) sectionCounts.set(membership.sectionCode, (sectionCounts.get(membership.sectionCode) ?? 0) + 1);
    });
    const sections = board.sections
      .map((section) => ({
        id: section.id,
        code: section.code,
        source: section.source,
        memberCount: sectionCounts.get(section.code) ?? section.members.length
      }))
      .sort((a, b) => a.code.localeCompare(b.code));
    return ok({ board, isJoined, memberCount: activeMemberships.length, myMembership, sections });
  }

  if (method === "POST" && path[2] === "join") {
    const user = await requireUser();
    if (isDemoUser(user)) {
      return ok({
        membership: { id: "demo-membership-current", userId: user.id, boardId },
        message: "本地视觉演示模式已模拟加入 Course Board。"
      });
    }

    const body = await readBody(request);
    const sectionCode = normalizeSectionCode(body.sectionCode);
    const board = await getBoardForUser(boardId);
    assertSameSchool(user, board.courseOffering.course.schoolId);
    const membership = await prisma.$transaction(async (tx) => {
      const section = await findOrCreateBoardSection(tx, boardId, sectionCode, user.id);
      return tx.courseBoardMembership.upsert({
        where: { userId_boardId: { userId: user.id, boardId } },
        update: { status: "active", source: "manual", sectionId: section.id, sectionCode, leftAt: null },
        create: {
          userId: user.id,
          boardId,
          sectionId: section.id,
          sectionCode,
          source: "manual",
          status: "active"
        }
      });
    });

    await operationLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: "course_board.join",
      targetType: "CourseBoard",
      targetId: boardId,
      method,
      path: request.nextUrl.pathname,
      summary: { sectionCode, membershipId: membership.id }
    });
    return ok({
      membership,
      message: `你已加入 ${board.title} 的 ${sectionCode} section。Course People 只代表平台内自选加入，不代表官方选课名单。`
    });
  }

  if (method === "PATCH" && path[2] === "membership-section") {
    const user = await requireUser();
    const body = await readBody(request);
    const sectionCode = normalizeSectionCode(body.sectionCode);
    const board = await getBoardForUser(boardId);
    assertSameSchool(user, board.courseOffering.course.schoolId);
    const existing = await prisma.courseBoardMembership.findUnique({ where: { userId_boardId: { userId: user.id, boardId } } });
    if (!existing || existing.status !== "active") throw new ApiError(403, "请先加入这个 Course Board，再选择 section。");
    const membership = await prisma.$transaction(async (tx) => {
      const section = await findOrCreateBoardSection(tx, boardId, sectionCode, user.id);
      return tx.courseBoardMembership.update({
        where: { userId_boardId: { userId: user.id, boardId } },
        data: { sectionId: section.id, sectionCode }
      });
    });
    await operationLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: "course_board.section.change",
      targetType: "CourseBoardMembership",
      targetId: membership.id,
      method,
      path: request.nextUrl.pathname,
      summary: { boardId, sectionCode }
    });
    return ok({ membership, message: `已切换到 ${sectionCode} section。` });
  }

  if (method === "DELETE" && path[2] === "leave") {
    const user = await requireUser();
    if (isDemoUser(user)) {
      return ok({ message: "本地视觉演示模式已模拟离开这个 Course Board。" });
    }

    const membership = await prisma.courseBoardMembership.findUnique({
      where: { userId_boardId: { userId: user.id, boardId } }
    });

    if (membership?.source.startsWith("auto_")) {
      await prisma.courseBoardMembership.update({
        where: { userId_boardId: { userId: user.id, boardId } },
        data: { status: "opted_out", leftAt: new Date() }
      });
      await operationLog({
        actorUserId: user.id,
        actorRole: user.role,
        action: "course_board.leave",
        targetType: "CourseBoard",
        targetId: boardId,
        method,
        path: request.nextUrl.pathname,
        summary: { source: membership.source, status: "opted_out" }
      });
      return ok({
        message: "已退出这个默认加入的 Course Board。若这是课程配置错误，可在 Support Tickets 提交 course_config_error 工单反馈。"
      });
    }

    await prisma.courseBoardMembership.deleteMany({
      where: { userId: user.id, boardId }
    });

    await operationLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: "course_board.leave",
      targetType: "CourseBoard",
      targetId: boardId,
      method,
      path: request.nextUrl.pathname,
      summary: { source: membership?.source ?? "manual", status: "deleted" }
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
      where: { boardId, status: "active" },
      include: {
        section: true,
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

    await operationLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: "teamaking_posts.create",
      targetType: "TeamakingPost",
      targetId: post.id,
      method,
      path: request.nextUrl.pathname,
      summary: { boardId, title: post.title }
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

    await operationLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: "teamaking_posts.patch",
      targetType: "TeamakingPost",
      targetId: post.id,
      method,
      path: request.nextUrl.pathname,
      summary: { status: post.status, title: post.title }
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
    await operationLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: "teamaking_posts.delete",
      targetType: "TeamakingPost",
      targetId: postId,
      method,
      path: request.nextUrl.pathname,
      summary: { boardId: existing.boardId }
    });
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

    await operationLog({
      actorUserId: sender.id,
      actorRole: sender.role,
      action: existing ? "team_up_requests.resend" : "team_up_requests.create",
      targetType: "TeamUpRequest",
      targetId: requestRow.id,
      method,
      path: request.nextUrl.pathname,
      summary: { postId, receiverId: post.userId }
    });
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
      throw new ApiError(400, `不允许从 ${existing.status} 变更为 ${nextStatus}。`, ERROR_CODES.TEAMUP_INVALID_TRANSITION, {
        from: existing.status,
        to: nextStatus
      });
    }

    const updated = await prisma.teamUpRequest.update({
      where: { id: requestId },
      data: { status: nextStatus }
    });

    await operationLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: "team_up_requests.status.patch",
      targetType: "TeamUpRequest",
      targetId: updated.id,
      method,
      path: request.nextUrl.pathname,
      summary: { from: existing.status, to: nextStatus }
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
    const allowed = allowedRequestTransitions[interest.status] ?? [];
    if (!allowed.includes(nextStatus)) {
      throw new ApiError(400, `不允许从 ${interest.status} 变更为 ${nextStatus}。`, ERROR_CODES.TEAMUP_INVALID_TRANSITION, {
        from: interest.status,
        to: nextStatus
      });
    }
    const updated = await prisma.teamUpRequest.update({
      where: { id: interest.id },
      data: { status: nextStatus }
    });
    await operationLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: `team_up_interests.${action}`,
      targetType: "TeamUpRequest",
      targetId: updated.id,
      summary: { from: interest.status, to: nextStatus }
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
    await operationLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: `follow_requests.${action}`,
      targetType: "FollowRequest",
      targetId: requestRow.id,
      summary: { from: existing.status, to: status }
    });
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
        reasons: index === 0 ? ["Joined the same course board"] : ["Cross-major collaboration"]
      })),
      users: demoPeople().map((membership, index) => ({
        user: publicUser(membership.user),
        score: index === 0 ? 70 : 45,
        reasons: index === 0 ? ["Same major", "Open to be discovered"] : ["Same school", "Cross-major collaboration"]
      }))
    });
  }

  const memberships = await prisma.courseBoardMembership.findMany({ where: { userId: user.id, status: "active" } });
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
        ...(boardIds.includes(post.boardId) ? ["Joined the same course board"] : []),
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

async function handleUploads(method: string, request: NextRequest) {
  if (method !== "POST") throw new ApiError(405, "这个上传接口不支持当前请求方式。");

  const user = await requireUser();
  const formData = await request.formData();
  const file = formData.get("file");
  const purposeRaw = formData.get("purpose");
  const purpose = typeof purposeRaw === "string" && profileUploadPurposeOptions().includes(purposeRaw) ? purposeRaw : "portfolio";

  if (!(file instanceof File)) {
    throw new ApiError(400, "请上传一个文件。", ERROR_CODES.UPLOAD_FILE_REQUIRED);
  }

  if (file.size > 30 * 1024 * 1024) {
    throw new ApiError(400, "单个文件暂时限制为 30MB。", ERROR_CODES.UPLOAD_FILE_TOO_LARGE, { size: file.size });
  }

  if (!isAllowedProfileFile(file.name) || isRiskyProfileFile(file.name)) {
    throw new ApiError(400, `暂不支持这个文件后缀：${fileExtensionOf(file.name) || "unknown"}`, ERROR_CODES.UPLOAD_EXTENSION_BLOCKED, {
      fileName: file.name
    });
  }

  const contentType = file.type || "application/octet-stream";
  if (!hasAcceptableMimeForExtension(file.name, contentType)) {
    throw new ApiError(400, "文件类型和后缀不匹配，请检查后重新上传。", ERROR_CODES.UPLOAD_MIME_MISMATCH, {
      fileName: file.name,
      contentType
    });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const safeName = safeUploadName(file.name);
  const parsedText = await extractReadableText(file.name, buffer);
  const resumeParsedData = purpose === "resume" ? parseResumeText(parsedText, file.name) : undefined;
  const stored = await storeProfileUpload({
    buffer,
    userId: user.id,
    safeName,
    contentType
  }).catch((error) => {
    throw new ApiError(500, "文件保存失败，请稍后再试。", ERROR_CODES.UPLOAD_STORAGE_FAILED, {
      fileName: file.name,
      message: error instanceof Error ? error.message : String(error)
    });
  });

  const upload = {
    fileUrl: stored.fileUrl,
    storageKey: stored.storageKey,
    fileName: file.name,
    fileMimeType: contentType,
    fileSize: file.size,
    fileExtension: fileExtensionOf(file.name),
    previewKind: previewKindForFile(file.name),
    parsedText,
    resumeParsedData,
    purpose,
    storageMode: stored.storageMode,
    storageProvider: stored.storageProvider,
    objectKey: stored.objectKey,
    scanStatus: "basic_checked"
  };

  return created({ upload });
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function records(value: unknown) {
  return Array.isArray(value) ? value.filter(isPlainRecord) : [];
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function textValues(value: unknown) {
  return Array.isArray(value) ? value.map(textValue).filter(Boolean) : [];
}

function academicTermOffset(term?: string | null) {
  const normalized = (term ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("spring") || normalized === "s2" || normalized.includes("semester 2")) return 0;
  if (normalized.includes("fall") || normalized.includes("autumn") || normalized === "s1" || normalized.includes("semester 1")) return 1;
  return null;
}

function academicTermIndex(year?: number | null, term?: string | null) {
  const offset = academicTermOffset(term);
  if (!year || offset === null) return null;
  return year * 2 + offset;
}

function relativeTermCodeForProfile(profile: any, semester: any) {
  const entryYear = typeof profile?.entryYear === "number" ? profile.entryYear : null;
  const entryTerm = textValue(profile?.entryTerm);
  const semesterYear = typeof semester?.year === "number" ? semester.year : null;
  const semesterTerm = textValue(semester?.term);
  const entryIndex = academicTermIndex(entryYear, entryTerm);
  const semesterIndex = academicTermIndex(semesterYear, semesterTerm);
  if (entryIndex === null || semesterIndex === null) return null;
  const diff = semesterIndex - entryIndex;
  if (diff < 0) return null;
  const year = Math.floor(diff / 2) + 1;
  const term = (diff % 2) + 1;
  return `Y${year}S${term}`;
}

function relativeTermCodeForEntry(entryYear: number, entryTerm: string, semester: any) {
  return relativeTermCodeForProfile({ entryYear, entryTerm }, semester);
}

function academicTermForRelativeTermCode(entryYear: number, entryTerm: string, relativeTermCode: string) {
  const match = /^Y(\d+)S([12])$/i.exec(relativeTermCode.trim());
  const entryIndex = academicTermIndex(entryYear, entryTerm);
  if (!match || entryIndex === null) return null;
  const yearOffset = Number(match[1]) - 1;
  const termOffset = Number(match[2]) - 1;
  const targetIndex = entryIndex + yearOffset * 2 + termOffset;
  const academicYear = Math.floor(targetIndex / 2);
  const term = targetIndex % 2 === 1 ? "Fall" : "Spring";
  return {
    code: `${academicYear}-${term}`,
    year: academicYear,
    term,
    label: `${academicYear} ${term}`
  };
}

function ruleMatchesAcademicTermContext(rule: Record<string, unknown>, semester: any) {
  const relativeTermCodes = relativeTermCodesForRule(rule);
  if (!relativeTermCodes.length) return false;
  const cohortYears = cohortYearsForRule(rule);
  if (!cohortYears.length) return false;
  return cohortYears.some((cohortYear) => {
    const code = relativeTermCodeForEntry(cohortYear, "Fall", semester);
    return code ? relativeTermCodes.includes(code) : false;
  });
}

function curriculumRuleMatchesUser(rule: any, user: any, semesterOverride?: any) {
  const audience = isPlainRecord(rule.audience) ? rule.audience : {};
  const profile = user.profile;
  if (!profile) return false;

  const relativeTermCodes = Array.isArray(rule.relativeTermCodes)
    ? textValues(rule.relativeTermCodes).map((code) => code.toUpperCase())
    : relativeTermCodesForRule(rule);
  if (relativeTermCodes.length) {
    const userRelativeTermCode = relativeTermCodeForProfile(profile, semesterOverride ?? rule.semester);
    if (!userRelativeTermCode || !relativeTermCodes.includes(userRelativeTermCode)) return false;
  }

  const grades = textValues(audience.grades);
  if (!relativeTermCodes.length && grades.length && !grades.includes(profile.grade)) return false;
  if (audience.allMajors === true) return true;

  const majorCodes = textValues(audience.majorCodes);
  const facultyCodes = textValues(audience.facultyCodes);
  const userMajorCode = textValue(profile.major?.code);
  const userFacultyCode = textValue(profile.faculty?.code);

  return (
    (majorCodes.length > 0 && userMajorCode && majorCodes.includes(userMajorCode)) ||
    (facultyCodes.length > 0 && userFacultyCode && facultyCodes.includes(userFacultyCode))
  );
}

function ruleHasProgrammeScope(rule: Record<string, unknown>) {
  const audience = audienceForRule(rule);
  if (audience.allMajors === true) return false;
  return textValues(audience.majorCodes).length > 0 || textValues(audience.facultyCodes).length > 0;
}

function ruleMatchesUserRelativeTerm(rule: any, user: any, semester: any) {
  const relativeTermCodes = Array.isArray(rule.relativeTermCodes)
    ? textValues(rule.relativeTermCodes).map((code) => code.toUpperCase())
    : relativeTermCodesForRule(rule);
  if (!relativeTermCodes.length) return true;
  const code = relativeTermCodeForProfile(user.profile, semester);
  return Boolean(code && relativeTermCodes.includes(code));
}

type HandbookSourceRef = {
  externalId: string;
  title: string;
  url: string;
  sourceType?: string;
  provenance?: string;
  score?: number;
};

type ProgrammeIntroRef = {
  title: string;
  url: string;
  facultyCode?: string;
  provenance?: string;
  score?: number;
};

function decodeHtmlEntity(entity: string) {
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: "\"",
    apos: "'",
    nbsp: " "
  };
  if (entity.startsWith("#x")) {
    const value = Number.parseInt(entity.slice(2), 16);
    return Number.isFinite(value) ? String.fromCodePoint(value) : `&${entity};`;
  }
  if (entity.startsWith("#")) {
    const value = Number.parseInt(entity.slice(1), 10);
    return Number.isFinite(value) ? String.fromCodePoint(value) : `&${entity};`;
  }
  return named[entity] ?? `&${entity};`;
}

function decodeHtmlText(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&([a-zA-Z]+|#\d+|#x[\da-fA-F]+);/g, (_, entity: string) => decodeHtmlEntity(entity))
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedSearchText(value: string) {
  return decodeHtmlText(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function significantWords(value: string) {
  const stopWords = new Set([
    "and",
    "the",
    "of",
    "for",
    "programme",
    "program",
    "studies",
    "study",
    "management",
    "science",
    "sciences",
    "technology",
    "department",
    "faculty",
    "school"
  ]);
  return normalizedSearchText(value)
    .split(" ")
    .filter((word) => word.length >= 3 && !stopWords.has(word));
}

function anchorLinksFromHtml(html: string) {
  const links: Array<{ href: string; text: string }> = [];
  const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchorPattern)) {
    const href = decodeHtmlText(match[1] ?? "");
    const text = decodeHtmlText(match[2] ?? "");
    if (href) links.push({ href, text });
  }
  return links;
}

function sourceRefFromRecord(value: unknown, provenance: string): HandbookSourceRef | null {
  if (!isPlainRecord(value)) return null;
  const url = textValue(value.url);
  if (!url) return null;
  return {
    externalId: textValue(value.externalId) || textValue(value.id),
    title: textValue(value.title),
    url,
    sourceType: textValue(value.sourceType),
    provenance
  };
}

function handbookRefScore(
  ref: HandbookSourceRef,
  context: { entryYear: number; majorCode: string; majorName: string; sourceRefIds: Set<string> }
) {
  const majorCode = context.majorCode.toLowerCase();
  const decodedUrl = decodeURIComponent(ref.url).toLowerCase();
  const searchText = normalizedSearchText(`${ref.externalId} ${ref.title} ${decodedUrl}`);
  const sourceId = ref.externalId.toLowerCase();
  let score = 0;

  if (!decodedUrl.includes(".pdf") && !searchText.includes("pdf")) score -= 50;
  if (context.sourceRefIds.has(ref.externalId) || context.sourceRefIds.has(sourceId)) score += 240;
  if (majorCode && sourceId === `handbook-${context.entryYear}-${majorCode}`) score += 180;
  if (sourceId.includes(`handbook-${context.entryYear}`)) score += 40;
  if (majorCode && sourceId.includes(majorCode)) score += 80;
  if (majorCode && decodedUrl.includes(majorCode)) score += 80;
  if (decodedUrl.includes(String(context.entryYear)) || searchText.includes(String(context.entryYear))) score += 50;
  if (normalizedSearchText(ref.title).includes(normalizedSearchText(context.majorName))) score += 70;

  const targetWords = significantWords(context.majorName);
  const matchedWords = targetWords.filter((word) => searchText.includes(word));
  score += matchedWords.length * 18;
  if (targetWords.length > 0 && matchedWords.length === targetWords.length) score += 40;
  if (searchText.includes("handbook")) score += 10;

  return score;
}

async function matchingRuleSourceRefIdsForUser(user: any, entryYear: number) {
  if (!user.schoolId || !user.profile) return [];
  const currentSemester = await prisma.semester.findFirst({ where: { schoolId: user.schoolId, isCurrent: true } });
  const rules = await prisma.courseCurriculumRule.findMany({
    where: {
      status: "active",
      course: { schoolId: user.schoolId }
    },
    select: {
      audience: true,
      relativeTermCodes: true,
      sourceRefIds: true,
      semester: true
    }
  });
  const sourceIds = new Set<string>();
  for (const rule of rules) {
    const audience = audienceForRule(rule);
    const cohortYears = cohortYearsForRule(rule);
    if (cohortYears.length && !cohortYears.includes(entryYear)) continue;
    const matches = currentSemester
      ? curriculumRuleMatchesUser(rule, user, currentSemester)
      : audience.allMajors === true ||
        textValues(audience.majorCodes).includes(textValue(user.profile?.major?.code)) ||
        textValues(audience.facultyCodes).includes(textValue(user.profile?.faculty?.code));
    if (!matches) continue;
    for (const sourceRefId of textValues(rule.sourceRefIds)) sourceIds.add(sourceRefId);
  }
  return Array.from(sourceIds);
}

function bestHandbookRef(
  refs: HandbookSourceRef[],
  context: { entryYear: number; majorCode: string; majorName: string; sourceRefIds: Set<string> }
) {
  return refs
    .map((ref) => ({ ...ref, score: handbookRefScore(ref, context) }))
    .filter((ref) => (ref.score ?? 0) > 0)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0] ?? null;
}

async function findHandbookRefFromDatasetSources(
  user: any,
  context: { entryYear: number; majorCode: string; majorName: string; sourceRefIds: Set<string> }
) {
  if (!user.schoolId) return null;
  const rows = await prisma.courseImportDatasetSourceRef.findMany({
    where: {
      dataset: { schoolId: user.schoolId }
    },
    orderBy: { id: "desc" },
    take: 800
  });
  return bestHandbookRef(
    rows.map((row: any) => ({
      externalId: row.externalId,
      title: row.title ?? "",
      url: row.url ?? "",
      sourceType: row.sourceType ?? "",
      provenance: "dataset_source_ref"
    })),
    context
  );
}

async function findHandbookRefFromImportPayloads(
  user: any,
  context: { entryYear: number; majorCode: string; majorName: string; sourceRefIds: Set<string> }
) {
  if (!user.schoolId) return null;
  const batches = await prisma.courseImportBatch.findMany({
    where: {
      schoolId: user.schoolId,
      status: { in: ["approved", "pending"] }
    },
    select: {
      payload: true,
      cohortYears: true,
      dataset: { include: { sourceRefs: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 20
  });
  const refs: HandbookSourceRef[] = [];
  for (const batch of batches) {
    const cohortYears = textValues(batch.cohortYears).map(Number).filter(Number.isFinite);
    if (cohortYears.length && !cohortYears.includes(context.entryYear)) continue;
    for (const sourceRef of batch.dataset?.sourceRefs ?? []) {
      const ref = sourceRefFromRecord(sourceRef, "batch_dataset_source_ref");
      if (ref) refs.push(ref);
    }
    if (isPlainRecord(batch.payload)) {
      for (const sourceRef of records(batch.payload.sourceRefs)) {
        const ref = sourceRefFromRecord(sourceRef, "batch_payload_source_ref");
        if (ref) refs.push(ref);
      }
    }
  }
  return bestHandbookRef(refs, context);
}

async function fetchTextWithTimeout(url: string, timeoutMs = 6000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return "";
    return await response.text();
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

async function findHandbookRefFromLiveAr(
  context: { entryYear: number; majorCode: string; majorName: string; sourceRefIds: Set<string> }
) {
  const indexHtml = await fetchTextWithTimeout(BNBU_HANDBOOK_URL);
  if (!indexHtml) return null;
  const yearLink = anchorLinksFromHtml(indexHtml).find((link) => {
    const text = normalizedSearchText(link.text);
    return text.includes(`${context.entryYear} admission`) || text.includes(`${context.entryYear} ${context.entryYear + 1}`);
  });
  if (!yearLink) return null;
  const yearPageUrl = new URL(yearLink.href, BNBU_HANDBOOK_URL).toString();
  const yearHtml = await fetchTextWithTimeout(yearPageUrl);
  if (!yearHtml) return null;
  const refs = anchorLinksFromHtml(yearHtml)
    .map((link) => ({
      externalId: `ar-live-${context.entryYear}-${normalizedSearchText(link.text).replace(/\s+/g, "-").slice(0, 80)}`,
      title: link.text,
      url: new URL(link.href, yearPageUrl).toString(),
      sourceType: "programme_structure",
      provenance: "ar_live"
    }))
    .filter((ref) => ref.url.toLowerCase().includes(".pdf") || normalizedSearchText(ref.title).includes("programme"));
  return bestHandbookRef(refs, context);
}

async function resolveProgrammeHandbookRef(user: any) {
  const entryYear = typeof user.profile?.entryYear === "number" ? user.profile.entryYear : null;
  const majorCode = textValue(user.profile?.major?.code);
  const majorName = textValue(user.profile?.major?.name);
  if (!entryYear || (!majorCode && !majorName)) return null;

  const cacheKey = `${user.schoolId ?? "school"}:${entryYear}:${majorCode}:${majorName}`;
  const cached = handbookLinkCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.ref;

  const sourceRefIds = new Set((await matchingRuleSourceRefIdsForUser(user, entryYear)).flatMap((id) => [id, id.toLowerCase()]));
  const context = { entryYear, majorCode, majorName, sourceRefIds };
  const ref =
    (await findHandbookRefFromDatasetSources(user, context)) ??
    (await findHandbookRefFromImportPayloads(user, context)) ??
    (await findHandbookRefFromLiveAr(context));

  handbookLinkCache.set(cacheKey, { ref, expiresAt: Date.now() + 10 * 60 * 1000 });
  return ref;
}

function programmeIntroScore(
  ref: ProgrammeIntroRef,
  context: { majorCode: string; majorName: string }
) {
  const majorCode = context.majorCode.toLowerCase();
  const url = decodeURIComponent(ref.url).toLowerCase();
  const searchText = normalizedSearchText(`${ref.title} ${url}`);
  let score = 0;

  if (url.includes("graduate") || searchText.includes("master") || searchText.includes("phd")) score -= 70;
  if (majorCode && (url.includes(`/${majorCode}_en`) || url.includes(`${majorCode}_en`))) score += 180;
  if (majorCode && searchText.split(" ").includes(majorCode)) score += 80;
  if (normalizedSearchText(ref.title).includes(normalizedSearchText(context.majorName))) score += 110;

  const targetWords = significantWords(context.majorName);
  const matchedWords = targetWords.filter((word) => searchText.includes(word));
  score += matchedWords.length * 24;
  if (targetWords.length > 0 && matchedWords.length === targetWords.length) score += 60;
  if (url.endsWith("_en") || url.includes("_en/") || url.includes("_en/index.htm")) score += 25;
  if (searchText.includes("programme") || searchText.includes("program")) score += 10;

  return score;
}

function bestProgrammeIntroRef(refs: ProgrammeIntroRef[], context: { majorCode: string; majorName: string }) {
  return refs
    .map((ref) => ({ ...ref, score: programmeIntroScore(ref, context) }))
    .filter((ref) => (ref.score ?? 0) > 0)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0] ?? null;
}

function facultyProgrammePagesForUser(user: any) {
  const facultyCode = textValue(user.profile?.faculty?.code).toUpperCase();
  const direct = BNBU_FACULTY_PROGRAMME_PAGES.find((page) => page.code === facultyCode);
  return direct ? [direct] : BNBU_FACULTY_PROGRAMME_PAGES;
}

async function resolveProgrammeIntroRef(user: any) {
  const majorCode = textValue(user.profile?.major?.code);
  const majorName = textValue(user.profile?.major?.name);
  if (!majorCode && !majorName) return null;

  const facultyCode = textValue(user.profile?.faculty?.code).toUpperCase();
  const cacheKey = `${facultyCode || "all"}:${majorCode}:${majorName}`;
  const cached = programmeIntroCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.ref;

  const context = { majorCode, majorName };
  const refs: ProgrammeIntroRef[] = [];
  for (const page of facultyProgrammePagesForUser(user)) {
    const html = await fetchTextWithTimeout(page.url);
    if (!html) continue;
    for (const link of anchorLinksFromHtml(html)) {
      const url = new URL(link.href, page.url).toString();
      if (!/^https?:\/\//i.test(url)) continue;
      refs.push({
        title: link.text,
        url,
        facultyCode: page.code,
        provenance: "faculty_site"
      });
    }
  }
  const ref = bestProgrammeIntroRef(refs, context);
  programmeIntroCache.set(cacheKey, { ref, expiresAt: Date.now() + 60 * 60 * 1000 });
  return ref;
}

async function officialAcademicLinksForUser(user: any) {
  const entryYear = typeof user.profile?.entryYear === "number" ? user.profile.entryYear : null;
  const majorCode = textValue(user.profile?.major?.code);
  const majorName = textValue(user.profile?.major?.name);
  const programmeRef = await resolveProgrammeIntroRef(user);
  const handbookRef = await resolveProgrammeHandbookRef(user);
  const programmeLabel = [entryYear ? `${entryYear} admission` : "", majorCode || majorName].filter(Boolean).join(" · ");

  return [
    {
      key: "programme",
      label: "BNBU 专业介绍",
      href: programmeRef?.url ?? BNBU_PROGRAMMES_URL,
      description: programmeRef?.url
        ? `查看 ${majorName || majorCode} 的官方 programme 页面。`
        : user.profile?.major?.name
          ? `查看 ${user.profile.major.name} 所属学院和专业官方介绍。`
        : "查看 BNBU 官方学院与专业介绍。"
    },
    {
      key: "handbook",
      label: "AR 官方四年课程安排",
      href: handbookRef?.url ?? BNBU_HANDBOOK_URL,
      description: handbookRef?.url
        ? `${programmeLabel} · 官方 programme handbook PDF`
        : "暂未从已导入数据或 AR 页面定位到精确 PDF，先打开 AR programme handbook 索引。"
    },
    {
      key: "mis",
      label: "MIS 本学期真实选课 / 课表",
      href: BNBU_MIS_URL,
      description: "TEAMAKING 加入 Course Board 不等于官方选课，真实课表请以 MIS 为准。"
    }
  ];
}

async function courseJoinAdvisory(courseId: string, user: any, semester: any) {
  if (!semester || !user.profile) return null;
  const rules = await prisma.courseCurriculumRule.findMany({
    where: {
      courseId,
      status: "active",
      studentAction: { in: ["default_join", "recommend_only", "searchable_add"] }
    },
    include: { semester: true }
  });
  const scopedRules = rules.filter((rule) => ruleHasProgrammeScope(rule) && ruleMatchesUserRelativeTerm(rule, user, semester));
  if (!scopedRules.length) return null;
  const matchesUserProgramme = scopedRules.some((rule) => curriculumRuleMatchesUser(rule, user, semester));
  if (matchesUserProgramme) return null;
  return {
    level: "warning",
    message: "这门课在当前 admission 配置中更像其他专业/学院的专业课。已加入的课程不会因你更改专业而自动移除；如果你确实以自由选修、跨专业合作或兴趣方式加入，可以继续使用。"
  };
}

function numberValue(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function firstItems(items: string[], limit = 8) {
  return items.slice(0, limit);
}

function numberValues(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is number => typeof item === "number" && Number.isFinite(item)) : [];
}

function audienceForRule(rule: Record<string, unknown>) {
  return isPlainRecord(rule.audience) ? rule.audience : {};
}

function cohortYearsForRule(rule: Record<string, unknown>) {
  return numberValues(audienceForRule(rule).cohortYears);
}

function countRows<T extends Record<string, unknown>>(rows: T[], keyOf: (row: T) => string | string[] | undefined) {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const keys = keyOf(row);
    const normalizedKeys = Array.isArray(keys) ? keys : keys ? [keys] : ["Unspecified"];
    normalizedKeys.forEach((key) => counts.set(key, (counts.get(key) ?? 0) + 1));
  });
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function stableJson(value: unknown) {
  return JSON.stringify(value ?? null);
}

function payloadHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex");
}

function uniqueSortedNumbers(values: number[]) {
  return [...new Set<number>(values)].sort((a, b) => b - a);
}

function importCohortYearsFromPayload(payload: Record<string, unknown>, preview?: any) {
  const fromCoverage = Array.isArray(preview?.coverage?.cohortYears)
    ? preview.coverage.cohortYears.map((item: any) => Number(item.key)).filter((item: number) => Number.isFinite(item))
    : [];
  if (fromCoverage.length) return uniqueSortedNumbers(fromCoverage);
  const topLevel = numberValues(payload.cohortYears);
  if (topLevel.length) return uniqueSortedNumbers(topLevel);
  return uniqueSortedNumbers(records(payload.curriculumRules).flatMap(cohortYearsForRule));
}

function sourceLabelForImport(payload: Record<string, unknown>, cohortYears: number[]) {
  const firstSource = records(payload.sourceRefs)[0];
  if (firstSource) return textValue(firstSource.title) || textValue(firstSource.url) || `${cohortYears.join(", ") || "Unknown"} admission import`;
  return `${cohortYears.join(", ") || "Unknown"} admission import`;
}

function buildCourseImportBatchSummary(payload: Record<string, unknown>, preview: any) {
  const validation = preview?.validation ?? validateBnbuCourseImportPayload(payload);
  const counts = preview?.counts ?? {};
  const cohortYears = importCohortYearsFromPayload(payload, preview);
  const semesterInput = isPlainRecord(payload.semester) ? payload.semester : {};
  const sourceLabel = sourceLabelForImport(payload, cohortYears);
  return {
    schemaVersion: validation.schemaVersion ?? textValue(payload.schemaVersion),
    semesterCode: validation.semesterCode ?? textValue(semesterInput.code),
    semesterLabel: textValue(semesterInput.name),
    cohortYears,
    importMode: preview?.importMode ?? (records(payload.offerings).length ? "combined_with_offerings" : "cohort_handbook"),
    sourceLabel,
    generatedAt: textValue(payload.generatedAt),
    counts: {
      faculties: validation.counts?.faculties ?? records(payload.faculties).length,
      majors: validation.counts?.majors ?? records(payload.majors).length,
      courses: validation.counts?.courses ?? records(payload.courses).length,
      offerings: validation.counts?.offerings ?? records(payload.offerings).length,
      curriculumRules: validation.counts?.curriculumRules ?? records(payload.curriculumRules).length,
      warnings: validation.warnings?.length ?? 0,
      errors: validation.errors?.length ?? 0,
      newCourses: counts.newCourses ?? 0,
      updatedCourses: counts.updatedCourses ?? 0,
      newRules: counts.newRules ?? 0,
      changedRules: counts.changedRules ?? 0,
      retainedRules: counts.retainedRules ?? 0,
      rulesToDeactivate: counts.rulesToDeactivate ?? 0,
      boardsToActivate: counts.courseBoardsToActivate ?? 0
    },
    warnings: validation.warnings ?? [],
    errors: validation.errors ?? []
  };
}

function jsonArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function summarizeCourseImportBatch(batch: any, includePayload = false) {
  const summary = isPlainRecord(batch.summary) ? batch.summary : {};
  const fallbackValidation = isPlainRecord(batch.validationSummary) ? batch.validationSummary : {};
  const fallbackPreview = isPlainRecord(fallbackValidation.preview) ? fallbackValidation.preview : {};
  const fallbackCoverage = isPlainRecord(fallbackPreview.coverage) ? fallbackPreview.coverage : {};
  const fallbackPayload = isPlainRecord(batch.payload) ? batch.payload : {};
  const inferredPayloadCohorts = Object.keys(fallbackPayload).length ? importCohortYearsFromPayload(fallbackPayload, fallbackPreview) : [];
  const cohortYears = numberValues(batch.cohortYears).length
    ? numberValues(batch.cohortYears)
    : numberValues(summary.cohortYears).length
      ? numberValues(summary.cohortYears)
      : numberValues(jsonArray(fallbackCoverage.cohortYears).map((item) => (isPlainRecord(item) ? item.key : item))).length
        ? numberValues(jsonArray(fallbackCoverage.cohortYears).map((item) => (isPlainRecord(item) ? item.key : item)))
        : inferredPayloadCohorts;
  const counts = isPlainRecord(summary.counts) ? summary.counts : {};
  const fallbackCounts = isPlainRecord(fallbackValidation.counts) ? fallbackValidation.counts : {};
  const fallbackPreviewCounts = isPlainRecord(fallbackPreview.counts) ? fallbackPreview.counts : {};
  const summarized = {
    id: batch.id,
    name: batch.name || batch.dataset?.name,
    datasetId: batch.datasetId,
    dataset: batch.dataset
      ? {
          id: batch.dataset.id,
          name: batch.dataset.name,
          status: batch.dataset.status,
          originalFileName: batch.dataset.originalFileName,
          originalSize: batch.dataset.originalSize,
          createdAt: batch.dataset.createdAt,
          downloadUrl: `/api/admin/course-import-datasets/${batch.dataset.id}/download`
        }
      : null,
    schoolId: batch.schoolId,
    school: batch.school,
    schemaVersion: batch.schemaVersion,
    semesterCode: batch.semesterCode,
    cohortYears,
    payloadHash: batch.payloadHash,
    sourceLabel:
      batch.sourceLabel ||
      textValue(batch.dataset?.sourceLabel) ||
      textValue(summary.sourceLabel) ||
      (Object.keys(fallbackPayload).length ? sourceLabelForImport(fallbackPayload, cohortYears) : `${cohortYears.join(", ") || "Unknown"} admission import`),
    status: batch.status,
    summary: {
      ...summary,
      cohortYears,
      counts: {
        faculties: Number(counts.faculties ?? fallbackCounts.faculties ?? 0),
        majors: Number(counts.majors ?? fallbackCounts.majors ?? 0),
        courses: Number(counts.courses ?? fallbackCounts.courses ?? 0),
        offerings: Number(counts.offerings ?? fallbackCounts.offerings ?? 0),
        curriculumRules: Number(counts.curriculumRules ?? fallbackCounts.curriculumRules ?? 0),
        warnings: Number(counts.warnings ?? jsonArray(fallbackValidation.warnings).length),
        errors: Number(counts.errors ?? jsonArray(fallbackValidation.errors).length),
        newCourses: Number(counts.newCourses ?? fallbackPreviewCounts.newCourses ?? 0),
        updatedCourses: Number(counts.updatedCourses ?? fallbackPreviewCounts.updatedCourses ?? 0),
        newRules: Number(counts.newRules ?? fallbackPreviewCounts.newRules ?? 0),
        changedRules: Number(counts.changedRules ?? fallbackPreviewCounts.changedRules ?? 0),
        retainedRules: Number(counts.retainedRules ?? fallbackPreviewCounts.retainedRules ?? 0),
        rulesToDeactivate: Number(counts.rulesToDeactivate ?? fallbackPreviewCounts.rulesToDeactivate ?? 0),
        boardsToActivate: Number(counts.boardsToActivate ?? fallbackPreviewCounts.courseBoardsToActivate ?? 0)
      }
    },
    approvedByUserId: batch.approvedByUserId,
    approvedAt: batch.approvedAt,
    rejectedByUserId: batch.rejectedByUserId,
    rejectedAt: batch.rejectedAt,
    adminNote: batch.adminNote,
    createdAt: batch.createdAt,
    updatedAt: batch.updatedAt
  };
  return includePayload ? { ...summarized, payload: batch.payload, validationSummary: batch.validationSummary } : summarized;
}

function hasOverlappingNumber(values: number[], candidates: number[]) {
  const candidateSet = new Set(candidates);
  return values.some((value) => candidateSet.has(value));
}

function parseCommaText(value: unknown) {
  if (Array.isArray(value)) return value.map(textValue).filter(Boolean);
  return textValue(value).split(",").map((item) => item.trim()).filter(Boolean);
}

function parseJsonObject(value: unknown) {
  if (isPlainRecord(value)) return value;
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return isPlainRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function courseUsageSummary(course: any) {
  const rules = Array.isArray(course.curriculumRules) ? course.curriculumRules : [];
  const rows: any[] = rules.map((rule: any) => {
    const audience = isPlainRecord(rule.audience) ? rule.audience : {};
    return {
      id: rule.id,
      externalId: rule.externalId,
      semester: rule.semester,
      classification: rule.classification,
      studentAction: rule.studentAction,
      cohortYears: numberValues(audience.cohortYears),
      entryTerm: textValue(audience.entryTerm) || "Fall",
      majorCodes: textValues(audience.majorCodes),
      facultyCodes: textValues(audience.facultyCodes),
      allMajors: audience.allMajors === true,
      relativeTermCodes: textValues(rule.relativeTermCodes),
      sourceRefIds: textValues(rule.sourceRefIds)
    };
  });
  const academicTermRows = rows.flatMap((row) => {
    const audienceCodes = row.allMajors
      ? ["ALL majors"]
      : row.majorCodes.length
        ? row.majorCodes
        : row.facultyCodes.length
          ? row.facultyCodes.map((code: string) => `Faculty ${code}`)
          : ["Unspecified"];
    return row.cohortYears.flatMap((entryYear: number) =>
      row.relativeTermCodes.flatMap((relativeTermCode: string) => {
        const academicTerm = academicTermForRelativeTermCode(entryYear, row.entryTerm, relativeTermCode);
        return audienceCodes.map((audienceCode: string) => ({
          ruleId: row.id,
          externalId: row.externalId,
          entryYear,
          entryTerm: row.entryTerm,
          audience: audienceCode,
          relativeTermCode,
          academicTermCode: academicTerm?.code ?? null,
          academicTermLabel: academicTerm?.label ?? "Unknown",
          classification: row.classification,
          studentAction: row.studentAction
        }));
      })
    );
  }).sort((a, b) =>
    String(a.academicTermCode ?? "").localeCompare(String(b.academicTermCode ?? "")) ||
    String(a.entryYear).localeCompare(String(b.entryYear)) ||
    a.audience.localeCompare(b.audience) ||
    a.relativeTermCode.localeCompare(b.relativeTermCode)
  );
  return {
    totalRules: rows.length,
    cohortYears: countRows(rows, (row) => row.cohortYears.map(String)),
    majors: countRows(rows, (row) => row.majorCodes.length ? row.majorCodes : row.allMajors ? "ALL" : "Unspecified"),
    relativeTerms: countRows(rows, (row) => row.relativeTermCodes.length ? row.relativeTermCodes : "Unspecified"),
    academicTerms: countRows(academicTermRows, (row) => row.academicTermLabel),
    classifications: countRows(rows, (row) => row.classification),
    academicTermRows: academicTermRows.slice(0, 200),
    rules: rows.slice(0, 80)
  };
}

function serializeAdminCourse(course: any) {
  return {
    ...course,
    usage: courseUsageSummary(course)
  };
}

function normalizeSectionCode(value: unknown) {
  const code = textValue(value) || "1001";
  if (!/^10\d{2}$/.test(code)) {
    throw new ApiError(400, "Section 必须是 10xx 格式；如果课程没有多个 section，请使用默认 1001。");
  }
  return code;
}

async function findOrCreateBoardSection(tx: any, boardId: string, sectionCode: string, userId?: string | null, source = "student_created") {
  const existing = await tx.courseBoardSection.findUnique({
    where: { boardId_code: { boardId, code: sectionCode } }
  });
  if (existing) return existing;
  return tx.courseBoardSection.create({
    data: {
      boardId,
      code: sectionCode,
      source,
      createdByUserId: userId ?? null
    }
  });
}

function courseImportPayloadFromBody(body: Record<string, unknown>) {
  const candidate = body.payload ?? body;
  const normalizeParsedPayload = (parsed: Record<string, unknown>) => {
    if (textValue(parsed.schemaVersion)) return parsed;
    const bundleFiles = records(parsed.files);
    const bundlePayloads = bundleFiles
      .map((file) => (isPlainRecord(file.payload) ? file.payload : null))
      .filter((payload): payload is Record<string, unknown> => Boolean(payload));
    if (bundlePayloads.length === 1) return bundlePayloads[0];
    if (bundlePayloads.length > 1) {
      throw new ApiError(
        400,
        `你粘贴的是爬虫输出整包，里面包含 ${bundlePayloads.length} 份 admission JSON。请在 crawler Jobs 里点击单个 “可导入 JSON” 文件下载并粘贴；或者在 crawler 表单的 After crawl 中选择 create_pending / approve_import 自动处理。`,
        ERROR_CODES.COURSE_IMPORT_INVALID_JSON,
        { kind: "crawler_output_bundle", fileCount: bundlePayloads.length, fileNames: bundleFiles.map((file) => textValue(file.name)).filter(Boolean) }
      );
    }
    if (records(parsed.files).length || isPlainRecord(parsed.job)) {
      throw new ApiError(
        400,
        "你粘贴的是爬虫输出整包，但里面没有可导入的 payload。请下载单个 bnbu-YYYY-admission-handbook.teamaking.json 后再导入。",
        ERROR_CODES.COURSE_IMPORT_INVALID_JSON,
        { kind: "crawler_output_bundle" }
      );
    }
    return parsed;
  };
  if (typeof candidate === "string") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(candidate);
    } catch {
      throw new ApiError(400, "payload 不是合法 JSON。", ERROR_CODES.COURSE_IMPORT_INVALID_JSON);
    }
    if (isPlainRecord(parsed)) return normalizeParsedPayload(parsed);
  }
  if (isPlainRecord(candidate)) return normalizeParsedPayload(candidate);
  throw new ApiError(400, "payload must be a JSON object.", ERROR_CODES.COURSE_IMPORT_INVALID_JSON);
}

const writableStorageRoot = process.env.VERCEL ? path.join("/tmp", "teamaking") : path.join(/*turbopackIgnore: true*/ process.cwd(), "storage");
const importArtifactDir = path.join(writableStorageRoot, "course_import_artifacts");
const crawlerOutputDir = path.join(writableStorageRoot, "crawler_outputs");
const crawlerScriptCandidates = [
  path.join(/*turbopackIgnore: true*/ process.cwd(), "scripts", "bnbu-crawler", "run-handbook-preview.mjs"),
  path.join(/*turbopackIgnore: true*/ process.cwd(), "local_bnbu_course_pipeline", "run_handbook_preview.mjs")
];
const crawlerJobs = new Map<string, any>();
const crawlerStaleMs = 30 * 60 * 1000;

function timestampFilePrefix(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function safeFilePart(value: string) {
  return value
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "course-import";
}

async function writeImportArtifact(payload: Record<string, unknown>, name: string) {
  await mkdir(importArtifactDir, { recursive: true });
  const fileName = `${timestampFilePrefix()}_${safeFilePart(name)}.teamaking.json`;
  const absolutePath = path.join(importArtifactDir, fileName);
  const storageKey = path.relative(/*turbopackIgnore: true*/ process.cwd(), absolutePath);
  const content = `${JSON.stringify(payload, null, 2)}\n`;
  await writeFile(absolutePath, content, "utf8");
  return { fileName, storageKey, size: Buffer.byteLength(content, "utf8") };
}

function jsonDownloadResponse(payload: unknown, filename: string) {
  return new NextResponse(`${JSON.stringify(payload, null, 2)}\n`, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeFilePart(filename).replace(/\.json$/i, "")}.json"`
    }
  });
}

async function readStoredJson(storageKey?: string | null) {
  if (!storageKey) throw new ApiError(404, "找不到可下载文件。");
  const absolutePath = path.resolve(/*turbopackIgnore: true*/ process.cwd(), storageKey);
  const allowedRoots = [importArtifactDir, crawlerOutputDir, path.join(/*turbopackIgnore: true*/ process.cwd(), "course_imports", "bnbu")].map((item) => path.resolve(item));
  const allowed = allowedRoots.some((root) => absolutePath === root || absolutePath.startsWith(`${root}${path.sep}`));
  if (!allowed || !absolutePath.endsWith(".json")) throw new ApiError(403, "文件路径不允许下载。");
  return readFile(absolutePath, "utf8");
}

async function listCrawlerOutputs() {
  const dirs = [crawlerOutputDir, path.join(/*turbopackIgnore: true*/ process.cwd(), "course_imports", "bnbu")];
  const files: any[] = [];
  for (const dir of dirs) {
    await mkdir(dir, { recursive: true });
    const names = await readdir(dir).catch(() => []);
    for (const name of names.filter((item) => item.endsWith(".teamaking.json") || item.endsWith(".json"))) {
      const absolutePath = path.join(dir, name);
      const info = await stat(absolutePath).catch(() => null);
      if (!info?.isFile()) continue;
      const storageKey = path.relative(/*turbopackIgnore: true*/ process.cwd(), absolutePath);
      files.push({
        name,
        storageKey,
        size: info.size,
        modifiedAt: info.mtime.toISOString(),
        downloadUrl: `/api/crawler/outputs/${encodeURIComponent(Buffer.from(storageKey).toString("base64url"))}/download`
      });
    }
  }
  return files.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}

function crawlerCsv(value: unknown) {
  return textValue(value).split(",").map((item) => item.trim()).filter(Boolean);
}

function parseCrawlerInstruction(value: unknown) {
  const instruction = textValue(value);
  const lower = instruction.toLowerCase();
  const urls = instruction.match(/https?:\/\/[^\s，。)）]+/g) ?? [];
  const years = [...new Set(instruction.match(/\b20\d{2}\b/g) ?? [])];
  const upperCodes = [...new Set(instruction.match(/\b[A-Z]{2,6}\b/g) ?? [])]
    .filter((code) => !["BNBU", "PDF", "HTML", "HTTP", "HTTPS", "URL", "JSON", "SPRING", "FALL"].includes(code));
  const limitMatch = lower.match(/(?:limit|前|first|top)\s*[:=]?\s*(\d{1,3})/i) ?? instruction.match(/(\d{1,3})\s*(?:个|份|programmes|majors|专业)/i);
  const termMatch =
    instruction.match(/\b(20\d{2})\s*[- ]?\s*(Spring|Fall)\b/i) ??
    instruction.match(/\b(20\d{2})\s*(春|秋|上|下)/);
  const term = termMatch ? (/spring|春|下/i.test(termMatch[2]) ? "Spring" : "Fall") : "";
  const academicYear = termMatch?.[1] ?? "";
  return {
    handbookUrl: urls.find((url) => /programme_handbook|handbook/i.test(url)) ?? urls[0] ?? "",
    cohorts: academicYear && term ? years.filter((year) => year !== academicYear).join(",") : years.join(","),
    programmes: upperCodes.join(","),
    limit: /全部|所有|all/i.test(instruction) ? "all" : limitMatch?.[1] ?? "",
    academicYear,
    term,
    target: "programme_handbook"
  };
}

async function crawlerScriptPath() {
  for (const candidate of crawlerScriptCandidates) {
    const info = await stat(candidate).catch(() => null);
    if (info?.isFile()) return candidate;
  }
  throw new ApiError(500, "没有找到 BNBU crawler runner。请确认 scripts/bnbu-crawler/run-handbook-preview.mjs 已部署。");
}

function normalizeCrawlerJobInput(body: Record<string, unknown>) {
  const natural = parseCrawlerInstruction(body.instruction);
  const academicYear = textValue(body.academicYear) || natural.academicYear || "2026";
  const term = textValue(body.term) || natural.term || "Spring";
  const cohorts = crawlerCsv(body.cohorts || natural.cohorts || "2025,2024");
  const outputMode = textValue(body.outputMode) || "download";
  const databaseAction = textValue(body.databaseAction) || textValue(body.postCrawlAction) || "download_only";
  const requestedName = optionalString(body.name) ?? optionalString(body.jobName);
  return {
    name: requestedName,
    target: textValue(body.target) || natural.target || "programme_handbook",
    handbookUrl:
      textValue(body.handbookUrl) ||
      natural.handbookUrl ||
      "https://ar.bnbu.edu.cn/current_students/student_handbook/programme_handbook.htm",
    cohorts,
    programmes: crawlerCsv(body.programmes || body.programmeCodes || natural.programmes).join(","),
    facultyCodes: crawlerCsv(body.facultyCodes).join(","),
    programmeName: textValue(body.programmeName),
    facultyName: textValue(body.facultyName),
    limit: textValue(body.limit) || natural.limit || "all",
    academicYear,
    term,
    semesterCode: textValue(body.semesterCode) || `${academicYear}-${term}`,
    semesterName: textValue(body.semesterName) || `${academicYear} ${term}`,
    outputMode,
    databaseAction: ["download_only", "create_pending", "approve_import"].includes(databaseAction) ? databaseAction : "download_only"
  };
}

function defaultCrawlerJobName(input: any) {
  const years = Array.isArray(input.cohorts) && input.cohorts.length ? input.cohorts.join(", ") : "unknown admission";
  return `${years} admission programme handbook`;
}

function serializeCrawlerJob(job: any) {
  const input = isPlainRecord(job.input) ? job.input : {};
  const logs = Array.isArray(job.logs) ? job.logs.map(textValue) : [];
  const outputs = Array.isArray(job.outputs) ? job.outputs : [];
  const imports = Array.isArray(job.imports) ? job.imports : outputs.map((output: any) => output.importResult).filter(Boolean);
  return {
    id: job.id,
    name: job.name,
    target: job.target,
    status: job.status,
    input,
    command: job.command,
    logs,
    outputs,
    imports,
    errorMessage: job.errorMessage,
    exitCode: job.exitCode,
    startedAt: job.startedAt?.toISOString?.() ?? job.startedAt,
    finishedAt: job.finishedAt?.toISOString?.() ?? job.finishedAt,
    createdAt: job.createdAt?.toISOString?.() ?? job.createdAt,
    updatedAt: job.updatedAt?.toISOString?.() ?? job.updatedAt
  };
}

async function persistCrawlerJob(job: any) {
  await prisma.crawlerJob.update({
    where: { id: job.id },
    data: {
      status: job.status,
      input: toJson(job.input),
      command: job.command,
      logs: toJson(job.logs ?? []),
      outputs: toJson(job.outputs ?? []),
      errorMessage: job.errorMessage ?? null,
      exitCode: job.exitCode ?? null,
      finishedAt: job.finishedAt ? new Date(job.finishedAt) : null
    }
  }).catch(() => null);
}

async function markStaleCrawlerJobs(appVersionId: string) {
  const staleDate = new Date(Date.now() - crawlerStaleMs);
  await prisma.crawlerJob.updateMany({
    where: {
      appVersionId,
      status: "running",
      updatedAt: { lt: staleDate }
    },
    data: {
      status: "failed",
      errorMessage: "任务长时间没有更新，可能是开发服务器重启、进程被终止，或网络/PDF 下载中断。请重新启动任务。",
      finishedAt: new Date()
    }
  }).catch(() => null);
}

async function listCrawlerJobs(appVersionId: string) {
  await markStaleCrawlerJobs(appVersionId);
  const jobs = await prisma.crawlerJob.findMany({
    where: { appVersionId },
    orderBy: { startedAt: "desc" },
    take: 50
  });
  return jobs.map(serializeCrawlerJob);
}

function crawlerOutputsChangedAfter(beforeOutputs: any[], afterOutputs: any[]) {
  const beforeByKey = new Map(beforeOutputs.map((file) => [file.storageKey, file.modifiedAt]));
  return afterOutputs.filter((file) => !beforeByKey.has(file.storageKey) || String(file.modifiedAt) > String(beforeByKey.get(file.storageKey)));
}

async function payloadFromStoredCrawlerOutput(output: any) {
  const content = await readStoredJson(output.storageKey);
  const parsed = JSON.parse(content);
  if (!isPlainRecord(parsed)) throw new ApiError(400, `爬虫输出不是有效 JSON object：${output.name}`);
  return parsed;
}

async function rejectOverlappingPendingImports(input: { appVersionId: string; schoolId?: string; cohortYears: number[]; admin: any; reason: string }) {
  if (!input.cohortYears.length) return [];
  const pendingBatches = await prisma.courseImportBatch.findMany({
    where: {
      appVersionId: input.appVersionId,
      ...(input.schoolId ? { schoolId: input.schoolId } : {}),
      status: "pending"
    },
    select: { id: true, cohortYears: true, payload: true, summary: true }
  });
  const overlapping = pendingBatches.filter((batch) => {
    const existingYears: number[] = numberValues(batch.cohortYears).length
      ? numberValues(batch.cohortYears)
      : isPlainRecord(batch.payload)
        ? importCohortYearsFromPayload(batch.payload)
        : numberValues(isPlainRecord(batch.summary) ? batch.summary.cohortYears : undefined);
    return hasOverlappingNumber(existingYears, input.cohortYears);
  });
  if (!overlapping.length) return [];
  await prisma.courseImportBatch.updateMany({
    where: { id: { in: overlapping.map((batch) => batch.id) } },
    data: {
      status: "rejected",
      rejectedByUserId: input.admin.id,
      rejectedAt: new Date(),
      adminNote: input.reason
    }
  });
  return overlapping.map((batch) => batch.id);
}

async function createCourseImportBatchFromPayload(input: {
  payload: Record<string, unknown>;
  name: string;
  admin: any;
  duplicateMode?: "block" | "reject_pending";
}) {
  const validation = validateBnbuCourseImportPayload(input.payload);
  if (!validation.ok) {
    throw new ApiError(400, `导入文件校验失败：${validation.errors.join("; ")}`);
  }

  const appVersionId = await getActiveAppVersionId();
  const school = await getActiveSchool("BNBU");
  const preview = await buildCourseImportPreview(input.payload);
  const summary = buildCourseImportBatchSummary(input.payload, preview);
  const cohortYears = importCohortYearsFromPayload(input.payload, preview);
  const hash = payloadHash(input.payload);

  if (input.duplicateMode === "reject_pending") {
    await rejectOverlappingPendingImports({
      appVersionId,
      schoolId: school?.id,
      cohortYears,
      admin: input.admin,
      reason: `Superseded by crawler import: ${input.name}`
    });
  } else {
    const pendingBatches = await prisma.courseImportBatch.findMany({
      where: {
        appVersionId,
        ...(school?.id ? { schoolId: school.id } : {}),
        status: "pending"
      },
      select: { id: true, cohortYears: true, payload: true, summary: true, createdAt: true }
    });
    const duplicatePending = pendingBatches.find((batch) => {
      const existingYears: number[] = numberValues(batch.cohortYears).length
        ? numberValues(batch.cohortYears)
        : isPlainRecord(batch.payload)
          ? importCohortYearsFromPayload(batch.payload)
          : numberValues(isPlainRecord(batch.summary) ? batch.summary.cohortYears : undefined);
      return hasOverlappingNumber(existingYears, cohortYears);
    });
    if (duplicatePending) {
      throw new ApiError(409, `已存在 ${cohortYears.join(", ")} admission 的 pending 配置，请先批准或拒绝旧配置后再创建。`, ERROR_CODES.COURSE_IMPORT_DUPLICATE_PENDING);
    }
  }

  const dataset = await createCourseImportDataset({ payload: input.payload, name: input.name, adminUserId: input.admin.id, schoolId: school?.id, preview });
  const batch = await prisma.courseImportBatch.create({
    data: {
      appVersionId,
      schoolId: school?.id,
      datasetId: dataset.id,
      name: input.name,
      schemaVersion: validation.schemaVersion ?? "teamaking.bnbu_course_import.v1",
      semesterCode: validation.semesterCode,
      cohortYears: toJson(cohortYears),
      payloadHash: hash,
      summary: toJson(summary),
      sourceLabel: summary.sourceLabel,
      status: "pending",
      payload: toJson({}),
      validationSummary: toJson({ ...validation, preview })
    }
  });
  await writeAudit(input.admin.id, "admin.course_imports.create", "CourseImportBatch", batch.id, null, { batch, validation, preview, source: "crawler" });
  return { batch, dataset, validation, preview, summary };
}

type CourseImportApproveStageName = "load_dataset" | "apply_import" | "build_summary" | "mark_approved" | "checkpoint";

type CourseImportApproveStage = {
  phase: CourseImportApproveStageName;
  status: "running" | "success" | "failed" | "skipped";
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  details?: unknown;
  error?: unknown;
};

function originalErrorDiagnostic(error: unknown) {
  return {
    name: error instanceof Error ? error.name : typeof error,
    message: error instanceof Error ? error.message : String(error),
    code: typeof (error as any)?.code === "string" ? (error as any).code : undefined,
    meta: (error as any)?.meta
  };
}

function courseImportApproveFailureNote(phase: string, error: unknown) {
  const diagnostic = originalErrorDiagnostic(error);
  return `Approve failed at ${phase} on ${new Date().toISOString()}: ${diagnostic.code ? `${diagnostic.code} ` : ""}${diagnostic.message}`;
}

async function runCourseImportApproveStage<T>(input: {
  phase: CourseImportApproveStageName;
  stages: CourseImportApproveStage[];
  batchId: string;
  admin: any;
  appVersionId?: string;
  details?: unknown;
  fn: () => Promise<T>;
}) {
  const startedAt = new Date();
  const startMs = Date.now();
  const stage: CourseImportApproveStage = {
    phase: input.phase,
    status: "running",
    startedAt: startedAt.toISOString(),
    details: input.details
  };
  input.stages.push(stage);
  try {
    const result = await input.fn();
    stage.status = "success";
    stage.finishedAt = new Date().toISOString();
    stage.durationMs = Date.now() - startMs;
    await safeOperationLog({
      appVersionId: input.appVersionId,
      actorUserId: input.admin.id,
      actorRole: input.admin.role,
      action: "admin.course_imports.approve.stage",
      targetType: "CourseImportBatch",
      targetId: input.batchId,
      status: "success",
      summary: { phase: input.phase, durationMs: stage.durationMs },
      metadata: { stage }
    });
    return result;
  } catch (error) {
    stage.status = "failed";
    stage.finishedAt = new Date().toISOString();
    stage.durationMs = Date.now() - startMs;
    stage.error = originalErrorDiagnostic(error);
    await safeOperationLog({
      appVersionId: input.appVersionId,
      actorUserId: input.admin.id,
      actorRole: input.admin.role,
      action: "admin.course_imports.approve.stage",
      targetType: "CourseImportBatch",
      targetId: input.batchId,
      status: "failed",
      summary: { phase: input.phase, durationMs: stage.durationMs },
      metadata: { stage, originalError: stage.error }
    });
    throw error;
  }
}

async function approveCourseImportBatch(batchId: string, admin: any) {
  const stages: CourseImportApproveStage[] = [];
  let loadedBatch: any = null;

  try {
    const { batch, approvalPayload } = await runCourseImportApproveStage({
      phase: "load_dataset",
      stages,
      batchId,
      admin,
      fn: async () => {
        const batch = await prisma.courseImportBatch.findUnique({ where: { id: batchId } });
        loadedBatch = batch;
        if (!batch) throw new ApiError(404, "找不到这个课程配置操作。");
        if (batch.status === "approved") throw new ApiError(400, "这个课程配置操作已经批准过。");
        const approvalPayload = batch.datasetId ? await payloadFromDataset(batch.datasetId) : isPlainRecord(batch.payload) ? batch.payload : null;
        if (!approvalPayload) throw new ApiError(400, "课程配置操作的 JSON 无法解析。");
        return { batch, approvalPayload };
      }
    });
    loadedBatch = batch;

    const before = await prisma.courseImportBatch.findUnique({ where: { id: batchId } });
    const result = await runCourseImportApproveStage({
      phase: "apply_import",
      stages,
      batchId,
      admin,
      appVersionId: batch.appVersionId,
      details: { datasetId: batch.datasetId, cohortYears: numberValues(batch.cohortYears) },
      fn: () => applyBnbuCourseImport(approvalPayload, batch.id)
    });
    const { approvalSummary, approvalCohortYears } = await runCourseImportApproveStage({
      phase: "build_summary",
      stages,
      batchId,
      admin,
      appVersionId: batch.appVersionId,
      fn: async () => {
        const existingSummary = isPlainRecord(batch.summary) ? batch.summary : {};
        const existingPreview = isPlainRecord(batch.validationSummary) && isPlainRecord(batch.validationSummary.preview)
          ? batch.validationSummary.preview
          : undefined;
        return {
          approvalSummary: Object.keys(existingSummary).length
            ? existingSummary
            : buildCourseImportBatchSummary(approvalPayload, { validation: validateBnbuCourseImportPayload(approvalPayload), counts: {} }),
          approvalCohortYears: numberValues(batch.cohortYears).length
            ? numberValues(batch.cohortYears)
            : importCohortYearsFromPayload(approvalPayload, existingPreview)
        };
      }
    });
    const updated = await runCourseImportApproveStage({
      phase: "mark_approved",
      stages,
      batchId,
      admin,
      appVersionId: batch.appVersionId,
      fn: () => prisma.courseImportBatch.update({
        where: { id: batchId },
        data: {
          schoolId: result.school.id,
          status: "approved",
          validationSummary: result.validationSummary,
          summary: toJson(approvalSummary),
          cohortYears: toJson(approvalCohortYears),
          payloadHash: batch.payloadHash ?? payloadHash(approvalPayload),
          sourceLabel: batch.sourceLabel ?? textValue(approvalSummary.sourceLabel),
          adminNote: typeof batch.adminNote === "string" && batch.adminNote.startsWith("Approve failed at ") ? null : batch.adminNote,
          approvedByUserId: admin.id,
          approvedAt: new Date()
        }
      })
    });
    const checkpoint = await runCourseImportApproveStage({
      phase: "checkpoint",
      stages,
      batchId,
      admin,
      appVersionId: batch.appVersionId,
      details: { mode: "manual", status: "skipped_manual_checkpoint" },
      fn: async () => ({ mode: "manual", status: "skipped_manual_checkpoint" })
    });
    await writeAudit(admin.id, "admin.course_imports.approve", "CourseImportBatch", batchId, before, { updated, result, checkpoint, stages });
    return { importBatch: updated, result, checkpoint, stages };
  } catch (error) {
    const failedStage = [...stages].reverse().find((stage) => stage.status === "failed");
    const phase = failedStage?.phase ?? "unknown";
    const metadata = {
      batchId,
      phase,
      stages,
      originalError: originalErrorDiagnostic(error)
    };
    if (loadedBatch) {
      await prisma.courseImportBatch.update({
        where: { id: batchId },
        data: { adminNote: courseImportApproveFailureNote(phase, error) }
      }).catch((updateError) => console.error("Failed to write course import approve failure note", updateError));
    }
    await safeOperationLog({
      appVersionId: loadedBatch?.appVersionId,
      actorUserId: admin.id,
      actorRole: admin.role,
      action: "admin.course_imports.approve",
      targetType: "CourseImportBatch",
      targetId: batchId,
      status: "failed",
      summary: { phase },
      metadata
    });
    if (error instanceof ApiError && error.status < 500) {
      throw new ApiError(error.status, error.message, error.errorCode, metadata);
    }
    throw new ApiError(500, `课程配置批准失败：${phase}。请在 Error Events 中查看 request id。`, ERROR_CODES.INTERNAL_SERVER_ERROR, metadata);
  }
}

async function importCrawlerOutputsForJob(job: any, outputs: any[], admin: any) {
  const action = job.input?.databaseAction ?? "download_only";
  if (!["create_pending", "approve_import"].includes(action)) return [];
  const imports = [];
  for (const output of outputs) {
    try {
      const payload = await payloadFromStoredCrawlerOutput(output);
      const name = `${job.name} · ${output.name}`;
      const created = await createCourseImportBatchFromPayload({
        payload,
        name,
        admin,
        duplicateMode: action === "approve_import" ? "reject_pending" : "block"
      });
      let approved = null;
      if (action === "approve_import") {
        approved = await approveCourseImportBatch(created.batch.id, admin);
      }
      imports.push({
        outputName: output.name,
        batchId: created.batch.id,
        datasetId: created.dataset.id,
        status: approved ? "approved" : "pending",
        summary: created.summary,
        approvalResult: approved?.result ?? null
      });
    } catch (error) {
      imports.push({
        outputName: output.name,
        status: "failed",
        error: error instanceof Error ? error.message : "导入失败"
      });
    }
  }
  return imports;
}

function crawlerJobBundleFilename(job: any) {
  return `${safeFilePart(job.name || job.id || "crawler-job")}-outputs-backup-not-direct-import.bundle.json`;
}

async function crawlerJobBundle(job: any) {
  const outputs = Array.isArray(job.outputs) ? job.outputs : [];
  const files = [];
  for (const output of outputs) {
    if (!output?.storageKey) continue;
    const content = await readStoredJson(output.storageKey);
    files.push({
      name: output.name,
      storageKey: output.storageKey,
      size: output.size,
      modifiedAt: output.modifiedAt,
      payload: JSON.parse(content)
    });
  }
  return {
    job: serializeCrawlerJob(job),
    files
  };
}

async function startCrawlerJob(body: Record<string, unknown>, admin: any) {
  const input = normalizeCrawlerJobInput(body);
  if (input.target !== "programme_handbook") {
    throw new ApiError(400, "当前 BNBU 课程配置只以每年 admission programme handbook 为准；class schedule 不是课程存在依据，semester offerings / syllabus teamwork 不作为当前产品目标。");
  }
  if (!input.cohorts.length) throw new ApiError(400, "至少填写一个 admission year，例如 2025 或 2025,2024。");
  await mkdir(crawlerOutputDir, { recursive: true });
  const script = await crawlerScriptPath();
  const appVersionId = await getActiveAppVersionId();
  const beforeOutputs = await listCrawlerOutputs();
  const jobName = input.name || defaultCrawlerJobName(input);
  const outDir = input.outputMode === "git_import_json" ? "course_imports/bnbu" : crawlerOutputDir;
  const args = [
    script,
    `--handbookUrl=${input.handbookUrl}`,
    `--cohorts=${input.cohorts.join(",")}`,
    `--limit=${input.limit}`,
    `--semesterCode=${input.semesterCode}`,
    `--semesterName=${input.semesterName}`,
    `--academicYear=${input.academicYear}`,
    `--term=${input.term}`,
    `--outDir=${outDir}`
  ];
  if (input.programmes) args.push(`--programmes=${input.programmes}`);
  if (input.facultyCodes) args.push(`--facultyCodes=${input.facultyCodes}`);
  if (input.programmeName) args.push(`--programmeName=${input.programmeName}`);
  if (input.facultyName) args.push(`--facultyName=${input.facultyName}`);
  const command = ["node", ...args].map((item) => (item.includes(" ") ? JSON.stringify(item) : item)).join(" ");
  const createdJob = await prisma.crawlerJob.create({
    data: {
      appVersionId,
      name: jobName,
      target: input.target,
      status: "running",
      input: toJson(input),
      command,
      logs: toJson([`Starting ${input.target} crawl at ${new Date().toISOString()}\n`]),
      outputs: toJson([]),
      createdByUserId: admin.id
    }
  });
  const job: any = {
    id: createdJob.id,
    name: jobName,
    input,
    status: "running",
    target: input.target,
    command,
    logs: [`Starting ${input.target} crawl at ${new Date().toISOString()}\n`],
    startedAt: createdJob.startedAt.toISOString(),
    finishedAt: null,
    exitCode: null,
    errorMessage: null,
    outputs: [],
    imports: []
  };
  crawlerJobs.set(createdJob.id, job);
  const child = spawn(process.execPath, args, { cwd: /*turbopackIgnore: true*/ process.cwd(), env: process.env });
  child.stdout.on("data", (chunk) => {
    job.logs.push(chunk.toString());
    void persistCrawlerJob(job);
  });
  child.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    job.logs.push(text);
    job.errorMessage = text.trim().split("\n").slice(-1)[0] || job.errorMessage;
    void persistCrawlerJob(job);
  });
  child.on("error", (error) => {
    job.status = "failed";
    job.finishedAt = new Date().toISOString();
    job.errorMessage = error.message;
    job.logs.push(`\n${error.stack || error.message}\n`);
    void persistCrawlerJob(job);
  });
  child.on("close", async (code) => {
    job.exitCode = code;
    job.status = code === 0 ? "completed" : "failed";
    job.finishedAt = new Date().toISOString();
    const allOutputs = await listCrawlerOutputs();
    job.outputs = crawlerOutputsChangedAfter(beforeOutputs, allOutputs);
    if (code === 0 && !job.outputs.length) {
      job.outputs = allOutputs.filter((file) => input.cohorts.some((cohort: string) => file.name.includes(`-${cohort}-`)));
    }
    if (code !== 0 && !job.errorMessage) {
      const tail = (job.logs ?? []).join("").trim().split("\n").filter(Boolean).slice(-1)[0];
      job.errorMessage = tail || `Crawler exited with code ${code}`;
    }
    if (code === 0) {
      job.imports = await importCrawlerOutputsForJob(job, job.outputs, admin);
      job.outputs = job.outputs.map((output: any) => ({
        ...output,
        importResult: job.imports.find((item: any) => item.outputName === output.name) ?? null
      }));
      const failedImport = job.imports.find((item: any) => item.status === "failed");
      if (failedImport) {
        job.status = "failed";
        job.errorMessage = failedImport.error;
      }
    }
    job.logs.push(`\nFinished with exit code ${code} at ${job.finishedAt}\n`);
    if (job.imports?.length) {
      job.logs.push(`Crawler import actions: ${JSON.stringify(job.imports.map((item: any) => ({ outputName: item.outputName, status: item.status, batchId: item.batchId, error: item.error })), null, 2)}\n`);
    }
    await persistCrawlerJob(job);
    await operationLog({
      actorUserId: admin.id,
      actorRole: admin.role,
      action: "crawler.jobs.finish",
      targetType: "CrawlerJob",
      targetId: job.id,
      status: job.status === "completed" ? "success" : "failed",
      summary: { name: job.name, input, exitCode: code, errorMessage: job.errorMessage }
    });
  });
  await operationLog({
    actorUserId: admin.id,
    actorRole: admin.role,
    action: "crawler.jobs.start",
    targetType: "CrawlerJob",
    targetId: job.id,
    summary: { name: job.name, input }
  });
  return serializeCrawlerJob({ ...createdJob, input, logs: job.logs, outputs: [], command, errorMessage: null, status: "running" });
}

function datasetRowId(row: Record<string, unknown>, fallback: string) {
  return textValue(row.id) || textValue(row.code) || fallback;
}

async function createCourseImportDataset(input: {
  payload: Record<string, unknown>;
  name: string;
  adminUserId: string;
  schoolId?: string;
  preview: any;
}) {
  const validation = input.preview.validation ?? validateBnbuCourseImportPayload(input.payload);
  const summary = buildCourseImportBatchSummary(input.payload, input.preview);
  const cohortYears = importCohortYearsFromPayload(input.payload, input.preview);
  const hash = payloadHash(input.payload);
  const artifact = await writeImportArtifact(input.payload, input.name);
  const appVersionId = await getActiveAppVersionId();
  const sourceRefs = records(input.payload.sourceRefs);
  const faculties = records(input.payload.faculties);
  const majors = records(input.payload.majors);
  const courses = records(input.payload.courses);
  const curriculumRules = records(input.payload.curriculumRules);
  const offerings = records(input.payload.offerings);

  return prisma.courseImportDataset.create({
    data: {
      appVersionId,
      schoolId: input.schoolId,
      name: input.name,
      schemaVersion: validation.schemaVersion ?? textValue(input.payload.schemaVersion) ?? "teamaking.bnbu_course_import.v2",
      semesterCode: validation.semesterCode,
      cohortYears: toJson(cohortYears),
      sourceLabel: summary.sourceLabel,
      payloadHash: hash,
      status: "validated",
      summary: toJson(summary),
      validationSummary: toJson({ ...validation, preview: input.preview }),
      originalFileName: artifact.fileName,
      originalStorageKey: artifact.storageKey,
      originalSize: artifact.size,
      createdByUserId: input.adminUserId,
      sourceRefs: {
        create: sourceRefs.map((row, index) => ({
          externalId: datasetRowId(row, `source-${index + 1}`),
          title: textValue(row.title),
          url: textValue(row.url),
          sourceType: textValue(row.sourceType),
          raw: toJson(row)
        }))
      },
      faculties: {
        create: faculties.map((row) => ({
          code: textValue(row.code),
          name: textValue(row.name),
          raw: toJson(row)
        })).filter((row) => row.code)
      },
      majors: {
        create: majors.map((row) => ({
          code: textValue(row.code),
          name: textValue(row.name),
          facultyCode: textValue(row.facultyCode),
          degreeType: textValue(row.degreeType),
          raw: toJson(row)
        })).filter((row) => row.code)
      },
      courses: {
        create: courses.map((row) => ({
          code: textValue(row.code),
          title: textValue(row.title),
          credits: numberValue(row.credits),
          categoryTags: toJson(Array.isArray(row.categoryTags) ? row.categoryTags : []),
          ownerUnit: toJson(isPlainRecord(row.ownerUnit) ? row.ownerUnit : {}),
          raw: toJson(row)
        })).filter((row) => row.code)
      },
      rules: {
        create: curriculumRules.map((row, index) => ({
          externalId: datasetRowId(row, `rule-${index + 1}`),
          courseCode: textValue(row.courseCode),
          classification: textValue(row.classification),
          studentAction: textValue(row.studentAction),
          audience: toJson(isPlainRecord(row.audience) ? row.audience : {}),
          relativeTermCodes: toJson(Array.isArray(row.relativeTermCodes) ? row.relativeTermCodes : []),
          sourceRefIds: toJson(Array.isArray(row.sourceRefIds) ? row.sourceRefIds : []),
          raw: toJson(row)
        })).filter((row) => row.externalId && row.courseCode)
      },
      offerings: {
        create: offerings.map((row, index) => ({
          externalId: datasetRowId(row, `offering-${index + 1}`),
          courseCode: textValue(row.courseCode),
          semesterCode: textValue(row.semesterCode),
          sections: toJson(Array.isArray(row.sections) ? row.sections : []),
          raw: toJson(row)
        })).filter((row) => row.externalId && row.courseCode)
      }
    },
    include: {
      school: true,
      sourceRefs: true,
      faculties: true,
      majors: true,
      courses: true,
      rules: true,
      offerings: true
    }
  });
}

async function payloadFromDataset(datasetId: string) {
  const dataset = await prisma.courseImportDataset.findUnique({
    where: { id: datasetId },
    include: {
      school: { include: { domains: true } },
      sourceRefs: true,
      faculties: true,
      majors: true,
      courses: true,
      rules: true,
      offerings: true
    }
  });
  if (!dataset) throw new ApiError(404, "找不到这个导入数据集。");
  return {
    schemaVersion: dataset.schemaVersion,
    generatedAt: dataset.createdAt.toISOString(),
    school: dataset.school ? { shortName: dataset.school.shortName, name: dataset.school.name, emailDomain: dataset.school.domains?.[0]?.domain } : { shortName: "BNBU" },
    semester: {
      code: dataset.semesterCode,
      name: dataset.semesterCode,
      academicYear: Number(String(dataset.semesterCode ?? "").match(/20\d{2}/)?.[0] ?? new Date().getFullYear()),
      term: String(dataset.semesterCode ?? "").includes("Fall") ? "Fall" : "Spring",
      isCurrentCandidate: false
    },
    sourceRefs: dataset.sourceRefs.map((row) => row.raw),
    faculties: dataset.faculties.map((row) => row.raw),
    majors: dataset.majors.map((row) => row.raw),
    courses: dataset.courses.map((row) => row.raw),
    offerings: dataset.offerings.map((row) => row.raw),
    curriculumRules: dataset.rules.map((row) => row.raw)
  };
}

async function versionSnapshotChunks(appVersionId: string) {
  const [users, schools, importBatches, datasets, operationLogs, auditLogs, errorEvents, supportTickets, posts, teamUps, follows, configs] = await Promise.all([
    prisma.user.findMany({
      where: { appVersionId },
      include: {
        profile: true,
        contactInfo: true,
        skills: true,
        memberships: true,
        submittedCourses: true,
        portfolioItems: true
      },
      orderBy: { createdAt: "asc" }
    }),
    prisma.school.findMany({
      where: { appVersionId },
      include: {
        domains: true,
        faculties: true,
        majors: true,
        semesters: true,
        courses: {
          include: {
            mappings: true,
            curriculumRules: true,
            offerings: {
              include: {
                syllabusMetadata: true,
                boards: { include: { sections: true } }
              }
            }
          }
        },
        importBatches: true
      },
      orderBy: { createdAt: "asc" }
    }),
    prisma.courseImportBatch.findMany({ where: { appVersionId }, orderBy: { createdAt: "asc" } }),
    prisma.courseImportDataset.findMany({
      where: { appVersionId },
      include: { sourceRefs: true, faculties: true, majors: true, courses: true, rules: true, offerings: true },
      orderBy: { createdAt: "asc" }
    }),
    prisma.operationLog.findMany({ where: { appVersionId }, orderBy: { createdAt: "asc" }, take: 5000 }),
    prisma.adminAuditLog.findMany({ where: { appVersionId }, orderBy: { createdAt: "asc" }, take: 5000 }),
    prisma.errorEvent.findMany({ where: { appVersionId }, orderBy: { createdAt: "asc" }, take: 5000 }),
    prisma.supportTicket.findMany({ where: { submittedBy: { appVersionId } }, orderBy: { createdAt: "asc" } }),
    prisma.teamakingPost.findMany({ where: { user: { appVersionId } }, orderBy: { createdAt: "asc" } }),
    prisma.teamUpRequest.findMany({ where: { sender: { appVersionId } }, orderBy: { createdAt: "asc" } }),
    prisma.followRequest.findMany({ where: { sender: { appVersionId } }, orderBy: { createdAt: "asc" } }),
    prisma.siteConfig.findMany({ orderBy: { key: "asc" } })
  ]);
  return [
    { name: "users", data: users },
    { name: "schools_and_course_catalog", data: schools },
    { name: "course_import_batches", data: importBatches },
    { name: "course_import_datasets", data: datasets },
    { name: "teamaking_posts", data: posts },
    { name: "team_up_requests", data: teamUps },
    { name: "follow_requests", data: follows },
    { name: "support_tickets", data: supportTickets },
    { name: "site_configs", data: configs },
    { name: "operation_logs", data: operationLogs },
    { name: "admin_audit_logs", data: auditLogs },
    { name: "error_events", data: errorEvents }
  ];
}

async function createVersionCheckpoint(input: {
  appVersionId?: string;
  label: string;
  kind?: string;
  reason?: string;
  triggeredByUserId?: string;
}) {
  const appVersionId = input.appVersionId ?? (await getActiveAppVersionId());
  const chunks = await versionSnapshotChunks(appVersionId);
  return prisma.versionCheckpoint.create({
    data: {
      appVersionId,
      label: input.label,
      kind: input.kind ?? "operation",
      reason: input.reason,
      triggeredByUserId: input.triggeredByUserId,
      summary: toJson(Object.fromEntries(chunks.map((chunk) => [chunk.name, Array.isArray(chunk.data) ? chunk.data.length : 0]))),
      chunks: {
        create: chunks.map((chunk) => ({
          name: chunk.name,
          rowCount: Array.isArray(chunk.data) ? chunk.data.length : 0,
          data: toJson(chunk.data)
        }))
      }
    },
    include: { chunks: true }
  });
}

function chunkArray(chunks: any[], name: string) {
  const data = chunks.find((chunk) => chunk.name === name)?.data;
  return Array.isArray(data) ? data : [];
}

function dateOrNull(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateOrUndefined(value: unknown) {
  return dateOrNull(value) ?? undefined;
}

async function restoreCheckpointAsNewVersion(checkpointId: string, admin: any) {
  const checkpoint = await prisma.versionCheckpoint.findUnique({
    where: { id: checkpointId },
    include: { chunks: true, appVersion: true }
  });
  if (!checkpoint) throw new ApiError(404, "找不到这个版本检查点。", ERROR_CODES.CHECKPOINT_NOT_FOUND);

  const restored = await prisma.$transaction(async (tx) => {
    await tx.appVersion.updateMany({
      where: { status: "active" },
      data: { status: "closed", endedAt: new Date() }
    });
    const version = await tx.appVersion.create({
      data: {
        name: `Restored: ${checkpoint.label}`,
        phase: checkpoint.appVersion.phase,
        status: "active",
        notes: `Restored from checkpoint ${checkpoint.id}`,
        createdByUserId: admin.id
      }
    });

    const schoolMap = new Map<string, string>();
    const facultyMap = new Map<string, string>();
    const majorMap = new Map<string, string>();
    const semesterMap = new Map<string, string>();
    const courseMap = new Map<string, string>();
    const offeringMap = new Map<string, string>();
    const boardMap = new Map<string, string>();
    const sectionMap = new Map<string, string>();
    const userMap = new Map<string, string>();
    const postMap = new Map<string, string>();

    for (const school of chunkArray(checkpoint.chunks, "schools_and_course_catalog")) {
      const createdSchool = await tx.school.create({
        data: {
          appVersionId: version.id,
          name: school.name,
          shortName: school.shortName,
          status: school.status ?? "active"
        }
      });
      schoolMap.set(school.id, createdSchool.id);

      for (const domain of school.domains ?? []) {
        await tx.schoolEmailDomain.create({
          data: { schoolId: createdSchool.id, domain: domain.domain, status: domain.status ?? "active" }
        });
      }
      for (const faculty of school.faculties ?? []) {
        const createdFaculty = await tx.faculty.create({
          data: { schoolId: createdSchool.id, code: faculty.code ?? null, name: faculty.name }
        });
        facultyMap.set(faculty.id, createdFaculty.id);
      }
      for (const major of school.majors ?? []) {
        const facultyId = facultyMap.get(major.facultyId);
        if (!facultyId) continue;
        const createdMajor = await tx.major.create({
          data: {
            schoolId: createdSchool.id,
            facultyId,
            code: major.code ?? null,
            name: major.name,
            degreeType: major.degreeType ?? "undergraduate"
          }
        });
        majorMap.set(major.id, createdMajor.id);
      }
      for (const semester of school.semesters ?? []) {
        const createdSemester = await tx.semester.create({
          data: {
            schoolId: createdSchool.id,
            code: semester.code ?? null,
            name: semester.name,
            year: Number(semester.year),
            term: semester.term,
            isCurrent: Boolean(semester.isCurrent)
          }
        });
        semesterMap.set(semester.id, createdSemester.id);
      }
      for (const course of school.courses ?? []) {
        const createdCourse = await tx.course.create({
          data: {
            schoolId: createdSchool.id,
            code: course.code,
            title: course.title,
            description: course.description ?? "",
            credits: course.credits ?? null,
            ownerUnit: toJson(course.ownerUnit ?? {}),
            categoryTags: toJson(course.categoryTags ?? []),
            sourceRefIds: toJson(course.sourceRefIds ?? []),
            manualOverrideFields: toJson(course.manualOverrideFields ?? []),
            manualNote: course.manualNote ?? null,
            courseType: course.courseType ?? "coursework",
            status: course.status ?? "active",
            source: course.source ?? "checkpoint_restore",
            mergedIntoCourseId: course.mergedIntoCourseId ? courseMap.get(course.mergedIntoCourseId) ?? null : null,
            mergedAt: dateOrNull(course.mergedAt),
            mergeNote: course.mergeNote ?? null
          }
        });
        courseMap.set(course.id, createdCourse.id);
      }
      for (const course of school.courses ?? []) {
        const courseId = courseMap.get(course.id);
        if (!courseId) continue;
        for (const mapping of course.mappings ?? []) {
          const majorId = majorMap.get(mapping.majorId);
          if (!majorId) continue;
          await tx.courseMajorMapping.create({
            data: {
              courseId,
              majorId,
              recommendedGrade: mapping.recommendedGrade,
              isRequired: Boolean(mapping.isRequired),
              isDefaultRecommended: mapping.isDefaultRecommended !== false
            }
          }).catch(() => null);
        }
        for (const rule of course.curriculumRules ?? []) {
          const semesterId = semesterMap.get(rule.semesterId);
          if (!semesterId) continue;
          await tx.courseCurriculumRule.create({
            data: {
              courseId,
              semesterId,
              externalId: rule.externalId,
              classification: rule.classification,
              classificationLabel: rule.classificationLabel ?? null,
              studentAction: rule.studentAction,
              audience: toJson(rule.audience ?? {}),
              relativeTermCodes: toJson(rule.relativeTermCodes ?? []),
              ownerUnit: toJson(rule.ownerUnit ?? {}),
              sourceRefIds: toJson(rule.sourceRefIds ?? []),
              confidence: rule.confidence ?? "unknown",
              status: rule.status ?? "active",
              raw: toJson(rule.raw ?? {})
            }
          }).catch(() => null);
        }
        for (const offering of course.offerings ?? []) {
          const semesterId = semesterMap.get(offering.semesterId);
          if (!semesterId) continue;
          const createdOffering = await tx.courseOffering.create({
            data: {
              courseId,
              semesterId,
              teacherName: offering.teacherName ?? null,
              section: offering.section ?? null,
              sourceRefIds: toJson(offering.sourceRefIds ?? []),
              status: offering.status ?? "active"
            }
          });
          offeringMap.set(offering.id, createdOffering.id);
          if (offering.syllabusMetadata) {
            await tx.courseSyllabusMetadata.create({
              data: {
                courseOfferingId: createdOffering.id,
                teamworkRequirement: offering.syllabusMetadata.teamworkRequirement ?? "unknown",
                teamworkSummary: offering.syllabusMetadata.teamworkSummary ?? null,
                evidenceSourceRefIds: toJson(offering.syllabusMetadata.evidenceSourceRefIds ?? []),
                confidence: offering.syllabusMetadata.confidence ?? "unknown",
                raw: toJson(offering.syllabusMetadata.raw ?? {})
              }
            });
          }
          for (const board of offering.boards ?? []) {
            const createdBoard = await tx.courseBoard.create({
              data: {
                courseOfferingId: createdOffering.id,
                title: board.title,
                status: board.status ?? "active",
                rules: board.rules ?? undefined,
                openFrom: dateOrNull(board.openFrom),
                openUntil: dateOrNull(board.openUntil)
              }
            });
            boardMap.set(board.id, createdBoard.id);
            for (const section of board.sections ?? []) {
              const createdSection = await tx.courseBoardSection.create({
                data: {
                  boardId: createdBoard.id,
                  code: section.code,
                  source: section.source ?? "checkpoint_restore"
                }
              });
              sectionMap.set(section.id, createdSection.id);
            }
          }
        }
      }
    }

    for (const user of chunkArray(checkpoint.chunks, "users")) {
      const schoolId = user.schoolId ? schoolMap.get(user.schoolId) : null;
      const createdUser = await tx.user.create({
        data: {
          appVersionId: version.id,
          email: user.email,
          schoolId,
          role: user.role ?? "verified_user",
          passwordHash: user.passwordHash ?? null,
          status: user.status ?? "active",
          suspendedUntil: dateOrNull(user.suspendedUntil),
          adminNote: user.adminNote ?? null,
          isEmailVerified: Boolean(user.isEmailVerified),
          onboardingCompleted: Boolean(user.onboardingCompleted)
        }
      });
      userMap.set(user.id, createdUser.id);
      if (user.profile) {
        await tx.userProfile.create({
          data: {
            userId: createdUser.id,
            displayName: user.profile.displayName,
            nickname: user.profile.nickname ?? null,
            avatarUrl: user.profile.avatarUrl ?? null,
            backgroundImageUrl: user.profile.backgroundImageUrl ?? null,
            headline: user.profile.headline ?? null,
            bio: user.profile.bio ?? "",
            grade: user.profile.grade ?? null,
            entryYear: user.profile.entryYear ?? null,
            entryTerm: user.profile.entryTerm ?? null,
            facultyId: user.profile.facultyId ? facultyMap.get(user.profile.facultyId) ?? null : null,
            majorId: user.profile.majorId ? majorMap.get(user.profile.majorId) ?? null : null,
            outputTags: toJson(user.profile.outputTags ?? []),
            resumeUrl: user.profile.resumeUrl ?? null,
            resumeFileName: user.profile.resumeFileName ?? null,
            resumeParsedData: toJson(user.profile.resumeParsedData ?? {}),
            openToBeDiscovered: user.profile.openToBeDiscovered !== false,
            visibilitySettings: toJson(user.profile.visibilitySettings ?? {})
          }
        });
      }
      if (user.contactInfo) {
        await tx.contactInfo.create({
          data: {
            userId: createdUser.id,
            schoolEmail: user.contactInfo.schoolEmail ?? user.email,
            wechatId: user.contactInfo.wechatId ?? null,
            wechatQrImageUrl: user.contactInfo.wechatQrImageUrl ?? null,
            linkedinUrl: user.contactInfo.linkedinUrl ?? null,
            personalEmail: user.contactInfo.personalEmail ?? null,
            visibilitySettings: toJson(user.contactInfo.visibilitySettings ?? defaultContactVisibility)
          }
        });
      }
      for (const portfolio of user.portfolioItems ?? []) {
        await tx.portfolioItem.create({
          data: {
            userId: createdUser.id,
            title: portfolio.title,
            type: portfolio.type,
            relatedCourseId: portfolio.relatedCourseId ? courseMap.get(portfolio.relatedCourseId) ?? null : null,
            semesterText: portfolio.semesterText ?? null,
            myRole: portfolio.myRole ?? null,
            contributionDescription: portfolio.contributionDescription ?? "",
            isGroupWork: Boolean(portfolio.isGroupWork),
            fileName: portfolio.fileName ?? null,
            fileMimeType: portfolio.fileMimeType ?? null,
            fileSize: portfolio.fileSize ?? null,
            fileExtension: portfolio.fileExtension ?? null,
            storageKey: portfolio.storageKey ?? null,
            storageMode: portfolio.storageMode ?? null,
            storageProvider: portfolio.storageProvider ?? null,
            objectKey: portfolio.objectKey ?? null,
            scanStatus: portfolio.scanStatus ?? "not_scanned",
            fileUrl: portfolio.fileUrl ?? null,
            externalUrl: portfolio.externalUrl ?? null,
            previewKind: portfolio.previewKind ?? "link",
            outcome: portfolio.outcome ?? null,
            reflection: portfolio.reflection ?? null,
            parsedText: portfolio.parsedText ?? null,
            metadata: toJson(portfolio.metadata ?? {}),
            visibility: portfolio.visibility ?? "same_school",
            isPinned: Boolean(portfolio.isPinned)
          }
        });
      }
      for (const membership of user.memberships ?? []) {
        const boardId = boardMap.get(membership.boardId);
        if (!boardId) continue;
        await tx.courseBoardMembership.create({
          data: {
            userId: createdUser.id,
            boardId,
            sectionId: membership.sectionId ? sectionMap.get(membership.sectionId) ?? null : null,
            sectionCode: membership.sectionCode ?? null,
            source: membership.source ?? "checkpoint_restore",
            status: membership.status ?? "active",
            originRuleId: membership.originRuleId ?? null,
            joinedAt: dateOrUndefined(membership.joinedAt),
            leftAt: dateOrNull(membership.leftAt)
          }
        }).catch(() => null);
      }
      for (const submission of user.submittedCourses ?? []) {
        const mappedSchoolId = submission.schoolId ? schoolMap.get(submission.schoolId) : schoolId;
        if (!mappedSchoolId) continue;
        await tx.userSubmittedCourse.create({
          data: {
            submittedByUserId: createdUser.id,
            schoolId: mappedSchoolId,
            code: submission.code,
            title: submission.title,
            teacherName: submission.teacherName ?? null,
            semesterText: submission.semesterText ?? null,
            status: submission.status ?? "pending",
            adminNote: submission.adminNote ?? null,
            matchedCourseId: submission.matchedCourseId ? courseMap.get(submission.matchedCourseId) ?? null : null
          }
        });
      }
    }

    for (const post of chunkArray(checkpoint.chunks, "teamaking_posts")) {
      const boardId = boardMap.get(post.boardId);
      const userId = userMap.get(post.userId);
      const offeringId = offeringMap.get(post.courseOfferingId);
      if (!boardId || !userId || !offeringId) continue;
      const createdPost = await tx.teamakingPost.create({
        data: {
          boardId,
          userId,
          courseOfferingId: offeringId,
          title: post.title,
          status: post.status ?? "open",
          strengths: toJson(post.strengths ?? []),
          contributionTypes: toJson(post.contributionTypes ?? []),
          expectedOutcome: post.expectedOutcome,
          portfolioItemIds: toJson([]),
          showWechatId: Boolean(post.showWechatId),
          showWechatQr: Boolean(post.showWechatQr),
          showLinkedin: Boolean(post.showLinkedin),
          showPersonalEmail: Boolean(post.showPersonalEmail),
          visibility: post.visibility ?? "same_course_board",
          expiresAt: dateOrNull(post.expiresAt)
        }
      });
      postMap.set(post.id, createdPost.id);
    }
    for (const request of chunkArray(checkpoint.chunks, "team_up_requests")) {
      const postId = postMap.get(request.postId);
      const senderId = userMap.get(request.senderId);
      const receiverId = userMap.get(request.receiverId);
      if (!postId || !senderId || !receiverId) continue;
      await tx.teamUpRequest.create({
        data: {
          postId,
          senderId,
          receiverId,
          message: request.message,
          senderContribution: request.senderContribution,
          senderContactSnapshot: toJson(request.senderContactSnapshot ?? {}),
          receiverContactSnapshot: toJson(request.receiverContactSnapshot ?? {}),
          status: request.status ?? "sent"
        }
      }).catch(() => null);
    }
    for (const request of chunkArray(checkpoint.chunks, "follow_requests")) {
      const senderId = userMap.get(request.senderId);
      const receiverId = userMap.get(request.receiverId);
      if (!senderId || !receiverId) continue;
      await tx.followRequest.create({
        data: { senderId, receiverId, status: request.status ?? "pending" }
      }).catch(() => null);
    }
    for (const ticket of chunkArray(checkpoint.chunks, "support_tickets")) {
      await tx.supportTicket.create({
        data: {
          submittedByUserId: ticket.submittedByUserId ? userMap.get(ticket.submittedByUserId) ?? null : null,
          email: ticket.email ?? null,
          category: ticket.category ?? "other",
          title: ticket.title,
          description: ticket.description,
          relatedUrl: ticket.relatedUrl ?? null,
          status: ticket.status ?? "open",
          adminNote: ticket.adminNote ?? null,
          adminReply: ticket.adminReply ?? null,
          adminRepliedAt: dateOrNull(ticket.adminRepliedAt)
        }
      });
    }
    for (const config of chunkArray(checkpoint.chunks, "site_configs")) {
      await tx.siteConfig.upsert({
        where: { key: config.key },
        update: { value: toJson(config.value ?? {}), updatedByUserId: userMap.get(admin.id) ?? admin.id },
        create: { key: config.key, value: toJson(config.value ?? {}), updatedByUserId: userMap.get(admin.id) ?? admin.id }
      });
    }

    return {
      version,
      mappedCounts: {
        schools: schoolMap.size,
        courses: courseMap.size,
        offerings: offeringMap.size,
        boards: boardMap.size,
        users: userMap.size,
        posts: postMap.size
      }
    };
  }, { timeout: 30000 });

  await operationLog({
    appVersionId: restored.version.id,
    actorUserId: admin.id,
    actorRole: admin.role,
    action: "admin.versions.restore_as_new_version",
    targetType: "VersionCheckpoint",
    targetId: checkpoint.id,
    summary: restored.mappedCounts
  });
  return { checkpoint, ...restored };
}

function summarizeVersion(version: any) {
  const counts = version._count ?? {};
  return {
    id: version.id,
    name: version.name,
    phase: version.phase,
    status: version.status,
    notes: version.notes,
    startedAt: version.startedAt,
    endedAt: version.endedAt,
    createdAt: version.createdAt,
    updatedAt: version.updatedAt,
    counts: {
      users: counts.users ?? 0,
      schools: counts.schools ?? 0,
      importBatches: counts.importBatches ?? 0,
      importDatasets: counts.importDatasets ?? 0,
      checkpoints: counts.checkpoints ?? 0,
      operationLogs: counts.operationLogs ?? 0
    }
  };
}

async function mergeCourses(sourceCourseId: string, targetCourseId: string, adminUserId: string, adminNote?: string) {
  if (sourceCourseId === targetCourseId) {
    throw new ApiError(400, "源课程和目标课程不能相同。", ERROR_CODES.COURSE_MERGE_INVALID);
  }

  const result = await prisma.$transaction(async (tx) => {
    const [source, target] = await Promise.all([
      tx.course.findUnique({ where: { id: sourceCourseId } }),
      tx.course.findUnique({ where: { id: targetCourseId } })
    ]);
    if (!source || !target) throw new ApiError(404, "找不到源课程或目标课程。", ERROR_CODES.COURSE_MERGE_INVALID);
    if (source.schoolId !== target.schoolId) {
      throw new ApiError(400, "只能合并同一学校下的课程。", ERROR_CODES.COURSE_MERGE_INVALID, { sourceCourseId, targetCourseId });
    }

    const summary = {
      offeringsMoved: 0,
      offeringsSkipped: 0,
      boardsMovedToDuplicateOffering: 0,
      mappingsMoved: 0,
      mappingsSkipped: 0,
      rulesMoved: 0,
      rulesSkipped: 0,
      portfoliosMoved: 0,
      submissionsMoved: 0
    };

    const offerings = await tx.courseOffering.findMany({ where: { courseId: source.id } });
    for (const offering of offerings) {
      const duplicate = await tx.courseOffering.findFirst({
        where: {
          courseId: target.id,
          semesterId: offering.semesterId,
          section: offering.section
        }
      });
      if (duplicate) {
        const movedBoards = await tx.courseBoard.updateMany({
          where: { courseOfferingId: offering.id },
          data: { courseOfferingId: duplicate.id }
        });
        await tx.teamakingPost.updateMany({
          where: { courseOfferingId: offering.id },
          data: { courseOfferingId: duplicate.id }
        });
        await tx.courseOffering.update({ where: { id: offering.id }, data: { status: "archived" } });
        summary.offeringsSkipped += 1;
        summary.boardsMovedToDuplicateOffering += movedBoards.count;
      } else {
        await tx.courseOffering.update({ where: { id: offering.id }, data: { courseId: target.id } });
        summary.offeringsMoved += 1;
      }
    }

    const mappings = await tx.courseMajorMapping.findMany({ where: { courseId: source.id } });
    for (const mapping of mappings) {
      const duplicate = await tx.courseMajorMapping.findUnique({
        where: {
          courseId_majorId_recommendedGrade: {
            courseId: target.id,
            majorId: mapping.majorId,
            recommendedGrade: mapping.recommendedGrade
          }
        }
      });
      if (duplicate) {
        await tx.courseMajorMapping.delete({ where: { id: mapping.id } });
        summary.mappingsSkipped += 1;
      } else {
        await tx.courseMajorMapping.update({ where: { id: mapping.id }, data: { courseId: target.id } });
        summary.mappingsMoved += 1;
      }
    }

    const rules = await tx.courseCurriculumRule.findMany({ where: { courseId: source.id } });
    for (const rule of rules) {
      const duplicate = await tx.courseCurriculumRule.findFirst({
        where: { courseId: target.id, semesterId: rule.semesterId, externalId: rule.externalId }
      });
      if (duplicate) {
        await tx.courseCurriculumRule.update({ where: { id: rule.id }, data: { status: "archived" } });
        summary.rulesSkipped += 1;
      } else {
        await tx.courseCurriculumRule.update({ where: { id: rule.id }, data: { courseId: target.id } });
        summary.rulesMoved += 1;
      }
    }

    const portfolios = await tx.portfolioItem.updateMany({
      where: { relatedCourseId: source.id },
      data: { relatedCourseId: target.id }
    });
    summary.portfoliosMoved = portfolios.count;

    const submissions = await tx.userSubmittedCourse.updateMany({
      where: { matchedCourseId: source.id },
      data: { matchedCourseId: target.id }
    });
    summary.submissionsMoved = submissions.count;

    const archivedSource = await tx.course.update({
      where: { id: source.id },
      data: {
        status: "archived",
        mergedIntoCourseId: target.id,
        mergedAt: new Date(),
        mergeNote: adminNote ?? `Merged into ${target.code}`
      }
    });

    return { source: archivedSource, target, summary };
  });

  await writeAudit(adminUserId, "admin.courses.merge", "Course", sourceCourseId, null, {
    targetCourseId,
    adminNote,
    summary: result.summary
  });
  return result;
}

async function createAppVersionFromAdminRequest(body: Record<string, unknown>, admin: any) {
  const active = await getActiveAppVersion();
  const finalCheckpoint = await createVersionCheckpoint({
    appVersionId: active.id,
    label: `Final state of ${active.name}`,
    kind: "version_close",
    reason: optionalString(body.reason) ?? "Admin opened a new software/test version",
    triggeredByUserId: admin.id
  });

  await prisma.appVersion.update({
    where: { id: active.id },
    data: {
      status: "closed",
      endedAt: new Date(),
      finalCheckpointId: finalCheckpoint.id
    }
  });

  const version = await prisma.appVersion.create({
    data: {
      name: assertString(body.name, "name"),
      phase: optionalString(body.phase) ?? "testing",
      status: "active",
      notes: optionalString(body.notes),
      createdByUserId: admin.id
    }
  });

  const activeSchools = await prisma.school.findMany({
    where: { appVersionId: active.id },
    include: { domains: true }
  });
  const schoolIdMap = new Map<string, string>();
  for (const sourceSchool of activeSchools) {
    const school = await prisma.school.create({
      data: {
        appVersionId: version.id,
        name: sourceSchool.name,
        shortName: sourceSchool.shortName,
        status: sourceSchool.status,
        domains: {
          create: sourceSchool.domains.map((domain) => ({ domain: domain.domain, status: domain.status }))
        }
      }
    });
    schoolIdMap.set(sourceSchool.id, school.id);
  }

  const adminUsers = await prisma.user.findMany({
    where: {
      appVersionId: active.id,
      role: { in: ["school_admin", "super_admin"] }
    },
    include: { profile: true, contactInfo: true }
  });
  for (const sourceUser of adminUsers) {
    const user = await prisma.user.create({
      data: {
        appVersionId: version.id,
        email: sourceUser.email,
        schoolId: sourceUser.schoolId ? schoolIdMap.get(sourceUser.schoolId) ?? null : null,
        role: sourceUser.role,
        passwordHash: sourceUser.passwordHash,
        status: "active",
        isEmailVerified: sourceUser.isEmailVerified,
        onboardingCompleted: false
      }
    });
    if (sourceUser.profile) {
      await prisma.userProfile.create({
        data: {
          userId: user.id,
          displayName: sourceUser.profile.displayName,
          nickname: sourceUser.profile.nickname,
          avatarUrl: sourceUser.profile.avatarUrl,
          backgroundImageUrl: sourceUser.profile.backgroundImageUrl,
          headline: sourceUser.profile.headline,
          bio: sourceUser.profile.bio,
          outputTags: toJson(sourceUser.profile.outputTags ?? []),
          visibilitySettings: toJson(sourceUser.profile.visibilitySettings ?? {}),
          openToBeDiscovered: false
        }
      });
    }
    if (sourceUser.contactInfo) {
      await prisma.contactInfo.create({
        data: {
          userId: user.id,
          schoolEmail: user.email,
          visibilitySettings: toJson(sourceUser.contactInfo.visibilitySettings ?? {})
        }
      });
    }
  }

  await operationLog({
    appVersionId: version.id,
    actorUserId: adminUsers.find((row) => row.email === admin.email)?.id ?? null,
    actorRole: admin.role,
    action: "admin.versions.open",
    targetType: "AppVersion",
    targetId: version.id,
    summary: { previousVersionId: active.id, finalCheckpointId: finalCheckpoint.id }
  });

  return { version, finalCheckpoint, copiedAdmins: adminUsers.length, copiedSchools: activeSchools.length };
}

async function estimateDefaultJoinUsers(input: {
  schoolId?: string;
  majorCodes: string[];
  facultyCodes: string[];
  grades: string[];
  relativeTermCodes: string[];
  allMajors: boolean;
  semesterYear?: number;
  semesterTerm?: string;
}) {
  if (!input.schoolId) return 0;

  const [majors, faculties] = await Promise.all([
    input.majorCodes.length
      ? prisma.major.findMany({ where: { schoolId: input.schoolId, code: { in: input.majorCodes } }, select: { id: true } })
      : Promise.resolve([]),
    input.facultyCodes.length
      ? prisma.faculty.findMany({ where: { schoolId: input.schoolId, code: { in: input.facultyCodes } }, select: { id: true } })
      : Promise.resolve([])
  ]);

  const audienceOr = [];
  if (input.allMajors) audienceOr.push({});
  if (majors.length) audienceOr.push({ majorId: { in: majors.map((major) => major.id) } });
  if (faculties.length) audienceOr.push({ facultyId: { in: faculties.map((faculty) => faculty.id) } });
  if (!audienceOr.length) return 0;

  const users = await prisma.user.findMany({
    where: {
      schoolId: input.schoolId,
      onboardingCompleted: true,
      profile: {
        is: {
          ...(input.grades.length && !input.relativeTermCodes.length ? { grade: { in: input.grades } } : {}),
          OR: audienceOr
        }
      }
    },
    select: {
      id: true,
      profile: {
        select: {
          entryYear: true,
          entryTerm: true,
          grade: true
        }
      }
    }
  });

  if (!input.relativeTermCodes.length) return users.length;
  const semester = { year: input.semesterYear, term: input.semesterTerm };
  return users.filter((user) => {
    const code = relativeTermCodeForProfile(user.profile, semester);
    return code ? input.relativeTermCodes.includes(code) : false;
  }).length;
}

async function buildCourseImportPreview(payload: Record<string, unknown>) {
  const validation = validateBnbuCourseImportPayload(payload);
  const semesterInput = isPlainRecord(payload.semester) ? payload.semester : {};
  const semesterCode = textValue(semesterInput.code);
  const school = await getActiveSchool("BNBU");
  const semester = school
    ? await prisma.semester.findFirst({
        where: {
          schoolId: school.id,
          OR: [{ code: semesterCode }, { name: textValue(semesterInput.name) }]
        }
      })
    : null;

  const facultyCodes = records(payload.faculties).map((item) => textValue(item.code)).filter(Boolean);
  const majorCodes = records(payload.majors).map((item) => textValue(item.code)).filter(Boolean);
  const courseCodes = records(payload.courses).map((item) => textValue(item.code)).filter(Boolean);
  const incomingRuleIds = records(payload.curriculumRules).map((item) => textValue(item.id)).filter(Boolean);
  const incomingCourses = records(payload.courses);
  const incomingRules = records(payload.curriculumRules);
  const incomingOfferings = records(payload.offerings);
  const incomingCohortYears = [...new Set(incomingRules.flatMap(cohortYearsForRule))].sort((a, b) => b - a);

  const [existingFaculties, existingMajors, existingCourses, existingRules] = await Promise.all([
    school && facultyCodes.length
      ? prisma.faculty.findMany({ where: { schoolId: school.id, code: { in: facultyCodes } }, select: { code: true, name: true } })
      : Promise.resolve([]),
    school && majorCodes.length
      ? prisma.major.findMany({ where: { schoolId: school.id, code: { in: majorCodes } }, select: { code: true, name: true } })
      : Promise.resolve([]),
    school && courseCodes.length
      ? prisma.course.findMany({
          where: { schoolId: school.id, code: { in: courseCodes } },
          select: {
            code: true,
            title: true,
            description: true,
            credits: true,
            ownerUnit: true,
            categoryTags: true,
            courseType: true,
            status: true,
            manualOverrideFields: true,
            manualNote: true
          }
        })
      : Promise.resolve([]),
    school
      ? prisma.courseCurriculumRule.findMany({
          where: { course: { schoolId: school.id }, status: "active" },
          include: { course: { select: { code: true, title: true } } }
        })
      : Promise.resolve([])
  ]);

  const existingFacultyCodes = new Set(existingFaculties.map((item) => item.code).filter(Boolean));
  const existingMajorCodes = new Set(existingMajors.map((item) => item.code).filter(Boolean));
  const existingCourseCodes = new Set(existingCourses.map((item) => item.code));
  const existingCourseByCode = new Map(existingCourses.map((item) => [item.code, item]));
  const existingRulesInCohorts = incomingCohortYears.length
    ? existingRules.filter((rule) => {
        const years = cohortYearsForRule({ audience: rule.audience as unknown as Record<string, unknown> });
        return years.some((year) => incomingCohortYears.includes(year));
      })
    : existingRules;
  const existingRuleIds = new Set(existingRulesInCohorts.map((item) => item.externalId));
  const incomingRuleIdSet = new Set(incomingRuleIds);

  let estimatedDefaultJoinUsers = 0;
  const defaultJoinRuleSamples: string[] = [];
  const searchableRuleSamples: string[] = [];

  for (const rule of incomingRules) {
    const studentAction = normalizedRuleStudentAction(rule);
    const externalId = textValue(rule.id);
    if (studentAction === "searchable_add") searchableRuleSamples.push(externalId);
    if (studentAction !== "default_join") continue;
    defaultJoinRuleSamples.push(externalId);
    const audience = isPlainRecord(rule.audience) ? rule.audience : {};
    estimatedDefaultJoinUsers += await estimateDefaultJoinUsers({
      schoolId: school?.id,
      majorCodes: textValues(audience.majorCodes),
      facultyCodes: textValues(audience.facultyCodes),
      grades: textValues(audience.grades),
      relativeTermCodes: relativeTermCodesForRule(rule),
      allMajors: audience.allMajors === true,
      semesterYear: Number(semesterInput.academicYear),
      semesterTerm: textValue(semesterInput.term)
    });
  }

  const newRuleIds = incomingRuleIds.filter((id) => !existingRuleIds.has(id));
  const retainedRuleIds = incomingRuleIds.filter((id) => existingRuleIds.has(id));
  const inactiveRuleIds = existingRulesInCohorts.map((rule) => rule.externalId).filter((id) => !incomingRuleIdSet.has(id));
  const existingRuleById = new Map(existingRulesInCohorts.map((rule) => [rule.externalId, rule]));
  const changedRules = incomingRules
    .map((rule) => {
      const externalId = textValue(rule.id);
      const existing = existingRuleById.get(externalId);
      if (!existing) return null;
      const incomingAudience = audienceForRule(rule);
      const incomingRelativeTerms = relativeTermCodesForRule(rule);
      const changedFields = [
        existing.classification !== textValue(rule.classification) ? "classification" : null,
        existing.studentAction !== normalizedRuleStudentAction(rule) ? "studentAction" : null,
        stableJson(existing.audience) !== stableJson(incomingAudience) ? "audience" : null,
        stableJson(existing.relativeTermCodes) !== stableJson(incomingRelativeTerms) ? "relativeTermCodes" : null
      ].filter(Boolean);
      if (!changedFields.length) return null;
      return {
        id: externalId,
        courseCode: textValue(rule.courseCode),
        changedFields,
        before: {
          classification: existing.classification,
          studentAction: existing.studentAction,
          audience: existing.audience,
          relativeTermCodes: existing.relativeTermCodes
        },
        after: {
          classification: textValue(rule.classification),
          studentAction: normalizedRuleStudentAction(rule),
          audience: incomingAudience,
          relativeTermCodes: incomingRelativeTerms
        }
      };
    })
    .filter(Boolean);

  const courseRows = incomingCourses.map((course) => {
    const code = textValue(course.code);
    const existing = existingCourseByCode.get(code);
    const manualOverrideFields = textValues(existing?.manualOverrideFields);
    const protectedConflicts = manualOverrideFields
      .map((field) => {
        const incomingValue =
          field === "categoryTags" || field === "sourceRefIds"
            ? textValues(course[field])
            : field === "ownerUnit"
              ? isPlainRecord(course[field]) ? course[field] : {}
              : course[field];
        const currentValue = existing ? (existing as any)[field] : undefined;
        if (!existing || stableJson(currentValue) === stableJson(incomingValue)) return null;
        return { field, currentValue, incomingValue };
      })
      .filter(Boolean);
    return {
      kind: "courses",
      id: code,
      code,
      title: textValue(course.title),
      credits: typeof course.credits === "number" ? course.credits : null,
      ownerUnit: isPlainRecord(course.ownerUnit) ? course.ownerUnit : {},
      categoryTags: textValues(course.categoryTags),
      sourceRefIds: textValues(course.sourceRefIds),
      manualOverrideFields,
      protectedConflicts,
      status: existingCourseCodes.has(code) ? "updated" : "new",
      raw: course
    };
  });
  const ruleRows = incomingRules.map((rule) => {
    const audience = audienceForRule(rule);
    const externalId = textValue(rule.id);
    return {
      kind: "curriculumRules",
      id: externalId,
      courseCode: textValue(rule.courseCode),
      classification: textValue(rule.classification),
      classificationLabel: textValue(rule.classificationLabel),
      studentAction: normalizedRuleStudentAction(rule),
      majorCodes: textValues(audience.majorCodes),
      facultyCodes: textValues(audience.facultyCodes),
      cohortYears: numberValues(audience.cohortYears),
      relativeTermCodes: relativeTermCodesForRule(rule),
      allMajors: audience.allMajors === true,
      confidence: textValue(rule.confidence) || "unknown",
      sourceRefIds: textValues(rule.sourceRefIds),
      status: existingRuleIds.has(externalId) ? "retained_or_changed" : "new",
      raw: rule
    };
  });
  const termContextRuleRows = ruleRows.filter((row) => ruleMatchesAcademicTermContext(row.raw, { year: Number(semesterInput.academicYear), term: textValue(semesterInput.term) }));
  const sourceRows = records(payload.sourceRefs).map((source) => ({
    kind: "sourceRefs",
    id: textValue(source.id),
    title: textValue(source.title),
    sourceType: textValue(source.sourceType),
    url: textValue(source.url),
    raw: source
  }));
  const offeringRows = incomingOfferings.map((offering, index) => ({
    kind: "offerings",
    id: textValue(offering.id) || `${textValue(offering.courseCode)}-${index}`,
    courseCode: textValue(offering.courseCode),
    semesterCode: textValue(offering.semesterCode),
    sections: textValues(offering.sections),
    sourceRefIds: textValues(offering.sourceRefIds),
    status: textValue(offering.status) || "active",
    raw: offering
  }));

  return {
    validation,
    importMode: incomingOfferings.length ? "combined_with_offerings" : "cohort_handbook",
    semester: {
      code: semesterCode,
      exists: Boolean(semester),
      willBecomeCurrent: semesterInput.isCurrentCandidate === true,
      label: textValue(semesterInput.name),
      note: incomingOfferings.length
        ? "包含真实开课记录，会创建或更新 CourseBoard。"
        : "这是按入学年份发布的 programme handbook / curriculum plan 导入；批准后写入课程目录和 admission-year 配置规则，CourseBoard 会由当前 academic term 与学生入学年份、专业、相对学期匹配后激活。"
    },
    counts: {
      newFaculties: facultyCodes.filter((code) => !existingFacultyCodes.has(code)).length,
      updatedFaculties: facultyCodes.filter((code) => existingFacultyCodes.has(code)).length,
      newMajors: majorCodes.filter((code) => !existingMajorCodes.has(code)).length,
      updatedMajors: majorCodes.filter((code) => existingMajorCodes.has(code)).length,
      newCourses: courseCodes.filter((code) => !existingCourseCodes.has(code)).length,
      updatedCourses: courseCodes.filter((code) => existingCourseCodes.has(code)).length,
      newRules: newRuleIds.length,
      retainedRules: retainedRuleIds.length,
      rulesToDeactivate: inactiveRuleIds.length,
      changedRules: changedRules.length,
      defaultJoinRules: defaultJoinRuleSamples.length,
      searchableRules: searchableRuleSamples.length,
      offeringCourses: new Set(incomingOfferings.map((item) => textValue(item.courseCode)).filter(Boolean)).size,
      offeringSections: incomingOfferings.reduce((total, item) => total + Math.max(1, textValues(item.sections).length), 0),
      courseBoardsToActivate: new Set(termContextRuleRows.map((row) => row.courseCode).filter(Boolean)).size,
      rulesInAcademicTermContext: termContextRuleRows.length,
      protectedCourseConflicts: courseRows.reduce((total, row) => total + row.protectedConflicts.length, 0),
      estimatedDefaultJoinUsers
    },
    coverage: {
      cohortYears: countRows(ruleRows, (row) => row.cohortYears.map(String)),
      classifications: countRows(ruleRows, (row) => row.classification),
      studentActions: countRows(ruleRows, (row) => row.studentAction),
      majors: countRows(ruleRows, (row) => (row.majorCodes.length ? row.majorCodes : row.allMajors ? "ALL" : "Unspecified")),
      relativeTerms: countRows(ruleRows, (row) => (row.relativeTermCodes.length ? row.relativeTermCodes : "Unspecified")),
      majorTermClassification: countRows(ruleRows, (row) => {
        const majors = row.majorCodes.length ? row.majorCodes : [row.allMajors ? "ALL" : "Unspecified"];
        const terms = row.relativeTermCodes.length ? row.relativeTermCodes : ["Unspecified"];
        return majors.flatMap((major) => terms.map((term) => `${row.cohortYears.join("/") || "?"} · ${major} · ${term} · ${row.classification}`));
      })
    },
    databaseCoverage: await buildBnbuDatabaseCoverage(existingRules),
    diff: {
      baseline: "current_database",
      courses: {
        added: courseCodes.filter((code) => !existingCourseCodes.has(code)),
        updated: courseCodes.filter((code) => existingCourseCodes.has(code)),
        protectedConflicts: courseRows.filter((row) => row.protectedConflicts.length > 0).map((row) => ({
          code: row.code,
          title: row.title,
          conflicts: row.protectedConflicts
        }))
      },
      rules: {
        added: newRuleIds,
        retained: retainedRuleIds,
        changed: changedRules,
        wouldDeactivate: inactiveRuleIds
      }
    },
    tables: {
      courses: courseRows,
      curriculumRules: ruleRows,
      offerings: offeringRows,
      sourceRefs: sourceRows
    },
    samples: {
      newCourses: firstItems(courseCodes.filter((code) => !existingCourseCodes.has(code))),
      updatedCourses: firstItems(courseCodes.filter((code) => existingCourseCodes.has(code))),
      newRules: firstItems(newRuleIds),
      rulesToDeactivate: firstItems(inactiveRuleIds),
      defaultJoinRules: firstItems(defaultJoinRuleSamples),
      searchableRules: firstItems(searchableRuleSamples),
      changedRules: firstItems(changedRules.map((item: any) => item.id))
    }
  };
}

async function buildBnbuDatabaseCoverage(preloadedRules?: any[]) {
  const school = await getActiveSchool("BNBU");
  if (!school) {
    return { cohortYears: [], classifications: [], majors: [], relativeTerms: [], totalRules: 0 };
  }
  const rules = preloadedRules ?? await prisma.courseCurriculumRule.findMany({
    where: { course: { schoolId: school.id }, status: "active" },
    include: { course: { select: { code: true, title: true } } }
  });
  const rows = rules.map((rule) => {
    const audience = isPlainRecord(rule.audience) ? rule.audience : {};
    return {
      cohortYears: numberValues(audience.cohortYears),
      classification: rule.classification,
      majorCodes: textValues(audience.majorCodes),
      relativeTermCodes: Array.isArray(rule.relativeTermCodes) ? textValues(rule.relativeTermCodes) : []
    };
  });
  return {
    totalRules: rows.length,
    cohortYears: countRows(rows, (row) => row.cohortYears.map(String)),
    classifications: countRows(rows, (row) => row.classification),
    majors: countRows(rows, (row) => row.majorCodes.length ? row.majorCodes : "ALL/Unspecified"),
    relativeTerms: countRows(rows, (row) => row.relativeTermCodes.length ? row.relativeTermCodes : "Unspecified")
  };
}

async function findOrCreateBoard(tx: any, courseOfferingId: string, title: string) {
  const existing = await tx.courseBoard.findFirst({ where: { courseOfferingId } });
  if (existing) {
    return tx.courseBoard.update({
      where: { id: existing.id },
      data: { status: existing.status === "closed" ? existing.status : "active" }
    });
  }
  return tx.courseBoard.create({
    data: {
      courseOfferingId,
      title,
      rules: "请尊重同学，清楚表达自己的贡献方式。必修/核心课程可能由 BNBU 课程配置默认加入；你可以自行退出，Course People 不代表官方选课名单。"
    }
  });
}

async function findOrCreateAcademicTermOffering(tx: any, input: {
  courseId: string;
  semesterId: string;
  sourceRefIds: string[];
}) {
  const existing = await tx.courseOffering.findFirst({
    where: { courseId: input.courseId, semesterId: input.semesterId, section: "Programme Plan" }
  });
  if (existing) {
    return tx.courseOffering.update({
      where: { id: existing.id },
      data: {
        sourceRefIds: input.sourceRefIds,
        status: existing.status === "cancelled" ? existing.status : "active"
      }
    });
  }
  return tx.courseOffering.create({
    data: {
      courseId: input.courseId,
      semesterId: input.semesterId,
      section: "Programme Plan",
      sourceRefIds: input.sourceRefIds,
      status: "active"
    }
  });
}

async function applyDefaultJoinRule(tx: any, input: {
  ruleId: string;
  schoolId: string;
  courseId: string;
  semesterId: string;
  semesterYear: number;
  semesterTerm: string;
  classification: string;
  audience: Record<string, unknown>;
  relativeTermCodes: string[];
}) {
  const majorCodes = textValues(input.audience.majorCodes);
  const facultyCodes = textValues(input.audience.facultyCodes);
  const grades = textValues(input.audience.grades);
  const allMajors = input.audience.allMajors === true;

  const [majors, faculties, boards] = await Promise.all([
    majorCodes.length
      ? tx.major.findMany({ where: { schoolId: input.schoolId, code: { in: majorCodes } }, select: { id: true } })
      : Promise.resolve([]),
    facultyCodes.length
      ? tx.faculty.findMany({ where: { schoolId: input.schoolId, code: { in: facultyCodes } }, select: { id: true } })
      : Promise.resolve([]),
    tx.courseBoard.findMany({
      where: {
        courseOffering: {
          courseId: input.courseId,
          semesterId: input.semesterId
        }
      },
      select: { id: true }
    })
  ]);

  if (!boards.length) return { matchedUsers: 0, membershipsCreated: 0, membershipsSkipped: 0 };

  const majorIds = majors.map((major: { id: string }) => major.id);
  const facultyIds = faculties.map((faculty: { id: string }) => faculty.id);
  const profileWhere: Record<string, unknown> = {};
  if (grades.length && !input.relativeTermCodes.length) profileWhere.grade = { in: grades };

  const audienceOr = [];
  if (allMajors) audienceOr.push({});
  if (majorIds.length) audienceOr.push({ majorId: { in: majorIds } });
  if (facultyIds.length) audienceOr.push({ facultyId: { in: facultyIds } });
  if (!audienceOr.length) return { matchedUsers: 0, membershipsCreated: 0, membershipsSkipped: 0 };

  const users = await tx.user.findMany({
    where: {
      schoolId: input.schoolId,
      onboardingCompleted: true,
      profile: {
        is: {
          ...profileWhere,
          OR: audienceOr
        }
      }
    },
    select: {
      id: true,
      profile: {
        select: {
          entryYear: true,
          entryTerm: true,
          grade: true
        }
      }
    }
  });

  const matchedUsers = input.relativeTermCodes.length
    ? users.filter((user: { profile: unknown }) => {
        const code = relativeTermCodeForProfile(user.profile, { year: input.semesterYear, term: input.semesterTerm });
        return code ? input.relativeTermCodes.includes(code) : false;
      })
    : users;

  let membershipsCreated = 0;
  let membershipsSkipped = 0;
  const source = membershipSourceForClassification(input.classification);

  for (const user of matchedUsers) {
    for (const board of boards) {
      const existing = await tx.courseBoardMembership.findUnique({
        where: { userId_boardId: { userId: user.id, boardId: board.id } }
      });

      if (existing?.status === "opted_out") {
        membershipsSkipped += 1;
        continue;
      }

      if (existing) {
        if (existing.source.startsWith("auto_")) {
          await tx.courseBoardMembership.update({
            where: { userId_boardId: { userId: user.id, boardId: board.id } },
            data: { status: "active", source, originRuleId: input.ruleId, leftAt: null }
          });
        }
        membershipsSkipped += 1;
        continue;
      }

      await tx.courseBoardMembership.create({
        data: {
          userId: user.id,
          boardId: board.id,
          source,
          status: "active",
          originRuleId: input.ruleId
        }
      });
      membershipsCreated += 1;
    }
  }

  return { matchedUsers: matchedUsers.length, membershipsCreated, membershipsSkipped };
}

async function applyBnbuCourseImport(payload: Record<string, unknown>, batchId: string) {
  const summary = validateBnbuCourseImportPayload(payload);
  if (!summary.ok) throw new ApiError(400, `导入文件校验失败：${summary.errors.join("; ")}`);
  const appVersionId = await getActiveAppVersionId();

  return prisma.$transaction(async (tx) => {
    const schoolInput = isPlainRecord(payload.school) ? payload.school : {};
    const semesterInput = isPlainRecord(payload.semester) ? payload.semester : {};
    const school = await tx.school.upsert({
      where: { appVersionId_shortName: { appVersionId, shortName: "BNBU" } },
      update: {
        name: textValue(schoolInput.name) || "Beijing Normal-Hong Kong Baptist University",
        status: "active"
      },
      create: {
        appVersionId,
        shortName: "BNBU",
        name: textValue(schoolInput.name) || "Beijing Normal-Hong Kong Baptist University",
        status: "active"
      }
    });

    const emailDomain = textValue(schoolInput.emailDomain) || "mail.bnbu.edu.cn";
    await tx.schoolEmailDomain.upsert({
      where: { schoolId_domain: { schoolId: school.id, domain: emailDomain } },
      update: { schoolId: school.id, status: "active" },
      create: { schoolId: school.id, domain: emailDomain, status: "active" }
    });

    if (semesterInput.isCurrentCandidate === true) {
      await tx.semester.updateMany({ where: { schoolId: school.id }, data: { isCurrent: false } });
    }

    const semesterCode = textValue(semesterInput.code);
    const existingSemester = await tx.semester.findFirst({
      where: { schoolId: school.id, OR: [{ code: semesterCode }, { name: textValue(semesterInput.name) }] }
    });
    const semester = existingSemester
      ? await tx.semester.update({
          where: { id: existingSemester.id },
          data: {
            code: semesterCode,
            name: textValue(semesterInput.name),
            year: Number(semesterInput.academicYear),
            term: textValue(semesterInput.term),
            isCurrent: semesterInput.isCurrentCandidate === true ? true : existingSemester.isCurrent
          }
        })
      : await tx.semester.create({
          data: {
            schoolId: school.id,
            code: semesterCode,
            name: textValue(semesterInput.name),
            year: Number(semesterInput.academicYear),
            term: textValue(semesterInput.term),
            isCurrent: semesterInput.isCurrentCandidate === true
          }
        });

    const facultyByCode = new Map<string, any>();
    for (const facultyInput of records(payload.faculties)) {
      const code = textValue(facultyInput.code);
      const existing = await tx.faculty.findFirst({
        where: { schoolId: school.id, OR: [{ code }, { name: textValue(facultyInput.name) }] }
      });
      const faculty = existing
        ? await tx.faculty.update({ where: { id: existing.id }, data: { code, name: textValue(facultyInput.name) } })
        : await tx.faculty.create({ data: { schoolId: school.id, code, name: textValue(facultyInput.name) } });
      facultyByCode.set(code, faculty);
    }

    const majorByCode = new Map<string, any>();
    for (const majorInput of records(payload.majors)) {
      const code = textValue(majorInput.code);
      const faculty = facultyByCode.get(textValue(majorInput.facultyCode));
      if (!faculty) continue;
      const existing = await tx.major.findFirst({
        where: { schoolId: school.id, OR: [{ code }, { name: textValue(majorInput.name) }] }
      });
      const major = existing
        ? await tx.major.update({
            where: { id: existing.id },
            data: {
              code,
              facultyId: faculty.id,
              name: textValue(majorInput.name),
              degreeType: textValue(majorInput.degreeType) || "undergraduate"
            }
          })
        : await tx.major.create({
            data: {
              schoolId: school.id,
              facultyId: faculty.id,
              code,
              name: textValue(majorInput.name),
              degreeType: textValue(majorInput.degreeType) || "undergraduate"
            }
          });
      majorByCode.set(code, major);
    }

    const courseByCode = new Map<string, any>();
    for (const courseInput of records(payload.courses)) {
      const code = textValue(courseInput.code);
      const existingCourse = await tx.course.findUnique({ where: { schoolId_code: { schoolId: school.id, code } } });
      const importData = {
        title: textValue(courseInput.title),
        description: textValue(courseInput.description),
        credits: numberValue(courseInput.credits),
        ownerUnit: toJson(isPlainRecord(courseInput.ownerUnit) ? courseInput.ownerUnit : {}),
        categoryTags: textValues(courseInput.categoryTags),
        sourceRefIds: textValues(courseInput.sourceRefIds),
        courseType: "coursework",
        status: "active",
        source: "bnbu_import"
      };
      const protectedFields = textValues(existingCourse?.manualOverrideFields);
      const updateData = Object.fromEntries(Object.entries(importData).filter(([field]) => !protectedFields.includes(field)));
      const course = existingCourse
        ? await tx.course.update({
            where: { id: existingCourse.id },
            data: updateData
          })
        : await tx.course.create({
            data: {
              schoolId: school.id,
              code,
              ...importData
            }
          });
      courseByCode.set(code, course);
    }

    for (const offeringInput of records(payload.offerings)) {
      const course = courseByCode.get(textValue(offeringInput.courseCode));
      if (!course) continue;
      const sections = textValues(offeringInput.sections);
      const teacherNames = textValues(offeringInput.teacherNames).join(", ") || textValue(offeringInput.teacherName) || null;
      const sectionValues = sections.length ? sections : [textValue(offeringInput.section) || "Default"];
      for (const section of sectionValues) {
        const existing = await tx.courseOffering.findFirst({ where: { courseId: course.id, semesterId: semester.id, section } });
        const offering = existing
          ? await tx.courseOffering.update({
              where: { id: existing.id },
              data: {
                teacherName: teacherNames,
                section,
                sourceRefIds: textValues(offeringInput.sourceRefIds),
                status: textValue(offeringInput.status) || "active"
              }
            })
          : await tx.courseOffering.create({
              data: {
                courseId: course.id,
                semesterId: semester.id,
                teacherName: teacherNames,
                section,
                sourceRefIds: textValues(offeringInput.sourceRefIds),
                status: textValue(offeringInput.status) || "active"
              }
            });

        const syllabus = isPlainRecord(offeringInput.syllabus) ? offeringInput.syllabus : null;
        if (syllabus) {
          await tx.courseSyllabusMetadata.upsert({
            where: { courseOfferingId: offering.id },
            update: {
              teamworkRequirement: textValue(syllabus.teamworkRequirement) || "unknown",
              teamworkSummary: textValue(syllabus.teamworkSummary) || null,
              evidenceSourceRefIds: textValues(syllabus.evidenceSourceRefIds),
              confidence: textValue(syllabus.confidence) || "unknown",
              raw: toJson(syllabus)
            },
            create: {
              courseOfferingId: offering.id,
              teamworkRequirement: textValue(syllabus.teamworkRequirement) || "unknown",
              teamworkSummary: textValue(syllabus.teamworkSummary) || null,
              evidenceSourceRefIds: textValues(syllabus.evidenceSourceRefIds),
              confidence: textValue(syllabus.confidence) || "unknown",
              raw: toJson(syllabus)
            }
          });
        }

        await findOrCreateBoard(tx, offering.id, `${course.code} ${course.title}`);
      }
    }

    const incomingRules = records(payload.curriculumRules);
    const incomingRuleIds = incomingRules.map((rule) => textValue(rule.id)).filter(Boolean);
    const incomingRuleIdSet = new Set(incomingRuleIds);
    const incomingCohortYears = uniqueSortedNumbers(incomingRules.flatMap(cohortYearsForRule));
    let deactivatedRuleCount = 0;
    if (incomingRuleIds.length && incomingCohortYears.length) {
      const existingRulesForSemester = await tx.courseCurriculumRule.findMany({
        where: { semesterId: semester.id, status: "active" },
        select: { id: true, externalId: true, audience: true }
      });
      const ruleIdsToDeactivate = existingRulesForSemester
        .filter((rule: { externalId: string; audience: unknown }) => {
          if (incomingRuleIdSet.has(rule.externalId)) return false;
          const existingCohortYears = cohortYearsForRule({ audience: isPlainRecord(rule.audience) ? rule.audience : {} });
          return hasOverlappingNumber(existingCohortYears, incomingCohortYears);
        })
        .map((rule: { id: string }) => rule.id);
      deactivatedRuleCount = ruleIdsToDeactivate.length;
      if (ruleIdsToDeactivate.length) {
        await tx.courseCurriculumRule.updateMany({
          where: { id: { in: ruleIdsToDeactivate } },
          data: { status: "inactive" }
        });
      }
    }

    const autoJoinResults = [];
    const activatedBoards = [];
    let autoJoinSkippedOutsideTerm = 0;
    let rulesInAcademicTermContext = 0;
    const handbookOnlyImport = records(payload.offerings).length === 0;
    for (const ruleInput of incomingRules) {
      const course = courseByCode.get(textValue(ruleInput.courseCode));
      if (!course) continue;
      const classification = textValue(ruleInput.classification);
      const studentAction = normalizedRuleStudentAction(ruleInput);
      const audience = isPlainRecord(ruleInput.audience) ? ruleInput.audience : {};
      const relativeTermCodes = relativeTermCodesForRule(ruleInput);
      const externalId = textValue(ruleInput.id);
      const matchesAcademicTerm = ruleMatchesAcademicTermContext(ruleInput, semester);
      if (matchesAcademicTerm) rulesInAcademicTermContext += 1;
      const rule = await tx.courseCurriculumRule.upsert({
        where: { semesterId_externalId: { semesterId: semester.id, externalId } },
        update: {
          importBatchId: batchId,
          courseId: course.id,
          classification,
          classificationLabel: textValue(ruleInput.classificationLabel) || bnbuClassificationLabels[classification as keyof typeof bnbuClassificationLabels] || classification,
          studentAction,
          audience: toJson(audience),
          relativeTermCodes,
          ownerUnit: toJson(isPlainRecord(ruleInput.ownerUnit) ? ruleInput.ownerUnit : {}),
          sourceRefIds: textValues(ruleInput.sourceRefIds),
          confidence: textValue(ruleInput.confidence) || "unknown",
          status: "active",
          raw: toJson(ruleInput)
        },
        create: {
          importBatchId: batchId,
          externalId,
          courseId: course.id,
          semesterId: semester.id,
          classification,
          classificationLabel: textValue(ruleInput.classificationLabel) || bnbuClassificationLabels[classification as keyof typeof bnbuClassificationLabels] || classification,
          studentAction,
          audience: toJson(audience),
          relativeTermCodes,
          ownerUnit: toJson(isPlainRecord(ruleInput.ownerUnit) ? ruleInput.ownerUnit : {}),
          sourceRefIds: textValues(ruleInput.sourceRefIds),
          confidence: textValue(ruleInput.confidence) || "unknown",
          status: "active",
          raw: toJson(ruleInput)
        }
      });

      if (handbookOnlyImport && matchesAcademicTerm) {
        const offering = await findOrCreateAcademicTermOffering(tx, {
          courseId: course.id,
          semesterId: semester.id,
          sourceRefIds: textValues(ruleInput.sourceRefIds)
        });
        const board = await findOrCreateBoard(tx, offering.id, `${course.code} ${course.title}`);
        activatedBoards.push({ ruleId: externalId, boardId: board.id, courseCode: course.code });
      }

      if (studentAction === "default_join") {
        if (!matchesAcademicTerm) {
          autoJoinSkippedOutsideTerm += 1;
          continue;
        }
        const result = await applyDefaultJoinRule(tx, {
          ruleId: rule.id,
          schoolId: school.id,
          courseId: course.id,
          semesterId: semester.id,
          semesterYear: semester.year,
          semesterTerm: semester.term,
          classification,
          audience,
          relativeTermCodes
        });
        autoJoinResults.push({ ruleId: externalId, ...result });
      }
    }

    return {
      school,
      semester,
      validationSummary: summary,
      activatedBoards,
      autoJoinResults,
      deactivatedRuleCount,
      rulesInAcademicTermContext,
      autoJoinSkippedOutsideTerm
    };
  }, { timeout: 60000, maxWait: 10000 });
}

function activeAnnouncementWhere(appVersionId: string, now = new Date()) {
  return {
    appVersionId,
    status: "published",
    OR: [{ startsAt: null }, { startsAt: { lte: now } }],
    AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }]
  };
}

function serializeAnnouncement(announcement: any) {
  const read = Array.isArray(announcement.reads) ? announcement.reads[0] : null;
  return {
    id: announcement.id,
    titleZh: announcement.titleZh,
    titleEn: announcement.titleEn,
    bodyZh: announcement.bodyZh,
    bodyEn: announcement.bodyEn,
    status: announcement.status,
    audience: announcement.audience,
    priority: announcement.priority,
    startsAt: announcement.startsAt,
    endsAt: announcement.endsAt,
    publishedAt: announcement.publishedAt,
    publishedBy: announcement.publishedBy ? publicUser(announcement.publishedBy) : null,
    archivedAt: announcement.archivedAt,
    readAt: read?.readAt ?? null,
    dismissedAt: read?.dismissedAt ?? null,
    createdAt: announcement.createdAt,
    updatedAt: announcement.updatedAt,
    readCount: announcement._count?.reads
  };
}

async function handleAnnouncements(method: string, path: string[]) {
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

  if (method === "GET" && resource === "versions") {
    const [activeVersion, versions, checkpoints] = await Promise.all([
      getActiveAppVersion(),
      prisma.appVersion.findMany({
        include: {
          _count: {
            select: {
              users: true,
              schools: true,
              importBatches: true,
              importDatasets: true,
              checkpoints: true,
              operationLogs: true
            }
          }
        },
        orderBy: { startedAt: "desc" },
        take: 30
      }),
      prisma.versionCheckpoint.findMany({
        include: { appVersion: true },
        orderBy: { createdAt: "desc" },
        take: 50
      })
    ]);
    return ok({
      activeVersion,
      versions: versions.map(summarizeVersion),
      checkpoints: checkpoints.map((checkpoint) => ({
        id: checkpoint.id,
        appVersionId: checkpoint.appVersionId,
        appVersionName: checkpoint.appVersion.name,
        label: checkpoint.label,
        kind: checkpoint.kind,
        reason: checkpoint.reason,
        summary: checkpoint.summary,
        createdAt: checkpoint.createdAt,
        downloadUrl: `/api/admin/versions/checkpoints/${checkpoint.id}/download`
      }))
    });
  }

  if (method === "POST" && resource === "versions" && !id) {
    const body = await readBody(request);
    const result = await createAppVersionFromAdminRequest(body, admin);
    await writeAudit(admin.id, "admin.versions.open", "AppVersion", result.version.id, null, result);
    return created({
      ...result,
      message: `已开启新版本：${result.version.name}。普通用户、课程、学期和导入数据从空白开始；只复制管理员账号和学校邮箱域名，便于继续登录管理。`
    });
  }

  if (method === "POST" && resource === "versions" && id === "checkpoints") {
    const body = await readBody(request);
    const checkpoint = await createVersionCheckpoint({
      label: optionalString(body.label) ?? `Manual checkpoint ${new Date().toLocaleString()}`,
      kind: "manual",
      reason: optionalString(body.reason),
      triggeredByUserId: admin.id
    });
    await writeAudit(admin.id, "admin.versions.checkpoint", "VersionCheckpoint", checkpoint.id, null, checkpoint);
    return created({ checkpoint, message: `已创建版本检查点：${checkpoint.label}` });
  }

  if (method === "GET" && resource === "versions" && id === "checkpoints" && action && path[4] === "download") {
    const checkpoint = await prisma.versionCheckpoint.findUnique({
      where: { id: action },
      include: { appVersion: true, chunks: true }
    });
    if (!checkpoint) throw new ApiError(404, "找不到这个版本检查点。");
    return jsonDownloadResponse(checkpoint, `${checkpoint.appVersion.name}-${checkpoint.label}-checkpoint.json`);
  }

  if (method === "POST" && resource === "versions" && id === "checkpoints" && action && ["restore-as-new-version", "rollback"].includes(path[4] ?? "")) {
    const restored = await restoreCheckpointAsNewVersion(action, admin);
    await writeAudit(admin.id, "admin.versions.restore_as_new_version", "VersionCheckpoint", action, null, restored.mappedCounts);
    return ok({
      ...restored,
      message: `已从检查点创建新的 active version：${restored.version.name}。旧 active version 已关闭，未做原地覆盖。`
    });
  }

  if (method === "GET" && resource === "course-import-datasets" && id && action === "download") {
    const dataset = await prisma.courseImportDataset.findUnique({ where: { id }, include: { school: true } });
    if (!dataset) throw new ApiError(404, "找不到这个导入数据集。");
    const content = await readStoredJson(dataset.originalStorageKey);
    return new NextResponse(content, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${dataset.originalFileName}"`
      }
    });
  }

  if (method === "POST" && resource === "course-imports" && id === "validate") {
    const body = await readBody(request);
    const payload = courseImportPayloadFromBody(body);
    const preview = await buildCourseImportPreview(payload);
    return ok({ validation: preview.validation, preview });
  }

  if (method === "GET" && resource === "course-imports") {
    const appVersionId = await getActiveAppVersionId();
    const importBatches = await prisma.courseImportBatch.findMany({
      where: { appVersionId },
      include: { school: true, dataset: true },
      orderBy: { createdAt: "desc" },
      take: 50
    });
    const selectedBatch = id ? await prisma.courseImportBatch.findUnique({ where: { id }, include: { school: true, dataset: true } }) : null;
    const selectedPayload = selectedBatch?.datasetId
      ? await payloadFromDataset(selectedBatch.datasetId)
      : selectedBatch && isPlainRecord(selectedBatch.payload)
        ? selectedBatch.payload
        : null;
    const preview = selectedPayload ? await buildCourseImportPreview(selectedPayload) : null;
    const databaseCoverage = await buildBnbuDatabaseCoverage();
    const selectedSummary = selectedBatch ? summarizeCourseImportBatch(selectedBatch, true) : null;
    return ok({
      importBatches: importBatches.map((batch) => summarizeCourseImportBatch(batch)),
      selectedBatch: selectedSummary && selectedPayload ? { ...selectedSummary, payload: selectedPayload } : selectedSummary,
      preview,
      databaseCoverage
    });
  }

  if (method === "POST" && resource === "course-imports" && !id) {
    const body = await readBody(request);
    const payload = courseImportPayloadFromBody(body);
    const name = optionalString(body.name) ?? optionalString(body.configName) ?? optionalString(body.sourceLabel);
    if (!name) throw new ApiError(400, "请为本次配置填写一个名称。");
    const createdBatch = await createCourseImportBatchFromPayload({ payload, name, admin, duplicateMode: "block" });
    return created({ importBatch: summarizeCourseImportBatch(createdBatch.batch), validation: createdBatch.validation, preview: createdBatch.preview });
  }

  if (method === "POST" && resource === "course-imports" && id && action === "approve") {
    const approved = await approveCourseImportBatch(id, admin);
    return ok({ importBatch: summarizeCourseImportBatch(approved.importBatch), result: approved.result });
  }

  if (method === "POST" && resource === "course-imports" && id && action === "reject") {
    const body = await readBody(request);
    const before = await prisma.courseImportBatch.findUnique({ where: { id } });
    if (!before) throw new ApiError(404, "找不到这个课程配置操作。");
    const updated = await prisma.courseImportBatch.update({
      where: { id },
      data: {
        status: "rejected",
        rejectedByUserId: admin.id,
        rejectedAt: new Date(),
        adminNote: optionalString(body.adminNote)
      }
    });
    await writeAudit(admin.id, "admin.course_imports.reject", "CourseImportBatch", id, before, updated);
    return ok({ importBatch: summarizeCourseImportBatch(updated) });
  }

  if (resource === "announcements") {
    const appVersionId = await getActiveAppVersionId();
    if (method === "GET" && !id) {
      const announcements = await prisma.siteAnnouncement.findMany({
        where: { appVersionId },
        include: {
          publishedBy: { include: userInclude },
          _count: { select: { reads: true } }
        },
        orderBy: [{ createdAt: "desc" }]
      });
      return ok({ announcements: announcements.map(serializeAnnouncement) });
    }

    if (method === "POST" && !id) {
      const body = await readBody(request);
      const status = optionalString(body.status) ?? "draft";
      const shouldPublish = status === "published";
      const announcement = await prisma.siteAnnouncement.create({
        data: {
          appVersionId,
          titleZh: assertString(body.titleZh, "titleZh"),
          titleEn: optionalString(body.titleEn),
          bodyZh: assertString(body.bodyZh, "bodyZh"),
          bodyEn: optionalString(body.bodyEn),
          audience: optionalString(body.audience) ?? "all",
          priority: Number(body.priority ?? 0) || 0,
          startsAt: optionalString(body.startsAt) ? new Date(assertString(body.startsAt, "startsAt")) : null,
          endsAt: optionalString(body.endsAt) ? new Date(assertString(body.endsAt, "endsAt")) : null,
          status: shouldPublish ? "published" : "draft",
          publishedAt: shouldPublish ? new Date() : null,
          publishedByUserId: shouldPublish ? admin.id : null
        },
        include: { publishedBy: { include: userInclude }, _count: { select: { reads: true } } }
      });
      await writeAudit(admin.id, "admin.announcements.create", "SiteAnnouncement", announcement.id, null, announcement);
      return created({ announcement: serializeAnnouncement(announcement), message: shouldPublish ? "公告已创建并发布。" : "公告草稿已创建。" });
    }

    if (method === "PATCH" && id) {
      const body = await readBody(request);
      const before = await prisma.siteAnnouncement.findUnique({ where: { id } });
      if (!before || before.appVersionId !== appVersionId) throw new ApiError(404, "找不到这条公告。");
      const announcement = await prisma.siteAnnouncement.update({
        where: { id },
        data: {
          titleZh: optionalString(body.titleZh) ?? before.titleZh,
          titleEn: Object.prototype.hasOwnProperty.call(body, "titleEn") ? optionalString(body.titleEn) : before.titleEn,
          bodyZh: optionalString(body.bodyZh) ?? before.bodyZh,
          bodyEn: Object.prototype.hasOwnProperty.call(body, "bodyEn") ? optionalString(body.bodyEn) : before.bodyEn,
          audience: optionalString(body.audience) ?? before.audience,
          priority: Object.prototype.hasOwnProperty.call(body, "priority") ? Number(body.priority ?? 0) || 0 : before.priority,
          startsAt: Object.prototype.hasOwnProperty.call(body, "startsAt") ? (optionalString(body.startsAt) ? new Date(assertString(body.startsAt, "startsAt")) : null) : before.startsAt,
          endsAt: Object.prototype.hasOwnProperty.call(body, "endsAt") ? (optionalString(body.endsAt) ? new Date(assertString(body.endsAt, "endsAt")) : null) : before.endsAt
        },
        include: { publishedBy: { include: userInclude }, _count: { select: { reads: true } } }
      });
      await writeAudit(admin.id, "admin.announcements.patch", "SiteAnnouncement", id, before, announcement);
      return ok({ announcement: serializeAnnouncement(announcement), message: "公告已更新。" });
    }

    if (method === "POST" && id && action === "publish") {
      const before = await prisma.siteAnnouncement.findUnique({ where: { id } });
      if (!before || before.appVersionId !== appVersionId) throw new ApiError(404, "找不到这条公告。");
      const announcement = await prisma.siteAnnouncement.update({
        where: { id },
        data: {
          status: "published",
          publishedAt: before.publishedAt ?? new Date(),
          publishedByUserId: admin.id,
          archivedAt: null
        },
        include: { publishedBy: { include: userInclude }, _count: { select: { reads: true } } }
      });
      await writeAudit(admin.id, "admin.announcements.publish", "SiteAnnouncement", id, before, announcement);
      return ok({ announcement: serializeAnnouncement(announcement), message: "公告已发布给所有用户。" });
    }

    if (method === "POST" && id && action === "archive") {
      const before = await prisma.siteAnnouncement.findUnique({ where: { id } });
      if (!before || before.appVersionId !== appVersionId) throw new ApiError(404, "找不到这条公告。");
      const announcement = await prisma.siteAnnouncement.update({
        where: { id },
        data: { status: "archived", archivedAt: new Date() },
        include: { publishedBy: { include: userInclude }, _count: { select: { reads: true } } }
      });
      await writeAudit(admin.id, "admin.announcements.archive", "SiteAnnouncement", id, before, announcement);
      return ok({ announcement: serializeAnnouncement(announcement), message: "公告已归档。" });
    }
  }

  if (resource === "content") {
    const appVersionId = await getActiveAppVersionId();
    if (method === "GET" && !id) {
      const kind = request.nextUrl.searchParams.get("kind") ?? undefined;
      const documents = await prisma.contentDocument.findMany({
        where: {
          appVersionId,
          ...(kind ? { kind } : {})
        },
        orderBy: [{ kind: "asc" }, { displayOrder: "asc" }, { updatedAt: "desc" }]
      });
      return ok({ documents: documents.map((document) => serializeContentDocument({ ...document, children: [] })) });
    }

    if (method === "POST" && !id) {
      const body = await readBody(request);
      const kind = optionalString(body.kind) ?? "help";
      if (!["help", "developer_log", "developer_contact"].includes(kind)) throw new ApiError(400, "内容类型无效。");
      const imageUrls = contentImageUrls(body.imageUrls);
      if (kind === "developer_log" && imageUrls.length > 3) throw new ApiError(400, "开发者日志最多支持 3 张图片。");
      const status = optionalString(body.status) ?? "draft";
      const document = await prisma.contentDocument.create({
        data: {
          appVersionId,
          kind,
          nodeType: optionalString(body.nodeType) === "folder" ? "folder" : "document",
          parentId: optionalString(body.parentId),
          slug: optionalString(body.slug) ?? `${kind}-${Date.now()}`,
          title: assertString(body.title, "title"),
          summary: optionalString(body.summary),
          bodyMarkdown: optionalString(body.bodyMarkdown) ?? "",
          imageUrls,
          status,
          displayOrder: Number(body.displayOrder ?? 0) || 0,
          publishedAt: status === "published" ? new Date() : null,
          updatedByUserId: admin.id
        }
      });
      await writeAudit(admin.id, "admin.content.create", "ContentDocument", document.id, null, document);
      return created({ document: serializeContentDocument({ ...document, children: [] }), message: status === "published" ? "文档已发布。" : "文档草稿已创建。" });
    }

    if (method === "PATCH" && id) {
      const body = await readBody(request);
      const before = await prisma.contentDocument.findUnique({ where: { id } });
      if (!before || before.appVersionId !== appVersionId) throw new ApiError(404, "找不到这篇文档。");
      const status = optionalString(body.status) ?? before.status;
      const nextImageUrls = Object.prototype.hasOwnProperty.call(body, "imageUrls") ? contentImageUrls(body.imageUrls) : contentImageUrls(before.imageUrls);
      if ((optionalString(body.kind) ?? before.kind) === "developer_log" && nextImageUrls.length > 3) throw new ApiError(400, "开发者日志最多支持 3 张图片。");
      const document = await prisma.contentDocument.update({
        where: { id },
        data: {
          kind: optionalString(body.kind) ?? before.kind,
          nodeType: optionalString(body.nodeType) === "folder" ? "folder" : optionalString(body.nodeType) === "document" ? "document" : before.nodeType,
          parentId: Object.prototype.hasOwnProperty.call(body, "parentId") ? optionalString(body.parentId) : before.parentId,
          slug: optionalString(body.slug) ?? before.slug,
          title: optionalString(body.title) ?? before.title,
          summary: Object.prototype.hasOwnProperty.call(body, "summary") ? optionalString(body.summary) : before.summary,
          bodyMarkdown: Object.prototype.hasOwnProperty.call(body, "bodyMarkdown") ? optionalString(body.bodyMarkdown) ?? "" : before.bodyMarkdown,
          imageUrls: nextImageUrls,
          status,
          displayOrder: Object.prototype.hasOwnProperty.call(body, "displayOrder") ? Number(body.displayOrder ?? 0) || 0 : before.displayOrder,
          publishedAt: status === "published" ? before.publishedAt ?? new Date() : before.publishedAt,
          updatedByUserId: admin.id
        }
      });
      await writeAudit(admin.id, "admin.content.patch", "ContentDocument", id, before, document);
      return ok({ document: serializeContentDocument({ ...document, children: [] }), message: "文档已更新。" });
    }

    if (method === "DELETE" && id) {
      const before = await prisma.contentDocument.findUnique({ where: { id } });
      if (!before || before.appVersionId !== appVersionId) throw new ApiError(404, "找不到这篇文档。");
      await prisma.contentDocument.delete({ where: { id } });
      await writeAudit(admin.id, "admin.content.delete", "ContentDocument", id, before, null);
      return ok({ message: "文档已删除。" });
    }
  }

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

  if (method === "GET" && resource === "schools") {
    const appVersionId = await getActiveAppVersionId();
    const schools = await prisma.school.findMany({ where: { appVersionId }, include: { domains: true, faculties: true, majors: true }, orderBy: { createdAt: "desc" } });
    return ok({ schools });
  }

  if (method === "POST" && resource === "schools") {
    const body = await readBody(request);
    const appVersionId = await getActiveAppVersionId();
    const school = await prisma.school.create({
      data: {
        appVersionId,
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
    const appVersionId = await getActiveAppVersionId();
    const [schools, faculties, majors, semesters] = await Promise.all([
      prisma.school.findMany({ where: { appVersionId }, orderBy: { shortName: "asc" } }),
      prisma.faculty.findMany({ where: { school: { appVersionId } }, include: { school: true }, orderBy: { name: "asc" } }),
      prisma.major.findMany({ where: { school: { appVersionId } }, include: { school: true, faculty: true }, orderBy: { name: "asc" } }),
      prisma.semester.findMany({ where: { school: { appVersionId } }, include: { school: true }, orderBy: [{ year: "desc" }, { name: "asc" }] })
    ]);
    return ok({ schools, faculties, majors, semesters });
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
    const url = new URL(request.url);
    const query = optionalString(url.searchParams.get("query")) ?? "";
    const requestedStatus = optionalString(url.searchParams.get("status")) ?? "all";
    const requestedSource = optionalString(url.searchParams.get("source")) ?? "all";
    const requestedTag = optionalString(url.searchParams.get("tag")) ?? "";
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(10, Number(url.searchParams.get("pageSize") ?? 25) || 25));
    const school = await getActiveSchool("BNBU");
    const where: any = {
      ...(school ? { schoolId: school.id } : {}),
      ...(requestedStatus !== "all" ? { status: requestedStatus } : {}),
      ...(requestedSource !== "all" ? { source: requestedSource } : {}),
      ...(query
        ? {
            OR: [
              { code: { contains: query, mode: "insensitive" } },
              { title: { contains: query, mode: "insensitive" } },
              { description: { contains: query, mode: "insensitive" } }
            ]
          }
        : {})
    };
    const [allMatching, semesters] = await Promise.all([
    prisma.course.findMany({
      where,
      include: {
        ...courseInclude,
        curriculumRules: {
          where: { status: "active" },
          include: { semester: true },
          orderBy: { updatedAt: "desc" },
          take: 200
        },
        _count: { select: { curriculumRules: true, offerings: true } }
      },
      orderBy: { code: "asc" }
    }),
    prisma.semester.findMany({
      where: school ? { schoolId: school.id } : {},
      orderBy: [{ year: "desc" }, { term: "asc" }]
    })
    ]);
    const tag = requestedTag.trim().toLowerCase();
    const filtered = tag
      ? allMatching.filter((course) => textValues(course.categoryTags).some((item) => item.toLowerCase().includes(tag)))
      : allMatching;
    const total = filtered.length;
    const courses = filtered.slice((page - 1) * pageSize, page * pageSize).map(serializeAdminCourse);
    const sources = [...new Set(allMatching.map((course) => course.source).filter(Boolean))].sort();
    const tags = [...new Set(allMatching.flatMap((course) => textValues(course.categoryTags)))].sort();
    return ok({ courses, semesters, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) }, filters: { sources, tags } });
  }

  if (method === "POST" && resource === "courses") {
    const body = await readBody(request);
    const schoolId = optionalString(body.schoolId) ?? (await getActiveSchool("BNBU"))?.id;
    if (!schoolId) throw new ApiError(400, "找不到 BNBU 学校记录，无法新增课程。");
    const code = assertString(body.code, "code").trim().toUpperCase();
    const existing = await prisma.course.findUnique({ where: { schoolId_code: { schoolId, code } } });
    if (existing) throw new ApiError(409, `${code} 已存在；同一学校下课程代码必须唯一。`);
    const course = await prisma.course.create({
      data: {
        schoolId,
        code,
        title: assertString(body.title, "title"),
        description: optionalString(body.description) ?? "",
        credits: numberValue(body.credits),
        ownerUnit: toJson(parseJsonObject(body.ownerUnit)),
        categoryTags: parseCommaText(body.categoryTags),
        courseType: optionalString(body.courseType) ?? "coursework",
        status: optionalString(body.status) ?? "active",
        source: "admin",
        manualOverrideFields: ["title", "description", "credits", "ownerUnit", "categoryTags", "courseType", "status"],
        manualNote: optionalString(body.manualNote)
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
    return created({ course: serializeAdminCourse({ ...course, curriculumRules: [], offerings: [], mappings: [], _count: { curriculumRules: 0, offerings: 0 } }), offering, board });
  }

  if (method === "PATCH" && resource === "courses" && id) {
    const body = await readBody(request);
    const before = await prisma.course.findUnique({ where: { id } });
    if (!before) throw new ApiError(404, "找不到这门课程。");
    const editableFields = ["code", "title", "description", "credits", "ownerUnit", "categoryTags", "courseType", "status"];
    const changedFields = editableFields.filter((field) => Object.prototype.hasOwnProperty.call(body, field));
    const overrideFields = [...new Set([...textValues(before.manualOverrideFields), ...changedFields.filter((field) => field !== "code")])];
    const nextCode = optionalString(body.code)?.trim().toUpperCase();
    if (nextCode && nextCode !== before.code) {
      const duplicate = await prisma.course.findUnique({ where: { schoolId_code: { schoolId: before.schoolId, code: nextCode } } });
      if (duplicate) throw new ApiError(409, `${nextCode} 已存在；同一学校下课程代码必须唯一。`);
    }
    const course = await prisma.course.update({
      where: { id },
      data: {
        code: nextCode ?? before.code,
        title: optionalString(body.title) ?? before.title,
        description: optionalString(body.description) ?? before.description,
        credits: Object.prototype.hasOwnProperty.call(body, "credits") ? numberValue(body.credits) : before.credits,
        ownerUnit: Object.prototype.hasOwnProperty.call(body, "ownerUnit") ? toJson(parseJsonObject(body.ownerUnit)) : before.ownerUnit,
        categoryTags: Object.prototype.hasOwnProperty.call(body, "categoryTags") ? parseCommaText(body.categoryTags) : textValues(before.categoryTags),
        courseType: optionalString(body.courseType) ?? before.courseType,
        status: optionalString(body.status) ?? before.status,
        manualOverrideFields: overrideFields,
        manualNote: optionalString(body.manualNote) ?? before.manualNote
      },
      include: {
        ...courseInclude,
        curriculumRules: { where: { status: "active" }, include: { semester: true }, orderBy: { updatedAt: "desc" }, take: 200 },
        _count: { select: { curriculumRules: true, offerings: true } }
      }
    });
    await writeAudit(admin.id, "admin.courses.patch", "Course", id, before, course);
    return ok({ course: serializeAdminCourse(course) });
  }

  if (method === "POST" && resource === "courses" && id && action === "offerings") {
    const body = await readBody(request);
    const course = await prisma.course.findUnique({ where: { id } });
    if (!course) throw new ApiError(404, "找不到这门课程。");
    const semesterId = assertString(body.semesterId, "semesterId");
    const semester = await prisma.semester.findUnique({ where: { id: semesterId } });
    if (!semester || semester.schoolId !== course.schoolId) {
      throw new ApiError(400, "开课学期和课程不属于同一学校。", ERROR_CODES.COURSE_OFFERING_INVALID, { courseId: id, semesterId });
    }
    const existing = await prisma.courseOffering.findFirst({
      where: {
        courseId: course.id,
        semesterId,
        section: optionalString(body.section) ?? null
      }
    });
    const offering = existing
      ? await prisma.courseOffering.update({
          where: { id: existing.id },
          data: {
            teacherName: optionalString(body.teacherName) ?? existing.teacherName,
            status: optionalString(body.status) ?? existing.status,
            sourceRefIds: Array.isArray(body.sourceRefIds) ? stringArray(body.sourceRefIds) : toJson(existing.sourceRefIds ?? [])
          },
          include: { course: true, semester: true, boards: true }
        })
      : await prisma.courseOffering.create({
          data: {
            courseId: course.id,
            semesterId,
            teacherName: optionalString(body.teacherName),
            section: optionalString(body.section),
            status: optionalString(body.status) ?? "active",
            sourceRefIds: Array.isArray(body.sourceRefIds) ? stringArray(body.sourceRefIds) : []
          },
          include: { course: true, semester: true, boards: true }
        });
    let board = null;
    if (body.createBoard !== false) {
      board = await prisma.courseBoard.findFirst({ where: { courseOfferingId: offering.id, status: "active" } });
      if (!board) {
        board = await prisma.courseBoard.create({
          data: {
            courseOfferingId: offering.id,
            title: optionalString(body.boardTitle) ?? `${course.code} ${course.title}`,
            rules: optionalString(body.boardRules) ?? undefined,
            status: "active"
          }
        });
      }
    }
    await writeAudit(admin.id, "admin.course_offerings.create", "CourseOffering", offering.id, null, { offering, board });
    return created({ offering, board, reused: Boolean(existing) });
  }

  if (method === "PATCH" && resource === "course-offerings" && id) {
    const body = await readBody(request);
    const before = await prisma.courseOffering.findUnique({ where: { id }, include: { course: true, semester: true, boards: true } });
    if (!before) throw new ApiError(404, "找不到这个开课配置。");
    const semesterId = optionalString(body.semesterId);
    if (semesterId) {
      const semester = await prisma.semester.findUnique({ where: { id: semesterId } });
      if (!semester || semester.schoolId !== before.course.schoolId) {
        throw new ApiError(400, "开课学期和课程不属于同一学校。", ERROR_CODES.COURSE_OFFERING_INVALID, { offeringId: id, semesterId });
      }
    }
    const offering = await prisma.courseOffering.update({
      where: { id },
      data: {
        semesterId: semesterId ?? before.semesterId,
        teacherName: optionalString(body.teacherName) ?? before.teacherName,
        section: Object.prototype.hasOwnProperty.call(body, "section") ? optionalString(body.section) ?? null : before.section,
        status: optionalString(body.status) ?? before.status,
        sourceRefIds: Array.isArray(body.sourceRefIds) ? stringArray(body.sourceRefIds) : toJson(before.sourceRefIds ?? [])
      },
      include: { course: true, semester: true, boards: true }
    });
    await writeAudit(admin.id, "admin.course_offerings.patch", "CourseOffering", id, before, offering);
    return ok({ offering });
  }

  if (method === "POST" && resource === "courses" && id && action === "merge") {
    const body = await readBody(request);
    const result = await mergeCourses(id, assertString(body.targetCourseId, "targetCourseId"), admin.id, optionalString(body.adminNote));
    return ok({ result, message: `课程已合并：${result.source.code} -> ${result.target.code}` });
  }

  if (method === "GET" && resource === "course-submissions") {
    const submissions = await prisma.userSubmittedCourse.findMany({
      include: { submittedBy: { include: { profile: true } }, school: true },
      orderBy: { createdAt: "desc" }
    });
    return ok({ submissions });
  }

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
    const requestedStatus = optionalString(body.status);
    if (requestedStatus && !teamUpInterestStatuses.includes(requestedStatus as any)) {
      throw new ApiError(400, "TeamUp 状态无效。", ERROR_CODES.TEAMUP_INVALID_TRANSITION, { status: requestedStatus });
    }
    const requestRow = await prisma.teamUpRequest.update({
      where: { id },
      data: { status: requestedStatus ?? before?.status }
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
    const appVersionId = await getActiveAppVersionId();
    const url = new URL(request.url);
    const actorUserId = optionalString(url.searchParams.get("actorUserId"));
    const [logs, operationLogs] = await Promise.all([
      prisma.adminAuditLog.findMany({
        where: { appVersionId },
        include: { adminUser: { include: { profile: true } } },
        orderBy: { createdAt: "desc" },
        take: 100
      }),
      prisma.operationLog.findMany({
        where: {
          appVersionId,
          ...(actorUserId ? { actorUserId } : {})
        },
        include: { actor: { include: { profile: true } } },
        orderBy: { createdAt: "desc" },
        take: 200
      })
    ]);
    return ok({ operationLogs, logs });
  }

  if (method === "GET" && resource === "error-events") {
    const appVersionId = await getActiveAppVersionId();
    const query = normalizeSearch(request.nextUrl.searchParams.get("query") ?? "");
    const where: any = { appVersionId };
    if (query) {
      where.OR = [
        { errorCode: { contains: query, mode: "insensitive" } },
        { requestId: { contains: query, mode: "insensitive" } },
        { path: { contains: query, mode: "insensitive" } },
        { userId: { contains: query, mode: "insensitive" } },
        { message: { contains: query, mode: "insensitive" } }
      ];
    }
    const events = await prisma.errorEvent.findMany({
      where,
      include: { user: { include: { profile: true } } },
      orderBy: { createdAt: "desc" },
      take: 200
    });
    const byCode = events.reduce<Record<string, number>>((acc, event) => {
      acc[event.errorCode] = (acc[event.errorCode] ?? 0) + 1;
      return acc;
    }, {});
    return ok({ errorEvents: events, summary: { total: events.length, byCode } });
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

  throw new ApiError(404, "找不到管理后台接口。");
}

async function handleCrawler(method: string, path: string[], request: NextRequest) {
  const admin = await requireAdmin();
  const resource = path[1];
  const id = path[2];
  const action = path[3];

  if (method === "GET" && (!resource || resource === "options")) {
    return ok({
      defaults: {
        name: "",
        target: "programme_handbook",
        handbookUrl: "https://ar.bnbu.edu.cn/current_students/student_handbook/programme_handbook.htm",
        cohorts: "2025,2024",
        academicYear: "2026",
        term: "Spring",
        limit: "all"
      },
      targets: [
        {
          value: "programme_handbook",
          label: "Programme handbook",
          supported: true,
          description: "唯一启用来源；抓取每个 admission year 的四年课程安排，输出 Course + admission-year Curriculum Rules。"
        }
      ],
      outputs: await listCrawlerOutputs()
    });
  }

  if (method === "GET" && resource === "jobs" && !id) {
    const appVersionId = await getActiveAppVersionId();
    return ok({
      jobs: await listCrawlerJobs(appVersionId),
      outputs: await listCrawlerOutputs()
    });
  }

  if (method === "POST" && resource === "jobs") {
    const body = await readBody(request);
    const job = await startCrawlerJob(body, admin);
    return created({ job, message: `已启动爬虫任务：${job.name}` });
  }

  if (method === "GET" && resource === "jobs" && id) {
    const appVersionId = await getActiveAppVersionId();
    await markStaleCrawlerJobs(appVersionId);
    const job = await prisma.crawlerJob.findUnique({ where: { id } });
    if (!job) throw new ApiError(404, "找不到这个爬虫任务。");
    if (action === "download") {
      const bundle = await crawlerJobBundle(job);
      return jsonDownloadResponse(bundle, crawlerJobBundleFilename(job));
    }
    return ok({ job: serializeCrawlerJob(job), outputs: await listCrawlerOutputs() });
  }

  if (method === "GET" && resource === "outputs") {
    if (id && action === "download") {
      const storageKey = Buffer.from(id, "base64url").toString("utf8");
      const content = await readStoredJson(storageKey);
      return new NextResponse(content, {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="${storageKey.split(/[\\/]/).pop() ?? "crawler-output.json"}"`
        }
      });
    }
    return ok({ outputs: await listCrawlerOutputs() });
  }

  throw new ApiError(404, "找不到爬虫接口。");
}

async function dispatch(method: string, context: RouteContext, request: NextRequest) {
  const path = await routeOf(context);
  const root = path[0];

  await ensureSystemIsActive(root);

  if (root === "auth") return handleAuth(method, path, request);
  if (root === "demo") return handleDemo(method, path, request);
  if (root === "onboarding") return handleOnboarding(method, path, request);
  if (root === "profile") return handleProfile(method, path, request);
  if (root === "contact-info" && path[1] === "me") return handleContactInfo(method, request);
  if (root === "friends") return handleFriends(method, request);
  if (root === "notifications" && path[1] === "summary") return handleNotifications(method);
  if (root === "content") return handleContent(method, request);
  if (root === "courses") return handleCourses(method, path, request);
  if (root === "course-comments") return handleCourseCommentReplies(method, path, request);
  if (root === "boards") return handleBoards(method, path, request);
  if (root === "teamaking-posts") return handleTeamakingPosts(method, path, request);
  if (root === "team-up-interests") return handleTeamUpInterests(method, path);
  if (root === "team-up-requests") return handleTeamUpRequests(method, path, request);
  if (root === "follow-requests") return handleFollowRequests(method, path);
  if (root === "support-tickets") return handleSupportTickets(method, request);
  if (root === "announcements") return handleAnnouncements(method, path);
  if (root === "uploads") return handleUploads(method, request);
  if (root === "matches" && method === "GET") return handleMatches();
  if (root === "admin") return handleAdmin(method, path, request);
  if (root === "crawler") return handleCrawler(method, path, request);

  throw new ApiError(404, "找不到这个 API 路径。");
}

export async function GET(request: NextRequest, context: RouteContext) {
  return handleApi(() => dispatch("GET", context, request), { request, onError: (error) => persistErrorEvent(request, error) });
}

export async function POST(request: NextRequest, context: RouteContext) {
  return handleApi(() => dispatch("POST", context, request), { request, onError: (error) => persistErrorEvent(request, error) });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return handleApi(() => dispatch("PATCH", context, request), { request, onError: (error) => persistErrorEvent(request, error) });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return handleApi(() => dispatch("DELETE", context, request), { request, onError: (error) => persistErrorEvent(request, error) });
}
