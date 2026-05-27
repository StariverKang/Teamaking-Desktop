import path from "node:path";

export type CrawlerTarget = "programme_handbook" | "course_catalog" | string;

export type NormalizedCrawlerJobInput = {
  name?: string;
  target: CrawlerTarget;
  handbookUrl: string;
  courseDescriptionsUrl: string;
  cohorts: string[];
  programmes: string;
  facultyCodes: string;
  programmeName: string;
  facultyName: string;
  limit: string;
  academicYear: string;
  term: string;
  semesterCode: string;
  semesterName: string;
  outputMode: string;
  databaseAction: "download_only" | "create_pending" | "approve_import";
};

type NormalizeCrawlerJobInputDefaults = {
  handbookUrl: string;
  courseDescriptionsUrl: string;
  academicYear?: string;
  term?: string;
};

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalString(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function crawlerCsv(value: unknown) {
  return textValue(value).split(",").map((item) => item.trim()).filter(Boolean);
}

export function parseCrawlerInstruction(value: unknown) {
  const instruction = textValue(value);
  const urls = instruction.match(/https?:\/\/[^\s，。)）]+/g) ?? [];
  const instructionWithoutUrls = instruction.replace(/https?:\/\/[^\s，。)）]+/g, " ");
  const lower = instructionWithoutUrls.toLowerCase();
  const years = [...new Set(instructionWithoutUrls.match(/\b20\d{2}\b/g) ?? [])];
  const upperCodes = [...new Set(instructionWithoutUrls.match(/\b[A-Z]{2,6}\b/g) ?? [])]
    .filter((code) => !["BNBU", "PDF", "HTML", "HTTP", "HTTPS", "URL", "JSON", "SPRING", "FALL"].includes(code));
  const limitMatch = lower.match(/(?:limit|前|first|top)\s*[:=]?\s*(\d{1,3})/i) ?? instructionWithoutUrls.match(/(\d{1,3})\s*(?:个|份|programmes|majors|专业)/i);
  const termMatch =
    instructionWithoutUrls.match(/\b(20\d{2})\s*[- ]?\s*(Spring|Fall)\b/i) ??
    instructionWithoutUrls.match(/\b(20\d{2})\s*(春|秋|上|下)/);
  const term = termMatch ? (/spring|春|下/i.test(termMatch[2]) ? "Spring" : "Fall") : "";
  const academicYear = termMatch?.[1] ?? "";
  const courseDescriptionsUrl = urls.find((url) => /course[_-]?dee?scription|course%20descriptions|\/1021\/1430/i.test(url)) ?? "";
  const target = courseDescriptionsUrl || /course\s*descriptions?|course\s*catalog|课程总表|课程目录|课程描述/i.test(instructionWithoutUrls)
    ? "course_catalog"
    : "programme_handbook";
  return {
    handbookUrl: target === "course_catalog" ? "" : urls.find((url) => /programme_handbook|handbook|\/1020\//i.test(url)) ?? urls[0] ?? "",
    courseDescriptionsUrl: courseDescriptionsUrl || (target === "course_catalog" ? urls[0] ?? "" : ""),
    cohorts: academicYear && term ? years.filter((year) => year !== academicYear).join(",") : years.join(","),
    programmes: upperCodes.join(","),
    limit: /全部|所有|\ball\b/i.test(instructionWithoutUrls) ? "all" : limitMatch?.[1] ?? "",
    academicYear,
    term,
    target
  };
}

export function normalizeCrawlerJobInput(
  body: Record<string, unknown>,
  defaults: NormalizeCrawlerJobInputDefaults
): NormalizedCrawlerJobInput {
  const natural = parseCrawlerInstruction(body.instruction);
  const academicYear = textValue(body.academicYear) || natural.academicYear || defaults.academicYear || "2026";
  const term = textValue(body.term) || natural.term || defaults.term || "Spring";
  const hasExplicitCohorts = Object.prototype.hasOwnProperty.call(body, "cohorts");
  const cohorts = crawlerCsv(hasExplicitCohorts ? body.cohorts : natural.cohorts);
  const outputMode = textValue(body.outputMode) || "download";
  const databaseAction = textValue(body.databaseAction) || textValue(body.postCrawlAction) || "download_only";
  const requestedName = optionalString(body.name) ?? optionalString(body.jobName);
  const target = textValue(body.target) || natural.target || "programme_handbook";

  return {
    name: requestedName,
    target,
    handbookUrl:
      textValue(body.handbookUrl) ||
      natural.handbookUrl ||
      defaults.handbookUrl,
    courseDescriptionsUrl:
      textValue(body.courseDescriptionsUrl) ||
      natural.courseDescriptionsUrl ||
      defaults.courseDescriptionsUrl,
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
    databaseAction: ["download_only", "create_pending", "approve_import"].includes(databaseAction)
      ? databaseAction as NormalizedCrawlerJobInput["databaseAction"]
      : "download_only"
  };
}

export function defaultCrawlerJobName(input: Pick<NormalizedCrawlerJobInput, "target" | "cohorts">) {
  if (input.target === "course_catalog") return "BNBU course descriptions catalogue";
  const years = Array.isArray(input.cohorts) && input.cohorts.length ? input.cohorts.join(", ") : "inferred";
  return `${years} admission programme handbook`;
}

export function jobScopedCrawlerOutputDir(crawlerOutputDir: string, jobId: string) {
  return path.join(crawlerOutputDir, jobId);
}

export function crawlerOutputsChangedAfter(beforeOutputs: any[], afterOutputs: any[]) {
  const beforeByKey = new Map(beforeOutputs.map((file) => [file.storageKey, file.modifiedAt]));
  return afterOutputs.filter((file) => !beforeByKey.has(file.storageKey) || String(file.modifiedAt) > String(beforeByKey.get(file.storageKey)));
}
