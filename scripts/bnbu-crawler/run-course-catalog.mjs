#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDocument, VerbosityLevel } from "pdfjs-dist/legacy/build/pdf.mjs";

const pdfStandardFontDataUrl = fileURLToPath(import.meta.resolve("pdfjs-dist/standard_fonts/"));
const ROOT = process.cwd();
const DEFAULT_COURSE_DESCRIPTIONS_URL = "https://ar.bnbu.edu.cn/info/1021/1430.htm";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key, rest.length ? rest.join("=") : "true"];
  })
);

const courseDescriptionsUrl = String(args.courseDescriptionsUrl ?? args.url ?? DEFAULT_COURSE_DESCRIPTIONS_URL);
const semesterCode = String(args.semesterCode ?? "2026-Spring");
const semesterName = String(args.semesterName ?? "2026 Spring");
const academicYear = Number(args.academicYear ?? 2026);
const term = String(args.term ?? "Spring");
const limit = args.limit === "all" || args.limit === undefined ? Infinity : Number(args.limit ?? "all");
const outDir = path.resolve(ROOT, String(args.outDir ?? "storage/crawler_outputs"));

const FACULTIES = [
  { code: "FBM", name: "Faculty of Business and Management" },
  { code: "FHSS", name: "Faculty of Humanities and Social Sciences" },
  { code: "FST", name: "Faculty of Science and Technology" },
  { code: "SCC", name: "School of Culture and Creativity" },
  { code: "SAIN", name: "School of AI and Liberal Arts" },
  { code: "GE", name: "School of General Education" },
  { code: "AR", name: "Academic Registry" }
];

const facultyByCode = new Map(FACULTIES.map((item) => [item.code, item]));
const prefixFaculty = new Map([
  ["ACCT", "FBM"], ["AE", "FBM"], ["BA", "FBM"], ["BUS", "FBM"], ["DMM", "FBM"], ["EBIS", "FBM"], ["ECON", "FBM"], ["EPIN", "FBM"], ["FIN", "FBM"], ["MHR", "FBM"], ["MKT", "FBM"],
  ["ATS", "FHSS"], ["CCGC", "FHSS"], ["COMM", "FHSS"], ["DGS", "FHSS"], ["ELLS", "FHSS"], ["GAD", "FHSS"], ["PRA", "FHSS"], ["SOC", "FHSS"], ["TRAN", "FHSS"],
  ["AI", "FST"], ["AM", "FST"], ["APSY", "FST"], ["BIOL", "FST"], ["CHEM", "FST"], ["COMP", "FST"], ["CST", "FST"], ["DS", "FST"], ["ENVS", "FST"], ["FM", "FST"], ["FS", "FST"], ["MATH", "FST"], ["STAT", "FST"],
  ["AIM", "SCC"], ["CCM", "SCC"], ["CTV", "SCC"], ["MAD", "SCC"], ["MUS", "SCC"], ["THEM", "SCC"],
  ["GF", "GE"], ["GE", "GE"], ["MT", "GE"], ["UCAI", "GE"], ["UCHL", "GE"], ["UCLC", "GE"], ["WPEX", "GE"]
]);

const knownAcronyms = new Map(["AI", "AR", "BBA", "BNBU", "C", "C++", "DBMS", "EAP", "HCI", "IELTS", "IFRS", "IT", "PR", "SQL", "TV", "VR", "XML"].map((value) => [value, value]));
knownAcronyms.set("IOT", "IoT");
const smallTitleWords = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "from", "in", "into", "of", "on", "or", "the", "to", "with"]);

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

function linkDateScore(value) {
  const compact = value.match(/(20\d{6})/)?.[1];
  if (compact) return Number(compact);
  const year = value.match(/(20\d{2})/)?.[1];
  return year ? Number(`${year}0000`) : 0;
}

async function resolveCourseDescriptionsPdf(url) {
  if (/\.pdf(?:$|\?)/i.test(url)) {
    return { pageUrl: "", pageTitle: "", pdfUrl: url, pdfTitle: path.basename(new URL(url).pathname) };
  }
  const html = await fetchText(url);
  const links = [...html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => {
      const href = absoluteUrl(url, match[1]);
      const label = stripTags(match[2]);
      return { href, label, score: linkDateScore(`${href} ${label}`) };
    })
    .filter((item) => /\.pdf(?:$|\?)/i.test(item.href));
  const candidates = links.filter((item) => /course\s*descriptions?/i.test(`${item.label} ${decodeURIComponent(item.href)}`));
  const selected = (candidates.length ? candidates : links).sort((a, b) => b.score - a.score)[0];
  if (!selected) throw new Error(`Could not find a Course Descriptions PDF at ${url}`);
  return {
    pageUrl: url,
    pageTitle: pageTitle(html) || "Course Descriptions",
    pdfUrl: selected.href,
    pdfTitle: selected.label || path.basename(new URL(selected.href).pathname)
  };
}

function shouldInsertSpace(currentLine, text) {
  const left = currentLine.at(-1) ?? "";
  const right = text[0] ?? "";
  if (!left || !right) return false;
  if (left === "-" || right === "," || right === "." || right === ")" || right === ":" || right === ";") return false;
  return /[A-Za-z0-9)]/.test(left) && /[A-Za-z0-9(]/.test(right);
}

async function pdfLines(buffer) {
  const doc = await getDocument({
    data: new Uint8Array(buffer),
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
        if (shouldInsertSpace(currentLine, text)) currentLine += " ";
        currentLine += text;
      }
    }
    flushLine();
  }
  doc.destroy();
  return lines;
}

function normalizeTitleWord(word, index, total) {
  const punctuationPrefix = word.match(/^[("']+/)?.[0] ?? "";
  const punctuationSuffix = word.match(/[)"',:;]+$/)?.[0] ?? "";
  const core = word.slice(punctuationPrefix.length, word.length - punctuationSuffix.length);
  if (!core) return word;
  const acronymKey = core.replace(/[^A-Za-z0-9+#]/g, "").toUpperCase();
  if (knownAcronyms.has(acronymKey)) return `${punctuationPrefix}${knownAcronyms.get(acronymKey)}${punctuationSuffix}`;
  const lower = core.toLowerCase();
  if (index > 0 && index < total - 1 && smallTitleWords.has(lower)) return `${punctuationPrefix}${lower}${punctuationSuffix}`;
  return `${punctuationPrefix}${lower.charAt(0).toUpperCase()}${lower.slice(1)}${punctuationSuffix}`;
}

function normalizeCourseTitle(value) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  if (cleaned !== cleaned.toUpperCase()) return cleaned;
  const words = cleaned.split(" ");
  return words.map((word, index) => normalizeTitleWord(word, index, words.length)).join(" ");
}

function ownerUnitForCode(code) {
  const prefix = code.match(/^[A-Z]+/)?.[0] ?? "";
  const facultyCode = prefixFaculty.get(prefix) ?? prefixFaculty.get(prefix.slice(0, 4)) ?? prefixFaculty.get(prefix.slice(0, 3)) ?? "AR";
  const faculty = facultyByCode.get(facultyCode) ?? facultyByCode.get("AR");
  return { type: facultyCode === "GE" ? "school" : "faculty", code: faculty.code, name: faculty.name };
}

function cleanSectionText(lines) {
  return lines
    .join(" ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .trim();
}

function parseCourseCatalog(lines) {
  const codeRe = /^[A-Z]{2,8}\d{4}[A-Z]?$/;
  const inlineCodeRe = /^([A-Z]{2,8}\d{4}[A-Z]?)\s+(.+)$/;
  const unitsRe = /^\(?\s*(\d+(?:\.\d+)?)\s+units?\s*\)?$/i;
  const courses = [];
  let record = null;
  let section = "title";

  const pushRecord = () => {
    if (!record) return;
    const title = normalizeCourseTitle(cleanSectionText(record.title));
    if (!title) {
      record = null;
      section = "title";
      return;
    }
    const prerequisite = cleanSectionText(record.prerequisite);
    const description = cleanSectionText(record.description);
    courses.push({
      code: record.code,
      title,
      credits: record.credits ?? undefined,
      ownerUnit: ownerUnitForCode(record.code),
      categoryTags: ["Official Course Description Catalogue"],
      description: [description, prerequisite && !/^none$/i.test(prerequisite) ? `Prerequisite(s): ${prerequisite}` : ""].filter(Boolean).join("\n\n"),
      sourceRefIds: ["course-descriptions-pdf"]
    });
    record = null;
    section = "title";
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (!line || /^\d+\s*\/\s*\d+$/.test(line) || /^Course Description$/i.test(line)) continue;
    if (/^The following course descriptions are identified/i.test(line)) continue;
    if (/^codes which are presented in alphabetical order/i.test(line)) continue;

    const inline = line.match(inlineCodeRe);
    if (codeRe.test(line) || inline) {
      pushRecord();
      record = { code: inline ? inline[1] : line, title: inline ? [inline[2]] : [], credits: null, prerequisite: [], description: [] };
      section = "title";
      continue;
    }
    if (!record) continue;

    const units = line.match(unitsRe);
    if (units) {
      record.credits = Number(units[1]);
      section = "prerequisite";
      continue;
    }

    const prerequisite = line.match(/^Pre[- ]?requisite\(s\)\s*:\s*(.*)$/i);
    if (prerequisite) {
      section = "prerequisite";
      if (prerequisite[1]) record.prerequisite.push(prerequisite[1]);
      continue;
    }

    const description = line.match(/^Course\s+Description\s*:\s*(.*)$/i);
    if (description) {
      section = "description";
      if (description[1]) record.description.push(description[1]);
      continue;
    }

    if (section === "title") record.title.push(line);
    if (section === "prerequisite") record.prerequisite.push(line);
    if (section === "description") record.description.push(line);
  }
  pushRecord();
  return courses;
}

function mergeByCode(courses) {
  const merged = new Map();
  for (const course of courses) {
    const existing = merged.get(course.code);
    if (!existing) {
      merged.set(course.code, course);
      continue;
    }
    const keepIncomingDescription = (course.description ?? "").length > (existing.description ?? "").length;
    merged.set(course.code, {
      ...existing,
      title: existing.title || course.title,
      credits: existing.credits ?? course.credits,
      description: keepIncomingDescription ? course.description : existing.description,
      sourceRefIds: [...new Set([...(existing.sourceRefIds ?? []), ...(course.sourceRefIds ?? [])])],
      categoryTags: [...new Set([...(existing.categoryTags ?? []), ...(course.categoryTags ?? [])])]
    });
  }
  return [...merged.values()].sort((a, b) => a.code.localeCompare(b.code));
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const retrievedAt = new Date().toISOString();
  const resolved = await resolveCourseDescriptionsPdf(courseDescriptionsUrl);
  const buffer = await fetchBuffer(resolved.pdfUrl);
  const parsed = mergeByCode(parseCourseCatalog(await pdfLines(buffer)));
  const selected = parsed.slice(0, limit);
  if (!selected.length) throw new Error(`No course descriptions were parsed from ${resolved.pdfUrl}`);
  const sourceRefs = [
    ...(resolved.pageUrl ? [{
      id: "course-descriptions-page",
      title: resolved.pageTitle,
      url: resolved.pageUrl,
      sourceType: "course_catalog_index",
      retrievedAt
    }] : []),
    {
      id: "course-descriptions-pdf",
      title: resolved.pdfTitle,
      url: resolved.pdfUrl,
      sourceType: "course_catalog_pdf",
      retrievedAt,
      sha256: createHash("sha256").update(buffer).digest("hex")
    }
  ];
  const payload = {
    schemaVersion: "teamaking.bnbu_course_import.v2",
    generatedAt: retrievedAt,
    importMode: "course_catalog",
    crawlerMeta: {
      runner: "scripts/bnbu-crawler/run-course-catalog.mjs",
      courseDescriptionsUrl,
      resolvedPdfUrl: resolved.pdfUrl,
      limit: Number.isFinite(limit) ? limit : "all",
      parsedCourses: parsed.length,
      selectedCourses: selected.length
    },
    cohortYears: [],
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
    faculties: FACULTIES,
    majors: [],
    courses: selected,
    offerings: [],
    curriculumRules: []
  };
  const outFile = path.join(outDir, "bnbu-course-descriptions-catalog.teamaking.json");
  await writeFile(outFile, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`resolved course descriptions PDF: ${resolved.pdfUrl}`);
  console.log(`wrote ${path.relative(ROOT, outFile)}`);
  console.log(`courses=${selected.length} parsed=${parsed.length} offerings=0 rules=0`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
