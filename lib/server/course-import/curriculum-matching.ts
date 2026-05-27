import { relativeTermCodesForRule } from "@/lib/bnbu-course-import";
import { isPlainRecord, textValue, textValues } from "@/lib/server/json-utils";

export function academicTermOffset(term?: string | null) {
  const normalized = (term ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("spring") || normalized === "s2" || normalized.includes("semester 2")) return 0;
  if (normalized.includes("fall") || normalized.includes("autumn") || normalized === "s1" || normalized.includes("semester 1")) return 1;
  return null;
}

export function academicTermIndex(year?: number | null, term?: string | null) {
  const offset = academicTermOffset(term);
  if (!year || offset === null) return null;
  return year * 2 + offset;
}

export function relativeTermCodeForProfile(profile: any, semester: any) {
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

export function relativeTermCodeForEntry(entryYear: number, entryTerm: string, semester: any) {
  return relativeTermCodeForProfile({ entryYear, entryTerm }, semester);
}

export function academicTermForRelativeTermCode(entryYear: number, entryTerm: string, relativeTermCode: string) {
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

export function audienceForRule(rule: Record<string, unknown>) {
  return isPlainRecord(rule.audience) ? rule.audience : {};
}

export function cohortYearsForRule(rule: Record<string, unknown>) {
  const audience = audienceForRule(rule);
  return Array.isArray(audience.cohortYears)
    ? audience.cohortYears.filter((item): item is number => typeof item === "number" && Number.isFinite(item))
    : [];
}

export function ruleMatchesAcademicTermContext(rule: Record<string, unknown>, semester: any) {
  const relativeTermCodes = relativeTermCodesForRule(rule);
  if (!relativeTermCodes.length) return false;
  const cohortYears = cohortYearsForRule(rule);
  if (!cohortYears.length) return false;
  return cohortYears.some((cohortYear) => {
    const code = relativeTermCodeForEntry(cohortYear, "Fall", semester);
    return code ? relativeTermCodes.includes(code) : false;
  });
}

export function curriculumRuleMatchesUser(rule: any, user: any, semesterOverride?: any) {
  const audience = audienceForRule(rule);
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

export function ruleHasProgrammeScope(rule: Record<string, unknown>) {
  const audience = audienceForRule(rule);
  if (audience.allMajors === true) return false;
  return textValues(audience.majorCodes).length > 0 || textValues(audience.facultyCodes).length > 0;
}

export function ruleMatchesUserRelativeTerm(rule: any, user: any, semester: any) {
  const relativeTermCodes = Array.isArray(rule.relativeTermCodes)
    ? textValues(rule.relativeTermCodes).map((code) => code.toUpperCase())
    : relativeTermCodesForRule(rule);
  if (!relativeTermCodes.length) return true;
  const code = relativeTermCodeForProfile(user.profile, semester);
  return Boolean(code && relativeTermCodes.includes(code));
}

export function defaultJoinUserMatchesRelativeTerm(user: { profile?: unknown }, relativeTermCodes: string[], semester: any) {
  if (!relativeTermCodes.length) return true;
  const normalizedCodes = relativeTermCodes.map((code) => code.toUpperCase());
  const code = relativeTermCodeForProfile(user.profile, semester);
  return Boolean(code && normalizedCodes.includes(code));
}

export function selectDefaultJoinUsers<T>(users: T[], relativeTermCodes: string[], semester: any) {
  return users.filter((user) => defaultJoinUserMatchesRelativeTerm(user as { profile?: unknown }, relativeTermCodes, semester));
}

export function defaultJoinMembershipAction(existing: { status?: string | null; source?: string | null } | null | undefined) {
  if (!existing) return "create";
  if (existing.status === "opted_out") return "skip";
  if (String(existing.source ?? "").startsWith("auto_")) return "update_auto";
  return "skip";
}
