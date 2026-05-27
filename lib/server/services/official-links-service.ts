import { audienceForRule, cohortYearsForRule, curriculumRuleMatchesUser } from "@/lib/server/course-import/curriculum-matching";

import { prisma } from "@/lib/prisma";
import { BNBU_HANDBOOK_URL, BNBU_MIS_URL, BNBU_PROGRAMMES_URL } from "@/lib/server/services/api-registry";
import { isPlainRecord, records, textValue, textValues } from "@/lib/server/services/json-service";

export const handbookLinkCache = new Map<string, { expiresAt: number; ref: HandbookSourceRef | null }>();

export const programmeIntroCache = new Map<string, { expiresAt: number; ref: ProgrammeIntroRef | null }>();

export const BNBU_FACULTY_PROGRAMME_PAGES = [
  { code: "FBM", url: "https://fbm.bnbu.edu.cn/en" },
  { code: "FHSS", url: "https://fhss.bnbu.edu.cn/en" },
  { code: "FST", url: "https://fst.bnbu.edu.cn/en" },
  { code: "SCC", url: "https://scc.bnbu.edu.cn/en" },
  { code: "SAI", url: "https://sai.bnbu.edu.cn/en" },
  { code: "SGE", url: "https://sge.bnbu.edu.cn/en" }
];

export type HandbookSourceRef = {
  externalId: string;
  title: string;
  url: string;
  sourceType?: string;
  provenance?: string;
  score?: number;
};

export type ProgrammeIntroRef = {
  title: string;
  url: string;
  facultyCode?: string;
  provenance?: string;
  score?: number;
};

export function decodeHtmlEntity(entity: string) {
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

export function decodeHtmlText(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&([a-zA-Z]+|#\d+|#x[\da-fA-F]+);/g, (_, entity: string) => decodeHtmlEntity(entity))
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizedSearchText(value: string) {
  return decodeHtmlText(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function significantWords(value: string) {
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

export function anchorLinksFromHtml(html: string) {
  const links: Array<{ href: string; text: string }> = [];
  const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchorPattern)) {
    const href = decodeHtmlText(match[1] ?? "");
    const text = decodeHtmlText(match[2] ?? "");
    if (href) links.push({ href, text });
  }
  return links;
}

export function sourceRefFromRecord(value: unknown, provenance: string): HandbookSourceRef | null {
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

export function handbookRefScore(
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

export async function matchingRuleSourceRefIdsForUser(user: any, entryYear: number) {
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

export function bestHandbookRef(
  refs: HandbookSourceRef[],
  context: { entryYear: number; majorCode: string; majorName: string; sourceRefIds: Set<string> }
) {
  return refs
    .map((ref) => ({ ...ref, score: handbookRefScore(ref, context) }))
    .filter((ref) => (ref.score ?? 0) > 0)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0] ?? null;
}

export async function findHandbookRefFromDatasetSources(
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

export async function findHandbookRefFromImportPayloads(
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

export async function fetchTextWithTimeout(url: string, timeoutMs = 6000) {
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

export async function findHandbookRefFromLiveAr(
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

export async function resolveProgrammeHandbookRef(user: any) {
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

export function programmeIntroScore(
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

export function bestProgrammeIntroRef(refs: ProgrammeIntroRef[], context: { majorCode: string; majorName: string }) {
  return refs
    .map((ref) => ({ ...ref, score: programmeIntroScore(ref, context) }))
    .filter((ref) => (ref.score ?? 0) > 0)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0] ?? null;
}

export function facultyProgrammePagesForUser(user: any) {
  const facultyCode = textValue(user.profile?.faculty?.code).toUpperCase();
  const direct = BNBU_FACULTY_PROGRAMME_PAGES.find((page) => page.code === facultyCode);
  return direct ? [direct] : BNBU_FACULTY_PROGRAMME_PAGES;
}

export async function resolveProgrammeIntroRef(user: any) {
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

export function buildOfficialAcademicLinks(
  user: any,
  programmeRef?: ProgrammeIntroRef | null,
  handbookRef?: HandbookSourceRef | null
) {
  const entryYear = typeof user.profile?.entryYear === "number" ? user.profile.entryYear : null;
  const majorCode = textValue(user.profile?.major?.code);
  const majorName = textValue(user.profile?.major?.name);
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

export async function officialAcademicLinksForUser(user: any) {
  const programmeRef = await resolveProgrammeIntroRef(user);
  const handbookRef = await resolveProgrammeHandbookRef(user);
  return buildOfficialAcademicLinks(user, programmeRef, handbookRef);
}
