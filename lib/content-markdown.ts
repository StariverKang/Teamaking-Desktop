export type ContentNodeType = "document" | "folder";

export type ContentMarkdownDraft = {
  fileName: string;
  relativePath: string;
  kind: string;
  nodeType: ContentNodeType;
  title: string;
  slug: string;
  summary: string;
  bodyMarkdown: string;
  status: string;
  displayOrder: number;
  parentSlug: string;
  imageUrls: string[];
  warnings: string[];
  archived: boolean;
};

export type MarkdownHeading = {
  depth: number;
  text: string;
  id: string;
};

type Frontmatter = Record<string, string>;

const validStatuses = new Set(["draft", "published", "hidden"]);

export function parseFrontmatter(raw: string) {
  const normalized = raw.replace(/^\uFEFF/, "");
  if (!normalized.startsWith("---")) {
    return { data: {} as Frontmatter, body: normalized, warnings: [] as string[] };
  }

  const lines = normalized.split(/\r?\n/);
  const endIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (endIndex === -1) {
    return {
      data: {} as Frontmatter,
      body: normalized,
      warnings: ["Frontmatter is missing a closing --- marker, so it was treated as markdown body."]
    };
  }

  const data: Frontmatter = {};
  const warnings: string[] = [];
  for (const line of lines.slice(1, endIndex)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(trimmed);
    if (!match) {
      warnings.push(`Ignored frontmatter line: ${trimmed}`);
      continue;
    }
    data[match[1]] = unquoteFrontmatterValue(match[2]);
  }

  return {
    data,
    body: lines.slice(endIndex + 1).join("\n").trimStart(),
    warnings
  };
}

function unquoteFrontmatterValue(value: string) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function slugifyContent(value: string, fallback = "document") {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || fallback;
}

export function markdownTitle(markdown: string) {
  const match = /^#\s+(.+)$/m.exec(markdown);
  return match?.[1]?.trim() ?? "";
}

export function markdownSummary(markdown: string) {
  const paragraphs = markdown
    .replace(/^---[\s\S]*?---\s*/, "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph && !paragraph.startsWith("#") && !paragraph.startsWith("```"));
  const first = paragraphs[0] ?? "";
  return first.replace(/\s+/g, " ").slice(0, 180);
}

export function parseContentMarkdownFile(input: {
  fileName: string;
  relativePath?: string;
  raw: string;
  index?: number;
  kind: string;
}): ContentMarkdownDraft {
  const { data, body, warnings } = parseFrontmatter(input.raw);
  const relativePath = input.relativePath || input.fileName;
  const baseName = input.fileName.replace(/\.md$/i, "");
  const inferredFolder = /^_folder$/i.test(baseName);
  const explicitNodeType = data.nodeType === "folder" || data.nodeType === "document" ? data.nodeType : undefined;
  const nodeType: ContentNodeType = explicitNodeType ?? (inferredFolder ? "folder" : "document");
  const title = data.title || markdownTitle(body) || titleFromFileName(baseName);
  const slug = data.slug || slugifyContent(inferredFolder ? parentFolderName(relativePath) : baseName);
  const summary = data.summary || (nodeType === "folder" ? "" : markdownSummary(body));
  const status = validStatuses.has(data.status) ? data.status : "draft";
  const displayOrder = numberValue(data.displayOrder, input.index ?? 0);
  const parentSlug = data.parentSlug || inferParentSlug(relativePath, nodeType);
  const imageUrls = csv(data.imageUrls).slice(0, 3);
  const archived = /(^|\/)99-archive(\/|$)/.test(relativePath);

  return {
    fileName: input.fileName,
    relativePath,
    kind: data.kind || input.kind,
    nodeType,
    title,
    slug,
    summary,
    bodyMarkdown: nodeType === "folder" ? "" : body.trim(),
    status: archived ? "draft" : status,
    displayOrder,
    parentSlug,
    imageUrls,
    warnings,
    archived
  };
}

function titleFromFileName(value: string) {
  return value
    .replace(/^_+/, "")
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Untitled";
}

function parentFolderName(relativePath: string) {
  const parts = relativePath.split("/").filter(Boolean);
  const folder = parts.length > 1 ? parts[parts.length - 2] : parts[0] ?? "folder";
  return folder.replace(/^\d+-/, "");
}

function inferParentSlug(relativePath: string, nodeType: ContentNodeType) {
  const parts = relativePath.split("/").filter(Boolean);
  if (parts.length < 2) return "";
  if (nodeType === "folder") {
    if (parts.length < 3) return "";
    return slugifyContent(parts[parts.length - 3].replace(/^\d+-/, ""));
  }
  return slugifyContent(parts[parts.length - 2].replace(/^\d+-/, ""));
}

function numberValue(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function csv(value: string | undefined) {
  if (!value) return [];
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

export function headingId(text: string, used?: Map<string, number>) {
  const base = slugifyContent(text, "section");
  if (!used) return base;
  const count = used.get(base) ?? 0;
  used.set(base, count + 1);
  return count === 0 ? base : `${base}-${count + 1}`;
}

export function extractMarkdownHeadings(markdown: string): MarkdownHeading[] {
  const used = new Map<string, number>();
  return markdown
    .split(/\r?\n/)
    .map((line) => /^(#{1,4})\s+(.+?)\s*$/.exec(line))
    .filter((match): match is RegExpExecArray => Boolean(match))
    .map((match) => {
      const text = match[2].replace(/[#*_`[\]()]/g, "").trim();
      return {
        depth: match[1].length,
        text,
        id: headingId(text, used)
      };
    });
}

export function flattenContentDocuments(documents: any[]): any[] {
  const result: any[] = [];
  const visit = (document: any) => {
    result.push(document);
    (document.children ?? []).forEach(visit);
  };
  documents.forEach(visit);
  return result;
}

export function contentBreadcrumb(document: any, allDocuments: any[]) {
  if (!document) return [];
  const byId = new Map(allDocuments.map((item) => [item.id, item]));
  const path = [document];
  let current = document.parentId ? byId.get(document.parentId) : null;
  while (current) {
    path.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : null;
  }
  return path;
}

export function searchContentDocuments(query: string, documents: any[]) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  return documents
    .filter((document) => document.nodeType !== "folder")
    .map((document) => {
      const haystack = [document.title, document.summary, document.slug, document.bodyMarkdown].join(" ").toLowerCase();
      const score = [document.title, document.summary, document.slug, document.bodyMarkdown].reduce((total, value, index) => {
        const text = String(value ?? "").toLowerCase();
        if (!text.includes(normalized)) return total;
        return total + [8, 5, 4, 2][index];
      }, 0);
      return { document, score: haystack.includes(normalized) ? Math.max(score, 1) : 0 };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || String(a.document.title).localeCompare(String(b.document.title)))
    .map((item) => item.document);
}

export function relatedContentDocuments(document: any, documents: any[], limit = 4) {
  if (!document) return [];
  const keywords = keywordsFor(document);
  return documents
    .filter((candidate) => candidate.id !== document.id && candidate.nodeType !== "folder")
    .map((candidate) => {
      let score = candidate.parentId && candidate.parentId === document.parentId ? 12 : 0;
      const candidateKeywords = new Set(keywordsFor(candidate));
      for (const keyword of keywords) {
        if (candidateKeywords.has(keyword)) score += 2;
      }
      if (candidate.kind === document.kind) score += 1;
      return { candidate, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || (a.candidate.displayOrder ?? 0) - (b.candidate.displayOrder ?? 0))
    .slice(0, limit)
    .map((item) => item.candidate);
}

function keywordsFor(document: any) {
  const text = [document.title, document.summary, document.slug, document.bodyMarkdown].join(" ").toLowerCase();
  return Array.from(new Set((text.match(/[a-z0-9]{3,}|[\u4e00-\u9fff]{2,}/g) ?? []).filter((word) => !stopWords.has(word))));
}

const stopWords = new Set([
  "the",
  "and",
  "for",
  "with",
  "this",
  "that",
  "you",
  "your",
  "teamaking",
  "support",
  "ticket"
]);
