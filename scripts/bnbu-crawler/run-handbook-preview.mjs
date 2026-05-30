#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { applyCrawlerAiAssist } from "./ai-catalog-assistant.mjs";
import { loadPdfjs, pdfStandardFontDataUrl } from "./pdfjs-runtime.mjs";

const ROOT = process.cwd();
const DEFAULT_HANDBOOK_URL = "https://ar.bnbu.edu.cn/current_students/student_handbook/programme_handbook.htm";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key, rest.length ? rest.join("=") : "true"];
  })
);

const handbookUrl = String(args.handbookUrl ?? DEFAULT_HANDBOOK_URL);
const cohorts = csv(args.cohorts ?? args.cohortYears);
const limit = args.limit === "all" || args.limit === undefined ? Infinity : Number(args.limit ?? 3);
const outDir = path.resolve(ROOT, String(args.outDir ?? "storage/crawler_outputs"));
const programmeCodes = csv(args.programmes ?? args.programmeCodes).map((item) => item.toUpperCase());
const facultyCodes = csv(args.faculties ?? args.facultyCodes).map((item) => item.toUpperCase());
const programmeNameQuery = String(args.programmeName ?? args.majorName ?? "").trim().toLowerCase();
const facultyNameQuery = String(args.facultyName ?? "").trim().toLowerCase();
const aiMode = String(args.aiMode ?? "off");
const aiModel = String(args.aiModel ?? process.env.CRAWLER_AI_MODEL ?? "gpt-4.1-mini");
const aiTimeoutMs = Number(args.aiTimeoutMs ?? process.env.CRAWLER_AI_TIMEOUT_MS ?? 25000);
const aiMaxTokens = Number(args.aiMaxTokens ?? 2000);
const aiStrictMode = booleanArg(args.aiStrictMode, aiMode === "strict");
const aiEnabled = booleanArg(args.aiEnabled ?? process.env.CRAWLER_AI_ENABLED, true);

const facultyCodeMap = new Map([
  ["Faculty of Business and Management", "FBM"],
  ["Faculty of Humanities and Social Sciences", "FHSS"],
  ["Faculty of Science and Technology", "FST"],
  ["School of Culture and Creativity", "SCC"],
  ["School of AI and Liberal Arts", "SAIN"],
  ["School of General Education", "GE"],
  ["Academic Registry", "AR"]
]);

function classificationPatterns() {
  return [
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
}

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

function booleanArg(value, defaultValue) {
  if (value === undefined) return defaultValue;
  return !/^(false|0|no|none|off)$/i.test(String(value).trim());
}

function aiAssistMeta(summary) {
  return {
    target: summary.target,
    status: summary.status,
    mode: summary.mode,
    model: summary.model,
    fieldsFixed: summary.fieldsFixed,
    filledCount: summary.filledCount,
    invalidCount: summary.invalidCount,
    errors: summary.errors,
    warnings: summary.warnings
  };
}

async function applyAiAssistToPayload(payload) {
  const result = await applyCrawlerAiAssist({
    target: "programme_handbook",
    payload,
    mode: aiMode,
    enabled: aiEnabled,
    model: aiModel,
    apiKey: process.env.CRAWLER_AI_API_KEY ?? process.env.OPENAI_API_KEY ?? "",
    timeoutMs: aiTimeoutMs,
    maxOutputTokens: aiMaxTokens,
    strictMode: aiStrictMode
  });
  const nextPayload = result.payload && typeof result.payload === "object" && !Array.isArray(result.payload) ? result.payload : payload;
  nextPayload.crawlerMeta = {
    ...(nextPayload.crawlerMeta ?? {}),
    aiAssist: aiAssistMeta(result.summary)
  };
  console.log(`ai assist programme_handbook: status=${result.summary.status} mode=${result.summary.mode} fixed=${result.summary.fieldsFixed} invalid=${result.summary.invalidCount}`);
  if (result.summary.status === "failed" && (aiStrictMode || aiMode === "strict")) {
    throw new Error(`AI strict validation failed: ${result.summary.errors.join("; ") || `${result.summary.invalidCount} invalid field(s)`}`);
  }
  return nextPayload;
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

function pageTitle(html) {
  return stripTags(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
}

function inferCohortYear(html, url, fallbackLabel = "") {
  const title = pageTitle(html);
  const text = `${title} ${fallbackLabel} ${stripTags(html).slice(0, 3000)} ${url}`;
  return (
    text.match(/for\s+(20\d{2})\s+Admission/i)?.[1] ??
    text.match(/(20\d{2})\s+Admission/i)?.[1] ??
    text.match(/Admission\s+(20\d{2})/i)?.[1] ??
    null
  );
}

function stableId(...parts) {
  return parts
    .join("-")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function planSemesterForCohort(cohortYear) {
  const academicYear = Number(cohortYear);
  return {
    code: `${cohortYear}-Admission-Programme-Plan`,
    name: `${cohortYear} Admission Programme Plan`,
    academicYear: Number.isFinite(academicYear) ? academicYear : 0,
    term: "Programme Plan",
    isCurrentCandidate: false
  };
}

function planRuleScopeForCohort(cohortYear) {
  return `${cohortYear}-admission-programme-plan`;
}

function programmeCodeFromHref(href) {
  const file = decodeURIComponent(href.split("/").pop() ?? "");
  return (file.match(/^([A-Z]{2,6})\b/)?.[1] ?? stableId(file).slice(0, 8)).toUpperCase();
}

function classifyLine(line, current) {
  for (const [pattern, classification, label] of classificationPatterns()) {
    if (pattern.test(line)) return { classification, label };
  }
  return current;
}

function cleanTitle(value) {
  return value.replace(/[①②③④⑤⑥⑦⑧⑨]/g, "").replace(/\s+/g, " ").trim();
}

export function relativeTermFromCode(code) {
  const digit = Number(code.match(/[A-Z]+(\d)/)?.[1] ?? 1);
  const year = Math.min(Math.max(digit || 1, 1), 4);
  return [`Y${year}S1`];
}

function nearestRelativeTerm(x, headerColumns) {
  let best = null;
  for (const column of headerColumns) {
    const distance = Math.abs(x - column.x);
    if (!best || distance < best.distance) best = { ...column, distance };
  }
  return best && best.distance < 18 ? best.term : null;
}

function mergeCourseTermMaps(target, source) {
  for (const [code, terms] of source.entries()) {
    target.set(code, [...new Set([...(target.get(code) ?? []), ...terms])]);
  }
}

export function courseTermMapFromPositionedText(items) {
  const textItems = items
    .filter((item) => item && typeof item.str === "string" && item.str.trim())
    .map((item) => ({ str: item.str.trim(), x: Number(item.x), y: Number(item.y) }))
    .filter((item) => Number.isFinite(item.x) && Number.isFinite(item.y));
  const semHeaders = textItems
    .filter((item) => /^(?:Sem|Semester)\s*[12]$/i.test(item.str) && item.x > 240)
    .sort((a, b) => a.x - b.x);
  const headerColumns = [];
  let year = 1;
  for (const header of semHeaders) {
    const sem = /2/.test(header.str) ? 2 : 1;
    headerColumns.push({ x: header.x + 8, term: `Y${year}S${sem}` });
    if (sem === 2) year += 1;
  }
  if (!headerColumns.length) return new Map();

  const rows = new Map();
  for (const item of textItems) {
    const key = String(Math.round(item.y));
    rows.set(key, [...(rows.get(key) ?? []), item]);
  }

  const termsByCode = new Map();
  for (const row of rows.values()) {
    const code = row.find((item) => /^[A-Z]{2,6}(?:\d{4}|\dXX\d)[A-Z]?$/.test(item.str) && item.x < 160)?.str;
    if (!code) continue;
    const terms = row
      .filter((item) => /^\d(?:\.\d)?$/.test(item.str) && item.x > 240)
      .map((item) => nearestRelativeTerm(item.x, headerColumns))
      .filter(Boolean);
    if (terms.length) termsByCode.set(code, [...new Set(terms)]);
  }
  return termsByCode;
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
  const { getDocument, VerbosityLevel } = await loadPdfjs();
  const data = new Uint8Array(buffer);
  const doc = await getDocument({
    data,
    standardFontDataUrl: pdfStandardFontDataUrl,
    disableWorker: true,
    verbosity: VerbosityLevel.ERRORS
  }).promise;
  const lines = [];
  let currentLine = "";
  const flushLine = () => {
    const line = currentLine.replace(/\s+/g, " ").trim();
    if (line) lines.push(line);
    currentLine = "";
  };
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    for (const item of content.items) {
      const text = typeof item.str === "string" ? item.str : "";
      if (text === "") {
        flushLine();
      } else if (/^\s+$/.test(text)) {
        if (currentLine && !currentLine.endsWith(" ")) currentLine += " ";
      } else {
        currentLine += text;
      }
    }
    flushLine();
  }
  await doc.destroy();
  return lines.join("\n");
}

async function pdfCourseTermMap(buffer) {
  const { getDocument, VerbosityLevel, Util } = await loadPdfjs();
  const data = new Uint8Array(buffer);
  const doc = await getDocument({
    data,
    standardFontDataUrl: pdfStandardFontDataUrl,
    disableWorker: true,
    verbosity: VerbosityLevel.ERRORS
  }).promise;
  const termsByCode = new Map();
  try {
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const positionedItems = content.items.map((item) => {
        const text = typeof item.str === "string" ? item.str : "";
        const transform = Array.isArray(item.transform) && Util?.transform
          ? Util.transform(viewport.transform, item.transform)
          : item.transform;
        return {
          str: text,
          x: Number(transform?.[4]),
          y: Number(transform?.[5])
        };
      });
      mergeCourseTermMaps(termsByCode, courseTermMapFromPositionedText(positionedItems));
      page.cleanup();
    }
  } finally {
    await doc.destroy();
  }
  return termsByCode;
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

export function parseCourses(text, programme, sourceId, cohortYear, termsByCode = new Map()) {
  const courses = [];
  const rules = [];
  const planSemester = planSemesterForCohort(cohortYear);
  const planRuleScope = planRuleScopeForCohort(cohortYear);
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
    const inferredTerms = termsByCode.get(code) ?? relativeTermFromCode(code);
    const relativeTermCodes = programmeScoped || studentAction === "default_join" ? inferredTerms : [];
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
      id: stableId(cohortYear, planRuleScope, code, programmeScoped ? programme.code : "ALL", relativeTermCodes[0] ?? "all", category.classification),
      courseCode: code,
      semesterCode: planSemester.code,
      classification: category.classification,
      classificationLabel: category.label,
      audience: programmeScoped
        ? { majorCodes: [programme.code], facultyCodes: [], grades: [], cohortYears: [Number(cohortYear)], concentrationCodes: [], allMajors: false }
        : { majorCodes: [], facultyCodes: [], grades: [], cohortYears: [Number(cohortYear)], concentrationCodes: [], allMajors: true },
      relativeTermCodes,
      studentAction,
      ownerUnit,
      sourceRefIds: [sourceId],
      confidence: termsByCode.has(code) ? "medium" : relativeTermCodes.length ? "low" : "medium"
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
  const directProgrammes = parseProgrammeLinks(html, handbookUrl);
  if (directProgrammes.length) {
    if (cohorts.length > 1) {
      throw new Error(`Handbook URL looks like a single admission page; provide one admission year or leave Admission years blank. Received: ${cohorts.join(",")}`);
    }
    const inferred = inferCohortYear(html, handbookUrl);
    const requested = cohorts[0] ?? "";
    if (requested && inferred && requested !== inferred) {
      throw new Error(`Admission year mismatch: the page appears to be ${inferred} admission, but --cohorts=${requested} was provided.`);
    }
    const cohort = requested || inferred;
    if (!cohort) {
      throw new Error(`Could not infer admission year from ${handbookUrl}. Fill Admission years with one year, such as 2023.`);
    }
    return [{
      cohort,
      label: pageTitle(html) || `Undergraduate Handbook for ${cohort} Admission`,
      url: handbookUrl,
      html
    }];
  }
  const links = parseCohortLinks(html, handbookUrl);
  if (!links.size) return [{ cohort: cohorts[0] ?? "2025", label: `Undergraduate Handbook ${cohorts[0] ?? "2025"}`, url: handbookUrl, html }];
  const requestedCohorts = cohorts.length ? cohorts : ["2025", "2024"];
  return requestedCohorts.map((cohort) => {
    const found = links.get(cohort);
    if (!found) throw new Error(`Could not find programme handbook page for ${cohort} admission at ${handbookUrl}`);
    return found;
  });
}

async function buildPayload(cohortPage) {
  const retrievedAt = new Date().toISOString();
  const html = cohortPage.html ?? await fetchText(cohortPage.url);
  const programmes = parseProgrammeLinks(html, cohortPage.url);
  const planSemester = planSemesterForCohort(cohortPage.cohort);
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
    const termsByCode = await pdfCourseTermMap(buffer);
    sourceRefs.push({
      id: sourceId,
      title: `${programme.name} Handbook ${cohortPage.cohort} Admission`,
      url: programme.href,
      sourceType: "curriculum_pdf",
      retrievedAt,
      sha256: createHash("sha256").update(buffer).digest("hex")
    });
    const parsed = parseCourses(text, programme, sourceId, cohortPage.cohort, termsByCode);
    courses.push(...parsed.courses);
    rules.push(...parsed.rules);
    console.log(`parsed ${cohortPage.cohort} ${programme.code}: ${parsed.courses.length} course rows, ${termsByCode.size} term-mapped rows`);
  }
  const faculties = [...new Map(selected.map((item) => [item.facultyCode, { code: item.facultyCode, name: item.facultyName }])).values()].sort((a, b) => a.code.localeCompare(b.code));
  return {
    schemaVersion: "teamaking.bnbu_course_import.v2",
    generatedAt: retrievedAt,
    importMode: "cohort_programme_handbook",
    crawlerMeta: {
      runner: "scripts/bnbu-crawler/run-handbook-preview.mjs",
      handbookUrl,
      cohorts: (cohorts.length ? cohorts : [cohortPage.cohort]).map(Number).filter(Number.isFinite),
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
    semester: planSemester,
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
    const payload = await applyAiAssistToPayload(await buildPayload(cohortPage));
    const outFile = path.join(outDir, `bnbu-${cohortPage.cohort}-admission-handbook.teamaking.json`);
    await writeFile(outFile, `${JSON.stringify(payload, null, 2)}\n`);
    console.log(`wrote ${path.relative(ROOT, outFile)}`);
    console.log(`cohort=${cohortPage.cohort} faculties=${payload.faculties.length} majors=${payload.majors.length} courses=${payload.courses.length} rules=${payload.curriculumRules.length} offerings=0`);
  }
}

async function flushAndExit(code) {
  await Promise.all([
    new Promise((resolve) => process.stdout.write("", resolve)),
    new Promise((resolve) => process.stderr.write("", resolve))
  ]).catch(() => null);
  process.exit(code);
}

const isCliEntrypoint = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCliEntrypoint) {
  main().then(() => flushAndExit(0)).catch((error) => {
    console.error(error);
    void flushAndExit(1);
  });
}
