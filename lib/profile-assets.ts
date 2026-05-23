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

export function fileExtensionOf(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export function isAllowedProfileFile(fileName: string) {
  return profileFileExtensions.includes(fileExtensionOf(fileName) as (typeof profileFileExtensions)[number]);
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

export function parseResumeText(text: string, fileName: string) {
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
  const phone = text.match(/(?:\+?\d[\d\s-]{7,}\d)/)?.[0]?.trim() ?? "";
  const links = Array.from(text.matchAll(/https?:\/\/[^\s)]+/g)).map((match) => match[0]).slice(0, 8);
  const knownSkills = [
    "research",
    "writing",
    "presentation",
    "data analysis",
    "python",
    "javascript",
    "typescript",
    "react",
    "sql",
    "figma",
    "photoshop",
    "excel",
    "project management",
    "marketing",
    "design"
  ];
  const lower = text.toLowerCase();
  const skills = knownSkills.filter((skill) => lower.includes(skill));

  return {
    fileName,
    parsedAt: new Date().toISOString(),
    parser: text ? "local-text-regex" : "metadata-only",
    email,
    phone,
    links,
    skills,
    summary: text ? text.replace(/\s+/g, " ").slice(0, 600) : "当前文件类型暂未做深度解析，已保存文件元数据；后续可接入云端文档解析服务。"
  };
}
