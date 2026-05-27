export const DEFAULT_UNIVERSITY_CORE_URL = "https://ar.bnbu.edu.cn/current_students/student_handbook/university_core.htm";
export const DEFAULT_GENERAL_EDUCATION_URL = "https://ar.bnbu.edu.cn/current_students/student_handbook/eeneral_education.htm";

export const COMMON_CURRICULUM_SOURCES = [
  {
    kind: "university_core",
    indexUrl: DEFAULT_UNIVERSITY_CORE_URL,
    title: "University Core",
    sourceIdSuffix: "university-core"
  },
  {
    kind: "general_education",
    indexUrl: DEFAULT_GENERAL_EDUCATION_URL,
    title: "General Education",
    sourceIdSuffix: "general-education"
  }
];

export const commonCurriculumOwnerUnit = {
  type: "school",
  code: "GE",
  name: "School of General Education"
};

const defaultCategories = {
  university_core: {
    classification: "university_core",
    label: "University Core Courses"
  },
  general_education: {
    classification: "general_education",
    label: "General Education"
  }
};

const universityCoreHeadings = [
  [/^Chinese$/i, "university_core_chinese", "University Core - Chinese"],
  [/^English$/i, "university_core_english", "University Core - English"],
  [/^AI Literacy$/i, "university_core_ai_literacy", "University Core - AI Literacy"],
  [/^Philosophy,\s*Politics and Economics$/i, "university_core_ppe", "University Core - Philosophy, Politics and Economics"],
  [/^Military Training$/i, "university_core_military_training", "University Core - Military Training"],
  [/^Whole Person Education Experiential Learning Modules$/i, "university_core_wpex", "University Core - WPEX"],
  [/^Healthy Lifestyle$/i, "university_core_healthy_lifestyle", "University Core - Healthy Lifestyle"]
];

const generalEducationHeadings = [
  [/Level\s*1\s*:\s*Foundational Courses/i, "ge_level_1_foundational", "GE Level 1 - Foundational Courses"],
  [/Level\s*2\s*:\s*Interdisciplinary Thematic Courses/i, "ge_level_2_interdisciplinary_thematic", "GE Level 2 - Interdisciplinary Thematic Courses"],
  [/Level\s*3\s*:\s*GE Capstone Courses/i, "ge_level_3_capstone", "GE Level 3 - Capstone"]
];

function normalizedText(value) {
  return String(value ?? "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function stableCommonCurriculumId(...parts) {
  return parts
    .join("-")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function yearRanges(text) {
  return [...text.matchAll(/(20\d{2})\s*(?:-|to|–|—)\s*(20\d{2})/gi)]
    .map((match) => [Number(match[1]), Number(match[2])])
    .filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end));
}

function listedYears(text) {
  return [...text.matchAll(/20\d{2}/g)].map((match) => Number(match[0])).filter(Number.isFinite);
}

export function commonCurriculumLinkMatchesCohort(value, cohortYear) {
  const text = normalizedText(value);
  const cohort = Number(cohortYear);
  if (!Number.isFinite(cohort)) return false;

  for (const [start, end] of yearRanges(text)) {
    if (cohort >= Math.min(start, end) && cohort <= Math.max(start, end)) return true;
  }

  const years = listedYears(text);
  if (!years.length) return false;
  const anchor = years[0];
  if (/\b(and\s+)?onwards?\b/i.test(text)) return cohort >= anchor;
  if (/\b(and\s+)?before\b/i.test(text)) return cohort <= anchor;
  return years.includes(cohort);
}

function linkDateScore(value) {
  const compact = value.match(/(20\d{6})/)?.[1];
  if (compact) return Number(compact);
  const year = value.match(/(20\d{2})/)?.[1];
  return year ? Number(`${year}0000`) : 0;
}

function exactCohortMatch(text, cohortYear) {
  const cohort = String(cohortYear);
  return new RegExp(`${cohort}\\s*(?:cohort|admission)`, "i").test(text);
}

function rangeCohortMatch(text, cohortYear) {
  const cohort = Number(cohortYear);
  return yearRanges(text).some(([start, end]) => cohort >= Math.min(start, end) && cohort <= Math.max(start, end));
}

export function commonCurriculumLinkScore(item, cohortYear) {
  const text = normalizedText(`${item.label ?? ""} ${item.title ?? ""} ${decodeURIComponent(item.href ?? item.url ?? "")}`);
  if (!commonCurriculumLinkMatchesCohort(text, cohortYear)) return Number.NEGATIVE_INFINITY;

  let score = 0;
  if (exactCohortMatch(text, cohortYear)) score += 120;
  if (rangeCohortMatch(text, cohortYear)) score += 100;
  if (/\b(and\s+)?onwards?\b/i.test(text)) score += 80;
  if (/\b(and\s+)?before\b/i.test(text)) score += 80;
  if (/\bUniversity Core\b/i.test(text)) score += 10;
  if (/\bGeneral Education\b/i.test(text)) score += 10;
  if (normalizedText(item.label ?? item.title ?? "")) score += 5;
  score += linkDateScore(text) / 100000000;
  return score;
}

export function selectCommonCurriculumLink(links, cohortYear) {
  return [...links]
    .map((link) => ({ link, score: commonCurriculumLinkScore(link, cohortYear) }))
    .filter((item) => Number.isFinite(item.score))
    .sort((a, b) => b.score - a.score)[0]?.link ?? null;
}

function categoryFromLine(sourceKind, line) {
  const normalized = normalizedText(line);
  const headings = sourceKind === "university_core" ? universityCoreHeadings : generalEducationHeadings;
  for (const [pattern, classification, label] of headings) {
    if (pattern.test(normalized)) return { classification, label };
  }
  return null;
}

function groupYearRange(text) {
  return yearRanges(normalizedText(text))[0] ?? null;
}

function groupAnchorYear(text) {
  return listedYears(normalizedText(text))[0] ?? null;
}

export function selectCommonCurriculumPdfLink(links, groupLabel) {
  const groupText = normalizedText(groupLabel);
  const groupRange = groupYearRange(groupText);
  const groupAnchor = groupAnchorYear(groupText);
  const groupOnwards = /\b(and\s+)?onwards?\b/i.test(groupText);
  const groupBefore = /\b(and\s+)?before\b/i.test(groupText);

  return [...links]
    .map((link) => {
      const text = normalizedText(`${link.label ?? ""} ${decodeURIComponent(link.href ?? link.url ?? "")}`);
      const linkRange = groupYearRange(text);
      const linkAnchor = groupAnchorYear(text);
      const exactYear = groupAnchor && new RegExp(`${groupAnchor}\\s*(?:cohort|admission)`, "i").test(text);
      let score = 0;
      if (groupRange && linkRange && groupRange[0] === linkRange[0] && groupRange[1] === linkRange[1]) score += 300;
      if (!groupRange && !groupOnwards && !groupBefore && exactYear) score += 250;
      if (groupOnwards && linkAnchor === groupAnchor && /\b(and\s+)?onwards?\b/i.test(text)) score += 220;
      if (groupBefore && linkAnchor === groupAnchor && /\b(and\s+)?before\b/i.test(text)) score += 220;
      if (normalizedText(link.label)) score += 10;
      score += linkDateScore(text) / 100000000;
      return { link, score };
    })
    .sort((a, b) => b.score - a.score)[0]?.link ?? null;
}

function cleanCourseTitle(value) {
  return normalizedText(value)
    .replace(/^[,;:./\s-]+/, "")
    .replace(/[,;:./\s-]+$/, "")
    .replace(/\(\d+\)/g, "")
    .replace(/\bor\b\s*$/i, "")
    .replace(/^or\b\s*/i, "")
    .replace(/[,;:./\s-]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripListMarker(value) {
  return value
    .replace(/^\(?[ivxlcdm]+\)?[.)]?\s*/i, "")
    .replace(/^\(?\d+\)?[.)]?\s*/, "")
    .trim();
}

function unitsOnly(line) {
  const match = normalizedText(line).match(/^(\d(?:\.\d+)?)\s+units?$/i);
  return match ? Number(match[1]) : null;
}

function coursesFromLine(line, category) {
  const cleaned = stripListMarker(normalizedText(line));
  const creditsMatch = cleaned.match(/(\d(?:\.\d+)?)\s+units?\s*$/i);
  if (!creditsMatch) return [];
  const credits = Number(creditsMatch[1]);
  const body = cleaned.slice(0, creditsMatch.index).trim();
  const codeMatches = [...body.matchAll(/\b[A-Z]{2,8}(?:\d{4}|\dXX\d)[A-Z]?\b/g)];
  if (!codeMatches.length) return [];

  return codeMatches.map((match, index) => {
    const code = match[0];
    const titleStart = (match.index ?? 0) + code.length;
    const titleEnd = codeMatches[index + 1]?.index ?? body.length;
    const title = cleanCourseTitle(body.slice(titleStart, titleEnd));
    return {
      code,
      title,
      credits,
      category
    };
  }).filter((course) => course.title);
}

function createCourse(row, sourceId) {
  return {
    code: row.code,
    title: row.title,
    credits: row.credits,
    ownerUnit: { ...commonCurriculumOwnerUnit },
    categoryTags: [row.category.label],
    description: "",
    sourceRefIds: [sourceId]
  };
}

export function parseCommonCurriculumCourses(lines, options) {
  const sourceKind = options.sourceKind;
  const sourceId = options.sourceId;
  let category = defaultCategories[sourceKind] ?? defaultCategories.general_education;
  let pending = null;
  const rows = [];

  const flushPending = (credits) => {
    if (!pending || typeof credits !== "number") return;
    rows.push({ ...pending, title: cleanCourseTitle(pending.title), credits });
    pending = null;
  };

  for (const rawLine of lines) {
    const line = normalizedText(rawLine);
    if (!line || /^\d+\s*\/\s*\d+$/.test(line) || /^Rev\s+\d+/i.test(line) || /^Notes/i.test(line)) continue;

    const creditOnly = unitsOnly(line);
    if (pending && creditOnly !== null) {
      flushPending(creditOnly);
      continue;
    }

    const nextCategory = categoryFromLine(sourceKind, line);
    if (nextCategory) {
      category = nextCategory;
      pending = null;
      continue;
    }

    const codedAs = line.match(/\bcoded as\s+([A-Z]{2,8}\dXX\d[A-Z]?)\b/i);
    if (codedAs) {
      pending = {
        code: codedAs[1].toUpperCase(),
        title: `${category.label.replace(/^University Core - /, "")} Courses`,
        category
      };
      continue;
    }

    const parsedRows = coursesFromLine(line, category);
    if (parsedRows.length) {
      rows.push(...parsedRows);
      pending = null;
      continue;
    }

    const codeOnly = stripListMarker(line).match(/^([A-Z]{2,8}(?:\d{4}|\dXX\d)[A-Z]?)\s+(.+)$/);
    if (codeOnly) {
      pending = {
        code: codeOnly[1],
        title: normalizedText(codeOnly[2]),
        category
      };
      continue;
    }

    if (pending) {
      pending = { ...pending, title: normalizedText(`${pending.title} ${line}`) };
    }
  }

  const courses = rows.map((row) => createCourse(row, sourceId));
  return { courses };
}
