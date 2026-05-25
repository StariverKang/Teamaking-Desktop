#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFParse } from "pdf-parse";

const ROOT = process.cwd();
const DEFAULT_HANDBOOK_URL = "https://ar.bnbu.edu.cn/current_students/student_handbook/programme_handbook.htm";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key, rest.length ? rest.join("=") : "true"];
  })
);

const handbookUrl = String(args.handbookUrl ?? DEFAULT_HANDBOOK_URL);
const cohorts = csv(args.cohorts ?? "2025,2024");
const semesterCode = String(args.semesterCode ?? "2026-Spring");
const semesterName = String(args.semesterName ?? "2026 Spring");
const academicYear = Number(args.academicYear ?? 2026);
const term = String(args.term ?? "Spring");
const limit = args.limit === "all" || args.limit === undefined ? Infinity : Number(args.limit ?? 3);
const outDir = path.resolve(ROOT, String(args.outDir ?? "storage/crawler_outputs"));
const programmeCodes = csv(args.programmes ?? args.programmeCodes).map((item) => item.toUpperCase());
const facultyCodes = csv(args.faculties ?? args.facultyCodes).map((item) => item.toUpperCase());
const programmeNameQuery = String(args.programmeName ?? args.majorName ?? "").trim().toLowerCase();
const facultyNameQuery = String(args.facultyName ?? "").trim().toLowerCase();

const facultyCodeMap = new Map([
  ["Faculty of Business and Management", "FBM"],
  ["Faculty of Humanities and Social Sciences", "FHSS"],
  ["Faculty of Science and Technology", "FST"],
  ["School of Culture and Creativity", "SCC"],
  ["School of AI and Liberal Arts", "SAIN"],
  ["School of General Education", "GE"],
  ["Academic Registry", "AR"]
]);

const classificationPatterns = [
  [/major required/i, "major_required", "Major Required Courses"],
  [/major elective/i, "major_elective", "Major Elective Courses"],
  [/concentration required/i, "concentration_required", "Concentration Required Courses"],
  [/concentration elective/i, "concentration_elective", "Concentration Elective Courses"],
  [/BBA.*Core/i, "bba_core", "BBA(Hons) Core Courses"],
  [/university core/i, "university_core", "University Core Courses"],
  [/general education/i, "general_education", "General Education"],
  [/free elective/i, "free_elective", "Free Elective Courses"],
  [/supporting/i, "supporting_course", "Supporting Courses"],
  [/internship/i, "internship", "Internship"],
  [/final year project/i, "final_year_project", "Final Year Project"]
];

const programmeScopedClassifications = new Set([
  "major_required",
  "major_elective",
  "concentration_required",
  "concentration_elective",
  "bba_core",
  "supporting_course",
  "internship",
  "final_year_project"
]);

const defaultJoinClassifications = new Set([
  "major_required",
  "bba_core",
  "concentration_required",
  "university_core",
  "internship",
  "final_year_project"
]);

function csv(value) {
  return String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

function absoluteUrl(base, href) {
  return new URL(href.replace(/ /g, "%20"), base).toString();
}

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function stableId(...parts) {
  return parts
    .join("-")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function programmeCodeFromHref(href) {
  const file = decodeURIComponent(href.split("/").pop() ?? "");
  return (file.match(/^([A-Z]{2,6})\b/)?.[1] ?? stableId(file).slice(0, 8)).toUpperCase();
}

function classifyLine(line, current) {
  for (const [pattern, classification, label] of classificationPatterns) {
    if (pattern.test(line)) return { classification, label };
  }
  return current;
}

function cleanTitle(value) {
  return value.replace(/[①②③④⑤⑥⑦⑧⑨]/g, "").replace(/\s+/g, " ").trim();
}

function relativeTermFromCode(code) {
  const digit = Number(code.match(/[A-Z]+(\d)/)?.[1] ?? 1);
  const year = Math.min(Math.max(digit || 1, 1), 4);
  return [`Y${year}S1`];
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GET ${url} failed: ${response.status}`);
  return response.text();
}

async function fetchBuffer(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GET ${url} failed: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function pdfText(buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

function parseCohortLinks(html, baseUrl) {
  const links = [...html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
  const cohortsByYear = new Map();
  for (const link of links) {
    const href = absoluteUrl(baseUrl, link[1]);
    const label = stripTags(link[2]);
    const year = label.match(/for\s+(20\d{2})\s+Admission/i)?.[1] ?? label.match(/Handbook\s+(20\d{2})[-–]/i)?.[1];
    if (year) cohortsByYear.set(year, { cohort: year, label, url: href });
  }
  return cohortsByYear;
}

function parseProgrammeLinks(html, pageUrl) {
  const rows = [...html.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((match) => match[0]);
  const programmes = [];
  let currentFaculty = "";
  for (const row of rows) {
    const strong = row.match(/<strong>([\s\S]*?)<\/strong>/i);
    if (strong) currentFaculty = stripTags(strong[1]);
    const link = row.match(/<a[^>]+href="([^"]+)"[^>]*(?:textvalue="([^"]*)")?[^>]*>([\s\S]*?)<\/a>/i);
    if (!link || !/\.pdf/i.test(link[1])) continue;
    const href = absoluteUrl(pageUrl, link[1]);
    const name = stripTags(link[2] || link[3]).replace(/\s+/g, " ").trim();
    const facultyName = currentFaculty || "Academic Registry";
    programmes.push({
      code: programmeCodeFromHref(href),
      name,
      facultyName,
      facultyCode: facultyCodeMap.get(facultyName) ?? stableId(facultyName).toUpperCase().slice(0, 8),
      href
    });
  }
  return programmes;
}

function inScope(programme) {
  if (programmeCodes.length && !programmeCodes.includes(programme.code.toUpperCase())) return false;
  if (facultyCodes.length && !facultyCodes.includes(programme.facultyCode.toUpperCase())) return false;
  if (programmeNameQuery && !programme.name.toLowerCase().includes(programmeNameQuery)) return false;
  if (facultyNameQuery && !programme.facultyName.toLowerCase().includes(facultyNameQuery)) return false;
  return true;
}

function ownerUnitFor(programme, courseCode) {
  if (/^(UCLC|UCAI|UCHL|WPEX|MT|GF|GE|G[FTV])/.test(courseCode)) {
    return { type: "school", code: "GE", name: "School of General Education" };
  }
  return { type: "faculty", code: programme.facultyCode, name: programme.facultyName };
}

function parseCourses(text, programme, sourceId, cohortYear) {
  const courses = [];
  const rules = [];
  let category = { classification: "unknown", label: "Unknown" };
  const courseLine = /^([A-Z]{2,6}(?:\d{4}|\dXX\d)[A-Z]?)\s+(.+?)\s+(\d(?:\.\d)?)$/;
  for (const rawLine of text.split(/\n+/)) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (!line) continue;
    category = classifyLine(line, category);
    const match = line.match(courseLine);
    if (!match) continue;
    const [, code, titleRaw, creditsRaw] = match;
    const ownerUnit = ownerUnitFor(programme, code);
    const programmeScoped = programmeScopedClassifications.has(category.classification);
    const studentAction = defaultJoinClassifications.has(category.classification) ? "default_join" : "searchable_add";
    const relativeTermCodes = programmeScoped || studentAction === "default_join" ? relativeTermFromCode(code) : [];
    courses.push({
      code,
      title: cleanTitle(titleRaw),
      credits: Number(creditsRaw),
      ownerUnit,
      categoryTags: [category.label],
      description: "",
      sourceRefIds: [sourceId]
    });
    rules.push({
      id: stableId(cohortYear, semesterCode, code, programmeScoped ? programme.code : "ALL", relativeTermCodes[0] ?? "all", category.classification),
      courseCode: code,
      semesterCode,
      classification: category.classification,
      classificationLabel: category.label,
      audience: programmeScoped
        ? { majorCodes: [programme.code], facultyCodes: [], grades: [], cohortYears: [Number(cohortYear)], concentrationCodes: [], allMajors: false }
        : { majorCodes: [], facultyCodes: [], grades: [], cohortYears: [Number(cohortYear)], concentrationCodes: [], allMajors: true },
      relativeTermCodes,
      studentAction,
      ownerUnit,
      sourceRefIds: [sourceId],
      confidence: relativeTermCodes.length ? "low" : "medium"
    });
  }
  return { courses, rules };
}

function mergeByCode(items) {
  const merged = new Map();
  for (const item of items) {
    const existing = merged.get(item.code);
    merged.set(item.code, existing ? {
      ...existing,
      sourceRefIds: [...new Set([...(existing.sourceRefIds ?? []), ...(item.sourceRefIds ?? [])])],
      categoryTags: [...new Set([...(existing.categoryTags ?? []), ...(item.categoryTags ?? [])])]
    } : item);
  }
  return [...merged.values()].sort((a, b) => a.code.localeCompare(b.code));
}

function mergeRules(items) {
  return [...new Map(items.map((item) => [item.id, item])).values()].sort((a, b) => a.id.localeCompare(b.id));
}

async function resolveCohortPages() {
  const html = await fetchText(handbookUrl);
  const links = parseCohortLinks(html, handbookUrl);
  if (!links.size) return [{ cohort: cohorts[0] ?? "2025", label: `Undergraduate Handbook ${cohorts[0] ?? "2025"}`, url: handbookUrl, html }];
  return cohorts.map((cohort) => {
    const found = links.get(cohort);
    if (!found) throw new Error(`Could not find programme handbook page for ${cohort} admission at ${handbookUrl}`);
    return found;
  });
}

async function buildPayload(cohortPage) {
  const retrievedAt = new Date().toISOString();
  const html = cohortPage.html ?? await fetchText(cohortPage.url);
  const programmes = parseProgrammeLinks(html, cohortPage.url);
  const selected = programmes.filter(inScope).slice(0, limit);
  if (!selected.length) throw new Error(`No programmes matched ${cohortPage.cohort}. Available: ${programmes.map((item) => item.code).join(", ")}`);
  const sourceRefs = [{
    id: `handbook-${cohortPage.cohort}-index`,
    title: cohortPage.label,
    url: cohortPage.url,
    sourceType: "programme_structure",
    retrievedAt
  }];
  const courses = [];
  const rules = [];
  for (const programme of selected) {
    const sourceId = `handbook-${cohortPage.cohort}-${programme.code.toLowerCase()}`;
    const buffer = await fetchBuffer(programme.href);
    const text = await pdfText(buffer);
    sourceRefs.push({
      id: sourceId,
      title: `${programme.name} Handbook ${cohortPage.cohort} Admission`,
      url: programme.href,
      sourceType: "curriculum_pdf",
      retrievedAt,
      sha256: createHash("sha256").update(buffer).digest("hex")
    });
    const parsed = parseCourses(text, programme, sourceId, cohortPage.cohort);
    courses.push(...parsed.courses);
    rules.push(...parsed.rules);
    console.log(`parsed ${cohortPage.cohort} ${programme.code}: ${parsed.courses.length} course rows`);
  }
  const faculties = [...new Map(selected.map((item) => [item.facultyCode, { code: item.facultyCode, name: item.facultyName }])).values()].sort((a, b) => a.code.localeCompare(b.code));
  return {
    schemaVersion: "teamaking.bnbu_course_import.v2",
    generatedAt: retrievedAt,
    importMode: "cohort_programme_handbook",
    crawlerMeta: {
      runner: "scripts/bnbu-crawler/run-handbook-preview.mjs",
      handbookUrl,
      cohorts: cohorts.map(Number).filter(Number.isFinite),
      programmeCodes,
      facultyCodes,
      limit: Number.isFinite(limit) ? limit : "all",
      selectedProgrammeCodes: selected.map((item) => item.code)
    },
    cohortYears: [Number(cohortPage.cohort)],
    school: {
      shortName: "BNBU",
      name: "Beijing Normal-Hong Kong Baptist University",
      emailDomain: "mail.bnbu.edu.cn"
    },
    semester: {
      code: semesterCode,
      name: semesterName,
      academicYear,
      term,
      isCurrentCandidate: false
    },
    sourceRefs,
    faculties,
    majors: selected.map((item) => ({
      code: item.code,
      name: item.name,
      facultyCode: item.facultyCode,
      degreeType: "undergraduate",
      aliases: []
    })).sort((a, b) => a.code.localeCompare(b.code)),
    courses: mergeByCode(courses),
    offerings: [],
    curriculumRules: mergeRules(rules)
  };
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const cohortPages = await resolveCohortPages();
  for (const cohortPage of cohortPages) {
    const payload = await buildPayload(cohortPage);
    const outFile = path.join(outDir, `bnbu-${cohortPage.cohort}-admission-handbook.teamaking.json`);
    await writeFile(outFile, `${JSON.stringify(payload, null, 2)}\n`);
    console.log(`wrote ${path.relative(ROOT, outFile)}`);
    console.log(`cohort=${cohortPage.cohort} faculties=${payload.faculties.length} majors=${payload.majors.length} courses=${payload.courses.length} rules=${payload.curriculumRules.length} offerings=0`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
