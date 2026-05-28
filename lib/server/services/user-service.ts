import { contactSnapshot } from "@/lib/contact";
import { visibleCourseBoardMemberships } from "@/lib/course-board-participation";

export const profileInclude = {
  faculty: true,
  major: true
};

export const userInclude = {
  appVersion: true,
  school: true,
  profile: { include: profileInclude },
  contactInfo: true,
  skills: { include: { skill: true } }
};

export const adminUserInclude = {
  ...userInclude,
  memberships: { include: { board: { include: { courseOffering: { include: { course: true, semester: true } } } } } },
  submittedCourses: true,
  teamakingPosts: true,
  sentTeamUpRequests: true,
  receivedRequests: true,
  portfolioItems: true,
  supportTickets: true
};

export function emailDomain(email: string) {
  const pieces = email.toLowerCase().split("@");
  return pieces.length === 2 ? pieces[1] : "";
}

export function inferredEntryYearFromEmail(email: string) {
  const localPart = email.toLowerCase().split("@")[0] ?? "";
  const yearDigit = localPart[1];
  if (!yearDigit || !/^\d$/.test(yearDigit)) return null;
  return 2020 + Number(yearDigit);
}

export function gradeFromEntryYear(entryYear?: number | null, now = new Date()) {
  if (!entryYear || !Number.isFinite(entryYear)) return null;
  const academicYear = now.getMonth() + 1 >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const level = Math.max(1, Math.min(4, academicYear - entryYear + 1));
  return `Year ${level}`;
}

export function academicLockForUser(user: any) {
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

export function profileWithAcademicLock(user: any) {
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

export function publicUser(user: any, contactContext?: Parameters<typeof contactSnapshot>[1], options: { includeMemberships?: boolean } = {}) {
  const serialized: any = {
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
  if (options.includeMemberships) {
    serialized.memberships = visibleCourseBoardMemberships(user.memberships);
  }
  return serialized;
}

export function listFromJson(value: unknown) {
  return Array.isArray(value) ? value : [];
}

export function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

export function scoreCourseMatch(course: { code: string; title: string }, query: string) {
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
