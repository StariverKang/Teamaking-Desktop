export const profileFileExtensions = [
  "md",
  "markdown",
  "txt",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "csv",
  "tsv",
  "pdf",
  "ppt",
  "pptx",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "heic",
  "mp3",
  "wav",
  "m4a",
  "aac",
  "flac",
  "ogg",
  "fig",
  "sketch",
  "xd",
  "psd",
  "ai",
  "js",
  "jsx",
  "ts",
  "tsx",
  "py",
  "java",
  "c",
  "cpp",
  "h",
  "cs",
  "go",
  "rs",
  "rb",
  "php",
  "html",
  "css",
  "json",
  "yaml",
  "yml",
  "zip",
  "rar",
  "7z"
] as const;

const imageExt = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "heic"]);
const audioExt = new Set(["mp3", "wav", "m4a", "aac", "flac", "ogg"]);
const pdfExt = new Set(["pdf"]);
const markdownExt = new Set(["md", "markdown"]);
const textExt = new Set(["txt", "csv", "tsv", "js", "jsx", "ts", "tsx", "py", "java", "c", "cpp", "h", "cs", "go", "rs", "rb", "php", "html", "css", "json", "yaml", "yml"]);
const officeExt = new Set(["doc", "docx", "xls", "xlsx", "ppt", "pptx"]);
const designExt = new Set(["fig", "sketch", "xd", "psd", "ai"]);
const archiveExt = new Set(["zip", "rar", "7z"]);
const riskyExt = new Set(["app", "bat", "bin", "cmd", "com", "dmg", "exe", "jar", "msi", "scr", "sh", "vbs"]);
const mimeFamilies: Record<string, string[]> = {
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  gif: ["image/gif"],
  webp: ["image/webp"],
  svg: ["image/svg+xml"],
  pdf: ["application/pdf"],
  txt: ["text/plain"],
  md: ["text/plain", "text/markdown", "application/octet-stream"],
  markdown: ["text/plain", "text/markdown", "application/octet-stream"],
  csv: ["text/csv", "application/vnd.ms-excel", "text/plain"],
  json: ["application/json", "text/plain"],
  doc: ["application/msword", "application/octet-stream"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip", "application/octet-stream"],
  xls: ["application/vnd.ms-excel", "application/octet-stream"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/zip", "application/octet-stream"],
  ppt: ["application/vnd.ms-powerpoint", "application/octet-stream"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/zip", "application/octet-stream"],
  zip: ["application/zip", "application/x-zip-compressed", "application/octet-stream"]
};

export function fileExtensionOf(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export function isAllowedProfileFile(fileName: string) {
  return profileFileExtensions.includes(fileExtensionOf(fileName) as (typeof profileFileExtensions)[number]);
}

export function isRiskyProfileFile(fileName: string) {
  return riskyExt.has(fileExtensionOf(fileName));
}

export function hasAcceptableMimeForExtension(fileName: string, mimeType: string) {
  const ext = fileExtensionOf(fileName);
  const normalized = mimeType.trim().toLowerCase();
  if (!normalized || normalized === "application/octet-stream") return true;
  const allowed = mimeFamilies[ext];
  if (!allowed) return true;
  if (allowed.includes(normalized)) return true;
  if (textExt.has(ext) && normalized.startsWith("text/")) return true;
  if (audioExt.has(ext) && normalized.startsWith("audio/")) return true;
  if (archiveExt.has(ext) && normalized.includes("compressed")) return true;
  return false;
}

export function previewKindForFile(fileName: string) {
  const ext = fileExtensionOf(fileName);
  if (imageExt.has(ext)) return "image";
  if (audioExt.has(ext)) return "audio";
  if (pdfExt.has(ext)) return "pdf";
  if (markdownExt.has(ext)) return "markdown";
  if (textExt.has(ext)) return "text";
  if (officeExt.has(ext)) return "office";
  if (designExt.has(ext)) return "design";
  if (archiveExt.has(ext)) return "archive";
  return "link";
}

export function portfolioTypeOptions() {
  return [
    "portfolio",
    "coursework",
    "report",
    "slides",
    "code",
    "design",
    "audio",
    "image",
    "gpa_screenshot",
    "language_score",
    "award_certificate",
    "skill_certification",
    "career_certification",
    "resume",
    "other"
  ];
}

export function profileUploadPurposeOptions() {
  return ["avatar", "background", "portfolio", "gpa_screenshot", "award_certificate", "skill_certification", "resume", "contact_qr"];
}

export function safeUploadName(originalName: string) {
  const ext = fileExtensionOf(originalName);
  const base = originalName
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${base || "upload"}-${Date.now()}${ext ? `.${ext}` : ""}`;
}

export async function extractReadableText(fileName: string, buffer: Buffer) {
  const kind = previewKindForFile(fileName);
  const ext = fileExtensionOf(fileName);

  try {
    if (["markdown", "text"].includes(kind)) {
      return buffer.toString("utf8").replace(/\0/g, "").slice(0, 12000);
    }

    if (ext === "docx") {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return result.value.replace(/\0/g, "").slice(0, 12000);
    }

    if (ext === "pdf") {
      const pdfParseModule = await import("pdf-parse");
      const pdfParse = (pdfParseModule as any).default ?? pdfParseModule;
      const result = await pdfParse(buffer);
      return String(result.text ?? "").replace(/\0/g, "").slice(0, 12000);
    }
  } catch {
    return "";
  }

  return "";
}

function cleanResumeText(text: string) {
  return text
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ \u00a0]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function resumeLines(text: string) {
  return cleanResumeText(text)
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 1);
}

function uniqueValues(values: string[], limit = 12) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const item = value.trim();
    const key = item.toLowerCase();
    if (!item || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
    if (result.length >= limit) break;
  }
  return result;
}

const resumeSectionMatchers = [
  { key: "education", label: "教育背景", pattern: /^(教育背景|教育|学历|academic background|education)(?=$|[\s:：-])/i },
  { key: "experience", label: "实习 / 工作经历", pattern: /^(实习经历|工作经历|实习|工作|work experience|experience|internship)(?=$|[\s:：-])/i },
  { key: "projects", label: "项目经历", pattern: /^(项目经历|项目|projects|project)(?=$|[\s:：-])/i },
  { key: "skills", label: "技能关键词", pattern: /^(个人技能|专业技能|技能|technical skills|skills)(?=$|[\s:：-])/i },
  { key: "awards", label: "奖项 / 证书", pattern: /^(奖项|荣誉|证书|awards|honors|certificates)(?=$|[\s:：-])/i },
  { key: "languages", label: "语言能力", pattern: /^(语言技能|语言|languages|language)(?=$|[\s:：-])/i }
];

function inferResumeSections(lines: string[]) {
  const sections: Record<string, { label: string; items: string[] }> = {};
  let currentKey = "summary";
  sections.summary = { label: "自动摘要依据", items: [] };

  for (const line of lines) {
    const matched = resumeSectionMatchers.find((item) => item.pattern.test(line));
    if (matched) {
      currentKey = matched.key;
      sections[currentKey] ??= { label: matched.label, items: [] };
      const rest = line.replace(matched.pattern, "").replace(/^[:：\s-]+/, "").trim();
      if (rest) sections[currentKey].items.push(rest);
      continue;
    }
    sections[currentKey] ??= { label: currentKey, items: [] };
    sections[currentKey].items.push(line);
  }

  return Object.fromEntries(
    Object.entries(sections)
      .map(([key, section]) => [key, { ...section, items: uniqueValues(section.items, 8) }])
      .filter(([, section]) => (section as { items: string[] }).items.length)
  );
}

function findLines(lines: string[], pattern: RegExp, limit = 4) {
  return uniqueValues(lines.filter((line) => pattern.test(line)), limit);
}

const skillPatterns: [RegExp, string][] = [
  [/academic writing|writing|写作|长文/i, "writing"],
  [/research|调研|资料|访谈/i, "research"],
  [/presentation|presenting|ppt|powerpoint|展示|演示/i, "presentation"],
  [/data analysis|数据分析|spss|sql|excel|统计/i, "data analysis"],
  [/python/i, "python"],
  [/javascript|typescript|react/i, "frontend development"],
  [/figma/i, "figma"],
  [/canva|海报|排版|封面|选图/i, "visual design"],
  [/project management|项目管理|项目协作|会议策划|议程安排/i, "project management"],
  [/marketing|campaign|运营|推广|社群|公众号|新媒体/i, "marketing"],
  [/notion|lark|飞书/i, "collaboration tools"],
  [/word/i, "word"],
  [/excel/i, "excel"],
  [/ielts|雅思|language/i, "language skills"]
];

function extractResumeSkills(text: string) {
  return uniqueValues(skillPatterns.filter(([pattern]) => pattern.test(text)).map(([, label]) => label), 16);
}

function buildResumeSummary(lines: string[], sections: Record<string, { label: string; items: string[] }>, skills: string[]) {
  const education = sections.education?.items?.[0] ?? findLines(lines, /大学|university|college|school|教育|education/i, 1)[0];
  const experience = sections.experience?.items?.[0] ?? sections.projects?.items?.[0] ?? findLines(lines, /实习|项目|运营|分析|策划|intern|project|operation/i, 1)[0];
  const skillText = skills.length ? `关键词：${skills.slice(0, 8).join(", ")}。` : "";
  return [education, experience, skillText].filter(Boolean).join(" ").slice(0, 800) || "当前文件类型暂未做深度解析，已保存文件元数据；后续可接入云端文档解析服务。";
}

export function parseResumeText(text: string, fileName: string) {
  const cleaned = cleanResumeText(text);
  const lines = resumeLines(cleaned);
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
  const phone = text.match(/(?:\+?\d[\d\s-]{7,}\d)/)?.[0]?.trim() ?? "";
  const links = Array.from(text.matchAll(/https?:\/\/[^\s)]+/g)).map((match) => match[0]).slice(0, 8);
  const sections = inferResumeSections(lines);
  const skills = extractResumeSkills(cleaned);
  const highlights = uniqueValues([
    ...findLines(lines, /项目|实习|运营|分析|策划|推广|访谈|project|intern|campaign|analysis/i, 5),
    ...(sections.experience?.items ?? []),
    ...(sections.projects?.items ?? [])
  ], 6);

  return {
    fileName,
    parsedAt: new Date().toISOString(),
    parser: text ? "local-text-regex" : "metadata-only",
    email,
    phone,
    links,
    skills,
    highlights,
    sections,
    lineCount: lines.length,
    rawText: cleaned.slice(0, 12000),
    summary: text ? buildResumeSummary(lines, sections, skills) : "当前文件类型暂未做深度解析，已保存文件元数据；后续可接入云端文档解析服务。"
  };
}
