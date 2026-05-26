"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowRight, Award, Check, Copy, FileText, Folder, Handshake, Image as ImageIcon, KeyRound, Link as LinkIcon, MailCheck, MessageCircle, Music, Plus, Search, Send, Settings, Trash2, UserRound, X } from "lucide-react";
import { Card, EmptyState, LoadingState, PageShell, SkillBadge, StatusPill } from "@/components/app-shell";
import { CourseCard, ProfileCard, TeamakingPostCard, TeamUpRequestCard } from "@/components/cards";
import { contributionTypes, strengths } from "@/lib/constants";
import { contactVisibilityOptions, defaultContactVisibility } from "@/lib/contact";

async function api(path: string, options: RequestInit = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    },
    body: typeof options.body === "string" || options.body === undefined ? options.body : JSON.stringify(options.body)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = data.errorCode ? `（代码：${data.errorCode}；请求：${data.requestId ?? "unknown"}）` : "";
    throw new Error(`${data.error ?? "请求失败，请稍后再试。"}${code}`);
  }

  return data;
}

async function uploadProfileFile(file: File, purpose: string) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("purpose", purpose);

  const response = await fetch("/api/uploads", {
    method: "POST",
    body: formData
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = data.errorCode ? `（代码：${data.errorCode}；请求：${data.requestId ?? "unknown"}）` : "";
    throw new Error(`${data.error ?? "上传失败，请稍后再试。"}${code}`);
  }

  return data.upload;
}

function useApi(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!path) {
      setData(null);
      setError("");
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);
    api(path)
      .then((value) => {
        if (alive) {
          setData(value);
          setError("");
        }
      })
      .catch((err: Error) => {
        if (alive) setError(err.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);

  return { data, error, loading };
}

function ErrorBox({ message }: { message?: string }) {
  if (!message) return null;
  return <div className="border border-coral/35 bg-coral/10 px-4 py-3 text-sm text-coral">{message}</div>;
}

function Field({
  label,
  children,
  help
}: {
  label: string;
  children: React.ReactNode;
  help?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-ink">
      <span>{label}</span>
      {children}
      {help ? <span className="text-xs font-normal leading-5 text-ink/56">{help}</span> : null}
    </label>
  );
}

const inputClass = "focus-ring w-full border border-ink/30 bg-chalk/80 px-3 py-2 text-sm text-ink";

function majorsForFaculty(majors: any[], facultyId?: string) {
  return majors.filter((major) => !facultyId || major.facultyId === facultyId);
}

function normalizeAcademicSelection(faculties: any[], majors: any[], preferredFacultyId?: string | null, preferredMajorId?: string | null) {
  const facultyExists = (id?: string | null) => Boolean(id && faculties.some((faculty) => faculty.id === id));
  const preferredMajor = preferredMajorId ? majors.find((major) => major.id === preferredMajorId) : null;
  const facultyId = facultyExists(preferredFacultyId)
    ? String(preferredFacultyId)
    : preferredMajor?.facultyId ?? faculties[0]?.id ?? "";
  const scopedMajors = majorsForFaculty(majors, facultyId);
  const majorId = preferredMajor && (!facultyId || preferredMajor.facultyId === facultyId)
    ? preferredMajor.id
    : scopedMajors[0]?.id ?? "";
  return { facultyId, majorId };
}

function MarkdownRenderer({ children }: { children: string }) {
  return (
    <div className="prose prose-sm max-w-none text-ink prose-headings:text-ink prose-a:text-coral prose-strong:text-ink prose-code:rounded prose-code:bg-mist prose-code:px-1 prose-pre:bg-ink prose-pre:text-paper">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children || ""}</ReactMarkdown>
    </div>
  );
}

const contentKindLabels: Record<string, string> = {
  help: "帮助中心",
  developer_log: "开发者日志",
  developer_contact: "联系开发者"
};

function flattenContentDocuments(documents: any[]): any[] {
  const flat: any[] = [];
  const visit = (document: any) => {
    flat.push(document);
    (document.children ?? []).forEach(visit);
  };
  documents.forEach(visit);
  return flat;
}

function buildContentTree(documents: any[]) {
  const clones = documents.map((document) => ({ ...document, children: [] as any[] }));
  const byId = new Map(clones.map((document) => [document.id, document]));
  const roots: any[] = [];
  for (const document of clones) {
    const parent = document.parentId ? byId.get(document.parentId) : null;
    if (parent) parent.children.push(document);
    else roots.push(document);
  }
  const sortTree = (items: any[]) => {
    items.sort((a, b) => (a.kind ?? "").localeCompare(b.kind ?? "") || (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || (a.title ?? "").localeCompare(b.title ?? ""));
    items.forEach((item) => sortTree(item.children ?? []));
  };
  sortTree(roots);
  return roots;
}

function firstContentDocument(documents: any[]): any | null {
  for (const document of documents) {
    if (contentNodeType(document) === "document") return document;
    const child = firstContentDocument(document.children ?? []);
    if (child) return child;
  }
  return null;
}

function contentNodeType(document: any) {
  return document?.nodeType === "folder" ? "folder" : "document";
}

function ContentDocumentTree({
  documents,
  selectedId,
  expandedIds,
  onToggle,
  onSelect,
  onCreateFolder,
  onCreateDocument,
  showStatus = false,
  selectFolders = false,
  depth = 0
}: {
  documents: any[];
  selectedId?: string;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (document: any) => void;
  onCreateFolder?: (parent?: any) => void;
  onCreateDocument?: (parent?: any) => void;
  showStatus?: boolean;
  selectFolders?: boolean;
  depth?: number;
}) {
  if (!documents.length) return <p className="px-3 py-4 text-sm text-ink/50">暂无文档。</p>;
  return (
    <div className={depth ? "grid gap-1 border-l border-ink/12 pl-3" : "grid gap-1"}>
      {documents.map((document) => {
        const children = document.children ?? [];
        const expanded = expandedIds.has(document.id);
        const selected = selectedId === document.id;
        const isFolder = contentNodeType(document) === "folder";
        const canContainChildren = isFolder || children.length > 0;
        const selectOrToggle = () => {
          if (isFolder && !selectFolders) {
            if (children.length) onToggle(document.id);
            return;
          }
          onSelect(document);
        };
        return (
          <div key={document.id}>
            <div className={`grid grid-cols-[28px_1fr_auto] items-start gap-1 rounded-sm border px-2 py-2 ${selected ? "border-coral bg-coral/10" : "border-transparent hover:border-ink/15 hover:bg-chalk"}`}>
              <button
                type="button"
                onClick={() => children.length ? onToggle(document.id) : selectOrToggle()}
                className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-sm border border-ink/20 text-xs font-semibold"
                aria-label={children.length ? "展开或收起文档" : "选择文档"}
              >
                {children.length ? (expanded ? "-" : "+") : isFolder ? <Folder size={14} aria-hidden /> : <FileText size={14} aria-hidden />}
              </button>
              <button type="button" onClick={selectOrToggle} className="min-w-0 text-left">
                <span className="block truncate text-sm font-semibold text-ink">{document.title || "Untitled"}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-ink/52">
                  <span>{isFolder ? "文件夹" : "文档"}</span>
                  <span>{contentKindLabels[document.kind] ?? document.kind}</span>
                  <span>/{document.slug}</span>
                  {showStatus ? <StatusPill status={document.status ?? "draft"} /> : null}
                </span>
              </button>
              {canContainChildren && (onCreateFolder || onCreateDocument) ? (
                <div className="flex flex-wrap justify-end gap-1">
                  {onCreateFolder ? (
                    <button type="button" onClick={(event) => { event.stopPropagation(); onCreateFolder(document); }} className="rounded-sm border border-ink/20 px-2 py-1 text-xs font-semibold hover:bg-paper">
                      新建文件夹
                    </button>
                  ) : null}
                  {onCreateDocument ? (
                    <button type="button" onClick={(event) => { event.stopPropagation(); onCreateDocument(document); }} className="rounded-sm border border-ink/20 px-2 py-1 text-xs font-semibold hover:bg-paper">
                      新建文档
                    </button>
                  ) : null}
                </div>
              ) : <span />}
            </div>
            {children.length && expanded ? (
              <div className="mt-1">
                <ContentDocumentTree documents={children} selectedId={selectedId} expandedIds={expandedIds} onToggle={onToggle} onSelect={onSelect} onCreateFolder={onCreateFolder} onCreateDocument={onCreateDocument} showStatus={showStatus} selectFolders={selectFolders} depth={depth + 1} />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function ContentDocumentReader({ document, emptyTitle = "选择一篇文档" }: { document?: any; emptyTitle?: string }) {
  if (!document) return <EmptyState title={emptyTitle} body="从左侧文档树选择一个条目后，会在这里显示正文。" />;
  if (contentNodeType(document) === "folder") {
    return <EmptyState title={document.title || "分类文件夹"} body="这是一个分类文件夹，用来组织子文档；正文内容请在其下创建文档。" />;
  }
  return (
    <article className="grid gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-coral">{contentKindLabels[document.kind] ?? document.kind} / {document.slug}</p>
        <h2 className="mt-1 text-3xl font-semibold text-ink">{document.title}</h2>
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-ink/56">
          {document.publishedAt ? <span>Published {new Date(document.publishedAt).toLocaleDateString()}</span> : null}
          {document.updatedAt ? <span>Updated {new Date(document.updatedAt).toLocaleString()}</span> : null}
        </div>
        {document.summary ? <p className="mt-3 text-sm leading-6 text-ink/64">{document.summary}</p> : null}
      </div>
      {contentImageUrls(document.imageUrls).length ? (
        <div className="grid gap-3 md:grid-cols-3">
          {contentImageUrls(document.imageUrls).map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={url} src={url} alt={document.title} className="max-h-64 w-full border border-ink/20 object-contain" />
          ))}
        </div>
      ) : null}
      {document.bodyMarkdown ? <MarkdownRenderer>{document.bodyMarkdown}</MarkdownRenderer> : <p className="text-sm text-ink/52">这篇文档还没有正文。</p>}
    </article>
  );
}

function FilePreviewModal({ item, onClose }: { item: any; onClose: () => void }) {
  if (!item) return null;
  const url = item.fileUrl || item.externalUrl;
  const kind = item.previewKind;
  const parsedText = item.parsedText || item.metadata?.parsedText || item.metadata?.summary || item.contributionDescription || "";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/72 px-4 py-6">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden border-2 border-ink bg-paper shadow-hard">
        <div className="flex items-center justify-between gap-3 border-b-2 border-ink bg-chalk px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-coral">{item.fileName || item.title || "Preview"}</p>
            <h2 className="truncate text-xl font-semibold text-ink">{item.title || "文件预览"}</h2>
          </div>
          <button type="button" onClick={onClose} className="focus-ring grid h-10 w-10 shrink-0 place-items-center border border-ink/30 bg-paper" aria-label="关闭预览">
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="max-h-[calc(90vh-88px)] overflow-auto p-4">
          {url && kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={item.title || item.fileName || "preview"} className="max-h-[74vh] w-full object-contain" />
          ) : url && kind === "pdf" ? (
            <iframe title={item.title || "PDF preview"} src={url} className="h-[74vh] w-full border border-ink/20 bg-white" />
          ) : url && kind === "office" ? (
            <div className="grid gap-3">
              <iframe title={item.title || "Office preview"} src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`} className="h-[74vh] w-full border border-ink/20 bg-white" />
              {parsedText ? (
                <details className="border border-ink/20 bg-chalk p-3">
                  <summary className="cursor-pointer font-semibold">如果 Office 预览不可用，展开查看解析文本</summary>
                  <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs leading-5">{parsedText}</pre>
                </details>
              ) : null}
            </div>
          ) : kind === "markdown" ? (
            <MarkdownRenderer>{parsedText || `[打开文件](${url})`}</MarkdownRenderer>
          ) : kind === "text" || parsedText ? (
            <pre className="max-h-[74vh] overflow-auto whitespace-pre-wrap break-words border border-ink/20 bg-chalk p-4 text-sm leading-6 text-ink/78">{parsedText || "暂无可预览文本。"}</pre>
          ) : url ? (
            <div className="grid gap-3">
              <p className="text-sm leading-6 text-ink/62">这个文件类型暂时不能直接内嵌预览，可以使用外部链接打开。</p>
              <a href={url} target="_blank" rel="noreferrer" className="w-fit border border-ink/30 px-3 py-2 text-sm font-semibold">打开文件</a>
            </div>
          ) : (
            <p className="text-sm text-ink/62">这个材料没有可预览文件。</p>
          )}
        </div>
      </div>
    </div>
  );
}

const portfolioTypeLabels: Record<string, string> = {
  portfolio: "个人作品",
  coursework: "课程作品",
  report: "报告 / 论文",
  slides: "PPT / 展示",
  code: "代码",
  design: "设计稿",
  audio: "音频",
  image: "图像",
  gpa_screenshot: "GPA 截图",
  language_score: "语言成绩",
  award_certificate: "获奖证书",
  skill_certification: "技能 / 职业认证",
  career_certification: "技能 / 职业认证",
  resume: "旧简历材料",
  other: "其他"
};

const portfolioTypes = Object.keys(portfolioTypeLabels).filter((type) => type !== "resume" && type !== "career_certification");
const currentCalendarYear = new Date().getFullYear();
const defaultEntryYear = new Date().getMonth() + 1 >= 8 ? currentCalendarYear : currentCalendarYear - 1;
const entryTermOptions = ["Fall", "Spring"];

const acceptedProfileFiles = [
  ".md",
  ".markdown",
  ".txt",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
  ".tsv",
  ".pdf",
  ".ppt",
  ".pptx",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".heic",
  ".mp3",
  ".wav",
  ".m4a",
  ".aac",
  ".flac",
  ".ogg",
  ".fig",
  ".sketch",
  ".xd",
  ".psd",
  ".ai",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".py",
  ".java",
  ".c",
  ".cpp",
  ".h",
  ".cs",
  ".go",
  ".rs",
  ".rb",
  ".php",
  ".html",
  ".css",
  ".json",
  ".yaml",
  ".yml",
  ".zip",
  ".rar",
  ".7z"
].join(",");

function tagsFromText(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function tagsToText(value: unknown) {
  return Array.isArray(value) ? value.join(", ") : "";
}

function uniqueTextList(values: unknown[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const item = String(value ?? "").trim();
    const key = item.toLowerCase();
    if (!item || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function formatFileSize(value?: number) {
  if (!value) return "";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function textList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function contentImageUrls(value: unknown) {
  return textList(value).slice(0, 3);
}

function renderResumeParsedData(parsed: any, fallbackFileName: string) {
  const sections = parsed?.sections && typeof parsed.sections === "object" ? parsed.sections : {};
  const sectionEntries = Object.entries(sections) as [string, { label?: string; items?: string[] }][];
  const rawText = String(parsed?.rawText ?? "");
  const skills = textList(parsed?.skills);
  const highlights = textList(parsed?.highlights);
  const contacts = [
    parsed?.email ? `邮箱：${parsed.email}` : "",
    parsed?.phone ? `电话：${parsed.phone}` : "",
    ...textList(parsed?.links).map((link) => `链接：${link}`)
  ].filter(Boolean);

  return (
    <div className="mt-4 grid gap-4 border border-ink/25 bg-paper p-3 text-sm leading-6 text-ink/66">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-ink">{parsed?.fileName || fallbackFileName || "尚未上传简历"}</p>
          <p className="mt-1 text-xs text-ink/50">{parsed?.parser ? `Parser: ${parsed.parser}` : "上传后会在这里显示解析结果。"}</p>
        </div>
        {parsed?.parsedAt ? <span className="border border-ink/20 px-2 py-1 text-xs text-ink/58">{new Date(parsed.parsedAt).toLocaleString()}</span> : null}
      </div>
      <div className="border border-ink/15 bg-chalk p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink/48">Auto summary</p>
        <p className="mt-2 whitespace-pre-wrap text-ink/72">{String(parsed?.summary ?? "上传后会在这里显示解析结果。")}</p>
      </div>
      {contacts.length || skills.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {contacts.length ? (
            <div className="border border-ink/15 bg-chalk p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/48">Contact detected</p>
              <div className="mt-2 grid gap-1">
                {contacts.slice(0, 8).map((item) => <p key={item} className="break-words">{item}</p>)}
              </div>
            </div>
          ) : null}
          {skills.length ? (
            <div className="border border-ink/15 bg-chalk p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/48">Keywords</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {skills.map((skill) => <SkillBadge key={skill}>{skill}</SkillBadge>)}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      {highlights.length ? (
        <div className="border border-ink/15 bg-chalk p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/48">Highlights</p>
          <ul className="mt-2 grid gap-1.5">
            {highlights.map((item) => <li key={item} className="break-words">- {item}</li>)}
          </ul>
        </div>
      ) : null}
      {sectionEntries.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {sectionEntries.slice(0, 6).map(([key, section]) => (
            <div key={key} className="max-h-52 overflow-auto border border-ink/15 bg-chalk p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/48">{section.label ?? key}</p>
              <div className="mt-2 grid gap-1.5">
                {textList(section.items).map((item) => <p key={item} className="break-words">{item}</p>)}
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {rawText ? (
        <details className="border border-ink/15 bg-chalk p-3">
          <summary className="cursor-pointer font-semibold text-ink">完整解析原文</summary>
          <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words border border-ink/10 bg-paper p-3 text-xs leading-5 text-ink/70">{rawText}</pre>
        </details>
      ) : null}
    </div>
  );
}

function previewIcon(kind?: string) {
  if (kind === "image") return <ImageIcon size={16} aria-hidden />;
  if (kind === "audio") return <Music size={16} aria-hidden />;
  if (kind === "pdf" || kind === "office" || kind === "markdown" || kind === "text") return <FileText size={16} aria-hidden />;
  if (kind === "design") return <Award size={16} aria-hidden />;
  return <LinkIcon size={16} aria-hidden />;
}

const honorTypes = new Set(["gpa_screenshot", "award_certificate", "skill_certification", "career_certification", "language_score"]);

function isHonorItem(item: any) {
  return honorTypes.has(item.type);
}

const portfolioEvidenceSections = [
  {
    key: "paperwork",
    title: "过往作品 / Paperwork",
    emptyTitle: "还没有公开过往作品",
    emptyBody: "课程作品、报告、PPT、代码、设计稿等证明材料会显示在这里。",
    matches: (item: any) => !["resume", "skill_certification", "career_certification", "language_score", "award_certificate", "gpa_screenshot"].includes(item.type)
  },
  {
    key: "certifications",
    title: "技能 / 职业认证",
    emptyTitle: "还没有公开技能认证",
    emptyBody: "技能认证、职业认证、语言成绩等证明会显示在这里。",
    matches: (item: any) => ["skill_certification", "career_certification", "language_score"].includes(item.type)
  },
  {
    key: "awards",
    title: "奖项 / GPA",
    emptyTitle: "还没有公开奖项或成绩证明",
    emptyBody: "获奖证书、GPA 截图等证明会显示在这里。",
    matches: (item: any) => ["award_certificate", "gpa_screenshot"].includes(item.type)
  },
  {
    key: "resume",
    title: "简历解析（靠后展示）",
    emptyTitle: "还没有公开简历",
    emptyBody: "对方还没有展示可见的简历文件或简历解析。",
    matches: (item: any) => item.type === "resume"
  }
];

function PortfolioEvidenceSection({ section, items, editable, onDelete, onEdit }: { section: (typeof portfolioEvidenceSections)[number]; items: any[]; editable?: boolean; onDelete?: (id: string) => void; onEdit?: (item: any) => void }) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-ink">{section.title}</h3>
        <span className="border border-ink/20 px-2 py-1 text-xs font-semibold text-ink/56">{items.length}</span>
      </div>
      {items.length > 0 ? (
        <PaginatedGrid items={items} pageSize={4} render={(item) => <PortfolioEvidenceCard key={item.id ?? item.title} item={item} editable={editable} onDelete={onDelete} onEdit={onEdit} />} />
      ) : (
        <EmptyState title={section.emptyTitle} body={section.emptyBody} />
      )}
    </section>
  );
}

function fileFamily(item: any) {
  if (item.previewKind === "pdf") return "report";
  if (item.previewKind === "office" && ["ppt", "pptx"].includes(item.fileExtension)) return "slides";
  if (item.previewKind === "text" && ["js", "jsx", "ts", "tsx", "py", "java", "c", "cpp", "go", "rs"].includes(item.fileExtension)) return "code";
  if (item.previewKind === "design") return "design";
  if (item.type === "slides" || item.type === "report" || item.type === "code" || item.type === "design") return item.type;
  return "other";
}

function portfolioPreviewState(item: any) {
  const parsedText = item.parsedText || item.metadata?.parsedText || item.metadata?.summary || "";
  const previewUrl = item.fileUrl || item.externalUrl || "";
  const hasStoredFile = Boolean(item.fileName || item.storageKey || item.objectKey || item.fileUrl);
  return {
    hasPreview: Boolean(previewUrl || parsedText),
    hasStoredFile,
    previewUrl,
    parsedText
  };
}

function PaginatedGrid({
  items,
  render,
  pageSize = 4,
  gridClassName = "grid gap-4 md:grid-cols-2"
}: {
  items: any[];
  render: (item: any) => React.ReactNode;
  pageSize?: number;
  gridClassName?: string;
}) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const visible = items.slice(safePage * pageSize, safePage * pageSize + pageSize);

  useEffect(() => {
    if (page > pageCount - 1) setPage(Math.max(0, pageCount - 1));
  }, [page, pageCount]);

  return (
    <div className="grid gap-3">
      <div className={gridClassName}>{visible.map(render)}</div>
      {items.length > pageSize ? (
        <div className="flex items-center justify-between border border-ink/20 bg-paper px-3 py-2 text-sm">
          <button type="button" className="focus-ring border border-ink/30 px-3 py-1 font-semibold disabled:opacity-40" disabled={safePage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>
            Previous
          </button>
          <span className="text-ink/62">{safePage + 1} / {pageCount}</span>
          <button type="button" className="focus-ring border border-ink/30 px-3 py-1 font-semibold disabled:opacity-40" disabled={safePage >= pageCount - 1} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}>
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ToggleGroup({
  values,
  selected,
  onChange
}: {
  values: string[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => {
        const active = selected.includes(value);
        return (
          <button
            key={value}
            type="button"
            onClick={() => onChange(active ? selected.filter((item) => item !== value) : [...selected, value])}
            className={`focus-ring rounded-lg border px-3 py-2 text-sm font-semibold ${
              active ? "border-moss bg-moss text-white" : "border-ink/12 bg-white text-ink/70 hover:bg-mist"
            }`}
          >
            {value}
          </button>
        );
      })}
    </div>
  );
}

export function LandingPage() {
  return (
    <main className="mx-auto max-w-7xl px-5 py-10">
      <section className="grid min-h-[calc(100vh-140px)] items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-coral">Proof-of-Work Profile + Course Boards</p>
          <h1 className="text-5xl font-semibold leading-tight text-ink md:text-7xl">TEAMAKING</h1>
          <p className="mt-5 text-2xl font-semibold text-moss">Your work speaks before you team up.</p>
          <p className="mt-3 text-xl text-ink/68">让认真做事的人，先被看见。</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login" className="focus-ring inline-flex items-center gap-2 rounded-lg bg-coral px-5 py-3 font-semibold text-white shadow-soft">
              <MailCheck size={18} aria-hidden />
              用学校邮箱开始
            </Link>
            <Link href="/demo-access" className="focus-ring inline-flex items-center gap-2 rounded-sm bg-ink px-5 py-3 font-semibold text-paper">
              进入演示验收
              <ArrowRight size={18} aria-hidden />
            </Link>
            <Link href="/courses" className="focus-ring inline-flex items-center gap-2 rounded-sm border border-ink/40 bg-paper px-5 py-3 font-semibold text-ink">
              先看看 Course Boards
              <ArrowRight size={18} aria-hidden />
            </Link>
          </div>
        </div>
        <div className="border border-ink/18 bg-chalk/92 p-5 shadow-soft">
          <div className="border border-ink/18 bg-mist/55 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink/16 pb-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-coral">What TEAMAKING is for</p>
                <h2 className="mt-1 font-serif text-2xl font-semibold text-ink">把课程协作信号放到同一个地方</h2>
              </div>
              <span className="border border-coral/35 bg-coral/10 px-2.5 py-1 text-xs font-semibold text-coral">course + people + proof</span>
            </div>
            <div className="mt-4 grid gap-3">
              {[
                ["展示个人成果", "用作品、证书、简历摘要和联系方式，让同学先看到你真实做过什么。"],
                ["按目标成绩找组员", "在课程板里说明你希望冲 A / A- / B+，或只求稳过，匹配节奏相近的小组作业伙伴。"],
                ["讨论课程内容", "围绕真实课程发帖、评价课程、整理经验，减少只靠群聊找信息的混乱。"]
              ].map(([title, body], index) => (
                <div key={title} className="border border-ink/16 bg-chalk/75 p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center border border-ink/18 bg-paper text-xs font-semibold text-ink">{index + 1}</span>
                    <div>
                      <p className="font-semibold text-ink">{title}</p>
                      <p className="mt-1 text-sm leading-6 text-ink/62">{body}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  function resetState(nextMode: "login" | "register" | "reset") {
    setMode(nextMode);
    setCode("");
    setDevCode("");
    setMessage("");
    setError("");
  }

  async function passwordLogin(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsLoggingIn(true);
    const result = await api("/api/auth/password-login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    }).catch((err: Error) => {
      setError(err.message);
      return null;
    }).finally(() => {
      setIsLoggingIn(false);
    });

    if (result?.redirectPath) router.push(result.redirectPath);
    else if (result?.user?.onboardingCompleted) router.push("/dashboard");
    else if (result?.user) router.push("/onboarding");
  }

  async function sendCode(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSendingCode(true);
    const endpoint = mode === "reset" ? "/api/auth/password-reset/send-code" : "/api/auth/register/send-code";
    const result = await api(endpoint, {
      method: "POST",
      body: JSON.stringify({ email })
    }).catch((err: Error) => {
      setError(err.message);
      return null;
    }).finally(() => {
      setIsSendingCode(false);
    });

    if (result) {
      const debugCode = typeof result.code === "string" ? result.code : "";
      setDevCode(debugCode);
      if (debugCode) setCode(debugCode);
      setMessage(debugCode ? `验证码已生成。开发环境验证码：${debugCode}` : result.message ?? "验证码已发送，请查看你的学校邮箱。");
    }
  }

  async function completeWithCode(event: FormEvent) {
    event.preventDefault();
    setError("");
    setIsCompleting(true);
    const endpoint = mode === "reset" ? "/api/auth/password-reset/complete" : "/api/auth/register/complete";
    const result = await api(endpoint, {
      method: "POST",
      body: JSON.stringify({ email, code, password })
    }).catch((err: Error) => {
      setError(err.message);
      return null;
    }).finally(() => {
      setIsCompleting(false);
    });

    if (result?.redirectPath) {
      setMode("login");
      setPassword("");
      setCode("");
      setDevCode("");
      setMessage(result.message ?? "处理完成，请登录。");
      return;
    }
    if (result?.user?.onboardingCompleted) router.push("/dashboard");
    else if (result?.user) router.push("/onboarding");
  }

  return (
    <PageShell title="测试环境入口" eyebrow="Authentication" description="测试环境账号会被保存，便于你重复登录、编辑资料、上传作品和继续测试；正式上线前可能统一清理测试数据。" aside="none">
      <div className="mb-5 inline-flex flex-wrap gap-2 border border-ink/20 bg-chalk p-1">
        {[
          ["login", "账号密码登录"],
          ["register", "邮箱注册"],
          ["reset", "找回密码"]
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => resetState(key as "login" | "register" | "reset")}
            className={`rounded-sm px-4 py-2 text-sm font-semibold ${mode === key ? "bg-ink text-paper" : "text-ink/68 hover:bg-mist"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-coral">{mode === "login" ? "Login" : mode === "register" ? "Register" : "Password Reset"}</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">{mode === "login" ? "已注册用户登录" : mode === "register" ? "学校邮箱注册" : "找回密码"}</h2>
            <p className="mt-2 text-sm leading-6 text-ink/64">
              {mode === "login"
                ? "已注册用户使用学校邮箱和密码登录。"
                : mode === "register"
                  ? "未注册用户先接收学校邮箱验证码，再设置密码完成注册。"
                  : "忘记密码时，用学校邮箱接收验证码后设置新密码。"}
            </p>
          </div>

          {mode === "login" ? (
            <form onSubmit={passwordLogin} className="grid gap-4">
              <Field label="学校邮箱">
                <input className={inputClass} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="your.name@mail.bnbu.edu.cn" />
              </Field>
              <Field label="密码">
                <input className={inputClass} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="输入密码" />
              </Field>
              <button type="submit" disabled={isLoggingIn} className="focus-ring inline-flex w-fit items-center gap-2 rounded-lg bg-ink px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
                <KeyRound size={16} aria-hidden />
                {isLoggingIn ? "登录中..." : "登录"}
              </button>
            </form>
          ) : (
            <div className="grid gap-6">
              <form onSubmit={sendCode} className="grid gap-4">
                <Field label="学校邮箱">
                  <input className={inputClass} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="your.name@mail.bnbu.edu.cn" />
                </Field>
                <button type="submit" disabled={isSendingCode} className="focus-ring inline-flex w-fit items-center gap-2 rounded-lg bg-ink px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
                  <Send size={16} aria-hidden />
                  {isSendingCode ? "发送中..." : "发送验证码"}
                </button>
              </form>
              {message ? <p className="rounded-lg bg-mist px-4 py-3 text-sm font-medium text-moss">{message}</p> : null}
              {devCode ? <p className="text-xs text-ink/58">本地调试提示：验证码已经自动填入下方输入框。</p> : null}
              <form onSubmit={completeWithCode} className="grid gap-4">
                <Field label="验证码">
                  <input className={inputClass} value={code} onChange={(event) => setCode(event.target.value)} placeholder="6 位验证码" />
                </Field>
                <Field label={mode === "register" ? "设置密码" : "设置新密码"}>
                  <input className={inputClass} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 8 位" />
                </Field>
                <button type="submit" disabled={isCompleting} className="focus-ring inline-flex w-fit items-center gap-2 rounded-lg bg-coral px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
                  <Check size={16} aria-hidden />
                  {isCompleting ? "处理中..." : mode === "register" ? "完成注册" : "重设密码并登录"}
                </button>
              </form>
            </div>
          )}
        </Card>

        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-coral">Test Notice</p>
          <h2 className="mt-2 text-xl font-semibold text-ink">测试用户说明</h2>
          <p className="mt-3 text-sm leading-6 text-ink/64">这个版本用于正式域名上的功能测试。测试账号、资料、作品上传和重复登录会暂时保留，方便继续验证流程。</p>
          <p className="mt-3 text-sm leading-6 text-ink/64">这些数据仍属于测试环境数据，不作为正式上线后的长期生产数据承诺。</p>
        </Card>
      </div>
      <div className="mt-5">
        <ErrorBox message={error} />
      </div>
    </PageShell>
  );
}

export function AdminLoginPage() {
  const router = useRouter();
  const [developerEmail, setDeveloperEmail] = useState("");
  const [developerPassword, setDeveloperPassword] = useState("");
  const [error, setError] = useState("");
  const [isDeveloperLoggingIn, setIsDeveloperLoggingIn] = useState(false);

  async function developerLogin(event: FormEvent) {
    event.preventDefault();
    setError("");
    setIsDeveloperLoggingIn(true);
    const result = await api("/api/auth/admin-login", {
      method: "POST",
      body: JSON.stringify({ email: developerEmail, password: developerPassword })
    }).catch((err: Error) => {
      setError(err.message);
      return null;
    }).finally(() => {
      setIsDeveloperLoggingIn(false);
    });

    if (result?.user) router.push("/admin");
  }

  return (
    <PageShell title="管理入口" eyebrow="Admin Access" description="这个入口只给维护者和管理员使用，不从主系统导航跳转。" aside="none">
      <div className="max-w-xl">
        <Card>
          <form onSubmit={developerLogin} className="grid gap-4">
            <Field label="管理员账号">
              <input className={inputClass} value={developerEmail} onChange={(event) => setDeveloperEmail(event.target.value)} placeholder="admin@teamingapp.org" />
            </Field>
            <Field label="管理员密码">
              <input className={inputClass} type="password" value={developerPassword} onChange={(event) => setDeveloperPassword(event.target.value)} placeholder="输入维护密码" />
            </Field>
            <button type="submit" disabled={isDeveloperLoggingIn} className="focus-ring inline-flex w-fit items-center gap-2 rounded-lg bg-ink px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
              <KeyRound size={16} aria-hidden />
              {isDeveloperLoggingIn ? "登录中..." : "进入管理后台"}
            </button>
          </form>
          <div className="mt-5">
            <ErrorBox message={error} />
          </div>
        </Card>
      </div>
    </PageShell>
  );
}

export function DemoAccessPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const accounts = [
    { key: "media", label: "Media Student", body: "普通学生视角：查看 dashboard、课程、课程板和 Team Up 流程。" },
    { key: "cs", label: "CS Student", body: "跨专业学生视角：用于检查 discovery、profile 和课程板成员展示。" },
    { key: "admin", label: "School Admin", body: "管理员视角：进入无代码后台，处理工单和配置数据。" }
  ];

  async function login(account: string) {
    setError("");
    const result = await api("/api/demo/login", { method: "POST", body: JSON.stringify({ account }) }).catch((err: Error) => {
      setError(err.message);
      return null;
    });
    if (result?.redirectPath) router.push(result.redirectPath);
  }

  return (
    <PageShell title="演示验收入口" eyebrow="Demo Access" description="这个入口只用于本地和验收环境，绕过邮箱验证码，帮助你直接检查业务逻辑与前端展示。" aside="none">
      <ErrorBox message={error} />
      <div className="grid gap-4 md:grid-cols-3">
        {accounts.map((account) => (
          <Card key={account.key}>
            <p className="text-xs font-semibold uppercase tracking-wide text-rust">Demo identity</p>
            <h2 className="mt-2 text-xl font-semibold text-ink">{account.label}</h2>
            <p className="mt-3 min-h-20 text-sm leading-6 text-ink/68">{account.body}</p>
            <button onClick={() => login(account.key)} className="focus-ring mt-5 inline-flex items-center gap-2 rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper">
              使用此身份进入
              <ArrowRight size={15} aria-hidden />
            </button>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}

export function OnboardingPage() {
  const router = useRouter();
  const { data, error, loading } = useApi("/api/onboarding");
  const [form, setForm] = useState({ displayName: "", grade: "Year 2", entryYear: defaultEntryYear, entryTerm: "Fall", facultyId: "", majorId: "" });
  const [tourStep, setTourStep] = useState(0);
  const [tourClosed, setTourClosed] = useState(false);
  const academicLock = data?.academicLock;
  const majors = useMemo(() => (data?.majors ?? []).filter((major: any) => !form.facultyId || major.facultyId === form.facultyId), [data, form.facultyId]);

  useEffect(() => {
    if (data?.user) {
      const academicSelection = normalizeAcademicSelection(
        data.faculties ?? [],
        data.majors ?? [],
        data.user.profile?.facultyId,
        data.user.profile?.majorId
      );
      setForm((current) => ({
        ...current,
        displayName: data.user.profile?.displayName ?? data.user.email?.split("@")[0] ?? "",
        grade: data.academicLock?.grade ?? data.user.profile?.grade ?? current.grade,
        entryYear: data.academicLock?.entryYear ?? data.user.profile?.entryYear ?? current.entryYear,
        entryTerm: data.academicLock?.entryTerm ?? data.user.profile?.entryTerm ?? current.entryTerm,
        facultyId: academicSelection.facultyId,
        majorId: academicSelection.majorId
      }));
    }
  }, [data]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    await api("/api/onboarding", { method: "POST", body: JSON.stringify(form) });
    router.push("/dashboard");
  }

  async function closeTour() {
    setTourClosed(true);
    await api("/api/onboarding/tour-dismiss", { method: "POST" }).catch(() => null);
  }

  const tourSteps = [
    { title: "欢迎来到 TEAMAKING", body: "这里用 Proof-of-Work Profile、Course Board 和轻量 Team Up 帮你更快找到靠谱同学。" },
    { title: "先补基础信息", body: "下面填写显示名称、学院和专业。年级会尽量从学校邮箱自动推断。" },
    { title: "Profile 可以继续编辑", body: "进入后可以在 Profile 页面补充作品证明、联系方式、头像和简历解析。" },
    { title: "遇到问题提交工单", body: "右下角支持按钮和 Support 页面都可以联系管理员。" },
    { title: "最后去 Course Board", body: "完成后进入 Dashboard，再从课程页加入 Course Board 并发布 Open to Team。" }
  ];

  return (
    <PageShell title="完成基础引导" eyebrow="Onboarding" description="这里不会验证官方选课，只用来帮助系统推荐课程板，并让同学理解你的协作背景。">
      {!tourClosed && !(data?.user?.profile?.onboardingTourDismissedAt) ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/70 px-4">
          <div className="w-full max-w-lg border-2 border-ink bg-paper p-5 shadow-hard">
            <p className="text-xs font-semibold uppercase tracking-wide text-coral">Step {tourStep + 1} / {tourSteps.length}</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">{tourSteps[tourStep].title}</h2>
            <p className="mt-3 text-sm leading-6 text-ink/68">{tourSteps[tourStep].body}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" onClick={closeTour} className="border border-ink/30 px-3 py-2 text-sm font-semibold">关闭引导</button>
              <button type="button" onClick={() => setTourStep((value) => Math.max(0, value - 1))} disabled={tourStep === 0} className="border border-ink/30 px-3 py-2 text-sm font-semibold disabled:opacity-40">上一步</button>
              {tourStep < tourSteps.length - 1 ? (
                <button type="button" onClick={() => setTourStep((value) => value + 1)} className="bg-ink px-3 py-2 text-sm font-semibold text-paper">下一步</button>
              ) : (
                <button type="button" onClick={closeTour} className="bg-coral px-3 py-2 text-sm font-semibold text-paper">开始填写</button>
              )}
            </div>
          </div>
        </div>
      ) : null}
      {loading ? <LoadingState /> : <ErrorBox message={error} />}
      {data ? (
        <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <Card>
            <h2 className="text-xl font-semibold text-ink">TEAMAKING 使用方式</h2>
            <div className="mt-4 grid gap-3 text-sm leading-6 text-ink/68">
              <p>1. 完成 Proof-of-Work Profile，让别人先看到你的实际贡献。</p>
              <p>2. 自己加入 Course Board，出现在 Course People 里。</p>
              <p>3. 发布 Open to Team 信号，其他同学可以轻量 Team Up。</p>
              <p>4. 最终沟通和组队在平台外完成，MVP 主要通过 WeChat 联系。</p>
            </div>
            <button type="button" onClick={() => router.push("/dashboard")} className="focus-ring mt-5 rounded-lg border border-ink/12 px-4 py-2 font-semibold">
              暂时跳过
            </button>
          </Card>
          <Card>
            <form onSubmit={submit} className="grid gap-4">
              <Field label="显示名称">
                <input className={inputClass} value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} />
              </Field>
              <Field label="年级 / Academic Year">
                <input className={inputClass} value={form.grade} readOnly={Boolean(academicLock?.locked)} onChange={(event) => setForm({ ...form, grade: event.target.value })} />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="入学年份 / Entry Year" help={academicLock?.locked ? "由邮箱第二位数字推断，特殊情况联系管理员覆盖。" : undefined}>
                  <input className={inputClass} type="number" value={form.entryYear} readOnly={Boolean(academicLock?.locked)} onChange={(event) => setForm({ ...form, entryYear: Number(event.target.value) })} />
                </Field>
                <Field label="入学学期 / Entry Term">
                  <select className={inputClass} value={form.entryTerm} disabled={Boolean(academicLock?.locked)} onChange={(event) => setForm({ ...form, entryTerm: event.target.value })}>
                    {entryTermOptions.map((term) => <option key={term}>{term}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Faculty / College">
                <select
                  className={inputClass}
                  value={form.facultyId}
                  onChange={(event) => setForm({ ...form, ...normalizeAcademicSelection(data.faculties ?? [], data.majors ?? [], event.target.value, null) })}
                >
                  {(data.faculties ?? []).map((faculty: any) => (
                    <option key={faculty.id} value={faculty.id}>
                      {faculty.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Major">
                <select className={inputClass} value={form.majorId} onChange={(event) => setForm({ ...form, majorId: event.target.value })} disabled={majors.length === 0}>
                  {majors.length === 0 ? <option value="">请先选择 Faculty</option> : null}
                  {majors.map((major: any) => (
                    <option key={major.id} value={major.id}>
                      {major.name}
                    </option>
                  ))}
                </select>
              </Field>
              <button type="submit" className="focus-ring inline-flex w-fit items-center gap-2 rounded-lg bg-coral px-4 py-2 font-semibold text-white">
                <Check size={16} aria-hidden />
                保存并进入 Dashboard
              </button>
            </form>
          </Card>
        </div>
      ) : null}
    </PageShell>
  );
}

export function DashboardPage() {
  const { data: me, loading, error } = useApi("/api/auth/me");
  const { data: recommended } = useApi("/api/courses/recommended", [me?.user?.id]);
  const { data: matches } = useApi("/api/matches", [me?.user?.id]);
  const { data: interests } = useApi("/api/team-up-interests/received", [me?.user?.id]);
  const activeMemberships = (me?.user?.memberships ?? []).filter((membership: any) => membership.status !== "opted_out");
  const currentMemberships = activeMemberships.filter((membership: any) => membership.board?.courseOffering?.semester?.isCurrent);
  const historyMemberships = activeMemberships.filter((membership: any) => !membership.board?.courseOffering?.semester?.isCurrent);

  return (
    <PageShell title="Dashboard" eyebrow="Student App" description="这里集中显示推荐课程、近期 Open to Team 信号、资料完整度和 Team Up 请求。">
      {loading ? <LoadingState /> : <ErrorBox message={error} />}
      {!loading && !me?.user ? (
        <EmptyState title="还没有登录" body="请先使用学校邮箱完成验证登录，再进入 TEAMAKING 的学生端。" />
      ) : null}
      {me?.user ? (
        <div className="grid gap-5">
          <div className="grid gap-5 md:grid-cols-3">
            <Card>
              <p className="text-sm text-ink/58">Profile completion</p>
              <p className="mt-2 text-3xl font-semibold text-ink">{me.user.onboardingCompleted ? "80%" : "35%"}</p>
              <p className="mt-2 text-sm text-ink/62">完善 portfolio 和联系方式后，协作信号会更可信。</p>
            </Card>
            <Card>
              <p className="text-sm text-ink/58">TeamUp Interest reminders</p>
              <p className="mt-2 text-3xl font-semibold text-ink">{interests?.interests?.length ?? 0}</p>
              <Link href="/team-up-requests" className="mt-3 inline-flex text-sm font-semibold text-coral">
                查看请求
              </Link>
            </Card>
            <Card>
              <p className="text-sm text-ink/58">Quick links</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link className="rounded-lg border border-ink/12 px-3 py-2 text-sm font-semibold" href="/courses">
                  加入课程板
                </Link>
                <Link className="rounded-lg border border-ink/12 px-3 py-2 text-sm font-semibold" href="/profile/me">
                  编辑 Profile
                </Link>
              </div>
            </Card>
          </div>
          <section>
            <h2 className="mb-3 text-xl font-semibold text-ink">My current Course Boards</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {currentMemberships.map((membership: any) => {
                const board = membership.board;
                const course = board?.courseOffering?.course;
                return (
                  <Link key={membership.id} href={`/boards/${board.id}`} className="border-2 border-ink bg-paper p-4 transition hover:-translate-y-0.5 hover:shadow-hard">
                    <p className="text-sm font-semibold text-coral">{course?.code}</p>
                    <h3 className="mt-1 text-lg font-semibold text-ink">{course?.title ?? board.title}</h3>
                    <p className="mt-2 text-xs text-ink/58">{membership.source?.startsWith("auto_") ? "BNBU 课程配置默认加入" : "手动加入"} · {board?.courseOffering?.semester?.name}</p>
                  </Link>
                );
              })}
              {currentMemberships.length === 0 ? <p className="text-sm text-ink/58">当前还没有加入的 Course Board。</p> : null}
            </div>
          </section>
          <section>
            <h2 className="mb-3 text-xl font-semibold text-ink">Recommended courses</h2>
            <PaginatedGrid items={recommended?.courses ?? []} render={(course) => <CourseCard key={course.id} course={course} />} />
          </section>
          {historyMemberships.length ? (
            <section>
              <h2 className="mb-3 text-xl font-semibold text-ink">Historical Course Boards</h2>
              <div className="grid gap-2">
                {historyMemberships.slice(0, 6).map((membership: any) => (
                  <Link key={membership.id} href={`/boards/${membership.board.id}`} className="border border-ink/15 bg-paper px-3 py-2 text-sm font-semibold text-ink">
                    {membership.board.courseOffering.course.code} · {membership.board.courseOffering.course.title} · {membership.board.courseOffering.semester.name}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
          <section>
            <h2 className="mb-3 text-xl font-semibold text-ink">Recent Open to Team posts</h2>
            <PaginatedGrid items={matches?.posts ?? []} render={(post) => <TeamakingPostCard key={post.id} post={post} />} />
          </section>
        </div>
      ) : null}
    </PageShell>
  );
}

function PortfolioEvidenceCard({ item, editable, onDelete, onEdit }: { item: any; editable?: boolean; onDelete?: (id: string) => void; onEdit?: (item: any) => void }) {
  const typeLabel = portfolioTypeLabels[item.type] ?? item.type ?? "作品";
  const [previewing, setPreviewing] = useState(false);
  const previewState = portfolioPreviewState(item);
  return (
    <div className="border-2 border-ink bg-paper p-4">
      <FilePreviewModal item={previewing ? item : null} onClose={() => setPreviewing(false)} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="border border-ink/30 bg-chalk px-2 py-1 text-xs font-semibold text-ink">{typeLabel}</span>
            {item.visibility ? <StatusPill status={item.visibility} /> : null}
          </div>
          <h3 className="mt-3 text-lg font-semibold text-ink">{item.title}</h3>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink/66">{item.contributionDescription || "暂无贡献说明。"}</p>
        </div>
        {editable ? (
          <div className="flex gap-2">
            {onEdit ? (
              <button type="button" onClick={() => onEdit(item)} className="focus-ring border border-ink/40 px-3 py-2 text-sm font-semibold">
                编辑
              </button>
            ) : null}
            {onDelete ? (
              <button type="button" onClick={() => onDelete(item.id)} className="focus-ring border border-ink/40 px-3 py-2 text-sm font-semibold text-rust">
                <Trash2 size={15} aria-hidden />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
        <div className="grid gap-2 text-sm text-ink/62">
          {item.myRole ? <p>我的角色：{item.myRole}</p> : null}
          {item.semesterText ? <p>时间：{item.semesterText}</p> : null}
          {item.fileName ? (
            <p>文件：{item.fileName} {formatFileSize(item.fileSize) ? `· ${formatFileSize(item.fileSize)}` : ""}</p>
          ) : previewState.hasStoredFile ? (
            <p>文件：已上传文件 {formatFileSize(item.fileSize) ? `· ${formatFileSize(item.fileSize)}` : ""}</p>
          ) : (
            <p className="text-ink/46">文件：暂无上传文件{editable ? "，点击编辑可补传。" : "。"}</p>
          )}
        </div>
        <div className="flex flex-wrap items-start gap-2">
          {previewState.hasPreview ? (
            <button type="button" onClick={() => setPreviewing(true)} className="inline-flex items-center gap-1 border border-ink/40 px-2 py-1 text-xs font-semibold">
              {previewIcon(item.previewKind)}
              预览
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 border border-ink/20 bg-chalk px-2 py-1 text-xs font-semibold text-ink/46">
              <FileText size={13} aria-hidden />
              暂无文件预览
            </span>
          )}
          {item.externalUrl ? (
            <a href={item.externalUrl} target="_blank" className="inline-flex items-center gap-1 border border-ink/40 px-2 py-1 text-xs font-semibold" rel="noreferrer">
              <LinkIcon size={13} aria-hidden />
              外部链接
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ProfileEditorPage() {
  const { data, error, loading } = useApi("/api/profile/me");
  const { data: onboarding } = useApi("/api/onboarding");
  const [saved, setSaved] = useState("");
  const [uploading, setUploading] = useState("");
  const [portfolioItems, setPortfolioItems] = useState<any[]>([]);
  const [workOwnershipFilter, setWorkOwnershipFilter] = useState("all");
  const [workTypeFilter, setWorkTypeFilter] = useState("all");
  const [form, setForm] = useState({
    displayName: "",
    nickname: "",
    headline: "",
    bio: "",
    grade: "Year 2",
    entryYear: defaultEntryYear,
    entryTerm: "Fall",
    facultyId: "",
    majorId: "",
    avatarUrl: "",
    backgroundImageUrl: "",
    outputTagsText: "research brief, slides, prototype",
    openToBeDiscovered: true,
    skillsText: "academic writing, research",
    resumeUrl: "",
    resumeFileName: "",
    resumeParsedData: {} as Record<string, unknown>
  });
  const [contact, setContact] = useState<any>({
    schoolEmail: "",
    wechatId: "",
    wechatQrImageUrl: "",
    linkedinUrl: "",
    personalEmail: "",
    visibilitySettings: defaultContactVisibility
  });
  const [portfolioForm, setPortfolioForm] = useState<any>({
    title: "",
    type: "portfolio",
    myRole: "",
    semesterText: "",
    contributionDescription: "",
    outcome: "",
    reflection: "",
    externalUrl: "",
    visibility: "same_school",
    isGroupWork: false,
    isPinned: false,
    fileName: "",
    fileMimeType: "",
    fileSize: 0,
    fileExtension: "",
    storageKey: "",
    fileUrl: "",
    previewKind: "link",
    parsedText: "",
    metadata: {}
  });
  const [editingPortfolioId, setEditingPortfolioId] = useState("");
  const academicLock = data?.user?.profile?.academicLock ?? onboarding?.academicLock;
  const profileFaculties = useMemo(() => onboarding?.faculties ?? [], [onboarding?.faculties]);
  const profileMajors = useMemo(() => onboarding?.majors ?? [], [onboarding?.majors]);
  const filteredProfileMajors = useMemo(() => majorsForFaculty(profileMajors, form.facultyId), [profileMajors, form.facultyId]);

  function resetPortfolioForm() {
    setEditingPortfolioId("");
    setPortfolioForm({
      title: "",
      type: "portfolio",
      myRole: "",
      semesterText: "",
      contributionDescription: "",
      outcome: "",
      reflection: "",
      externalUrl: "",
      visibility: "same_school",
      isGroupWork: false,
      isPinned: false,
      fileName: "",
      fileMimeType: "",
      fileSize: 0,
      fileExtension: "",
      storageKey: "",
      fileUrl: "",
      previewKind: "link",
      parsedText: "",
      metadata: {}
    });
  }

  useEffect(() => {
    if (data?.user) {
      const profile = data.user.profile;
      const academicSelection = normalizeAcademicSelection(
        onboarding?.faculties ?? [],
        onboarding?.majors ?? [],
        profile?.facultyId,
        profile?.majorId
      );
      setForm({
        displayName: profile?.displayName ?? "",
        nickname: profile?.nickname ?? "",
        headline: profile?.headline ?? "",
        bio: profile?.bio ?? "",
        grade: profile?.grade ?? "Year 2",
        entryYear: profile?.entryYear ?? defaultEntryYear,
        entryTerm: profile?.entryTerm ?? "Fall",
        facultyId: academicSelection.facultyId,
        majorId: academicSelection.majorId,
        avatarUrl: profile?.avatarUrl ?? "",
        backgroundImageUrl: profile?.backgroundImageUrl ?? "",
        outputTagsText: tagsToText(profile?.outputTags),
        openToBeDiscovered: profile?.openToBeDiscovered ?? true,
        skillsText: (data.user.skills ?? []).map((item: any) => item.skill.name).join(", "),
        resumeUrl: profile?.resumeUrl ?? "",
        resumeFileName: profile?.resumeFileName ?? "",
        resumeParsedData: profile?.resumeParsedData ?? {}
      });
    }
    if (data?.portfolioItems) setPortfolioItems(data.portfolioItems);
    if (data?.contactInfo) {
      setContact({
        ...data.contactInfo,
        visibilitySettings: {
          ...defaultContactVisibility,
          ...(data.contactInfo.visibilitySettings ?? {})
        }
      });
    } else if (data?.user?.email) {
      setContact((current: any) => ({ ...current, schoolEmail: data.user.email }));
    }
  }, [data, onboarding]);

  async function uploadAndApply(file: File | undefined, purpose: string, apply: (upload: any) => void) {
    if (!file) return;
    setUploading(purpose);
    setSaved("");
    try {
      const upload = await uploadProfileFile(file, purpose);
      apply(upload);
      setSaved("文件已上传，点击保存后会写入 Profile 数据。");
    } catch (err) {
      setSaved(err instanceof Error ? err.message : "上传失败。");
    } finally {
      setUploading("");
    }
  }

  async function reparseResume() {
    if (!form.resumeUrl) {
      setSaved("请先上传或填写简历 URL。");
      return;
    }
    setUploading("resume-reparse");
    setSaved("");
    try {
      const result = await api("/api/profile/me/reparse-resume", { method: "POST" });
      setForm((current) => ({
        ...current,
        resumeParsedData: result.resumeParsedData ?? current.resumeParsedData
      }));
      setSaved(result.message ?? "简历已重新整理。");
    } catch (err) {
      setSaved(err instanceof Error ? err.message : "简历重新整理失败。");
    } finally {
      setUploading("");
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaved("");
    await api("/api/profile/me", {
      method: "PATCH",
      body: JSON.stringify({
        displayName: form.displayName,
        nickname: form.nickname,
        headline: form.headline,
        bio: form.bio,
        grade: form.grade,
        entryYear: form.entryYear,
        entryTerm: form.entryTerm,
        facultyId: form.facultyId,
        majorId: form.majorId,
        avatarUrl: form.avatarUrl,
        backgroundImageUrl: form.backgroundImageUrl,
        outputTags: tagsFromText(form.outputTagsText),
        openToBeDiscovered: form.openToBeDiscovered,
        resumeUrl: form.resumeUrl,
        resumeFileName: form.resumeFileName,
        resumeParsedData: form.resumeParsedData,
        contactInfo: contact,
        skills: tagsFromText(form.skillsText)
      })
    });
    setSaved("个人资料、联系方式、头像/背景、简历解析信息已保存。");
  }

  async function createPortfolioItem(event: FormEvent) {
    event.preventDefault();
    setSaved("");
    const sameHonorTypeCount = portfolioItems.filter((item) => item.type === portfolioForm.type).length;
    const pinnedCount = portfolioItems.filter((item) => item.isPinned).length;
    if (!editingPortfolioId && isHonorItem(portfolioForm) && sameHonorTypeCount >= 3) {
      setSaved("语言成绩、GPA、奖项/认证每类最多上传 3 个。");
      return;
    }
    if (!editingPortfolioId && portfolioForm.isPinned && pinnedCount >= 3) {
      setSaved("每个用户最多置顶 3 个过往成果。");
      return;
    }
    const endpoint = editingPortfolioId ? `/api/profile/me/portfolio-items/${editingPortfolioId}` : "/api/profile/me/portfolio-items";
    const result = await api(endpoint, {
      method: editingPortfolioId ? "PATCH" : "POST",
      body: JSON.stringify({
        ...portfolioForm,
        metadata: {
          ...(portfolioForm.metadata ?? {}),
          createdFrom: "profile_editor"
        }
      })
    });
    setSaved(editingPortfolioId ? "作品/证明材料已更新。" : "作品/证明材料已保存。");
    resetPortfolioForm();
    if (result?.portfolioItem) {
      setPortfolioItems((current) =>
        editingPortfolioId
          ? current.map((item) => (item.id === result.portfolioItem.id ? result.portfolioItem : item))
          : [result.portfolioItem, ...current]
      );
    }
  }

  function editPortfolioItem(item: any) {
    setEditingPortfolioId(item.id);
    setPortfolioForm({
      title: item.title ?? "",
      type: item.type === "career_certification" || item.type === "resume" ? "skill_certification" : item.type ?? "portfolio",
      myRole: item.myRole ?? "",
      semesterText: item.semesterText ?? "",
      contributionDescription: item.contributionDescription ?? "",
      outcome: item.outcome ?? "",
      reflection: item.reflection ?? "",
      externalUrl: item.externalUrl ?? "",
      visibility: item.visibility ?? "same_school",
      isGroupWork: Boolean(item.isGroupWork),
      isPinned: Boolean(item.isPinned),
      fileName: item.fileName ?? "",
      fileMimeType: item.fileMimeType ?? "",
      fileSize: item.fileSize ?? 0,
      fileExtension: item.fileExtension ?? "",
      storageKey: item.storageKey ?? "",
      fileUrl: item.fileUrl ?? "",
      previewKind: item.previewKind ?? "link",
      parsedText: item.parsedText ?? "",
      metadata: item.metadata ?? {}
    });
    setSaved("正在编辑已有作品；修改后点击保存。");
  }

  async function deletePortfolioItem(id: string) {
    await api(`/api/profile/me/portfolio-items/${id}`, { method: "DELETE" });
    setPortfolioItems((current) => current.filter((item) => item.id !== id));
    setSaved("作品/证明材料已删除。");
  }

  return (
    <PageShell title="Proof-of-Work Profile" eyebrow="Profile" description="编辑个人展示页：联系方式、头像背景、技能标签、作品证明、GPA 截图、证书和简历解析都在这里维护。">
      {loading ? <LoadingState /> : <ErrorBox message={error} />}
      {data ? (
        <div className="grid gap-5">
          <Card className="p-0">
            <div
              className="min-h-[170px] border-b-2 border-ink bg-mist p-5"
              style={form.backgroundImageUrl ? { backgroundImage: `linear-gradient(90deg, rgba(248,246,239,.78) 0%, rgba(248,246,239,.42) 48%, rgba(248,246,239,.16) 100%), url(${form.backgroundImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
            >
              <div className="flex flex-wrap items-end gap-4">
                <div className="grid h-24 w-24 place-items-center overflow-hidden border-2 border-ink bg-chalk">
                  {form.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.avatarUrl} alt="avatar preview" className="h-full w-full object-cover" />
                  ) : (
                    <UserRound size={34} aria-hidden className="text-ink/55" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-rust">Profile preview</p>
                  <h2 className="mt-1 text-3xl font-semibold text-ink">{form.displayName || "未命名用户"}</h2>
                  <p className="mt-2 text-sm text-ink/68">{form.nickname || "可填写昵称"} · {form.headline || "可填写一句个人定位"}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {tagsFromText(form.outputTagsText).map((tag) => <SkillBadge key={tag}>{tag}</SkillBadge>)}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <form onSubmit={submit} className="grid gap-5">
            <Card>
              <h2 className="text-xl font-semibold text-ink">基础展示信息</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label="显示名称">
                  <input className={inputClass} value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} />
                </Field>
                <Field label="昵称 / 别名">
                  <input className={inputClass} value={form.nickname} onChange={(event) => setForm({ ...form, nickname: event.target.value })} placeholder="例如 Mia / slides person" />
                </Field>
                <Field label="一句话定位">
                  <input className={inputClass} value={form.headline} onChange={(event) => setForm({ ...form, headline: event.target.value })} placeholder="例如 Research and presentation collaborator" />
                </Field>
                <Field label="头像 URL / 上传后自动填入">
                  <div className="grid gap-2">
                    <input className={inputClass} value={form.avatarUrl} onChange={(event) => setForm({ ...form, avatarUrl: event.target.value })} />
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg,.webp,.gif,.svg"
                      onChange={(event) => uploadAndApply(event.target.files?.[0], "avatar", (upload) => setForm((current) => ({ ...current, avatarUrl: upload.fileUrl })))}
                    />
                  </div>
                </Field>
                <Field label="主页背景 URL / 上传后自动填入">
                  <div className="grid gap-2">
                    <input className={inputClass} value={form.backgroundImageUrl} onChange={(event) => setForm({ ...form, backgroundImageUrl: event.target.value })} />
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg,.webp,.gif,.svg"
                      onChange={(event) => uploadAndApply(event.target.files?.[0], "background", (upload) => setForm((current) => ({ ...current, backgroundImageUrl: upload.fileUrl })))}
                    />
                  </div>
                </Field>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-5">
                <Field label="年级" help={academicLock?.locked ? "根据学校邮箱自动推断，普通用户不可手动修改；特殊情况请提交工单。" : undefined}>
                  <input className={inputClass} value={form.grade} readOnly={Boolean(academicLock?.locked)} onChange={(event) => setForm({ ...form, grade: event.target.value })} />
                </Field>
                <Field label="入学年份">
                  <input className={inputClass} type="number" value={form.entryYear} readOnly={Boolean(academicLock?.locked)} onChange={(event) => setForm({ ...form, entryYear: Number(event.target.value) })} />
                </Field>
                <Field label="入学学期">
                  <select className={inputClass} value={form.entryTerm} disabled={Boolean(academicLock?.locked)} onChange={(event) => setForm({ ...form, entryTerm: event.target.value })}>
                    {entryTermOptions.map((term) => <option key={term}>{term}</option>)}
                  </select>
                </Field>
                <Field label="Faculty">
                  <select
                    className={inputClass}
                    value={form.facultyId}
                    onChange={(event) => setForm({ ...form, ...normalizeAcademicSelection(profileFaculties, profileMajors, event.target.value, null) })}
                  >
                    {profileFaculties.map((faculty: any) => <option key={faculty.id} value={faculty.id}>{faculty.name}</option>)}
                  </select>
                </Field>
                <Field label="Major">
                  <select className={inputClass} value={form.majorId} onChange={(event) => setForm({ ...form, majorId: event.target.value })} disabled={filteredProfileMajors.length === 0}>
                    {filteredProfileMajors.length === 0 ? <option value="">请先选择 Faculty</option> : null}
                    {filteredProfileMajors.map((major: any) => <option key={major.id} value={major.id}>{major.name}</option>)}
                  </select>
                </Field>
              </div>
              <div className="mt-4">
                <OfficialAcademicLinks links={data.officialLinks} compact />
              </div>
              <div className="mt-4 grid gap-4">
                <Field label="个人简介">
                  <textarea className={inputClass} rows={4} value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} />
                </Field>
                <Field label="技能标签，用英文逗号分隔" help="例如 academic writing, PPT design, data analysis">
                  <input className={inputClass} value={form.skillsText} onChange={(event) => setForm({ ...form, skillsText: event.target.value })} />
                </Field>
                <Field label="擅长产出领域 Tag，用英文逗号分隔" help="例如 research brief, slides, prototype, interview notes">
                  <input className={inputClass} value={form.outputTagsText} onChange={(event) => setForm({ ...form, outputTagsText: event.target.value })} />
                </Field>
              </div>
            </Card>

            <Card>
              <h2 className="text-xl font-semibold text-ink">联系方式与可见性</h2>
              <p className="mt-2 text-sm leading-6 text-ink/62">学校邮箱来自登录邮箱，默认展示为身份凭证，不允许前端编辑；微信、二维码、LinkedIn、个人邮箱都可以选择性填写。</p>
              <div className="mt-4 grid gap-3">
                <Field label="学校邮箱（只读，默认展示）">
                  <input className={`${inputClass} bg-ink/5`} value={contact.schoolEmail || data.user.email} readOnly />
                </Field>
                {[
                  ["wechatId", "WeChat ID"],
                  ["wechatQrImageUrl", "WeChat QR 图片 URL"],
                  ["linkedinUrl", "LinkedIn / 个人主页"],
                  ["personalEmail", "个人邮箱"]
                ].map(([key, label]) => (
                  <div key={key} className="grid gap-3 border border-ink/25 bg-paper p-3 md:grid-cols-[1fr_220px]">
                    <Field label={label}>
                      <div className="grid gap-2">
                        <input className={inputClass} value={contact[key] ?? ""} onChange={(event) => setContact({ ...contact, [key]: event.target.value })} />
                        {key === "wechatQrImageUrl" ? (
                          <input
                            type="file"
                            accept=".png,.jpg,.jpeg,.webp,.gif"
                            onChange={(event) => uploadAndApply(event.target.files?.[0], "contact_qr", (upload) => setContact((current: any) => ({ ...current, wechatQrImageUrl: upload.fileUrl })))}
                          />
                        ) : null}
                      </div>
                    </Field>
                    <Field label="可见范围">
                      <select
                        className={inputClass}
                        value={contact.visibilitySettings?.[key] ?? defaultContactVisibility[key as keyof typeof defaultContactVisibility]}
                        onChange={(event) => setContact({ ...contact, visibilitySettings: { ...contact.visibilitySettings, [key]: event.target.value } })}
                      >
                        {contactVisibilityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </Field>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <h2 className="text-xl font-semibold text-ink">简历上传与解析</h2>
              <p className="mt-2 text-sm leading-6 text-ink/62">当前本地解析支持 txt / md / 代码、PDF、Word、PPT、Excel/CSV 等文本提取；旧 Office、加密文件或扫描件解析失败时会保存文件并显示原因。</p>
              <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr]">
                <Field label="简历 URL">
                  <input className={inputClass} value={form.resumeUrl} onChange={(event) => setForm({ ...form, resumeUrl: event.target.value })} />
                </Field>
                <Field label="上传简历">
                  <input
                    type="file"
                    accept={acceptedProfileFiles}
                    onChange={(event) =>
                      uploadAndApply(event.target.files?.[0], "resume", (upload) =>
                        setForm((current) => ({
                          ...current,
                          resumeUrl: upload.fileUrl,
                          resumeFileName: upload.fileName,
                          resumeParsedData: upload.resumeParsedData ?? {}
                        }))
                      )
                    }
                  />
                </Field>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="focus-ring inline-flex items-center gap-2 rounded-sm border border-ink/30 px-3 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={!form.resumeUrl || uploading === "resume-reparse"}
                  onClick={reparseResume}
                >
                  <FileText size={16} aria-hidden />
                  {uploading === "resume-reparse" ? "正在整理..." : "重新整理当前简历"}
                </button>
                <p className="text-sm leading-6 text-ink/56">已有简历也可以直接重新解析，生成摘要、分区和关键词。</p>
              </div>
              {renderResumeParsedData(form.resumeParsedData, form.resumeFileName)}
            </Card>

            <label className="flex items-center gap-2 text-sm font-semibold text-ink">
              <input type="checkbox" checked={form.openToBeDiscovered} onChange={(event) => setForm({ ...form, openToBeDiscovered: event.target.checked })} />
              允许同校用户在 discovery 中看到我
            </label>
            <button type="submit" className="focus-ring inline-flex w-fit items-center gap-2 rounded-sm bg-ink px-4 py-2 font-semibold text-paper">
              <Check size={16} aria-hidden />
              保存 Profile 与联系方式
            </button>
          </form>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-ink">{editingPortfolioId ? "编辑作品 / 证明材料" : "新增作品 / 证明材料"}</h2>
              {editingPortfolioId ? (
                <button type="button" onClick={resetPortfolioForm} className="border border-ink/30 px-3 py-2 text-sm font-semibold">
                  取消编辑
                </button>
              ) : null}
            </div>
            <p className="mt-2 text-sm leading-6 text-ink/62">兼容 md、Word、表格、PDF、PPT、图像、音频、设计稿、代码等主流文件后缀；GPA 截图、获奖证书、技能/职业认证也作为证明材料管理。</p>
            <form onSubmit={createPortfolioItem} className="mt-4 grid gap-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="标题">
                  <input className={inputClass} value={portfolioForm.title} onChange={(event) => setPortfolioForm({ ...portfolioForm, title: event.target.value })} />
                </Field>
                <Field label="类型">
                  <select className={inputClass} value={portfolioForm.type} onChange={(event) => setPortfolioForm({ ...portfolioForm, type: event.target.value })}>
                    {portfolioTypes.map((type) => <option key={type} value={type}>{portfolioTypeLabels[type]}</option>)}
                  </select>
                </Field>
                <Field label="可见范围">
                  <select className={inputClass} value={portfolioForm.visibility} onChange={(event) => setPortfolioForm({ ...portfolioForm, visibility: event.target.value })}>
                    <option value="private">仅自己</option>
                    <option value="same_school">同校可见</option>
                    <option value="same_course_board">同课程板可见</option>
                    <option value="public">公开</option>
                  </select>
                </Field>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="我的角色">
                  <input className={inputClass} value={portfolioForm.myRole} onChange={(event) => setPortfolioForm({ ...portfolioForm, myRole: event.target.value })} />
                </Field>
                <Field label="学期 / 时间">
                  <input className={inputClass} value={portfolioForm.semesterText} onChange={(event) => setPortfolioForm({ ...portfolioForm, semesterText: event.target.value })} />
                </Field>
                <Field label="外部链接（可选）">
                  <input className={inputClass} value={portfolioForm.externalUrl} onChange={(event) => setPortfolioForm({ ...portfolioForm, externalUrl: event.target.value })} />
                </Field>
              </div>
              <Field label="上传文件">
                <input
                  type="file"
                  accept={acceptedProfileFiles}
                  onChange={(event) =>
                    uploadAndApply(event.target.files?.[0], portfolioForm.type, (upload) =>
                      setPortfolioForm((current: any) => ({
                        ...current,
                        ...upload,
                        title: current.title || upload.fileName,
                        metadata: { ...(current.metadata ?? {}), resumeParsedData: upload.resumeParsedData }
                      }))
                    )
                  }
                />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="贡献说明">
                  <textarea className={inputClass} rows={4} value={portfolioForm.contributionDescription} onChange={(event) => setPortfolioForm({ ...portfolioForm, contributionDescription: event.target.value })} />
                </Field>
                <Field label="结果 / 复盘">
                  <textarea className={inputClass} rows={4} value={`${portfolioForm.outcome}${portfolioForm.outcome && portfolioForm.reflection ? "\n" : ""}${portfolioForm.reflection}`} onChange={(event) => {
                    const [outcome = "", ...rest] = event.target.value.split("\n");
                    setPortfolioForm({ ...portfolioForm, outcome, reflection: rest.join("\n") });
                  }} />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                <input type="checkbox" checked={portfolioForm.isGroupWork} onChange={(event) => setPortfolioForm({ ...portfolioForm, isGroupWork: event.target.checked })} />
                这是小组作品
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                <input type="checkbox" checked={portfolioForm.isPinned} onChange={(event) => setPortfolioForm({ ...portfolioForm, isPinned: event.target.checked })} />
                置顶展示（最多 3 个）
              </label>
              {portfolioForm.fileName ? <PortfolioEvidenceCard item={portfolioForm} /> : null}
              <button className="focus-ring inline-flex w-fit items-center gap-2 rounded-sm bg-rust px-4 py-2 font-semibold text-paper">
                <Plus size={16} aria-hidden />
                {editingPortfolioId ? "更新作品 / 证明" : "保存作品 / 证明"}
              </button>
            </form>
          </Card>

          <Card>
            <h2 className="text-xl font-semibold text-ink">已保存的作品与证明</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {["all", "individual", "group"].map((value) => (
                <button key={value} type="button" onClick={() => setWorkOwnershipFilter(value)} className={`border px-3 py-2 text-sm font-semibold ${workOwnershipFilter === value ? "border-ink bg-ink text-paper" : "border-ink/30 bg-paper"}`}>
                  {value === "all" ? "全部" : value === "individual" ? "个人作品" : "小组成果"}
                </button>
              ))}
              {["all", "slides", "report", "code", "design", "other"].map((value) => (
                <button key={value} type="button" onClick={() => setWorkTypeFilter(value)} className={`border px-3 py-2 text-sm font-semibold ${workTypeFilter === value ? "border-rust bg-rust text-paper" : "border-ink/30 bg-paper"}`}>
                  {value === "all" ? "全部类型" : value}
                </button>
              ))}
            </div>
            {(() => {
              const pinned = portfolioItems.filter((item) => item.isPinned).slice(0, 3);
              const filteredPaperwork = portfolioItems.filter((item) => {
                const ownershipOk = workOwnershipFilter === "all" || (workOwnershipFilter === "group" ? item.isGroupWork : !item.isGroupWork);
                const typeOk = workTypeFilter === "all" || fileFamily(item) === workTypeFilter;
                return portfolioEvidenceSections[0].matches(item) && ownershipOk && typeOk;
              });
              return (
                <div className="mt-5 grid gap-6">
                  <section>
                    <h3 className="mb-3 text-lg font-semibold text-ink">置顶成果</h3>
                    {pinned.length > 0 ? <PaginatedGrid items={pinned} pageSize={3} render={(item) => <PortfolioEvidenceCard key={item.id} item={item} editable onDelete={deletePortfolioItem} onEdit={editPortfolioItem} />} /> : <EmptyState title="还没有置顶成果" body="勾选置顶展示后，会优先显示最多三个作品。" />}
                  </section>
                  <PortfolioEvidenceSection section={portfolioEvidenceSections[0]} items={filteredPaperwork} editable onDelete={deletePortfolioItem} onEdit={editPortfolioItem} />
                  {portfolioEvidenceSections.slice(1).map((section) => (
                    <PortfolioEvidenceSection key={section.key} section={section} items={portfolioItems.filter(section.matches)} editable onDelete={deletePortfolioItem} onEdit={editPortfolioItem} />
                  ))}
                </div>
              );
            })()}
          </Card>

          {uploading ? <p className="text-sm font-medium text-rust">正在上传：{uploading}</p> : null}
          {saved ? <p className="border border-ink/20 bg-paper px-3 py-2 text-sm font-medium text-forest">{saved}</p> : null}
        </div>
      ) : null}
    </PageShell>
  );
}

export function PublicProfilePage({ userId }: { userId: string }) {
  const { data, error, loading } = useApi(`/api/profile/${userId}`);
  const [followMessage, setFollowMessage] = useState("");
  const [copiedContact, setCopiedContact] = useState("");
  const profile = data?.user?.profile;
  const contact = data?.contactInfo ?? data?.user?.contactInfo ?? {};
  const profileTags = uniqueTextList([
    ...(Array.isArray(profile?.outputTags) ? profile.outputTags : []),
    ...((data?.user?.skills ?? []).map((item: any) => item.skill?.name ?? item.name).filter(Boolean))
  ]);

  async function copyContactValue(key: string, value: string) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopiedContact(key);
    window.setTimeout(() => setCopiedContact((current) => (current === key ? "" : current)), 1600);
  }

  function ContactRow({ itemKey, label, value }: { itemKey: string; label: string; value?: string | null }) {
    if (!value) return null;
    return (
      <div className="flex flex-wrap items-start justify-between gap-3 py-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/48">{label}</p>
          <p className="mt-1 break-all text-sm leading-6 text-ink/78">{value}</p>
        </div>
        <button
          type="button"
          className="focus-ring inline-flex shrink-0 items-center gap-2 rounded-sm border border-ink/25 px-3 py-1.5 text-xs font-semibold text-ink"
          onClick={() => copyContactValue(itemKey, value)}
        >
          {copiedContact === itemKey ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
          {copiedContact === itemKey ? "已复制" : "复制"}
        </button>
      </div>
    );
  }

  async function follow() {
    const result = await api(`/api/profile/${userId}/follow-request`, { method: "POST" });
    setFollowMessage(result.existing ? "关注申请已存在。" : "关注申请已发送。");
  }

  return (
    <PageShell title={profile?.displayName ?? "用户 Profile"} eyebrow="Proof-of-Work Profile" description="同校已验证用户可以查看对方允许展示的基础资料、联系方式和作品证明。">
      {loading ? <LoadingState /> : <ErrorBox message={error} />}
      {data?.user ? (
        <div className="grid gap-5">
          <Card>
            <div
              className="min-h-[180px] border-2 border-ink bg-mist p-5"
              style={profile?.backgroundImageUrl ? { backgroundImage: `linear-gradient(90deg, rgba(248,246,239,.78) 0%, rgba(248,246,239,.42) 48%, rgba(248,246,239,.16) 100%), url(${profile.backgroundImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
            >
              <div className="flex flex-wrap items-end gap-4">
                <div className="grid h-24 w-24 place-items-center overflow-hidden border-2 border-ink bg-chalk">
                  {profile?.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.avatarUrl} alt={profile.displayName} className="h-full w-full object-cover" />
                  ) : (
                    <UserRound size={34} aria-hidden />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-rust">{profile?.nickname || data.user.email}</p>
                  <h2 className="mt-1 text-3xl font-semibold text-ink">{profile?.displayName}</h2>
                  <p className="mt-2 text-sm text-ink/68">{profile?.grade ?? "未填写年级"} · {profile?.major?.name ?? "未填写专业"}</p>
                  {profile?.headline ? <p className="mt-1 text-sm text-ink/68">{profile.headline}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {profileTags.map((tag: string) => <SkillBadge key={tag}>{tag}</SkillBadge>)}
                  </div>
                </div>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-ink/68">{profile?.bio}</p>
            <button type="button" onClick={follow} className="focus-ring mt-4 rounded-sm bg-rust px-4 py-2 text-sm font-semibold text-paper">
              申请关注
            </button>
            {followMessage ? <p className="mt-2 text-sm font-medium text-moss">{followMessage}</p> : null}
          </Card>
          <Card>
            <h2 className="text-xl font-semibold text-ink">联系方式</h2>
            <div className="mt-4 divide-y divide-ink/12 border-y border-ink/12">
              <ContactRow itemKey="schoolEmail" label="学校邮箱" value={contact.schoolEmail ?? data.user.email} />
              <ContactRow itemKey="wechatId" label="WeChat" value={contact.wechatId} />
              <ContactRow itemKey="linkedinUrl" label="LinkedIn / 主页" value={contact.linkedinUrl} />
              <ContactRow itemKey="personalEmail" label="个人邮箱" value={contact.personalEmail} />
              {contact.wechatQrImageUrl ? (
                <div className="py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink/48">WeChat QR</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={contact.wechatQrImageUrl} alt="WeChat QR" className="mt-3 h-32 w-32 border border-ink/30 object-cover" />
                </div>
              ) : null}
            </div>
          </Card>
          <Card>
            <h2 className="text-xl font-semibold text-ink">Portfolio evidence</h2>
            {(() => {
              const portfolioItems = data.portfolioItems ?? [];
              const pinned = portfolioItems.filter((item: any) => item.isPinned).slice(0, 3);
              return (
                <div className="mt-4 grid gap-6">
                  {pinned.length > 0 ? (
                    <section>
                      <h3 className="mb-3 text-lg font-semibold text-ink">Pinned Work</h3>
                      <PaginatedGrid items={pinned} pageSize={3} render={(item) => <PortfolioEvidenceCard key={item.id} item={item} />} />
                    </section>
                  ) : null}
                  {portfolioEvidenceSections.map((section) => (
                    <PortfolioEvidenceSection key={section.key} section={section} items={portfolioItems.filter(section.matches)} />
                  ))}
                </div>
              );
            })()}
          </Card>
        </div>
      ) : null}
    </PageShell>
  );
}

export function ContactInfoPage() {
  const { data, error, loading } = useApi("/api/contact-info/me");
  const [saved, setSaved] = useState("");
  const [form, setForm] = useState<any>({
    schoolEmail: "",
    wechatId: "",
    wechatQrImageUrl: "",
    linkedinUrl: "",
    personalEmail: "",
    visibilitySettings: defaultContactVisibility
  });

  useEffect(() => {
    if (data?.contactInfo) {
      setForm({
        ...data.contactInfo,
        visibilitySettings: {
          ...defaultContactVisibility,
          ...(data.contactInfo.visibilitySettings ?? {})
        }
      });
    }
  }, [data]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    await api("/api/contact-info/me", { method: "PATCH", body: JSON.stringify(form) });
    setSaved("联系方式已保存。schoolEmail 始终来自登录邮箱，不会被前端修改。");
  }

  return (
    <PageShell title="Contact Info" eyebrow="Visibility Settings" description="联系方式可以按可见范围展示。学校邮箱只读，用来证明身份真实性。">
      {loading ? <LoadingState /> : <ErrorBox message={error} />}
      {data ? (
        <Card>
          <form onSubmit={submit} className="grid gap-4">
            <Field label="学校邮箱（只读）">
              <input className={`${inputClass} bg-ink/5`} value={form.schoolEmail ?? ""} readOnly />
            </Field>
            {[
              ["wechatId", "WeChat ID"],
              ["wechatQrImageUrl", "WeChat QR placeholder URL"],
              ["linkedinUrl", "LinkedIn URL"],
              ["personalEmail", "Personal Email"]
            ].map(([key, label]) => (
              <div key={key} className="grid gap-3 rounded-lg border border-ink/10 p-4 md:grid-cols-[1fr_240px]">
                <Field label={label}>
                  <input className={inputClass} value={form[key] ?? ""} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
                </Field>
                <Field label="可见范围">
                  <select
                    className={inputClass}
                    value={form.visibilitySettings?.[key] ?? defaultContactVisibility[key as keyof typeof defaultContactVisibility]}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        visibilitySettings: { ...form.visibilitySettings, [key]: event.target.value }
                      })
                    }
                  >
                    {contactVisibilityOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            ))}
            <button type="submit" className="focus-ring inline-flex w-fit items-center gap-2 rounded-lg bg-coral px-4 py-2 font-semibold text-white">
              <Check size={16} aria-hidden />
              保存联系方式
            </button>
            {saved ? <p className="text-sm font-medium text-moss">{saved}</p> : null}
          </form>
        </Card>
      ) : null}
    </PageShell>
  );
}

export function SupportPage() {
  const { data: me } = useApi("/api/auth/me");
  const [form, setForm] = useState({
    email: "",
    category: "missing_course",
    title: "",
    description: "",
    relatedUrl: ""
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const { data: mine, loading: mineLoading } = useApi(me?.user ? "/api/support-tickets/mine" : null, [me?.user?.id, refreshKey]);

  useEffect(() => {
    if (me?.user?.email) setForm((current) => ({ ...current, email: me.user.email }));
  }, [me]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");
    const result = await api("/api/support-tickets", { method: "POST", body: JSON.stringify(form) }).catch((err: Error) => {
      setError(err.message);
      return null;
    });
    if (result) {
      setMessage("工单已提交。管理员会在后台查看并处理。");
      setForm({ email: me?.user?.email ?? "", category: "missing_course", title: "", description: "", relatedUrl: "" });
      setRefreshKey((value) => value + 1);
    }
  }

  return (
    <PageShell title="Support Ticket" eyebrow="Admin contact" description="缺失课程、bug、报错、后台需求都走工单。这个入口替代原来的课程提交审核机制。" aside="none">
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <h2 className="text-xl font-semibold text-ink">可以提交什么</h2>
          <div className="mt-4 grid gap-3 text-sm leading-6 text-ink/68">
            <p>缺失课程：写清课程代码、课程名、学期或老师。</p>
            <p>bug / 报错：写清你在哪个页面、点了什么、看到什么错误。</p>
            <p>后台需求：写清希望管理员改什么数据或配置。</p>
            <p>开发者联系方式会由管理员在 Site Config 中维护。</p>
          </div>
        </Card>
        <Card>
          <form onSubmit={submit} className="grid gap-4">
            <Field label="联系邮箱">
              <input className={inputClass} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="可选，但建议填写" />
            </Field>
            <Field label="工单类型">
              <select className={inputClass} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
                <option value="missing_course">缺失课程</option>
                <option value="course_config_error">课程配置错误</option>
                <option value="bug">Bug</option>
                <option value="error_report">报错</option>
                <option value="admin_request">后台需求</option>
                <option value="other">其他</option>
              </select>
            </Field>
            <Field label="标题">
              <input className={inputClass} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            </Field>
            <Field label="详细说明">
              <textarea className={inputClass} rows={6} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            </Field>
            <Field label="相关页面 URL（可选）">
              <input className={inputClass} value={form.relatedUrl} onChange={(event) => setForm({ ...form, relatedUrl: event.target.value })} placeholder="/courses 或错误页面地址" />
            </Field>
            <button className="focus-ring inline-flex w-fit items-center gap-2 rounded-sm bg-ink px-4 py-2 font-semibold text-paper">
              <Send size={16} aria-hidden />
              提交工单
            </button>
          </form>
          <ErrorBox message={error} />
          {message ? <p className="mt-3 border border-ink/20 bg-paper px-3 py-2 text-sm font-medium text-forest">{message}</p> : null}
        </Card>
      </div>
      {me?.user ? (
        <div className="mt-5">
          <Card>
            <h2 className="text-xl font-semibold text-ink">我的工单</h2>
            {mineLoading ? <p className="mt-3 text-sm text-ink/56">正在读取...</p> : null}
            <div className="mt-4 grid gap-3">
              {(mine?.tickets ?? []).length ? mine.tickets.map((ticket: any) => (
                <div key={ticket.id} className="border border-ink/15 bg-chalk p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-semibold text-ink">{ticket.title}</p>
                    <StatusPill status={ticket.status} />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-ink/62">{ticket.description}</p>
                  {ticket.adminReply ? (
                    <p className="mt-3 border border-forest/20 bg-paper px-3 py-2 text-sm leading-6 text-forest">管理员回复：{ticket.adminReply}</p>
                  ) : null}
                </div>
              )) : <p className="text-sm text-ink/56">还没有提交过工单。</p>}
            </div>
          </Card>
        </div>
      ) : null}
    </PageShell>
  );
}

export function SupportWidget() {
  const pathname = usePathname();
  const { data: me } = useApi("/api/auth/me");
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    email: "",
    category: "bug",
    title: "",
    description: ""
  });

  useEffect(() => {
    if (me?.user?.email) setForm((current) => ({ ...current, email: me.user.email }));
  }, [me]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");
    const result = await api("/api/support-tickets", { method: "POST", body: JSON.stringify(form) }).catch((err: Error) => {
      setError(err.message);
      return null;
    });
    if (result) {
      setMessage("工单已提交。");
      setForm({ email: me?.user?.email ?? "", category: "bug", title: "", description: "" });
    }
  }

  if (pathname?.startsWith("/admin") || pathname?.startsWith("/crawler")) return null;

  return (
    <div className="fixed bottom-5 right-5 z-40">
      {open ? (
        <div className="mb-3 w-[min(360px,calc(100vw-40px))] border-2 border-ink bg-paper p-4 shadow-hard">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-ink">联系管理员</h2>
            <button type="button" onClick={() => setOpen(false)} className="border border-ink/30 p-1"><X size={16} aria-hidden /></button>
          </div>
          <form onSubmit={submit} className="mt-3 grid gap-3">
            <input className={inputClass} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="联系邮箱" />
            <select className={inputClass} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
              <option value="missing_course">缺失课程</option>
              <option value="course_config_error">课程配置错误</option>
              <option value="bug">Bug</option>
              <option value="error_report">报错</option>
              <option value="admin_request">后台需求</option>
              <option value="other">其他</option>
            </select>
            <input className={inputClass} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="标题" />
            <textarea className={inputClass} rows={4} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="请描述问题或需求" />
            <button className="bg-ink px-3 py-2 text-sm font-semibold text-paper">提交工单</button>
          </form>
          <ErrorBox message={error} />
          {message ? <p className="mt-2 text-sm font-medium text-forest">{message}</p> : null}
        </div>
      ) : null}
      <button type="button" onClick={() => setOpen((value) => !value)} className="focus-ring inline-flex h-12 w-12 items-center justify-center rounded-full border-2 border-ink bg-coral text-paper shadow-hard" aria-label="提交支持工单">
        <MessageCircle size={22} aria-hidden />
      </button>
    </div>
  );
}

export function ContentDocumentsPage({ kind, title, eyebrow, description }: { kind: "help" | "developer_log" | "developer_contact"; title: string; eyebrow: string; description: string }) {
  const { data, error, loading } = useApi(`/api/content?kind=${kind}`);
  const documents = useMemo(() => data?.documents ?? [], [data?.documents]);
  const flatDocuments = useMemo(() => flattenContentDocuments(documents), [documents]);
  const [selectedDocId, setSelectedDocId] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!selectedDocId && flatDocuments.length) setSelectedDocId(flatDocuments[0].id);
  }, [flatDocuments, selectedDocId]);

  useEffect(() => {
    if (!documents.length) return;
    setExpandedIds((current) => {
      const next = new Set(current);
      documents.forEach((document: any) => next.add(document.id));
      return next;
    });
  }, [documents]);

  const selectedDocument = flatDocuments.find((document: any) => document.id === selectedDocId) ?? firstContentDocument(documents);

  return (
    <PageShell title={title} eyebrow={eyebrow} description={description}>
      {loading ? <LoadingState /> : <ErrorBox message={error} />}
      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-semibold text-ink">文档目录</h2>
            <span className="rounded-sm border border-ink/20 px-2 py-1 text-xs font-semibold text-moss">{flatDocuments.length} 项</span>
          </div>
          <ContentDocumentTree
            documents={documents}
            selectedId={selectedDocument?.id}
            expandedIds={expandedIds}
            onToggle={(id) => setExpandedIds((current) => {
              const next = new Set(current);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })}
            onSelect={(document) => setSelectedDocId(document.id)}
            selectFolders
          />
        </Card>
        <Card>
          <ContentDocumentReader document={selectedDocument} />
        </Card>
        {!loading && documents.length === 0 ? <EmptyState title="暂无内容" body="管理员发布内容后，会显示在这里。" /> : null}
      </div>
    </PageShell>
  );
}

function OfficialAcademicLinks({ links, compact = false }: { links?: any[]; compact?: boolean }) {
  const rows = links ?? [];
  if (!rows.length) return null;
  const content = (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-coral">Official references</p>
          <h2 className="mt-1 font-serif text-xl font-semibold text-ink">官方查询入口</h2>
        </div>
        <p className="max-w-xl text-xs leading-5 text-ink/58">
          TEAMAKING 的 Course Board 是平台内协作入口；专业介绍、官方四年安排和真实选课请以学校网站与 MIS 为准。
        </p>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-3">
        {rows.map((link) => (
          <a
            key={link.key ?? link.href}
            href={link.href}
            target="_blank"
            rel="noreferrer"
            className="group border border-ink/18 bg-paper/70 p-3 hover:border-ink/42 hover:bg-mist/45"
          >
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
              {link.label}
              <LinkIcon size={14} aria-hidden className="text-coral" />
            </span>
            {link.description ? <span className="mt-2 block text-xs leading-5 text-ink/58">{link.description}</span> : null}
          </a>
        ))}
      </div>
    </>
  );
  return compact ? <div className="border border-ink/18 bg-paper/60 p-3">{content}</div> : <Card>{content}</Card>;
}

export function CoursesPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"recommended" | "mine" | "search">("recommended");
  const [searchPage, setSearchPage] = useState(1);
  const searchPageSize = 10;
  const { data: me, loading: authLoading } = useApi("/api/auth/me");
  const isAuthed = Boolean(me?.user);
  const { data: recommended } = useApi(isAuthed ? "/api/courses/recommended" : null, [isAuthed]);
  const { data: myCourses } = useApi(isAuthed ? "/api/courses/my" : null, [isAuthed]);
  const { data: search, error: searchError, loading: searchLoading } = useApi(
    isAuthed ? `/api/courses/search?q=${encodeURIComponent(q)}&page=${searchPage}&pageSize=${searchPageSize}` : null,
    [q, searchPage, searchPageSize, isAuthed]
  );
  const officialLinks = recommended?.officialLinks ?? myCourses?.officialLinks ?? [];
  const searchPagination = search?.pagination ?? { page: searchPage, pageSize: searchPageSize, total: 0, totalPages: 1 };

  async function joinFirstBoard(course: any) {
    const result = await api(`/api/courses/${course.id}/join`, { method: "POST" });
    const boardId = result?.board?.id ?? course.offerings?.[0]?.boards?.[0]?.id;
    if (boardId) router.push(`/boards/${boardId}`);
  }

  return (
    <PageShell title="Course Boards" eyebrow="Courses" description="搜索或加入课程板。加入只代表你在 TEAMAKING 平台内自选加入，不代表官方选课。">
      {!isAuthed ? (
        <div className="grid gap-5">
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-rust">Public preview</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">未登录时只展示课程板示例</h2>
            <p className="mt-3 text-sm leading-6 text-ink/68">
              为保护学生资料，未登录用户不能读取真实课程、Course Board、Open to Team posts 或 Course People。请使用学校邮箱登录，或进入演示验收模式查看完整逻辑。
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/demo-access" className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper">
                演示验收模式
              </Link>
              <Link href="/login" className="rounded-sm border border-ink/40 px-4 py-2 text-sm font-semibold">
                学校邮箱登录
              </Link>
            </div>
          </Card>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["COM3003", "Media Ethics", "Open to Team posts are hidden before login."],
              ["CST1001", "Introduction to Programming", "Course People are hidden before login."],
              ["BUS2002", "Marketing Principles", "Join actions require verified identity."]
            ].map(([code, title, body]) => (
              <Card key={code}>
                <p className="text-sm font-semibold text-rust">{code}</p>
                <h3 className="mt-2 text-lg font-semibold text-ink">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-ink/62">{body}</p>
              </Card>
            ))}
          </div>
          {authLoading ? <p className="text-sm text-ink/56">正在确认登录状态；未确认前不会读取真实课程或学生数据。</p> : null}
        </div>
      ) : null}
      {isAuthed ? (
      <div className="grid gap-5">
        <OfficialAcademicLinks links={officialLinks} />
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/15 pb-3">
            <div className="flex flex-wrap gap-2">
              {[
                ["recommended", "Recommended"],
                ["mine", "我的课程"],
                ["search", "Search / Free elective"]
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key as typeof tab)}
                  className={`border px-3 py-2 text-sm font-semibold ${tab === key ? "border-ink bg-ink text-paper" : "border-ink/25 bg-paper text-ink"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs leading-5 text-ink/55">
              已加入课程不会因后续更改专业而自动移除；疑似非本专业专业课会在“我的课程”中提示。
            </p>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Search size={18} aria-hidden />
            <input
              className={inputClass}
              value={q}
              onChange={(event) => {
                setQ(event.target.value);
                setSearchPage(1);
                if (event.target.value.trim()) setTab("search");
              }}
              placeholder="搜索课程代码或课程名称，例如 COM3003；free elective 可直接搜索加入"
            />
          </div>
          {tab === "search" && q.trim() ? (
            <div className="mt-4 border-t border-ink/15 pt-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Recommended by match score</p>
                <p className="text-xs text-ink/52">
                  {searchPagination.total} results · page {searchPagination.page} / {searchPagination.totalPages}
                </p>
              </div>
              {searchLoading ? <LoadingState /> : null}
              <ErrorBox message={searchError} />
              <div className="grid gap-2">
                {(search?.courses ?? []).map((course: any) => {
                  return (
                    <div key={course.id} className="grid gap-3 border border-ink/15 bg-paper px-3 py-3 md:grid-cols-[1fr_auto] md:items-center">
                      <div>
                        <p className="text-sm font-semibold text-ink">{course.code} · {course.title}</p>
                        <p className="mt-1 text-xs text-ink/58">{course.matchReason} · score {course.score}</p>
                      </div>
                      <div className="flex gap-2">
                        <Link href={`/courses/${course.id}`} className="border border-ink/30 px-3 py-2 text-xs font-semibold hover:bg-mist/50">
                          详情
                        </Link>
                        <button onClick={() => joinFirstBoard(course)} className="border border-ink bg-ink px-3 py-2 text-xs font-semibold text-paper">
                          加入课程板
                        </button>
                      </div>
                    </div>
                  );
                })}
                {!searchLoading && (search?.courses ?? []).length === 0 ? (
                  <EmptyState title="没有找到匹配课程" body="可以换一个课程代码、英文关键词，或通过右下角工单提交缺失课程。" />
                ) : null}
              </div>
              {searchPagination.totalPages > 1 ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink/15 pt-3">
                  <p className="text-xs text-ink/52">
                    Showing {(searchPagination.page - 1) * searchPagination.pageSize + 1}
                    {"-"}
                    {Math.min(searchPagination.page * searchPagination.pageSize, searchPagination.total)} of {searchPagination.total}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={searchPagination.page <= 1}
                      onClick={() => setSearchPage((page) => Math.max(1, page - 1))}
                      className="border border-ink/30 px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      disabled={searchPagination.page >= searchPagination.totalPages}
                      onClick={() => setSearchPage((page) => Math.min(searchPagination.totalPages, page + 1))}
                      className="border border-ink/30 px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </Card>
        {tab === "recommended" ? (
        <section>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <h2 className="font-serif text-2xl font-semibold text-ink">Recommended courses</h2>
            {recommended?.academicContext?.relativeTermCode ? (
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/52">
                {recommended.academicContext.semester?.name} · {recommended.academicContext.relativeTermCode}
              </p>
            ) : null}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {(recommended?.courses ?? []).map((course: any) => (
              <CourseCard key={course.id} course={course} onJoin={joinFirstBoard} />
            ))}
            {(recommended?.courses ?? []).length === 0 ? (
              <Card>
                <h3 className="font-serif text-xl font-semibold text-ink">暂时没有匹配到本学期专业课程</h3>
                <p className="mt-2 text-sm leading-6 text-ink/64">
                  请确认个人 Profile 中的 admission year、major 已保存，并确认对应年份 handbook JSON 已由管理员批准导入。
                </p>
              </Card>
            ) : null}
          </div>
        </section>
        ) : null}
        {tab === "mine" ? (
        <section>
          <h2 className="mb-3 font-serif text-2xl font-semibold text-ink">我的课程</h2>
          <div className="grid gap-3">
            {(myCourses?.memberships ?? []).map((membership: any) => {
              const board = membership.board;
              const offering = board?.courseOffering;
              const course = offering?.course;
              return (
                <div key={membership.id} className="grid gap-3 border border-ink/35 bg-chalk/90 p-4 md:grid-cols-[1fr_auto] md:items-center">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-coral">{offering?.semester?.name ?? "Course Board"} · section {membership.sectionCode ?? "1001"}</p>
                    <h3 className="mt-1 font-serif text-xl font-semibold text-ink">{course?.code} · {course?.title ?? board?.title}</h3>
                    <p className="mt-2 text-xs text-ink/56">{membership.source?.startsWith("auto_") ? "BNBU admission 配置默认加入" : "手动加入 / free elective / 自选课程板"}</p>
                    {membership.advisory ? (
                      <p className="mt-3 border-l-2 border-coral bg-coral/8 px-3 py-2 text-sm leading-6 text-coral">{membership.advisory.message}</p>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/courses/${course?.id}`} className="border border-ink/30 px-3 py-2 text-sm font-semibold hover:bg-mist/50">
                      详情
                    </Link>
                    <Link href={`/boards/${board?.id}`} className="border border-ink bg-ink px-3 py-2 text-sm font-semibold text-paper">
                      进入课程板
                    </Link>
                  </div>
                </div>
              );
            })}
            {(myCourses?.memberships ?? []).length === 0 ? <EmptyState title="还没有加入课程板" body="你可以从推荐课程或搜索结果加入课程板；这不会改动学校官方选课。" /> : null}
          </div>
        </section>
        ) : null}
        <Card>
          <h2 className="font-serif text-xl font-semibold text-ink">缺失课程 / bug / 报错</h2>
          <p className="mt-2 text-sm leading-6 text-ink/64">
            缺失课程不再走复杂审核机制。请直接提交工单，管理员会私下确认并处理。
          </p>
          <Link href="/support" className="focus-ring mt-4 inline-flex w-fit items-center gap-2 border border-ink/40 px-4 py-2 font-semibold hover:bg-mist/60">
            <Plus size={16} aria-hidden />
            提交工单
          </Link>
        </Card>
      </div>
      ) : null}
    </PageShell>
  );
}

function CourseCommentItem({ comment, onReply, onDelete }: { comment: any; onReply: (id: string, body: string) => void; onDelete: (id: string) => void }) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [body, setBody] = useState("");
  const [showReplies, setShowReplies] = useState(true);

  async function submitReply(event: FormEvent) {
    event.preventDefault();
    await onReply(comment.id, body);
    setBody("");
    setReplyOpen(false);
    setShowReplies(true);
  }

  return (
    <div className="border border-ink/15 bg-paper p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-ink">{comment.user?.profile?.displayName ?? comment.user?.email ?? "用户"}</p>
          <p className="text-xs text-ink/50">{comment.createdAt ? new Date(comment.createdAt).toLocaleString() : ""}</p>
        </div>
        <button type="button" onClick={() => onDelete(comment.id)} className="border border-ink/30 px-2 py-1 text-xs font-semibold text-rust">
          删除
        </button>
      </div>
      <p className={`mt-3 whitespace-pre-wrap text-sm leading-6 ${comment.deleted ? "text-ink/45" : "text-ink/72"}`}>{comment.body}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => setReplyOpen((value) => !value)} className="border border-ink/30 px-2 py-1 text-xs font-semibold">回复</button>
        {(comment.replies ?? []).length ? (
          <button type="button" onClick={() => setShowReplies((value) => !value)} className="border border-ink/30 px-2 py-1 text-xs font-semibold">
            {showReplies ? "收起回复" : `展开 ${comment.replies.length} 条回复`}
          </button>
        ) : null}
      </div>
      {replyOpen ? (
        <form onSubmit={submitReply} className="mt-3 grid gap-2">
          <textarea className={inputClass} rows={2} value={body} onChange={(event) => setBody(event.target.value)} placeholder="写一条回复" />
          <button className="w-fit border border-ink bg-ink px-3 py-1.5 text-xs font-semibold text-paper">发布回复</button>
        </form>
      ) : null}
      {showReplies && (comment.replies ?? []).length ? (
        <div className="mt-3 grid gap-3 border-l-2 border-ink/15 pl-3">
          {comment.replies.map((reply: any) => (
            <CourseCommentItem key={reply.id} comment={reply} onReply={onReply} onDelete={onDelete} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CourseCommentsSection({ courseId }: { courseId: string }) {
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");
  const { data, error, loading } = useApi(`/api/courses/${courseId}/comments?page=${page}&pageSize=8`, [page, refresh, courseId]);
  const pagination = data?.pagination ?? { page: 1, totalPages: 1, total: 0 };

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    await api(`/api/courses/${courseId}/comments`, { method: "POST", body: JSON.stringify({ body }) });
    setBody("");
    setRefresh((value) => value + 1);
    setMessage("课程评价已发布。");
  }

  async function reply(parentId: string, replyBody: string) {
    await api(`/api/course-comments/${parentId}/replies`, { method: "POST", body: JSON.stringify({ body: replyBody }) });
    setRefresh((value) => value + 1);
  }

  async function remove(commentId: string) {
    await api(`/api/course-comments/${commentId}`, { method: "DELETE" });
    setRefresh((value) => value + 1);
  }

  return (
    <Card>
      <h2 className="text-xl font-semibold text-ink">课程评价</h2>
      <p className="mt-2 text-sm leading-6 text-ink/62">绑定真实课程目录，不绑定某个具体 Course Board；评论记录真实时间，不支持点赞。</p>
      <form onSubmit={submit} className="mt-4 grid gap-3">
        <textarea className={inputClass} rows={4} value={body} onChange={(event) => setBody(event.target.value)} placeholder="写下课程体验、任务类型、组队建议或注意事项。" />
        <button className="focus-ring w-fit bg-coral px-4 py-2 text-sm font-semibold text-paper">发布评价</button>
      </form>
      {message ? <p className="mt-3 border border-forest/20 bg-paper px-3 py-2 text-sm font-medium text-forest">{message}</p> : null}
      {loading ? <p className="mt-4 text-sm text-ink/56">正在读取评论...</p> : <ErrorBox message={error} />}
      <div className="mt-4 grid gap-3">
        {(data?.comments ?? []).map((comment: any) => (
          <CourseCommentItem key={comment.id} comment={comment} onReply={reply} onDelete={remove} />
        ))}
        {(data?.comments ?? []).length === 0 ? <p className="text-sm text-ink/56">还没有课程评价。</p> : null}
      </div>
      <div className="mt-4 flex items-center justify-between border border-ink/15 bg-chalk px-3 py-2 text-sm">
        <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1} className="border border-ink/30 px-3 py-1 font-semibold disabled:opacity-40">上一页</button>
        <span>{pagination.page} / {pagination.totalPages} · {pagination.total} 条</span>
        <button type="button" onClick={() => setPage((value) => Math.min(pagination.totalPages, value + 1))} disabled={page >= pagination.totalPages} className="border border-ink/30 px-3 py-1 font-semibold disabled:opacity-40">下一页</button>
      </div>
    </Card>
  );
}

export function CourseDetailPage({ courseId }: { courseId: string }) {
  const router = useRouter();
  const { data, error, loading } = useApi(`/api/courses/${courseId}`);
  const course = data?.course;
  const [joinMessage, setJoinMessage] = useState("");

  async function joinCourse() {
    if (!course) return;
    setJoinMessage("");
    const result = await api(`/api/courses/${course.id}/join`, { method: "POST" });
    const boardId = result?.board?.id;
    if (boardId) router.push(`/boards/${boardId}`);
    else setJoinMessage(result?.message ?? "已加入课程板。");
  }

  return (
    <PageShell title={course ? `${course.code} ${course.title}` : "Course Detail"} eyebrow="Course" description="课程详情、开课学期和对应 Course Board。">
      {loading ? <LoadingState /> : <ErrorBox message={error} />}
      {course ? (
        <div className="grid gap-5">
          <OfficialAcademicLinks links={data?.officialLinks} />
          <Card>
            <p className="text-sm font-semibold text-coral">{course.code}</p>
            <h2 className="mt-1 font-serif text-2xl font-semibold text-ink">{course.title}</h2>
            <p className="mt-3 text-sm leading-6 text-ink/68">{course.description || "暂无课程描述。"}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="button" onClick={joinCourse} className="border border-ink bg-ink px-4 py-2 text-sm font-semibold text-paper">
                加入课程板
              </button>
              <p className="text-xs leading-5 text-ink/56">可用于自由选修或手动加入；只代表 TEAMAKING 平台内自选，不代表官方选课。</p>
            </div>
            {joinMessage ? <p className="mt-3 text-sm font-medium text-forest">{joinMessage}</p> : null}
          </Card>
          <CourseCommentsSection courseId={course.id} />
          <div className="grid gap-4 md:grid-cols-2">
            {(course.offerings ?? []).map((offering: any) => (
              <Card key={offering.id}>
                <p className="font-semibold text-ink">{offering.semester?.name}</p>
                <p className="mt-1 text-sm text-ink/62">{offering.teacherName ?? "未配置老师"} · {offering.section ?? "默认班级"}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(offering.boards ?? []).map((board: any) => (
                    <Link key={board.id} href={`/boards/${board.id}`} className="rounded-lg bg-coral px-3 py-2 text-sm font-semibold text-white">
                      进入 {board.title}
                    </Link>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}

export function BoardPage({ boardId }: { boardId: string }) {
  const [tab, setTab] = useState<"posts" | "people">("posts");
  const [refresh, setRefresh] = useState(0);
  const { data: me, loading: authLoading } = useApi("/api/auth/me");
  const isAuthed = Boolean(me?.user);
  const { data: boardData, error, loading } = useApi(isAuthed ? `/api/boards/${boardId}` : null, [refresh, isAuthed]);
  const { data: posts } = useApi(isAuthed ? `/api/boards/${boardId}/open-to-team` : null, [refresh, isAuthed]);
  const { data: people } = useApi(isAuthed ? `/api/boards/${boardId}/people` : null, [refresh, isAuthed]);
  const [boardMessage, setBoardMessage] = useState("");
  const [sectionCode, setSectionCode] = useState("1001");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [postForm, setPostForm] = useState({
    title: "",
    strengths: [] as string[],
    contributionTypes: [] as string[],
    expectedOutcome: "",
    portfolioItemIds: [] as string[],
    visibility: "same_course_board"
  });

  const board = boardData?.board;
  const course = board?.courseOffering?.course;
  const sections = boardData?.sections ?? [];
  const visiblePeople = (people?.people ?? []).filter((item: any) => sectionFilter === "all" || item.sectionCode === sectionFilter);

  useEffect(() => {
    if (course && !postForm.title) {
      setPostForm((current) => ({ ...current, title: `Open to Team for ${course.code}` }));
    }
  }, [course, postForm.title]);

  useEffect(() => {
    if (boardData?.myMembership?.sectionCode) setSectionCode(boardData.myMembership.sectionCode);
  }, [boardData?.myMembership?.sectionCode]);

  async function joinOrLeave() {
    setBoardMessage("");
    if (boardData?.isJoined) {
      const result = await api(`/api/boards/${boardId}/leave`, { method: "DELETE" });
      setBoardMessage(result?.message ?? "已离开这个 Course Board。");
    } else {
      const result = await api(`/api/boards/${boardId}/join`, { method: "POST", body: JSON.stringify({ sectionCode }) });
      setBoardMessage(result?.message ?? "已加入这个 Course Board。");
    }
    setRefresh((value) => value + 1);
  }

  async function changeSection(event: FormEvent) {
    event.preventDefault();
    const result = await api(`/api/boards/${boardId}/membership-section`, { method: "PATCH", body: JSON.stringify({ sectionCode }) });
    setBoardMessage(result?.message ?? "已更新 section。");
    setRefresh((value) => value + 1);
  }

  async function createPost(event: FormEvent) {
    event.preventDefault();
    await api(`/api/boards/${boardId}/teamaking-posts`, { method: "POST", body: JSON.stringify(postForm) });
    setRefresh((value) => value + 1);
  }

  return (
    <PageShell title={board?.title ?? "Course Board"} eyebrow="Course Board" description="Open to Team 是协作信号；Course People 是平台内自选加入名单，不是官方选课名单。">
      {authLoading || loading ? <LoadingState /> : <ErrorBox message={error} />}
      {!isAuthed ? (
        <div className="grid gap-5">
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-rust">Privacy boundary</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">登录前不能查看真实 Course Board 数据</h2>
            <p className="mt-3 text-sm leading-6 text-ink/68">
              真实课程板包含学生资料、Open to Team posts、联系方式可见性和 Course People。未登录用户只能看到这个结构示例。
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/demo-access" className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper">
                演示验收模式
              </Link>
              <Link href="/login" className="rounded-sm border border-ink/40 px-4 py-2 text-sm font-semibold">
                学校邮箱登录
              </Link>
            </div>
          </Card>
          <Card>
            <div className="flex gap-2">
              <span className="border border-ink/30 bg-ink px-3 py-2 text-sm font-semibold text-paper">Open to Team</span>
              <span className="border border-ink/30 px-3 py-2 text-sm font-semibold">Course People</span>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="border border-dashed border-ink/30 p-4">
                <p className="font-semibold text-ink">Open to Team 示例卡片</p>
                <p className="mt-2 text-sm leading-6 text-ink/62">真实姓名、专业、作品证明和联系方式在登录前全部隐藏。</p>
              </div>
              <div className="border border-dashed border-ink/30 p-4">
                <p className="font-semibold text-ink">Course People 示例区域</p>
                <p className="mt-2 text-sm leading-6 text-ink/62">这里只说明信息架构，不展示任何真实用户。</p>
              </div>
            </div>
          </Card>
          {authLoading ? <p className="text-sm text-ink/56">正在确认登录状态；未确认前不会读取真实课程板、帖子或成员数据。</p> : null}
        </div>
      ) : null}
      {board ? (
        <div className="grid gap-5">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-coral">{course?.code}</p>
                <h2 className="text-2xl font-semibold text-ink">
                  {course?.id ? <Link href={`/courses/${course.id}`} className="underline decoration-ink/20 underline-offset-4 hover:text-coral">{course?.title}</Link> : course?.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-ink/68">
                  开放时间：{board.openFrom ? new Date(board.openFrom).toLocaleDateString() : "当前学期开放"} - {board.openUntil ? new Date(board.openUntil).toLocaleDateString() : "学期结束前"}
                </p>
                <p className="mt-2 text-sm text-ink/58">当前平台成员：{boardData.memberCount}</p>
              </div>
              <button onClick={joinOrLeave} className="focus-ring rounded-lg bg-ink px-4 py-2 font-semibold text-white">
                {boardData.isJoined ? "Leave Course Board" : "Join Course Board"}
              </button>
            </div>
            <form onSubmit={boardData.isJoined ? changeSection : (event) => { event.preventDefault(); joinOrLeave(); }} className="mt-5 grid gap-3 border border-ink/15 bg-paper p-4">
              <div>
                <p className="text-sm font-semibold text-ink">Section / 班级</p>
                <p className="mt-1 text-xs leading-5 text-ink/58">输入 10xx 格式的 section 编号。如果这门课没有多个 section/班级，默认使用 1001。Section 只用于 TEAMAKING 内部组队筛选，不代表官方选课验证。</p>
              </div>
              {sections.length ? (
                <div className="flex flex-wrap gap-2">
                  {sections.map((section: any) => (
                    <button
                      key={section.code}
                      type="button"
                      onClick={() => setSectionCode(section.code)}
                      className={`rounded-sm border px-3 py-1.5 text-sm font-semibold ${sectionCode === section.code ? "border-ink bg-ink text-paper" : "border-ink/25 bg-chalk text-ink"}`}
                    >
                      {section.code} · {section.memberCount ?? 0}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="grid gap-2 md:grid-cols-[180px_auto]">
                <input className={inputClass} value={sectionCode} maxLength={4} onChange={(event) => setSectionCode(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="1001" />
                <button className="w-fit rounded-sm border border-ink/40 px-4 py-2 text-sm font-semibold">
                  {boardData.isJoined ? "Update section" : "Join with section"}
                </button>
              </div>
            </form>
            {boardMessage ? (
              <div className="mt-4 border border-ink/20 bg-paper px-3 py-2 text-sm text-ink/68">
                <span>{boardMessage}</span>
                {boardMessage.includes("course_config_error") ? (
                  <Link href="/support" className="ml-2 font-semibold text-coral">提交配置错误工单</Link>
                ) : null}
              </div>
            ) : null}
          </Card>
          {boardData.isJoined ? (
            <Card>
              <h2 className="text-xl font-semibold text-ink">Create Teamaking Post</h2>
              <form onSubmit={createPost} className="mt-4 grid gap-4">
                <Field label="标题">
                  <input className={inputClass} value={postForm.title} onChange={(event) => setPostForm({ ...postForm, title: event.target.value })} />
                </Field>
                <Field label="Strengths">
                  <ToggleGroup values={strengths} selected={postForm.strengths} onChange={(values) => setPostForm({ ...postForm, strengths: values })} />
                </Field>
                <Field label="Contribution types">
                  <ToggleGroup values={contributionTypes} selected={postForm.contributionTypes} onChange={(values) => setPostForm({ ...postForm, contributionTypes: values })} />
                </Field>
                <Field label="Expected outcome">
                  <textarea className={inputClass} rows={3} value={postForm.expectedOutcome} onChange={(event) => setPostForm({ ...postForm, expectedOutcome: event.target.value })} placeholder="A polished report with strong argumentation and clean slides." />
                </Field>
                <Field label="Visibility">
                  <select className={inputClass} value={postForm.visibility} onChange={(event) => setPostForm({ ...postForm, visibility: event.target.value })}>
                    <option value="same_course_board">同一 Course Board 可见</option>
                    <option value="same_school">同校可见</option>
                  </select>
                </Field>
                <button className="focus-ring inline-flex w-fit items-center gap-2 rounded-lg bg-coral px-4 py-2 font-semibold text-white">
                  <Plus size={16} aria-hidden />
                  Create Teamaking Post
                </button>
              </form>
            </Card>
          ) : null}
          <div className="flex gap-2">
            <button onClick={() => setTab("posts")} className={`rounded-lg px-4 py-2 font-semibold ${tab === "posts" ? "bg-ink text-white" : "bg-white text-ink"}`}>
              Open to Team
            </button>
            <button onClick={() => setTab("people")} className={`rounded-lg px-4 py-2 font-semibold ${tab === "people" ? "bg-ink text-white" : "bg-white text-ink"}`}>
              Course People
            </button>
          </div>
          {tab === "posts" ? (
            <div className="grid gap-4 md:grid-cols-2">
              {(posts?.posts ?? []).map((post: any) => (
                <TeamakingPostCard key={post.id} post={post} />
              ))}
            </div>
          ) : (
            <div className="grid gap-4">
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setSectionFilter("all")} className={`rounded-sm px-3 py-2 text-sm font-semibold ${sectionFilter === "all" ? "bg-ink text-paper" : "border border-ink/30"}`}>All sections</button>
                {sections.map((section: any) => (
                  <button key={section.code} onClick={() => setSectionFilter(section.code)} className={`rounded-sm px-3 py-2 text-sm font-semibold ${sectionFilter === section.code ? "bg-ink text-paper" : "border border-ink/30"}`}>
                    {section.code} · {section.memberCount ?? 0}
                  </button>
                ))}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {visiblePeople.map((item: any) => (
                  <div key={item.id} className="grid gap-2">
                    <ProfileCard user={item.user} />
                    <span className="w-fit border border-ink/20 bg-chalk px-2 py-1 text-xs font-semibold text-ink/62">Section {item.sectionCode ?? "未选择"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </PageShell>
  );
}

export function TeamakingPostPage({ postId }: { postId: string }) {
  const [refresh, setRefresh] = useState(0);
  const { data: me } = useApi("/api/auth/me");
  const { data, error, loading } = useApi(`/api/teamaking-posts/${postId}`, [refresh]);
  const { data: interests } = useApi(`/api/teamaking-posts/${postId}/interests`, [refresh]);
  const [form, setForm] = useState({ message: "", senderContribution: "" });
  const [message, setMessage] = useState("");
  const post = data?.post;
  const isOwnPost = Boolean(me?.user?.id && post?.userId === me.user.id);

  async function teamUp(event: FormEvent) {
    event.preventDefault();
    const result = await api(`/api/teamaking-posts/${postId}/team-up`, { method: "POST", body: JSON.stringify(form) });
    setMessage(result.existing ? "你已经发送过 TeamUp Interest，可在对方回应前撤回。" : "TeamUp Interest 已发送。");
    setRefresh((value) => value + 1);
  }

  async function actOnInterest(id: string, action: "mutual" | "refuse" | "withdraw") {
    await api(`/api/team-up-interests/${id}/${action}`, { method: "POST" });
    setRefresh((value) => value + 1);
  }

  return (
    <PageShell title={post?.title ?? "Teamaking Post"} eyebrow="Open to Team" description="这是一个轻量协作信号，不是队长招募，也不是申请加入正式团队。">
      {loading ? <LoadingState /> : <ErrorBox message={error} />}
      {post ? (
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <TeamakingPostCard post={post} />
          <Card>
            <h2 className="text-xl font-semibold text-ink">Team Up</h2>
            <p className="mt-2 text-sm leading-6 text-ink/62">发送一条轻量联系请求，说明你想贡献什么。最终沟通和组队在平台外完成。</p>
            {isOwnPost ? (
              <p className="mt-4 border border-ink/20 bg-paper px-3 py-2 text-sm text-ink/68">这是你自己发布的 Teamaking Post，不能给自己发送 TeamUp Interest。</p>
            ) : (
              <form onSubmit={teamUp} className="mt-4 grid gap-4">
                <Field label="你的消息">
                  <textarea className={inputClass} rows={4} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} />
                </Field>
                <Field label="你可以贡献什么">
                  <textarea className={inputClass} rows={3} value={form.senderContribution} onChange={(event) => setForm({ ...form, senderContribution: event.target.value })} />
                </Field>
                <button className="focus-ring inline-flex w-fit items-center gap-2 rounded-lg bg-coral px-4 py-2 font-semibold text-white">
                  <Handshake size={16} aria-hidden />
                  Send Team Up
                </button>
              </form>
            )}
            {message ? <p className="mt-3 text-sm font-medium text-moss">{message}</p> : null}
          </Card>
          <div className="lg:col-span-2">
            <Card>
              <h2 className="text-xl font-semibold text-ink">TeamUp Interests for this Post</h2>
              <div className="mt-4 grid gap-4">
                {(interests?.interests ?? []).length > 0 ? (
                  (interests?.interests ?? []).map((interest: any) => (
                    <TeamUpRequestCard
                      key={interest.id}
                      request={interest}
                      actions={
                        <>
                          <button type="button" onClick={() => actOnInterest(interest.id, "mutual")} className="focus-ring rounded-sm bg-moss px-3 py-2 text-sm font-semibold text-white">
                            我也感兴趣
                          </button>
                          <button type="button" onClick={() => actOnInterest(interest.id, "refuse")} className="focus-ring rounded-sm border border-ink/40 px-3 py-2 text-sm font-semibold">
                            Refuse
                          </button>
                          <button type="button" onClick={() => actOnInterest(interest.id, "withdraw")} className="focus-ring rounded-sm border border-ink/40 px-3 py-2 text-sm font-semibold">
                            Withdraw
                          </button>
                        </>
                      }
                    />
                  ))
                ) : (
                  <EmptyState title="还没有 TeamUp Interest" body="有人对这条 Open to Team signal 感兴趣后，会显示在这里。" />
                )}
              </div>
            </Card>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}

export function TeamUpRequestsPage() {
  const [refresh, setRefresh] = useState(0);
  const { data: received } = useApi("/api/team-up-interests/received", [refresh]);

  async function actOnInterest(id: string, action: "mutual" | "refuse") {
    await api(`/api/team-up-interests/${id}/${action}`, { method: "POST" });
    setRefresh((value) => value + 1);
  }

  return (
    <PageShell title="TeamUp Menu" eyebrow="TeamUp Interests" description="这里只显示发给你发布的 Teamaking Posts 的 TeamUp Interest 提醒；查看详情会把 sent 自动推进为 viewed。">
      <div className="grid gap-6">
        <section>
          <h2 className="mb-3 text-xl font-semibold text-ink">Received TeamUp Interests</h2>
          <div className="grid gap-4">
            {(received?.interests ?? []).map((request: any) => (
              <TeamUpRequestCard
                key={request.id}
                request={request}
                actions={
                  <>
                    <button type="button" onClick={() => actOnInterest(request.id, "mutual")} className="focus-ring rounded-sm bg-moss px-3 py-2 text-sm font-semibold text-white">
                      我也感兴趣
                    </button>
                    <button type="button" onClick={() => actOnInterest(request.id, "refuse")} className="focus-ring rounded-sm border border-ink/40 px-3 py-2 text-sm font-semibold">
                      Refuse
                    </button>
                  </>
                }
              />
            ))}
            {(received?.interests ?? []).length === 0 ? <EmptyState title="还没有 TeamUp Interest" body="其他同学对你发布的 Teamaking Post 发起 TeamUp 后，会显示在这里。" /> : null}
          </div>
        </section>
      </div>
    </PageShell>
  );
}

export function InboxPage() {
  const [refresh, setRefresh] = useState(0);
  const { data, error, loading } = useApi("/api/follow-requests/inbox", [refresh]);

  async function act(id: string, action: "accept" | "refuse" | "withdraw") {
    await api(`/api/follow-requests/${id}/${action}`, { method: "POST" });
    setRefresh((value) => value + 1);
  }

  return (
    <PageShell title="Inbox" eyebrow="Follow Requests" description="Inbox 只处理用户之间的关注/好友申请，不显示 TeamUp Interest。">
      {loading ? <LoadingState /> : <ErrorBox message={error} />}
      <div className="grid gap-4">
        {(data?.requests ?? []).map((request: any) => (
          <Card key={request.id}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <ProfileCard user={request.sender} />
              <StatusPill status={request.status} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => act(request.id, "accept")} className="focus-ring rounded-sm bg-moss px-3 py-2 text-sm font-semibold text-white">
                Accept Follow
              </button>
              <button type="button" onClick={() => act(request.id, "refuse")} className="focus-ring rounded-sm border border-ink/40 px-3 py-2 text-sm font-semibold">
                Refuse
              </button>
            </div>
          </Card>
        ))}
        {(data?.requests ?? []).length === 0 ? <EmptyState title="没有关注申请" body="其他用户申请关注你时，会出现在这里。" /> : null}
      </div>
    </PageShell>
  );
}

export function FriendsPage() {
  const [query, setQuery] = useState("");
  const { data, error, loading } = useApi(`/api/friends?query=${encodeURIComponent(query)}`, [query]);
  const friends = data?.friends ?? [];

  return (
    <PageShell title="Friends" eyebrow="Mutual Follow" description="双方关注申请 accepted 后，会在这里成为好友；可搜索姓名、邮箱、专业或年级。">
      <Card>
        <div className="flex items-center gap-2">
          <Search size={16} aria-hidden className="text-ink/45" />
          <input className={inputClass} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索姓名、邮箱、专业、年级" />
        </div>
      </Card>
      {loading ? <LoadingState /> : <ErrorBox message={error} />}
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {friends.map((friend: any) => <ProfileCard key={friend.id} user={friend} />)}
        {!loading && friends.length === 0 ? <EmptyState title="还没有好友" body="当关注申请被对方接受后，双方会出现在彼此好友列表里。" /> : null}
      </div>
    </PageShell>
  );
}

export function MatchesPage() {
  const [usersPage, setUsersPage] = useState(1);
  const usersPageSize = 8;
  const { data, error, loading } = useApi(`/api/matches?usersPage=${usersPage}&usersPageSize=${usersPageSize}`, [usersPage, usersPageSize]);
  const hiddenPostReasons = new Set(["same school", "open to team"]);
  const visiblePostReasons = (reasons: string[] = []) => reasons.filter((reason) => !hiddenPostReasons.has(String(reason).trim().toLowerCase()));
  const usersPagination = data?.usersPagination ?? { page: usersPage, pageSize: usersPageSize, total: 0, totalPages: 1 };

  return (
    <PageShell title="Matches" eyebrow="Discovery" description="优先推荐上过同一门课程、二度/三度好友网络、同一个专业、同校开放展示的同学；不使用 AI，也不依赖官方选课数据库。">
      {loading ? <LoadingState /> : <ErrorBox message={error} />}
      <div className="grid gap-6">
        <section>
          <h2 className="mb-3 text-xl font-semibold text-ink">Relevant Teamaking Posts</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {(data?.posts ?? []).map((post: any) => (
              <div key={post.id} className="grid gap-2">
                <TeamakingPostCard post={post} />
                {visiblePostReasons(post.reasons ?? []).length ? (
                  <div className="flex flex-wrap gap-2">
                    {visiblePostReasons(post.reasons ?? []).map((reason: string) => (
                      <SkillBadge key={reason}>{reason}</SkillBadge>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
        <section>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-xl font-semibold text-ink">Relevant Users</h2>
              <p className="mt-1 text-xs leading-5 text-ink/56">排序依据：同一课程记录优先，其次二度/三度好友网络和同专业，再用同校开放展示补充。</p>
            </div>
            <p className="text-xs text-ink/52">
              {usersPagination.total} users · page {usersPagination.page} / {usersPagination.totalPages}
            </p>
          </div>
          {(data?.users ?? []).length ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                {(data?.users ?? []).map((item: any) => (
                  <div key={item.user.id} className="grid gap-2">
                    <ProfileCard user={item.user} />
                    <div className="flex flex-wrap gap-2">
                      {(item.reasons ?? []).map((reason: string) => (
                        <SkillBadge key={reason}>{reason}</SkillBadge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {usersPagination.totalPages > 1 ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-ink/18 bg-paper/70 px-3 py-2 text-xs">
                  <span className="text-ink/56">
                    Showing {(usersPagination.page - 1) * usersPagination.pageSize + 1}
                    {"-"}
                    {Math.min(usersPagination.page * usersPagination.pageSize, usersPagination.total)} of {usersPagination.total}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={usersPagination.page <= 1}
                      onClick={() => setUsersPage((page) => Math.max(1, page - 1))}
                      className="border border-ink/30 px-3 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      disabled={usersPagination.page >= usersPagination.totalPages}
                      onClick={() => setUsersPage((page) => Math.min(usersPagination.totalPages, page + 1))}
                      className="border border-ink/30 px-3 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          ) : !loading ? (
            <EmptyState title="暂时没有相关用户" body="加入课程板、完善专业信息，或等待更多同学开放 Profile 后，这里会优先显示同课和同专业的人。" />
          ) : null}
        </section>
      </div>
    </PageShell>
  );
}

export function AdminHomePage() {
  return (
    <PageShell title="Admin Dashboard" eyebrow="Admin" description="管理用户、学校、课程、课程提交、Course Boards、Teamaking Posts、Team Up Requests 和站点配置。" aside="admin">
      <div className="grid gap-4 md:grid-cols-3">
        {["Users & Roles", "Admin Users", "Schools & Domains", "Course Boards", "Support Tickets", "Metrics", "Maintenance", "Site Configs", "Audit Logs", "Error Events"].map((item) => (
          <Card key={item}>
            <Settings size={20} aria-hidden className="text-coral" />
            <h2 className="mt-3 font-semibold text-ink">{item}</h2>
            <p className="mt-2 text-sm leading-6 text-ink/62">所有管理端变更都会写入 AdminAuditLog。</p>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}

export function AdminMetricsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10);
  const [from, setFrom] = useState(thirtyDaysAgo);
  const [to, setTo] = useState(today);
  const query = `/api/admin/metrics?from=${from}&to=${to}`;
  const { data, error, loading } = useApi(query, [from, to]);
  const metrics = data?.metrics ?? [];

  return (
    <PageShell title="Metrics" eyebrow="Admin" description="查看并下载一段时间内的用户动态统计数据。" aside="admin">
      <div className="grid gap-5">
        <Card>
          <div className="grid gap-3 md:grid-cols-[180px_180px_auto]">
            <Field label="开始日期">
              <input className={inputClass} type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </Field>
            <Field label="结束日期">
              <input className={inputClass} type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </Field>
            <a className="mt-auto inline-flex w-fit items-center gap-2 rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper" href={`${query}&format=csv`}>
              <FileText size={16} aria-hidden />
              下载 CSV
            </a>
          </div>
        </Card>
        {loading ? <LoadingState /> : <ErrorBox message={error} />}
        <div className="grid gap-4 md:grid-cols-3">
          {metrics.map((item: any) => (
            <Card key={item.metric}>
              <p className="text-sm font-semibold text-coral">{item.label}</p>
              <p className="mt-2 text-3xl font-semibold text-ink">{item.value}</p>
            </Card>
          ))}
        </div>
      </div>
    </PageShell>
  );
}

export function AdminMaintenancePage() {
  const [refresh, setRefresh] = useState(0);
  const { data, error, loading } = useApi("/api/admin/maintenance", [refresh]);
  const [confirmation, setConfirmation] = useState("");
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const summary = data?.summary ?? {};
  const canSubmit = confirmation.trim() === "CLEAR_TEAMING_STATE";

  async function clearCourseTeamingState() {
    setBusy(true);
    setResult(null);
    try {
      const response = await api("/api/admin/maintenance/clear-course-teaming-state", {
        method: "POST",
        body: JSON.stringify({ confirmation })
      });
      setResult({ type: "success", message: response.message ?? "课程组队状态已清空。" });
      setConfirmation("");
      setRefresh((value) => value + 1);
    } catch (error) {
      setResult({ type: "error", message: error instanceof Error ? error.message : "操作失败。" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell title="Maintenance" eyebrow="Admin" description="执行少量高风险维护操作。所有动作都会写入审计日志；默认只做软清空，不删除历史记录。" aside="admin">
      {loading ? <LoadingState /> : <ErrorBox message={error} />}
      <div className="grid gap-5">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-coral">Course teaming state</p>
          <h2 className="mt-2 font-serif text-2xl font-semibold text-ink">清空目前所有课程组队状态</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/64">
            这个操作用于新一轮测试或运营重置：它会移除当前活跃的课程组队状态，但不会删除好友关系、加入过的课程记录、发送过的组队帖或 TeamUp 请求记录。
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-5">
            {[
              ["Active course joins", summary.activeMemberships ?? 0],
              ["Historical joins", summary.historicalMemberships ?? 0],
              ["Open posts", summary.openPosts ?? 0],
              ["Active TeamUp", summary.activeTeamUpRequests ?? 0],
              ["Friendships", summary.acceptedFriendships ?? 0]
            ].map(([label, value]) => (
              <div key={String(label)} className="border border-ink/18 bg-paper/70 p-3">
                <p className="text-xs text-ink/52">{label}</p>
                <p className="mt-1 text-2xl font-semibold text-ink">{String(value)}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 border border-rust/35 bg-rust/5 p-4">
            <h3 className="text-sm font-semibold text-rust">将发生什么</h3>
            <ul className="mt-2 grid gap-1 text-sm leading-6 text-ink/70">
              <li>活跃课程加入记录会变成 `history`，保留 joinedAt 和 leftAt，继续作为 Matches 推荐依据。</li>
              <li>open/paused 的 Teamaking Post 会变成 `closed`，发帖记录仍可在后台追溯。</li>
              <li>sent/viewed/mutual 的 TeamUp 请求会变成 `closed`，历史请求记录不会删除。</li>
              <li>accepted 好友关系完全不变；二度、三度好友网络仍会用于 Relevant Users 推荐。</li>
            </ul>
          </div>
          {result ? (
            <div className={`mt-4 border px-3 py-2 text-sm font-semibold ${result.type === "error" ? "border-rust/40 bg-rust/5 text-rust" : "border-forest/30 bg-forest/10 text-forest"}`}>
              {result.message}
            </div>
          ) : null}
          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
            <Field label="确认文本">
              <input
                className={inputClass}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder="输入 CLEAR_TEAMING_STATE 后才能执行"
              />
            </Field>
            <button
              type="button"
              disabled={!canSubmit || busy}
              onClick={clearCourseTeamingState}
              className="mt-auto border border-rust bg-rust px-4 py-3 text-sm font-semibold text-paper disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? "处理中..." : "清空当前组队状态"}
            </button>
          </div>
        </Card>
      </div>
    </PageShell>
  );
}

function previewValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value).slice(0, 80);
  return String(value);
}

function rowsFromData(data: any) {
  if (!data) return [];
  return Object.entries(data).filter(([, value]) => Array.isArray(value)) as [string, any[]][];
}

export function AdminResourcePage({
  title,
  endpoint,
  description,
  initialContentTab = "developer_contact"
}: {
  title: string;
  endpoint: string;
  description: string;
  defaultActionPath?: string;
  initialContentTab?: "developer_contact" | "developer_log" | "help" | "announcements";
}) {
  const [refresh, setRefresh] = useState(0);
  const resource = endpoint.includes("support-tickets")
    ? "support-tickets"
    : endpoint.includes("team-up-requests")
      ? "team-up-requests"
      : endpoint.split("/").filter(Boolean).pop() ?? "";
  const [courseQuery, setCourseQuery] = useState("");
  const [courseStatusFilter, setCourseStatusFilter] = useState("all");
  const [courseSourceFilter, setCourseSourceFilter] = useState("all");
  const [courseTagFilter, setCourseTagFilter] = useState("");
  const [coursePage, setCoursePage] = useState(1);
  const courseEndpoint = `/api/admin/courses?query=${encodeURIComponent(courseQuery)}&status=${encodeURIComponent(courseStatusFilter)}&source=${encodeURIComponent(courseSourceFilter)}&tag=${encodeURIComponent(courseTagFilter)}&page=${coursePage}&pageSize=25`;
  const [ticketQuery, setTicketQuery] = useState("");
  const [ticketStatusFilter, setTicketStatusFilter] = useState("all");
  const [ticketCategoryFilter, setTicketCategoryFilter] = useState("all");
  const supportEndpoint = `/api/admin/support-tickets?query=${encodeURIComponent(ticketQuery)}&status=${encodeURIComponent(ticketStatusFilter)}&category=${encodeURIComponent(ticketCategoryFilter)}`;
  const [errorEventQuery, setErrorEventQuery] = useState("");
  const errorEventEndpoint = `/api/admin/error-events?query=${encodeURIComponent(errorEventQuery)}`;
  const dataEndpoint = resource === "courses" ? courseEndpoint : resource === "support-tickets" ? supportEndpoint : resource === "error-events" ? errorEventEndpoint : endpoint;
  const { data, error, loading } = useApi(dataEndpoint, [refresh]);
  const {
    data: contentAnnouncementData,
    error: contentAnnouncementError,
    loading: contentAnnouncementLoading
  } = useApi(resource === "content" ? "/api/admin/announcements" : null, [refresh]);
  const rows = useMemo(() => rowsFromData(data), [data]);
  const primaryRows = useMemo(() => rows[0]?.[1] ?? [], [rows]);
  const [selectedId, setSelectedId] = useState("");
  const [status, setStatus] = useState("active");
  const [role, setRole] = useState("profile_completed_user");
  const [adminNote, setAdminNote] = useState("");
  const [textFields, setTextFields] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [busyAction, setBusyAction] = useState("");
  const [actionData, setActionData] = useState<any>(null);
  const [importPreviewTab, setImportPreviewTab] = useState("coverage");
  const [importSearch, setImportSearch] = useState("");
  const [importPage, setImportPage] = useState(1);
  const [importEdit, setImportEdit] = useState<{ kind: string; id: string; draft: Record<string, string | boolean>; raw: any } | null>(null);
  const [courseDraft, setCourseDraft] = useState<Record<string, string>>({});
  const courseEditorRef = useRef<HTMLDivElement | null>(null);
  const [adminTableQuery, setAdminTableQuery] = useState("");
  const [contentTreeQuery, setContentTreeQuery] = useState("");
  const [contentTab, setContentTab] = useState<"developer_contact" | "developer_log" | "help" | "announcements">(initialContentTab);
  const [contentExpandedIds, setContentExpandedIds] = useState<Set<string>>(new Set());
  const [contentCreating, setContentCreating] = useState(false);
  const [contentAnnouncementId, setContentAnnouncementId] = useState("");
  const [contentAnnouncementCreating, setContentAnnouncementCreating] = useState(false);

  useEffect(() => {
    if (resource === "content" || resource === "courses") return;
    if (primaryRows.length > 0 && !selectedId) setSelectedId(primaryRows[0].id ?? primaryRows[0].key ?? "");
  }, [primaryRows, resource, selectedId]);

  const selectedCourse = resource === "courses" ? (data?.courses ?? []).find((course: any) => course.id === selectedId) ?? null : null;

  useEffect(() => {
    if (resource !== "courses" || !selectedCourse) return;
    setSelectedId(selectedCourse.id);
    setCourseDraft({
      code: selectedCourse.code ?? "",
      title: selectedCourse.title ?? "",
      description: selectedCourse.description ?? "",
      credits: selectedCourse.credits === null || selectedCourse.credits === undefined ? "" : String(selectedCourse.credits),
      ownerUnit: JSON.stringify(selectedCourse.ownerUnit ?? {}, null, 2),
      categoryTags: Array.isArray(selectedCourse.categoryTags) ? selectedCourse.categoryTags.join(", ") : "",
      courseType: selectedCourse.courseType ?? "coursework",
      status: selectedCourse.status ?? "active",
      manualNote: selectedCourse.manualNote ?? "",
      rawJson: JSON.stringify({
        code: selectedCourse.code ?? "",
        title: selectedCourse.title ?? "",
        description: selectedCourse.description ?? "",
        credits: selectedCourse.credits ?? "",
        ownerUnit: selectedCourse.ownerUnit ?? {},
        categoryTags: Array.isArray(selectedCourse.categoryTags) ? selectedCourse.categoryTags : [],
        courseType: selectedCourse.courseType ?? "coursework",
        status: selectedCourse.status ?? "active",
        manualNote: selectedCourse.manualNote ?? ""
      }, null, 2)
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource, selectedCourse?.id, selectedCourse?.updatedAt]);

  useEffect(() => {
    if (resource !== "content") return;
    if (contentTab === "announcements") return;
    const documents = data?.documents ?? [];
    const current = documents.find((document: any) => document.id === selectedId);
    if (contentCreating) return;
    if (!current || current.kind !== contentTab) {
      const next = documents.find((document: any) => document.kind === contentTab);
      setSelectedId(next?.id ?? "");
    }
  }, [resource, contentTab, contentCreating, data?.documents, selectedId]);

  useEffect(() => {
    if (resource !== "content" || contentTab === "announcements") return;
    const selectedDocument = (data?.documents ?? []).find((document: any) => document.id === selectedId && document.kind === contentTab);
    if (!selectedDocument) return;
    setContentCreating(false);
    setTextFields((current) => ({
      ...current,
      contentKind: selectedDocument.kind ?? "help",
      contentNodeType: selectedDocument.nodeType ?? "document",
      contentTitle: selectedDocument.title ?? "",
      contentSlug: selectedDocument.slug ?? "",
      contentParentId: selectedDocument.parentId ?? "",
      contentSummary: selectedDocument.summary ?? "",
      contentBodyMarkdown: selectedDocument.bodyMarkdown ?? "",
      contentImageUrls: contentImageUrls(selectedDocument.imageUrls).join(", "),
      contentStatus: selectedDocument.status ?? "draft",
      contentDisplayOrder: String(selectedDocument.displayOrder ?? 0)
    }));
  }, [resource, contentTab, selectedId, data?.documents]);

  useEffect(() => {
    if (resource !== "content" || contentTab === "announcements" || contentCreating || selectedId) return;
    const documents = data?.documents ?? [];
    const firstDocument = documents.find((document: any) => document.kind === contentTab);
    if (firstDocument) setSelectedId(firstDocument.id);
  }, [resource, contentTab, contentCreating, data?.documents, selectedId]);

  useEffect(() => {
    if (resource !== "content") return;
    const documents = data?.documents ?? [];
    if (!documents.length) return;
    setContentExpandedIds((current) => {
      const next = new Set(current);
      documents.filter((document: any) => !document.parentId && document.kind === contentTab).forEach((document: any) => next.add(document.id));
      return next;
    });
  }, [resource, contentTab, data?.documents]);

  useEffect(() => {
    if (resource !== "content" || contentTab !== "announcements" || contentAnnouncementCreating) return;
    const announcements = contentAnnouncementData?.announcements ?? [];
    const current = announcements.find((announcement: any) => announcement.id === contentAnnouncementId);
    if (!current && announcements.length) setContentAnnouncementId(announcements[0].id);
  }, [resource, contentTab, contentAnnouncementCreating, contentAnnouncementData?.announcements, contentAnnouncementId]);

  useEffect(() => {
    if (resource !== "content" || contentTab !== "announcements" || contentAnnouncementCreating) return;
    const selectedAnnouncement = (contentAnnouncementData?.announcements ?? []).find((announcement: any) => announcement.id === contentAnnouncementId);
    if (!selectedAnnouncement) return;
    setTextFields((current) => ({
      ...current,
      announcementTitleZh: selectedAnnouncement.titleZh ?? "",
      announcementTitleEn: selectedAnnouncement.titleEn ?? "",
      announcementBodyZh: selectedAnnouncement.bodyZh ?? "",
      announcementBodyEn: selectedAnnouncement.bodyEn ?? "",
      announcementPriority: String(selectedAnnouncement.priority ?? 0),
      announcementStatus: selectedAnnouncement.status ?? "draft",
      announcementStartsAt: selectedAnnouncement.startsAt ? String(selectedAnnouncement.startsAt).slice(0, 16) : "",
      announcementEndsAt: selectedAnnouncement.endsAt ? String(selectedAnnouncement.endsAt).slice(0, 16) : ""
    }));
  }, [resource, contentTab, contentAnnouncementCreating, contentAnnouncementId, contentAnnouncementData?.announcements]);

  async function runAction(path: string, method: string, body: Record<string, unknown>, options: { busy?: string; success?: (response: any) => string; after?: (response: any) => void } = {}) {
    setResult(null);
    setBusyAction(options.busy ?? path);
    try {
      const response = await api(path, { method, body: JSON.stringify(body) });
      setActionData(response);
      setResult({ type: "success", message: options.success ? options.success(response) : response.message ?? "操作已完成。" });
      options.after?.(response);
      setRefresh((value) => value + 1);
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : "操作失败，请稍后再试。";
      setResult({ type: "error", message });
      return null;
    } finally {
      setBusyAction("");
    }
  }

  async function loadCourseImportPreview(importBatchId: string) {
    if (!importBatchId) return;
    setResult(null);
    setBusyAction("load-import-diff");
    try {
      const response = await api(`/api/admin/course-imports/${importBatchId}`);
      setActionData(response);
      setImportPreviewTab("diff");
      const summary = response.selectedBatch?.summary;
      const counts = summary?.counts ?? response.preview?.counts ?? {};
      setResult({ type: "success", message: `已载入差异：${summary?.cohortYears?.join(", ") || "unknown"} admission，${counts.courses ?? 0} courses，${counts.curriculumRules ?? 0} rules。` });
    } catch (error) {
      setResult({ type: "error", message: error instanceof Error ? error.message : "查看差异失败。" });
    } finally {
      setBusyAction("");
    }
  }

  function payloadForEditing() {
    if (textFields.payload) return textFields.payload;
    const batchPayload = actionData?.selectedBatch?.payload;
    return batchPayload ? JSON.stringify(batchPayload, null, 2) : "";
  }

  function startImportEdit(row: any) {
    if (row.kind === "courses") {
      setImportEdit({
        kind: row.kind,
        id: row.id,
        raw: row.raw ?? row,
        draft: {
          code: row.code ?? "",
          title: row.title ?? "",
          credits: row.credits === null || row.credits === undefined ? "" : String(row.credits),
          description: row.raw?.description ?? "",
          categoryTags: Array.isArray(row.categoryTags) ? row.categoryTags.join(", ") : "",
          sourceRefIds: Array.isArray(row.sourceRefIds) ? row.sourceRefIds.join(", ") : ""
        }
      });
      return;
    }
    const audience = row.raw?.audience ?? {};
    setImportEdit({
      kind: row.kind,
      id: row.id,
      raw: row.raw ?? row,
      draft: {
        courseCode: row.courseCode ?? "",
        classification: row.classification ?? "",
        classificationLabel: row.classificationLabel ?? "",
        studentAction: row.studentAction ?? "default_join",
        allMajors: row.allMajors === true,
        majorCodes: Array.isArray(row.majorCodes) ? row.majorCodes.join(", ") : "",
        cohortYears: Array.isArray(row.cohortYears) ? row.cohortYears.join(", ") : "",
        relativeTermCodes: Array.isArray(row.relativeTermCodes) ? row.relativeTermCodes.join(", ") : "",
        sourceRefIds: Array.isArray(row.sourceRefIds) ? row.sourceRefIds.join(", ") : "",
        confidence: row.confidence ?? "",
        facultyCodes: Array.isArray(row.facultyCodes) ? row.facultyCodes.join(", ") : "",
        grades: Array.isArray(audience.grades) ? audience.grades.join(", ") : ""
      }
    });
  }

  function applyImportEdit() {
    try {
      if (!importEdit) return;
      const rawPayload = payloadForEditing();
      const parsed = JSON.parse(rawPayload);
      const edited = { ...(importEdit.raw ?? {}) };
      if (importEdit.kind === "courses") {
        edited.code = String(importEdit.draft.code ?? "").trim().toUpperCase();
        edited.title = String(importEdit.draft.title ?? "").trim();
        edited.description = String(importEdit.draft.description ?? "");
        const credits = Number(importEdit.draft.credits);
        edited.credits = Number.isFinite(credits) ? credits : undefined;
        edited.categoryTags = String(importEdit.draft.categoryTags ?? "").split(",").map((item) => item.trim()).filter(Boolean);
        edited.sourceRefIds = String(importEdit.draft.sourceRefIds ?? "").split(",").map((item) => item.trim()).filter(Boolean);
      } else {
        const audience = { ...(edited.audience ?? {}) };
        edited.courseCode = String(importEdit.draft.courseCode ?? "").trim().toUpperCase();
        edited.classification = String(importEdit.draft.classification ?? "").trim();
        edited.classificationLabel = String(importEdit.draft.classificationLabel ?? "").trim();
        edited.studentAction = String(importEdit.draft.studentAction ?? "default_join");
        audience.allMajors = importEdit.draft.allMajors === true;
        audience.majorCodes = String(importEdit.draft.majorCodes ?? "").split(",").map((item) => item.trim().toUpperCase()).filter(Boolean);
        audience.facultyCodes = String(importEdit.draft.facultyCodes ?? "").split(",").map((item) => item.trim().toUpperCase()).filter(Boolean);
        audience.grades = String(importEdit.draft.grades ?? "").split(",").map((item) => item.trim()).filter(Boolean);
        audience.cohortYears = String(importEdit.draft.cohortYears ?? "").split(",").map((item) => Number(item.trim())).filter(Number.isFinite);
        edited.audience = audience;
        edited.relativeTermCodes = String(importEdit.draft.relativeTermCodes ?? "").split(",").map((item) => item.trim().toUpperCase()).filter(Boolean);
        edited.sourceRefIds = String(importEdit.draft.sourceRefIds ?? "").split(",").map((item) => item.trim()).filter(Boolean);
        edited.confidence = String(importEdit.draft.confidence ?? "unknown");
      }
      const list = Array.isArray(parsed[importEdit.kind]) ? parsed[importEdit.kind] : [];
      const index = list.findIndex((item: any) => {
        if (importEdit.kind === "courses") return item.code === importEdit.id;
        return item.id === importEdit.id;
      });
      if (index < 0) throw new Error(`找不到要编辑的 ${importEdit.kind}: ${importEdit.id}`);
      list[index] = edited;
      parsed[importEdit.kind] = list;
      setTextFields({ ...textFields, payload: JSON.stringify(parsed, null, 2) });
      setImportEdit(null);
      setResult({ type: "info", message: "已写入 JSON 文本，请重新点击“校验 JSON”更新预览。" });
    } catch (error) {
      setResult({ type: "error", message: error instanceof Error ? error.message : "编辑失败。" });
    }
  }

  function selectedLabel(row: any) {
    return row.profile?.displayName ?? row.title ?? row.name ?? row.key ?? row.email ?? row.id;
  }

  function openCourseEditor(course: any) {
    setSelectedId(course.id);
    setResult({ type: "info", message: `正在编辑课程：${course.code} · ${course.title}` });
    window.setTimeout(() => courseEditorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function courseDraftPayload(draft: Record<string, string> = courseDraft) {
    const payload: Record<string, unknown> = {};
    ["code", "title", "description", "credits", "ownerUnit", "categoryTags", "courseType", "status", "manualNote"].forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(draft, field)) payload[field] = draft[field];
    });
    return payload;
  }

  function courseRawJsonText(draft: Record<string, string> = courseDraft) {
    return JSON.stringify(courseDraftPayload(draft), null, 2);
  }

  function coursePayloadFromRawJson(rawJson: string) {
    const parsed = JSON.parse(rawJson);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("课程 JSON 必须是一个对象。");
    }
    const source = parsed as Record<string, unknown>;
    const payload: Record<string, unknown> = {};
    ["code", "title", "description", "credits", "courseType", "status", "manualNote"].forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(source, field)) payload[field] = source[field] === null || source[field] === undefined ? "" : String(source[field]);
    });
    if (Object.prototype.hasOwnProperty.call(source, "ownerUnit")) {
      payload.ownerUnit = typeof source.ownerUnit === "string" ? source.ownerUnit : JSON.stringify(source.ownerUnit ?? {}, null, 2);
    }
    if (Object.prototype.hasOwnProperty.call(source, "categoryTags")) {
      payload.categoryTags = Array.isArray(source.categoryTags) ? source.categoryTags.join(", ") : String(source.categoryTags ?? "");
    }
    return payload;
  }

  function renderCourseImportPreview(preview: any) {
    if (!preview) return null;
    const counts = preview.counts ?? {};
    const validation = preview.validation ?? {};
    const coverage = preview.coverage ?? {};
    const databaseCoverage = preview.databaseCoverage ?? actionData?.databaseCoverage;
    const tables = preview.tables ?? {};
    const activeTable =
      importPreviewTab === "courses"
        ? tables.courses ?? []
        : importPreviewTab === "rules"
          ? tables.curriculumRules ?? []
          : importPreviewTab === "sources"
            ? tables.sourceRefs ?? []
            : importPreviewTab === "offerings"
              ? tables.offerings ?? []
              : [];
    const filteredTable = activeTable.filter((row: any) => JSON.stringify(row).toLowerCase().includes(importSearch.toLowerCase()));
    const pageSize = 25;
    const totalPages = Math.max(1, Math.ceil(filteredTable.length / pageSize));
    const currentPage = Math.min(importPage, totalPages);
    const pageRows = filteredTable.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const metricRows = [
      ["New faculties", counts.newFaculties],
      ["Updated faculties", counts.updatedFaculties],
      ["New majors", counts.newMajors],
      ["Updated majors", counts.updatedMajors],
      ["New courses", counts.newCourses],
      ["Updated courses", counts.updatedCourses],
      ["New rules", counts.newRules],
      ["Changed rules", counts.changedRules],
      ["Retained rules", counts.retainedRules],
      ["Rules to deactivate", counts.rulesToDeactivate],
      ["Default-join rules", counts.defaultJoinRules],
      ["Searchable rules", counts.searchableRules],
      ["Offering courses", counts.offeringCourses],
      ["Offering sections", counts.offeringSections],
      ["Rules in term context", counts.rulesInAcademicTermContext],
      ["Boards to activate", counts.courseBoardsToActivate],
      ["Protected course conflicts", counts.protectedCourseConflicts],
      ["Estimated default joins", counts.estimatedDefaultJoinUsers]
    ];
    const tabs = [
      ["coverage", "Coverage"],
      ["courses", "Courses"],
      ["rules", "Rules"],
      ["sources", "Sources"],
      ["offerings", "Offerings"],
      ["diff", "Diff"]
    ];
    const coverageBlocks = [
      ["Admission years in this JSON", coverage.cohortYears],
      ["Admission years already in DB", databaseCoverage?.cohortYears],
      ["Classifications", coverage.classifications],
      ["Student actions", coverage.studentActions],
      ["Majors", coverage.majors],
      ["Relative terms", coverage.relativeTerms]
    ];
    function renderCountList(values: any[]) {
      const items = Array.isArray(values) ? values : [];
      return (
        <div className="max-h-56 overflow-auto pr-2">
          {items.length ? items.map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-3 border-b border-ink/10 py-1.5 text-sm">
              <span className="truncate text-ink/72">{item.key}</span>
              <span className="font-semibold text-ink">{item.count}</span>
            </div>
          )) : <p className="text-sm text-ink/48">None</p>}
        </div>
      );
    }
    function renderDataTable(rows: any[]) {
      const headers =
        importPreviewTab === "courses"
          ? ["code", "title", "credits", "status", "categoryTags", "protectedConflicts"]
          : importPreviewTab === "rules"
            ? ["id", "courseCode", "cohortYears", "majorCodes", "relativeTermCodes", "classification", "studentAction", "confidence"]
            : importPreviewTab === "sources"
              ? ["id", "title", "sourceType", "url"]
              : ["id", "courseCode", "semesterCode", "sections", "status", "sourceRefIds"];
      const headerLabels: Record<string, string> = {
        cohortYears: "admissionYears",
        semesterCode: "academicTerm",
        courseCode: "courseCode",
        relativeTermCodes: "relativeTerms"
      };
      const canEditRows = importPreviewTab === "courses" || importPreviewTab === "rules";
      return (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              className={`${inputClass} md:max-w-sm`}
              placeholder="Search code, major, classification, source..."
              value={importSearch}
              onChange={(event) => {
                setImportSearch(event.target.value);
                setImportPage(1);
              }}
            />
            <span className="text-sm text-ink/56">{filteredTable.length} rows</span>
            <button type="button" className="rounded-sm border border-ink/30 px-3 py-2 text-sm font-semibold" onClick={() => setImportPage(Math.max(1, currentPage - 1))}>Prev</button>
            <span className="text-sm font-semibold text-ink">Page {currentPage} / {totalPages}</span>
            <button type="button" className="rounded-sm border border-ink/30 px-3 py-2 text-sm font-semibold" onClick={() => setImportPage(Math.min(totalPages, currentPage + 1))}>Next</button>
          </div>
          <div className="max-h-[520px] overflow-auto border border-ink/15">
            <table className="w-full min-w-[980px] border-collapse text-left text-xs">
              <thead className="sticky top-0 bg-ink text-paper">
                <tr>
                  {headers.map((header) => <th key={header} className="px-3 py-2 font-semibold">{headerLabels[header] ?? header}</th>)}
                  {canEditRows ? <th className="px-3 py-2 font-semibold">Edit</th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.kind}-${row.id}`} className="border-b border-ink/10 odd:bg-chalk">
                    {headers.map((header) => (
                      <td key={header} className="max-w-[260px] px-3 py-2 align-top">
                        <span className="line-clamp-3 break-words">{previewValue(row[header])}</span>
                      </td>
                    ))}
                    {canEditRows ? (
                      <td className="px-3 py-2 align-top">
                        <button type="button" onClick={() => startImportEdit(row)} className="rounded-sm border border-ink/30 px-2 py-1 font-semibold">Edit</button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }
    function renderDiffTable() {
      const asArray = (value: any) => Array.isArray(value) ? value : [];
      const rows = [
        ...asArray(preview.diff?.courses?.added).map((value: string) => ({ category: "Added course", item: value, details: "Will create a course catalog row." })),
        ...asArray(preview.diff?.courses?.updated).map((value: string) => ({ category: "Updated course", item: value, details: "Catalog metadata differs from this JSON." })),
        ...asArray(preview.diff?.courses?.protectedConflicts).map((item: any) => ({
          category: "Manual override conflict",
          item: item.code,
          details: asArray(item.fields).join(", ")
        })),
        ...asArray(preview.diff?.rules?.added).map((value: string) => ({ category: "Added rule", item: value, details: "Will add an admission-year curriculum rule." })),
        ...asArray(preview.diff?.rules?.changed).map((item: any) => ({
          category: "Changed rule",
          item: item.id,
          details: asArray(item.changedFields).join(", ")
        })),
        ...asArray(preview.diff?.rules?.wouldDeactivate).map((value: string) => ({ category: "Rule to deactivate", item: value, details: "Active database rule is absent from this JSON." }))
      ];
      const filteredRows = rows.filter((row) => JSON.stringify(row).toLowerCase().includes(importSearch.toLowerCase()));
      const diffTotalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
      const diffCurrentPage = Math.min(importPage, diffTotalPages);
      const diffPageRows = filteredRows.slice((diffCurrentPage - 1) * pageSize, diffCurrentPage * pageSize);

      return (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              className={`${inputClass} md:max-w-sm`}
              placeholder="Search diff by code, rule id, category..."
              value={importSearch}
              onChange={(event) => {
                setImportSearch(event.target.value);
                setImportPage(1);
              }}
            />
            <span className="text-sm text-ink/56">{filteredRows.length} changes</span>
            <button type="button" className="rounded-sm border border-ink/30 px-3 py-2 text-sm font-semibold" onClick={() => setImportPage(Math.max(1, diffCurrentPage - 1))}>Prev</button>
            <span className="text-sm font-semibold text-ink">Page {diffCurrentPage} / {diffTotalPages}</span>
            <button type="button" className="rounded-sm border border-ink/30 px-3 py-2 text-sm font-semibold" onClick={() => setImportPage(Math.min(diffTotalPages, diffCurrentPage + 1))}>Next</button>
          </div>
          <div className="max-h-[520px] overflow-auto border border-ink/15">
            <table className="w-full min-w-[760px] border-collapse text-left text-xs">
              <thead className="sticky top-0 bg-ink text-paper">
                <tr>
                  <th className="px-3 py-2 font-semibold">Category</th>
                  <th className="px-3 py-2 font-semibold">Code / rule</th>
                  <th className="px-3 py-2 font-semibold">What changed</th>
                </tr>
              </thead>
              <tbody>
                {diffPageRows.length ? diffPageRows.map((row, index) => (
                  <tr key={`${row.category}-${row.item}-${index}`} className="border-b border-ink/10 odd:bg-chalk">
                    <td className="px-3 py-2 align-top font-semibold text-ink">{row.category}</td>
                    <td className="px-3 py-2 align-top font-mono text-ink/76">{row.item}</td>
                    <td className="px-3 py-2 align-top text-ink/64">{row.details || "No field detail available"}</td>
                  </tr>
                )) : (
                  <tr>
                    <td className="px-3 py-4 text-sm text-ink/48" colSpan={3}>No diff rows match this search.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    }
    return (
      <div className="grid gap-5 border-2 border-ink bg-paper p-4 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink/12 pb-4">
          <div>
            <h3 className="text-lg font-semibold text-ink">Import Preview</h3>
            <p className="mt-1 text-sm text-ink/58">
              {preview.importMode === "cohort_handbook" ? "Admission-year programme handbook" : "Combined import"} · {preview.semester?.label ?? preview.semester?.code ?? "Academic term context"}
            </p>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/64">{preview.semester?.note}</p>
          </div>
          <span className={`rounded-sm px-3 py-1 text-xs font-semibold ${validation.ok ? "bg-forest text-white" : "bg-rust text-white"}`}>
            {validation.ok ? "Valid" : "Invalid"}
          </span>
        </div>
        <div className="grid gap-2 md:grid-cols-4">
          {metricRows.map(([label, value]) => (
            <div key={label as string} className="border border-ink/15 bg-chalk px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/48">{label}</p>
              <p className="mt-1 text-xl font-semibold text-ink">{String(value ?? 0)}</p>
            </div>
          ))}
        </div>
        {validation.errors?.length ? (
          <div className="border border-rust/40 bg-rust/5 p-3 text-sm text-rust">
            <p className="font-semibold">Errors</p>
            <ul className="mt-2 list-disc pl-5">
              {validation.errors.slice(0, 8).map((item: string) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        ) : null}
        {validation.warnings?.length ? (
          <div className="border border-ink/20 bg-chalk p-3 text-sm text-ink/68">
            <p className="font-semibold text-ink">Warnings</p>
            <ul className="mt-2 list-disc pl-5">
              {validation.warnings.slice(0, 8).map((item: string) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setImportPreviewTab(key);
                setImportPage(1);
              }}
              className={`rounded-sm px-3 py-2 text-sm font-semibold ${importPreviewTab === key ? "bg-ink text-paper" : "border border-ink/30 text-ink"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {importPreviewTab === "coverage" ? (
          <div className="grid gap-3 md:grid-cols-3">
            {coverageBlocks.map(([label, values]) => (
              <div key={label as string} className="border border-ink/15 bg-chalk p-3">
                <p className="mb-2 text-sm font-semibold text-ink">{label as string}</p>
                {renderCountList(values as any[])}
              </div>
            ))}
          </div>
        ) : null}
        {["courses", "rules", "sources", "offerings"].includes(importPreviewTab) ? renderDataTable(pageRows) : null}
        {importPreviewTab === "diff" ? renderDiffTable() : null}
        {importEdit ? (
          <div className="border-2 border-coral bg-coral/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-semibold text-ink">Editing {importEdit.kind === "courses" ? "course" : "curriculum rule"}: {importEdit.id}</p>
              <button type="button" className="rounded-sm border border-ink/30 px-3 py-1 text-sm font-semibold" onClick={() => setImportEdit(null)}>Close</button>
            </div>
            {importEdit.kind === "courses" ? (
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <Field label="Course code"><input className={inputClass} value={String(importEdit.draft.code ?? "")} onChange={(event) => setImportEdit({ ...importEdit, draft: { ...importEdit.draft, code: event.target.value } })} /></Field>
                <Field label="Title"><input className={inputClass} value={String(importEdit.draft.title ?? "")} onChange={(event) => setImportEdit({ ...importEdit, draft: { ...importEdit.draft, title: event.target.value } })} /></Field>
                <Field label="Credits"><input className={inputClass} value={String(importEdit.draft.credits ?? "")} onChange={(event) => setImportEdit({ ...importEdit, draft: { ...importEdit.draft, credits: event.target.value } })} /></Field>
                <Field label="Category tags"><input className={inputClass} value={String(importEdit.draft.categoryTags ?? "")} onChange={(event) => setImportEdit({ ...importEdit, draft: { ...importEdit.draft, categoryTags: event.target.value } })} /></Field>
                <Field label="Source refs"><input className={inputClass} value={String(importEdit.draft.sourceRefIds ?? "")} onChange={(event) => setImportEdit({ ...importEdit, draft: { ...importEdit.draft, sourceRefIds: event.target.value } })} /></Field>
                <Field label="Description"><textarea className={inputClass} rows={3} value={String(importEdit.draft.description ?? "")} onChange={(event) => setImportEdit({ ...importEdit, draft: { ...importEdit.draft, description: event.target.value } })} /></Field>
              </div>
            ) : (
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <Field label="Course code"><input className={inputClass} value={String(importEdit.draft.courseCode ?? "")} onChange={(event) => setImportEdit({ ...importEdit, draft: { ...importEdit.draft, courseCode: event.target.value } })} /></Field>
                <Field label="Classification">
                  <select className={inputClass} value={String(importEdit.draft.classification ?? "")} onChange={(event) => setImportEdit({ ...importEdit, draft: { ...importEdit.draft, classification: event.target.value } })}>
                    {["major_required", "major_elective", "concentration_required", "free_elective", "university_core", "bba_core", "general_education", "internship", "final_year_project", "unknown"].map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </Field>
                <Field label="Student action">
                  <select className={inputClass} value={String(importEdit.draft.studentAction ?? "default_join")} onChange={(event) => setImportEdit({ ...importEdit, draft: { ...importEdit.draft, studentAction: event.target.value } })}>
                    {["default_join", "searchable_add", "recommend_only", "hidden"].map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </Field>
                <Field label="Major codes"><input className={inputClass} value={String(importEdit.draft.majorCodes ?? "")} onChange={(event) => setImportEdit({ ...importEdit, draft: { ...importEdit.draft, majorCodes: event.target.value } })} /></Field>
                <Field label="Faculty codes"><input className={inputClass} value={String(importEdit.draft.facultyCodes ?? "")} onChange={(event) => setImportEdit({ ...importEdit, draft: { ...importEdit.draft, facultyCodes: event.target.value } })} /></Field>
                <Field label="Admission years"><input className={inputClass} value={String(importEdit.draft.cohortYears ?? "")} onChange={(event) => setImportEdit({ ...importEdit, draft: { ...importEdit.draft, cohortYears: event.target.value } })} /></Field>
                <Field label="Relative terms"><input className={inputClass} value={String(importEdit.draft.relativeTermCodes ?? "")} onChange={(event) => setImportEdit({ ...importEdit, draft: { ...importEdit.draft, relativeTermCodes: event.target.value } })} /></Field>
                <Field label="Confidence"><input className={inputClass} value={String(importEdit.draft.confidence ?? "")} onChange={(event) => setImportEdit({ ...importEdit, draft: { ...importEdit.draft, confidence: event.target.value } })} /></Field>
                <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <input type="checkbox" checked={importEdit.draft.allMajors === true} onChange={(event) => setImportEdit({ ...importEdit, draft: { ...importEdit.draft, allMajors: event.target.checked } })} />
                  All majors
                </label>
              </div>
            )}
            <details className="mt-3 text-xs text-ink/58">
              <summary className="cursor-pointer font-semibold text-ink">Advanced raw JSON preview</summary>
              <pre className="mt-2 max-h-56 overflow-auto border border-ink/15 bg-paper p-3">{JSON.stringify(importEdit.raw, null, 2)}</pre>
            </details>
            <button type="button" onClick={applyImportEdit} className="mt-3 rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper">Apply edit to JSON</button>
          </div>
        ) : null}
        </div>
    );
  }

  function renderAdminForm() {
    if (resource === "content") {
      const documents = data?.documents ?? [];
      const announcements = contentAnnouncementData?.announcements ?? [];
      const contentTabs: { key: typeof contentTab; label: string; note: string }[] = [
        { key: "developer_contact", label: "联系开发者", note: "单页面内容，不使用树状结构" },
        { key: "developer_log", label: "开发日志", note: "可用树状结构管理版本记录" },
        { key: "help", label: "帮助中心", note: "可用树状结构管理帮助文档" },
        { key: "announcements", label: "全站公告", note: "公告弹窗与历史记录" }
      ];
      const query = contentTreeQuery.trim().toLowerCase();
      const activeDocumentKind = contentTab === "announcements" ? "help" : contentTab;
      const tabDocuments = documents.filter((document: any) => document.kind === activeDocumentKind);
      const visibleDocuments = tabDocuments.filter((document: any) => !query || [document.title, document.slug, document.summary, document.kind, document.status].some((value) => String(value ?? "").toLowerCase().includes(query)));
      const documentTree = buildContentTree(visibleDocuments);
      const selectedDocument = contentCreating ? null : tabDocuments.find((document: any) => document.id === selectedId);
      const draft = {
        kind: textFields.contentKind ?? selectedDocument?.kind ?? activeDocumentKind,
        nodeType: contentTab === "developer_contact" ? "document" : textFields.contentNodeType ?? selectedDocument?.nodeType ?? "document",
        title: textFields.contentTitle ?? selectedDocument?.title ?? "",
        slug: textFields.contentSlug ?? selectedDocument?.slug ?? "",
        parentId: textFields.contentParentId ?? selectedDocument?.parentId ?? "",
        summary: textFields.contentSummary ?? selectedDocument?.summary ?? "",
        bodyMarkdown: textFields.contentBodyMarkdown ?? selectedDocument?.bodyMarkdown ?? "",
        imageUrls: textFields.contentImageUrls ?? contentImageUrls(selectedDocument?.imageUrls).join(", "),
        status: textFields.contentStatus ?? selectedDocument?.status ?? "draft",
        displayOrder: textFields.contentDisplayOrder ?? String(selectedDocument?.displayOrder ?? 0)
      };
      const setDraft = (key: string, value: string) => setTextFields({ ...textFields, [key]: value });
      const startNewDocument = (nodeType: "folder" | "document" = "document", parent?: any) => {
        const nextKind = parent?.kind ?? activeDocumentKind;
        setContentCreating(true);
        setSelectedId("");
        setTextFields({
          ...textFields,
          contentKind: nextKind,
          contentNodeType: nodeType,
          contentTitle: "",
          contentSlug: "",
          contentParentId: parent?.id ?? "",
          contentSummary: "",
          contentBodyMarkdown: "",
          contentImageUrls: "",
          contentStatus: "draft",
          contentDisplayOrder: "0"
        });
        if (parent?.id) {
          setContentExpandedIds((current) => new Set(current).add(parent.id));
        }
      };
      const selectContentDocument = (document: any) => {
        setContentCreating(false);
        setSelectedId(document.id);
      };
      const draftImageUrls = draft.imageUrls.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 3);
      const previewDocument = selectedDocument ?? {
        kind: draft.kind,
        slug: draft.slug || "new-document",
        title: draft.title || "未命名文档",
        nodeType: draft.nodeType,
        summary: draft.summary,
        bodyMarkdown: draft.bodyMarkdown,
        imageUrls: draftImageUrls,
        status: draft.status,
        updatedAt: null
      };
      const parentOptions = tabDocuments.filter((document: any) => document.id !== selectedDocument?.id && document.kind === draft.kind && contentNodeType(document) === "folder");
      const selectedAnnouncement = contentAnnouncementCreating ? null : announcements.find((announcement: any) => announcement.id === contentAnnouncementId);
      const announcementDraft = {
        titleZh: textFields.announcementTitleZh ?? selectedAnnouncement?.titleZh ?? "",
        titleEn: textFields.announcementTitleEn ?? selectedAnnouncement?.titleEn ?? "",
        bodyZh: textFields.announcementBodyZh ?? selectedAnnouncement?.bodyZh ?? "",
        bodyEn: textFields.announcementBodyEn ?? selectedAnnouncement?.bodyEn ?? "",
        priority: textFields.announcementPriority ?? String(selectedAnnouncement?.priority ?? 0),
        status: textFields.announcementStatus ?? selectedAnnouncement?.status ?? "draft",
        startsAt: textFields.announcementStartsAt ?? (selectedAnnouncement?.startsAt ? String(selectedAnnouncement.startsAt).slice(0, 16) : ""),
        endsAt: textFields.announcementEndsAt ?? (selectedAnnouncement?.endsAt ? String(selectedAnnouncement.endsAt).slice(0, 16) : "")
      };
      const setAnnouncementDraft = (key: string, value: string) => setTextFields({ ...textFields, [key]: value });
      const startNewAnnouncement = () => {
        setContentAnnouncementCreating(true);
        setContentAnnouncementId("");
        setTextFields({
          ...textFields,
          announcementTitleZh: "",
          announcementTitleEn: "",
          announcementBodyZh: "",
          announcementBodyEn: "",
          announcementPriority: "0",
          announcementStatus: "draft",
          announcementStartsAt: "",
          announcementEndsAt: ""
        });
      };
      const selectAnnouncement = (announcement: any) => {
        setContentAnnouncementCreating(false);
        setContentAnnouncementId(announcement.id);
      };
      const renderContentTabs = () => (
        <Card>
          <div className="grid gap-2 md:grid-cols-4">
            {contentTabs.map((tab) => {
              const active = contentTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setContentTab(tab.key);
                    setContentCreating(false);
                    setContentAnnouncementCreating(false);
                    setContentTreeQuery("");
                    setSelectedId("");
                    setContentAnnouncementId("");
                  }}
                  className={`rounded-sm border px-3 py-3 text-left ${active ? "border-ink bg-ink text-paper" : "border-ink/20 bg-paper text-ink hover:bg-chalk"}`}
                >
                  <span className="block font-semibold">{tab.label}</span>
                  <span className={`mt-1 block text-xs leading-5 ${active ? "text-paper/72" : "text-ink/52"}`}>{tab.note}</span>
                </button>
              );
            })}
          </div>
        </Card>
      );
      if (contentTab === "announcements") {
        return (
          <div className="grid gap-5">
            {renderContentTabs()}
            <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-ink">公告列表</h2>
                    <p className="mt-1 text-sm leading-6 text-ink/58">选择已有公告进行编辑；点新建公告才会进入新建模式。</p>
                  </div>
                  <span className="rounded-sm border border-ink/20 px-2 py-1 text-xs font-semibold text-moss">{announcements.length} 条</span>
                </div>
                <button type="button" onClick={startNewAnnouncement} className="mt-4 w-full rounded-sm bg-ink px-3 py-2 text-sm font-semibold text-paper">新建公告</button>
                {contentAnnouncementLoading ? <LoadingState /> : null}
                <ErrorBox message={contentAnnouncementError} />
                <div className="mt-4 max-h-[620px] overflow-auto border border-ink/15 bg-paper">
                  {announcements.length ? announcements.map((announcement: any) => (
                    <button
                      key={announcement.id}
                      type="button"
                      onClick={() => selectAnnouncement(announcement)}
                      className={`block w-full border-b border-ink/10 px-3 py-3 text-left last:border-b-0 ${selectedAnnouncement?.id === announcement.id ? "bg-coral/10" : "hover:bg-chalk"}`}
                    >
                      <span className="block font-semibold text-ink">{announcement.titleZh}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink/52">
                        <StatusPill status={announcement.status} />
                        <span>阅读 {announcement.readCount ?? 0}</span>
                        <span>{announcement.publishedAt ? new Date(announcement.publishedAt).toLocaleString() : "未发布"}</span>
                      </span>
                    </button>
                  )) : <EmptyState title="暂无公告" body="创建第一条公告后，会显示在这里。" />}
                </div>
              </Card>
              <div className="grid gap-5">
                <Card>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold text-ink">{selectedAnnouncement ? "编辑已有公告" : "新建公告"}</h2>
                      <p className="mt-1 text-sm text-ink/56">{selectedAnnouncement ? "正在编辑已保存公告；发布/归档按钮在表单底部。" : "这是一条尚未保存的新公告。"}</p>
                    </div>
                    {selectedAnnouncement ? <StatusPill status={selectedAnnouncement.status} /> : <StatusPill status="new" />}
                  </div>
                  <div className="border border-ink/15 bg-chalk p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-rust">公告预览</p>
                    <h3 className="mt-2 text-xl font-semibold text-ink">{announcementDraft.titleZh || "未命名公告"}</h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-ink/68">{announcementDraft.bodyZh || "公告正文会显示在这里。"}</p>
                    {announcementDraft.titleEn || announcementDraft.bodyEn ? (
                      <div className="mt-4 border-t border-ink/10 pt-3 text-sm leading-6 text-ink/52">
                        <p className="font-semibold">{announcementDraft.titleEn}</p>
                        <p className="mt-1 whitespace-pre-wrap">{announcementDraft.bodyEn}</p>
                      </div>
                    ) : null}
                  </div>
                </Card>
                <Card>
                  <h2 className="text-xl font-semibold text-ink">公告编辑</h2>
                  <form
                    className="mt-4 grid gap-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const body = {
                        titleZh: announcementDraft.titleZh,
                        titleEn: announcementDraft.titleEn,
                        bodyZh: announcementDraft.bodyZh,
                        bodyEn: announcementDraft.bodyEn,
                        priority: Number(announcementDraft.priority) || 0,
                        status: selectedAnnouncement ? undefined : announcementDraft.status,
                        startsAt: announcementDraft.startsAt,
                        endsAt: announcementDraft.endsAt
                      };
                      runAction(selectedAnnouncement ? `/api/admin/announcements/${selectedAnnouncement.id}` : "/api/admin/announcements", selectedAnnouncement ? "PATCH" : "POST", body, {
                        success: (response) => response.message ?? "公告已保存。",
                        after: (response) => {
                          if (response.announcement?.id) {
                            setContentAnnouncementCreating(false);
                            setContentAnnouncementId(response.announcement.id);
                          }
                        }
                      });
                    }}
                  >
                    <div className="grid gap-3 md:grid-cols-2">
                      <Field label="中文标题">
                        <input className={inputClass} value={announcementDraft.titleZh} onChange={(event) => setAnnouncementDraft("announcementTitleZh", event.target.value)} required />
                      </Field>
                      <Field label="English title">
                        <input className={inputClass} value={announcementDraft.titleEn} onChange={(event) => setAnnouncementDraft("announcementTitleEn", event.target.value)} />
                      </Field>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Field label="中文正文">
                        <textarea className={inputClass} rows={7} value={announcementDraft.bodyZh} onChange={(event) => setAnnouncementDraft("announcementBodyZh", event.target.value)} required />
                      </Field>
                      <Field label="English body">
                        <textarea className={inputClass} rows={7} value={announcementDraft.bodyEn} onChange={(event) => setAnnouncementDraft("announcementBodyEn", event.target.value)} />
                      </Field>
                    </div>
                    <div className="grid gap-3 md:grid-cols-4">
                      <Field label="优先级">
                        <input type="number" className={inputClass} value={announcementDraft.priority} onChange={(event) => setAnnouncementDraft("announcementPriority", event.target.value)} />
                      </Field>
                      <Field label="新建后状态">
                        <select className={inputClass} value={announcementDraft.status} onChange={(event) => setAnnouncementDraft("announcementStatus", event.target.value)} disabled={Boolean(selectedAnnouncement)}>
                          <option value="draft">草稿</option>
                          <option value="published">创建后立即发布</option>
                        </select>
                      </Field>
                      <Field label="开始时间（可选）">
                        <input type="datetime-local" className={inputClass} value={announcementDraft.startsAt} onChange={(event) => setAnnouncementDraft("announcementStartsAt", event.target.value)} />
                      </Field>
                      <Field label="结束时间（可选）">
                        <input type="datetime-local" className={inputClass} value={announcementDraft.endsAt} onChange={(event) => setAnnouncementDraft("announcementEndsAt", event.target.value)} />
                      </Field>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper">{selectedAnnouncement ? "保存公告修改" : "创建公告"}</button>
                      {selectedAnnouncement && selectedAnnouncement.status !== "published" ? (
                        <button type="button" onClick={() => runAction(`/api/admin/announcements/${selectedAnnouncement.id}/publish`, "POST", {}, { success: (response) => response.message ?? "公告已发布。" })} className="rounded-sm border border-ink/30 px-4 py-2 text-sm font-semibold">
                          发布
                        </button>
                      ) : null}
                      {selectedAnnouncement && selectedAnnouncement.status !== "archived" ? (
                        <button type="button" onClick={() => runAction(`/api/admin/announcements/${selectedAnnouncement.id}/archive`, "POST", {}, { success: (response) => response.message ?? "公告已归档。" })} className="rounded-sm border border-rust/40 px-4 py-2 text-sm font-semibold text-rust">
                          归档
                        </button>
                      ) : null}
                    </div>
                  </form>
                </Card>
              </div>
            </div>
          </div>
        );
      }
      return (
        <div className="grid gap-5">
          {renderContentTabs()}
          <div className={`grid gap-5 ${contentTab === "developer_contact" ? "xl:grid-cols-[360px_1fr]" : "xl:grid-cols-[380px_1fr]"}`}>
            <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-ink">{contentTab === "developer_contact" ? "联系开发者页面" : "已有内容"}</h2>
                <p className="mt-1 text-sm leading-6 text-ink/58">{contentTab === "developer_contact" ? "这是单页面内容；选择已有页面编辑，或新建替代页面。" : "展开目录、点击文档后在右侧编辑；新建内容单独进入新建模式。"}</p>
              </div>
              <span className="rounded-sm border border-ink/20 px-2 py-1 text-xs font-semibold text-moss">{visibleDocuments.length} / {tabDocuments.length}</span>
            </div>
            <div className="mt-4 grid gap-3">
              <input className={inputClass} value={contentTreeQuery} onChange={(event) => setContentTreeQuery(event.target.value)} placeholder="搜索标题、slug、摘要、状态" />
              <div className="flex flex-wrap gap-2">
                {contentTab === "developer_contact" ? (
                  <button type="button" onClick={() => startNewDocument("document")} className="rounded-sm bg-ink px-3 py-2 text-sm font-semibold text-paper">新建联系开发者页面</button>
                ) : (
                  <>
                    <button type="button" onClick={() => startNewDocument("folder")} className="rounded-sm bg-ink px-3 py-2 text-sm font-semibold text-paper">新建根文件夹</button>
                    <button type="button" onClick={() => startNewDocument("document")} className="rounded-sm border border-ink/30 px-3 py-2 text-sm font-semibold">新建根文档</button>
                  </>
                )}
              </div>
              <div className="max-h-[620px] overflow-auto border border-ink/15 bg-paper p-2">
                {contentTab === "developer_contact" ? (
                  visibleDocuments.length ? visibleDocuments.map((document: any) => (
                    <button
                      key={document.id}
                      type="button"
                      onClick={() => selectContentDocument(document)}
                      className={`block w-full border-b border-ink/10 px-3 py-3 text-left last:border-b-0 ${selectedDocument?.id === document.id ? "bg-coral/10" : "hover:bg-chalk"}`}
                    >
                      <span className="block font-semibold text-ink">{document.title}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink/52">
                        <StatusPill status={document.status} />
                        <span>/{document.slug}</span>
                      </span>
                    </button>
                  )) : <EmptyState title="暂无联系开发者页面" body="点击上方按钮新建内容。" />
                ) : (
                  <ContentDocumentTree
                    documents={documentTree}
                    selectedId={selectedDocument?.id}
                    expandedIds={contentExpandedIds}
                    onToggle={(id) => setContentExpandedIds((current) => {
                      const next = new Set(current);
                      if (next.has(id)) next.delete(id);
                      else next.add(id);
                      return next;
                    })}
                    onSelect={selectContentDocument}
                    onCreateFolder={(parent) => startNewDocument("folder", parent)}
                    onCreateDocument={(parent) => startNewDocument("document", parent)}
                    showStatus
                    selectFolders
                  />
                )}
              </div>
            </div>
          </Card>
          <div className="grid gap-5">
            <Card>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-ink">预览</h2>
                  <p className="mt-1 text-sm text-ink/56">{selectedDocument ? `正在编辑已有${contentNodeType(selectedDocument) === "folder" ? "文件夹" : "文档"}` : `正在新建${draft.nodeType === "folder" ? "文件夹" : "文档"}，尚未保存`}</p>
                </div>
                {selectedDocument ? (
                  <button type="button" onClick={() => runAction(`/api/admin/content/${selectedDocument.id}`, "DELETE", {}, { success: (response) => response.message ?? "内容已删除。", after: () => startNewDocument("document") })} className="border border-rust/40 px-3 py-2 text-sm font-semibold text-rust">
                    删除内容
                  </button>
                ) : null}
              </div>
              <ContentDocumentReader document={previewDocument} emptyTitle="选择或新建一篇文档" />
            </Card>
            <Card>
              <h2 className="text-xl font-semibold text-ink">{selectedDocument ? `编辑已有${draft.nodeType === "folder" ? "文件夹" : "文档"}` : `新建${draft.nodeType === "folder" ? "文件夹" : "文档"}`}</h2>
              <p className="mt-1 text-sm leading-6 text-ink/58">{selectedDocument ? "这里修改的是当前已保存内容。" : "这里创建的是全新内容；保存前不会影响已有内容。"}</p>
          <form
            className="mt-4 grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const body = {
                kind: draft.kind,
                nodeType: draft.nodeType,
                title: draft.title,
                slug: draft.slug || `${draft.kind}-${Date.now()}`,
                parentId: draft.parentId,
                summary: draft.summary,
                bodyMarkdown: draft.nodeType === "folder" ? "" : draft.bodyMarkdown,
                imageUrls: draft.nodeType === "folder" ? [] : draftImageUrls,
                status: draft.status,
                displayOrder: Number(draft.displayOrder) || 0
              };
              runAction(selectedDocument ? `/api/admin/content/${selectedDocument.id}` : "/api/admin/content", selectedDocument ? "PATCH" : "POST", body, {
                success: (response) => response.message ?? "文档已保存。",
                after: (response) => {
                  if (response.document?.id) {
                    setContentCreating(false);
                    setSelectedId(response.document.id);
                  }
                }
              });
            }}
          >
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="类型">
                <select className={inputClass} value={draft.kind} onChange={(event) => setDraft("contentKind", event.target.value)}>
                  <option value={activeDocumentKind}>{contentKindLabels[activeDocumentKind]}</option>
                </select>
              </Field>
              <Field label="节点">
                <select className={inputClass} value={draft.nodeType} onChange={(event) => setDraft("contentNodeType", event.target.value)} disabled={contentTab === "developer_contact"}>
                  <option value="folder">分类文件夹</option>
                  <option value="document">文档</option>
                </select>
              </Field>
              <Field label="状态">
                <select className={inputClass} value={draft.status} onChange={(event) => setDraft("contentStatus", event.target.value)}>
                  <option value="draft">draft</option>
                  <option value="published">published</option>
                  <option value="hidden">hidden</option>
                </select>
              </Field>
              <Field label="Slug">
                <input className={inputClass} value={draft.slug} onChange={(event) => setDraft("contentSlug", event.target.value)} />
              </Field>
              <Field label="排序">
                <input className={inputClass} type="number" value={draft.displayOrder} onChange={(event) => setDraft("contentDisplayOrder", event.target.value)} />
              </Field>
            </div>
            <Field label="标题">
              <input className={inputClass} value={draft.title} onChange={(event) => setDraft("contentTitle", event.target.value)} />
            </Field>
            {contentTab !== "developer_contact" ? (
              <Field label="父级文档">
                <select className={inputClass} value={draft.parentId} onChange={(event) => setDraft("contentParentId", event.target.value)}>
                  <option value="">无父级，作为根文档显示</option>
                  {parentOptions.map((document: any) => (
                    <option key={document.id} value={document.id}>{document.title} · /{document.slug}</option>
                  ))}
                </select>
              </Field>
            ) : null}
            {draft.nodeType === "document" ? (
              <>
                <Field label="摘要">
                  <input className={inputClass} value={draft.summary} onChange={(event) => setDraft("contentSummary", event.target.value)} />
                </Field>
                <Field label="图片 URL，逗号分隔，最多 3 张">
                  <input className={inputClass} value={draft.imageUrls} onChange={(event) => setDraft("contentImageUrls", event.target.value)} />
                </Field>
                <Field label="Markdown 正文">
                  <textarea className={inputClass} rows={12} value={draft.bodyMarkdown} onChange={(event) => setDraft("contentBodyMarkdown", event.target.value)} />
                </Field>
                <div className="grid gap-3 border border-ink/15 bg-chalk p-3">
                  <p className="text-sm font-semibold text-ink">预览</p>
                  <MarkdownRenderer>{draft.bodyMarkdown}</MarkdownRenderer>
                </div>
              </>
            ) : (
              <p className="border border-ink/15 bg-chalk px-3 py-2 text-sm leading-6 text-ink/62">分类文件夹只负责组织子文档，不编辑正文。请在文件夹上使用“新建文档”添加内容。</p>
            )}
            <button className="w-fit bg-ink px-4 py-2 text-sm font-semibold text-paper">{selectedDocument ? "更新内容" : "创建内容"}</button>
          </form>
            </Card>
          </div>
          </div>
        </div>
      );
    }

    if (resource === "versions") {
      const activeVersion = data?.activeVersion;
      const versions = data?.versions ?? [];
      const checkpoints = data?.checkpoints ?? [];
      return (
        <div className="grid gap-5">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="border border-ink/15 bg-chalk p-4 md:col-span-2">
              <p className="text-sm font-semibold uppercase tracking-wide text-ink/50">Active version</p>
              <h3 className="mt-1 text-xl font-semibold text-ink">{activeVersion?.name ?? "Unknown"}</h3>
              <p className="mt-2 text-sm text-ink/62">{activeVersion?.phase ?? "testing"} · {activeVersion?.status ?? "active"} · started {activeVersion?.startedAt ? new Date(activeVersion.startedAt).toLocaleString() : ""}</p>
            </div>
            <button
              type="button"
              disabled={Boolean(busyAction)}
              onClick={() => runAction("/api/admin/versions/checkpoints", "POST", { label: textFields.checkpointLabel, reason: textFields.checkpointReason }, {
                busy: "create-checkpoint",
                success: (response) => response.message ?? "已创建检查点。"
              })}
              className="rounded-sm border border-ink/40 px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {busyAction === "create-checkpoint" ? "创建中..." : "创建检查点"}
            </button>
            <input className={inputClass} placeholder="检查点名称（可选）" value={textFields.checkpointLabel ?? ""} onChange={(event) => setTextFields({ ...textFields, checkpointLabel: event.target.value })} />
          </div>

          <form
            className="grid gap-3 border border-rust/25 bg-rust/5 p-4 md:grid-cols-[1fr_160px_1fr_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              runAction("/api/admin/versions", "POST", {
                name: textFields.versionName,
                phase: textFields.versionPhase,
                notes: textFields.versionNotes,
                reason: textFields.versionReason
              }, {
                busy: "open-version",
                success: (response) => response.message ?? "已开启新版本。"
              });
            }}
          >
            <div className="md:col-span-4">
              <h3 className="text-lg font-semibold text-ink">Open a new blank version</h3>
              <p className="mt-1 text-sm leading-6 text-ink/62">会先保存当前版本最终状态，再开启新版本。普通用户、课程、学期、导入数据不复制；管理员账号和学校邮箱域名会复制，便于继续管理。</p>
            </div>
            <input className={inputClass} placeholder="新版本名称，例如 2026-05 online test" value={textFields.versionName ?? ""} onChange={(event) => setTextFields({ ...textFields, versionName: event.target.value })} />
            <select className={inputClass} value={textFields.versionPhase ?? "testing"} onChange={(event) => setTextFields({ ...textFields, versionPhase: event.target.value })}>
              {["testing", "staging", "production"].map((item) => <option key={item}>{item}</option>)}
            </select>
            <input className={inputClass} placeholder="原因 / 备注" value={textFields.versionReason ?? ""} onChange={(event) => setTextFields({ ...textFields, versionReason: event.target.value })} />
            <button disabled={Boolean(busyAction)} className="rounded-sm bg-rust px-4 py-2 text-sm font-semibold text-paper disabled:opacity-50">{busyAction === "open-version" ? "开启中..." : "开启新版本"}</button>
          </form>

          <div className="border border-ink/15">
            <div className="border-b border-ink/10 bg-chalk px-4 py-3">
              <h3 className="font-semibold text-ink">Versions</h3>
            </div>
            <div className="max-h-80 overflow-auto">
              <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                <thead className="sticky top-0 bg-ink text-paper"><tr>{["Name", "Phase", "Status", "Users", "Schools", "Imports", "Datasets", "Started", "Ended"].map((header) => <th key={header} className="px-3 py-2">{header}</th>)}</tr></thead>
                <tbody>
                  {versions.map((version: any) => (
                    <tr key={version.id} className="border-b border-ink/10">
                      <td className="px-3 py-2 font-semibold">{version.name}</td>
                      <td className="px-3 py-2">{version.phase}</td>
                      <td className="px-3 py-2"><StatusPill status={version.status} /></td>
                      <td className="px-3 py-2">{version.counts?.users ?? 0}</td>
                      <td className="px-3 py-2">{version.counts?.schools ?? 0}</td>
                      <td className="px-3 py-2">{version.counts?.importBatches ?? 0}</td>
                      <td className="px-3 py-2">{version.counts?.importDatasets ?? 0}</td>
                      <td className="px-3 py-2">{version.startedAt ? new Date(version.startedAt).toLocaleString() : ""}</td>
                      <td className="px-3 py-2">{version.endedAt ? new Date(version.endedAt).toLocaleString() : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border border-ink/15">
            <div className="border-b border-ink/10 bg-chalk px-4 py-3">
              <h3 className="font-semibold text-ink">Checkpoints</h3>
            </div>
            <div className="max-h-80 overflow-auto">
              <table className="w-full min-w-[860px] border-collapse text-left text-sm">
                <thead className="sticky top-0 bg-ink text-paper"><tr>{["Label", "Version", "Kind", "Summary", "Created", "Action"].map((header) => <th key={header} className="px-3 py-2">{header}</th>)}</tr></thead>
                <tbody>
                  {checkpoints.map((checkpoint: any) => (
                    <tr key={checkpoint.id} className="border-b border-ink/10">
                      <td className="px-3 py-2 font-semibold">{checkpoint.label}</td>
                      <td className="px-3 py-2">{checkpoint.appVersionName}</td>
                      <td className="px-3 py-2">{checkpoint.kind}</td>
                      <td className="max-w-[280px] truncate px-3 py-2 text-xs">{previewValue(checkpoint.summary)}</td>
                      <td className="px-3 py-2">{checkpoint.createdAt ? new Date(checkpoint.createdAt).toLocaleString() : ""}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <a className="rounded-sm border border-ink/30 px-2 py-1 text-xs font-semibold" href={checkpoint.downloadUrl}>下载</a>
                          <button
                            type="button"
                            className="rounded-sm border border-rust/50 px-2 py-1 text-xs font-semibold text-rust"
                            onClick={() => runAction(`/api/admin/versions/checkpoints/${checkpoint.id}/restore-as-new-version`, "POST", {}, {
                              busy: `restore-${checkpoint.id}`,
                              success: (response) => response.message ?? "已从检查点创建新版本。"
                            })}
                          >
                            恢复为新版本
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }

    if (resource === "logs") {
      const operationLogs = data?.operationLogs ?? [];
      const auditLogs = data?.logs ?? [];
      return (
        <div className="grid gap-5">
          <p className="text-sm leading-6 text-ink/62">操作日志记录写入、编辑和与他人的交互；翻页、跳转、只读浏览不会记录。</p>
          <div className="max-h-96 overflow-auto border border-ink/15">
            <table className="w-full min-w-[920px] border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-ink text-paper"><tr>{["Time", "Actor", "Action", "Target", "Status", "Summary"].map((header) => <th key={header} className="px-3 py-2">{header}</th>)}</tr></thead>
              <tbody>
                {operationLogs.map((log: any) => (
                  <tr key={log.id} className="border-b border-ink/10">
                    <td className="px-3 py-2">{log.createdAt ? new Date(log.createdAt).toLocaleString() : ""}</td>
                    <td className="px-3 py-2">{log.actor?.profile?.displayName ?? log.actor?.email ?? log.actorRole ?? "system"}</td>
                    <td className="px-3 py-2 font-semibold">{log.action}</td>
                    <td className="px-3 py-2">{log.targetType ?? ""} {log.targetId ?? ""}</td>
                    <td className="px-3 py-2"><StatusPill status={log.status} /></td>
                    <td className="max-w-[320px] truncate px-3 py-2 text-xs">{previewValue(log.summary)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details className="border border-ink/15 bg-chalk p-3">
            <summary className="cursor-pointer text-sm font-semibold text-ink">Admin audit details</summary>
            <div className="mt-3 max-h-72 overflow-auto">
              <table className="w-full min-w-[860px] border-collapse text-left text-xs">
                <thead className="sticky top-0 bg-ink text-paper"><tr>{["Time", "Admin", "Action", "Target", "After"].map((header) => <th key={header} className="px-3 py-2">{header}</th>)}</tr></thead>
                <tbody>
                  {auditLogs.map((log: any) => (
                    <tr key={log.id} className="border-b border-ink/10">
                      <td className="px-3 py-2">{log.createdAt ? new Date(log.createdAt).toLocaleString() : ""}</td>
                      <td className="px-3 py-2">{log.adminUser?.profile?.displayName ?? log.adminUser?.email}</td>
                      <td className="px-3 py-2">{log.action}</td>
                      <td className="px-3 py-2">{log.targetType} {log.targetId}</td>
                      <td className="max-w-[320px] truncate px-3 py-2">{previewValue(log.afterValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      );
    }

    if (resource === "error-events") {
      const events = data?.errorEvents ?? [];
      const summary = data?.summary ?? {};
      return (
        <div className="grid gap-5">
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <input
              className={inputClass}
              placeholder="搜索 errorCode / requestId / userId / path"
              value={errorEventQuery}
              onChange={(event) => setErrorEventQuery(event.target.value)}
            />
            <span className="rounded-sm border border-ink/20 px-3 py-2 text-sm font-semibold text-ink">{summary.total ?? events.length} events</span>
          </div>
          <div className="max-h-[560px] overflow-auto border border-ink/15">
            <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-ink text-paper">
                <tr>{["Time", "Code", "Request", "User", "Path", "Status", "Message"].map((header) => <th key={header} className="px-3 py-2">{header}</th>)}</tr>
              </thead>
              <tbody>
                {events.length ? events.map((event: any) => (
                  <tr key={event.id} className="border-b border-ink/10">
                    <td className="px-3 py-2">{event.createdAt ? new Date(event.createdAt).toLocaleString() : ""}</td>
                    <td className="px-3 py-2 font-semibold text-rust">{event.errorCode}</td>
                    <td className="max-w-[180px] truncate px-3 py-2 font-mono text-xs">{event.requestId}</td>
                    <td className="max-w-[200px] truncate px-3 py-2">{event.user?.profile?.displayName ?? event.user?.email ?? event.userId ?? "anonymous"}</td>
                    <td className="max-w-[260px] truncate px-3 py-2">{event.method} {event.path}</td>
                    <td className="px-3 py-2">{event.status}</td>
                    <td className="max-w-[320px] truncate px-3 py-2">{event.message}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={7} className="px-3 py-4 text-ink/48">没有匹配的错误事件。</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (resource === "course-submissions") {
      return (
        <div className="grid gap-3">
          <p className="text-sm leading-6 text-ink/62">缺失课程提交审核已弃用。新的 bug、报错、缺失课程都走 Support Tickets。</p>
          <Link href="/admin/support-tickets" className="w-fit rounded-sm border border-ink/40 px-4 py-2 text-sm font-semibold">
            去处理工单
          </Link>
        </div>
      );
    }

    if (resource === "course-imports") {
      const preview = actionData?.preview ?? actionData?.validation?.preview;
      const importBatches = data?.importBatches ?? [];
      const selectedBatch = importBatches.find((row: any) => row.id === selectedId) ?? importBatches[0];
      const selectedBatchId = selectedBatch?.id;
      const readableBatchLabel = (row: any) => {
        const years = row.cohortYears?.length ? `${row.cohortYears.join(", ")} admission` : "unknown admission";
        const counts = row.summary?.counts ?? {};
        const created = row.createdAt ? new Date(row.createdAt).toLocaleString() : "unknown time";
        return `${row.name ?? "Untitled"} · ${years} · preview ${row.semesterCode ?? "no activation term"} · ${counts.curriculumRules ?? 0} rules · ${row.status} · created ${created}`;
      };
      const pendingCount = importBatches.filter((row: any) => row.status === "pending").length;
      return (
        <div className="grid gap-5">
          <div className="border border-ink/15 bg-chalk p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-ink/50">Admission-year configuration operations</p>
                <h3 className="mt-1 text-xl font-semibold text-ink">导入队列与配置历史</h3>
                <p className="mt-1 text-sm text-ink/60">每一行是一份 JSON 配置操作。批准后会写入课程目录和 admission-year 课程安排规则；旧的 approved 行是历史记录，不代表同一 JSON 被拆成多个 pending。</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-sm bg-paper px-3 py-1 text-sm font-semibold text-ink">{pendingCount} pending</span>
                <span className="rounded-sm bg-paper px-3 py-1 text-sm font-semibold text-ink">{importBatches.length} total records</span>
              </div>
            </div>
            <div className="mt-4 max-h-80 overflow-auto border border-ink/10 bg-paper">
              <table className="w-full min-w-[920px] border-collapse text-left text-sm">
                <thead className="sticky top-0 bg-ink text-paper">
                  <tr>
                    {["配置名称", "Admission year", "激活预览学期", "状态", "课程目录项", "配置规则", "Warnings", "来源", "创建时间", "操作"].map((header) => <th key={header} className="px-3 py-2">{header}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {importBatches.map((row: any) => {
                    const counts = row.summary?.counts ?? {};
                    return (
                      <tr key={row.id} className={`border-b border-ink/10 ${selectedBatchId === row.id ? "bg-mist/60" : ""}`}>
                        <td className="px-3 py-2 font-semibold">{row.name ?? row.sourceLabel ?? "Untitled import"}</td>
                        <td className="px-3 py-2">{row.cohortYears?.length ? row.cohortYears.join(", ") : "Unknown"}</td>
                        <td className="px-3 py-2">{row.semesterCode ?? "None"}</td>
                        <td className="px-3 py-2"><StatusPill status={row.status} /></td>
                        <td className="px-3 py-2">{counts.courses ?? 0}</td>
                        <td className="px-3 py-2">{counts.curriculumRules ?? 0}</td>
                        <td className="px-3 py-2">{counts.warnings ?? 0}</td>
                        <td className="max-w-[260px] truncate px-3 py-2">{row.sourceLabel ?? row.summary?.sourceLabel ?? "Unknown source"}</td>
                        <td className="px-3 py-2">{row.createdAt ? new Date(row.createdAt).toLocaleString() : ""}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => { setSelectedId(row.id); loadCourseImportPreview(row.id); }} className="rounded-sm border border-ink/30 px-2 py-1 text-xs font-semibold">
                              查看差异
                            </button>
                            {row.status === "pending" ? (
                              <button
                                type="button"
                                disabled={Boolean(busyAction)}
                                onClick={() => {
                                  setSelectedId(row.id);
                                  runAction(`/api/admin/course-imports/${row.id}/approve`, "POST", {}, {
                                    busy: "approve-import",
                                    success: (response) => {
                                      const activated = response.result?.activatedBoards?.length ?? 0;
                                      return `已批准 ${row.name ?? "配置"}：课程目录和 admission-year 配置规则已写入，激活/复用 ${activated} 个 Course Board。`;
                                    }
                                  });
                                }}
                                className="rounded-sm bg-forest px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
                              >
                                批准
                              </button>
                            ) : null}
                            {row.status === "pending" ? (
                              <button
                                type="button"
                                disabled={Boolean(busyAction)}
                                onClick={() => {
                                  const note = window.prompt("拒绝原因 / 管理备注，可留空") ?? "";
                                  setSelectedId(row.id);
                                  runAction(`/api/admin/course-imports/${row.id}/reject`, "POST", { adminNote: note }, {
                                    busy: "reject-import",
                                    success: () => `已拒绝 ${row.name ?? "该配置"}，课程目录和配置规则未改变。`
                                  });
                                }}
                                className="rounded-sm border border-rust px-2 py-1 text-xs font-semibold text-rust disabled:opacity-50"
                              >
                                拒绝
                              </button>
                            ) : null}
                            {row.dataset?.downloadUrl ? <a className="rounded-sm border border-ink/30 px-2 py-1 text-xs font-semibold" href={row.dataset.downloadUrl}>下载</a> : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <form
            className="grid gap-3 border border-ink/15 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              runAction("/api/admin/course-imports", "POST", { payload: textFields.payload, name: textFields.importName }, {
                busy: "create-import",
                success: (response) => {
                  const summary = response.importBatch?.summary;
                  const counts = summary?.counts ?? response.validation?.counts ?? {};
                  const years = response.importBatch?.cohortYears?.join(", ") || summary?.cohortYears?.join(", ") || "unknown";
                  return `已创建待审批配置：${years} admission，${counts.courses ?? 0} courses，${counts.curriculumRules ?? 0} rules。`;
                },
                after: (response) => {
                  if (response.importBatch?.id) setSelectedId(response.importBatch.id);
                  setImportPreviewTab("coverage");
                }
              });
            }}
          >
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-ink/50">Step 1</p>
              <h3 className="mt-1 text-lg font-semibold text-ink">Paste and validate JSON</h3>
              <p className="mt-1 text-sm text-ink/60">校验只读取 JSON，不写入数据库；创建待审批配置只会生成一条 pending 操作。系统会把 JSON 理解为课程目录、admission-year 配置规则和来源证据，便于之后查询、编辑、审计和回溯。</p>
              <p className="mt-1 text-xs text-ink/50">如果 JSON 来自 crawler，请粘贴单个 “可导入 JSON：bnbu-YYYY-admission-handbook.teamaking.json”。“下载整包备份”包含多个文件，不能作为一份配置直接导入。</p>
            </div>
            <input
              className={inputClass}
              placeholder="本次配置名称，例如 2025 admission handbook · first full import"
              value={textFields.importName ?? ""}
              onChange={(event) => setTextFields({ ...textFields, importName: event.target.value })}
            />
            <textarea
              className={`${inputClass} min-h-[220px] font-mono text-xs`}
              placeholder='粘贴 BNBU cleaned JSON，例如 {"schemaVersion":"teamaking.bnbu_course_import.v2", ...}'
              value={textFields.payload ?? ""}
              onChange={(event) => setTextFields({ ...textFields, payload: event.target.value })}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={Boolean(busyAction)}
                onClick={() => runAction("/api/admin/course-imports/validate", "POST", { payload: textFields.payload }, {
                  busy: "validate-import",
                  success: (response) => {
                    const counts = response.validation?.counts ?? {};
                    const years = response.preview?.coverage?.cohortYears?.map((item: any) => item.key).join(", ") || "unknown";
                    return `校验通过：${years} admission，${counts.courses ?? 0} courses，${counts.curriculumRules ?? 0} rules，${response.validation?.warnings?.length ?? 0} warnings。`;
                  },
                  after: () => setImportPreviewTab("coverage")
                })}
                className="rounded-sm border border-ink/40 px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {busyAction === "validate-import" ? "校验中..." : "校验 JSON"}
              </button>
              <button disabled={Boolean(busyAction)} className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper disabled:opacity-50">
                {busyAction === "create-import" ? "创建中..." : "创建待审批配置"}
              </button>
            </div>
          </form>
          <div className="border border-ink/15 p-4">
            <div className="mb-3">
              <p className="text-sm font-semibold uppercase tracking-wide text-ink/50">Step 2</p>
              <h3 className="mt-1 text-lg font-semibold text-ink">Preview, search, edit and compare</h3>
              <p className="mt-1 text-sm text-ink/60">Diff 的基线是当前数据库 active 数据；课程目录和 admission-year 配置规则分开显示。</p>
            </div>
          {renderCourseImportPreview(preview)}
          </div>
          <form
            className="grid gap-3 border border-ink/15 p-4 md:grid-cols-[1fr_auto_1fr_auto_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              runAction(`/api/admin/course-imports/${selectedBatchId}/approve`, "POST", {}, {
                busy: "approve-import",
                success: (response) => {
                  const activated = response.result?.activatedBoards?.length ?? 0;
                  return `已批准导入：激活/复用 ${activated} 个 Course Board，课程目录和 admission-year 配置规则已写入。`;
                }
              });
            }}
          >
            <div className="md:col-span-5">
              <p className="text-sm font-semibold uppercase tracking-wide text-ink/50">Step 3</p>
              <h3 className="mt-1 text-lg font-semibold text-ink">Approve or reject one pending configuration</h3>
            </div>
            <select className={inputClass} value={selectedBatchId ?? ""} onChange={(event) => setSelectedId(event.target.value)}>
              {importBatches.map((row: any) => <option key={row.id} value={row.id}>{readableBatchLabel(row)}</option>)}
            </select>
            <button type="button" onClick={() => loadCourseImportPreview(selectedBatchId)} className="rounded-sm border border-ink/40 px-4 py-2 text-sm font-semibold">
              {busyAction === "load-import-diff" ? "载入中..." : "查看差异"}
            </button>
            <input className={inputClass} placeholder="拒绝原因 / 管理备注" value={adminNote} onChange={(event) => setAdminNote(event.target.value)} />
            <button disabled={!selectedBatchId || Boolean(busyAction)} className="rounded-sm bg-forest px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busyAction === "approve-import" ? "批准中..." : "批准导入"}</button>
            <button
              type="button"
              disabled={!selectedBatchId || Boolean(busyAction)}
              onClick={() => runAction(`/api/admin/course-imports/${selectedBatchId}/reject`, "POST", { adminNote }, {
                busy: "reject-import",
                success: () => "已拒绝该待审批配置，数据库课程和规则未改变。"
              })}
              className="rounded-sm border border-rust px-4 py-2 text-sm font-semibold text-rust disabled:opacity-50"
            >
              {busyAction === "reject-import" ? "拒绝中..." : "拒绝"}
            </button>
          </form>
        </div>
      );
    }

    if (resource === "users") {
      return (
        <form
          className="grid gap-3 md:grid-cols-6"
          onSubmit={(event) => {
            event.preventDefault();
            runAction(`/api/admin/users/${selectedId}`, "PATCH", { role, status, suspendedUntil: textFields.suspendedUntil, adminNote, onboardingCompleted: true });
          }}
        >
          <select className={inputClass} value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
            {primaryRows.map((row) => <option key={row.id} value={row.id}>{selectedLabel(row)}</option>)}
          </select>
          <select className={inputClass} value={role} onChange={(event) => setRole(event.target.value)}>
            {["verified_user", "profile_completed_user", "course_moderator", "school_admin", "super_admin"].map((item) => <option key={item}>{item}</option>)}
          </select>
          <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>
            {["active", "suspended", "banned"].map((item) => <option key={item}>{item}</option>)}
          </select>
          <input className={inputClass} type="datetime-local" value={textFields.suspendedUntil ?? ""} onChange={(event) => setTextFields({ ...textFields, suspendedUntil: event.target.value })} />
          <input className={inputClass} placeholder="管理员备注" value={adminNote} onChange={(event) => setAdminNote(event.target.value)} />
          <button className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper">保存用户</button>
        </form>
      );
    }

    if (resource === "admin-users") {
      const adminUsers = data?.adminUsers ?? [];
      return (
        <div className="grid gap-5">
          <form
            className="grid gap-3 md:grid-cols-5"
            onSubmit={(event) => {
              event.preventDefault();
              runAction("/api/admin/admin-users", "POST", {
                email: textFields.email,
                password: textFields.password,
                displayName: textFields.displayName,
                role
              }, {
                busy: "create-admin-user",
                success: (response) => response.message ?? "管理员账号已创建。"
              });
            }}
          >
            <input className={inputClass} placeholder="管理员邮箱" value={textFields.email ?? ""} onChange={(event) => setTextFields({ ...textFields, email: event.target.value })} />
            <input className={inputClass} placeholder="显示名" value={textFields.displayName ?? ""} onChange={(event) => setTextFields({ ...textFields, displayName: event.target.value })} />
            <input className={inputClass} type="password" placeholder="初始密码" value={textFields.password ?? ""} onChange={(event) => setTextFields({ ...textFields, password: event.target.value })} />
            <select className={inputClass} value={role} onChange={(event) => setRole(event.target.value)}>
              {["school_admin", "course_moderator", "super_admin"].map((item) => <option key={item}>{item}</option>)}
            </select>
            <button disabled={Boolean(busyAction)} className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper disabled:opacity-50">
              {busyAction === "create-admin-user" ? "保存中..." : "创建/重置管理员"}
            </button>
          </form>
          <div className="overflow-auto border border-ink/15">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead className="bg-ink text-paper"><tr>{["Email", "Display name", "Role", "Status"].map((header) => <th key={header} className="px-3 py-2">{header}</th>)}</tr></thead>
              <tbody>
                {adminUsers.map((user: any) => (
                  <tr key={user.id} className="border-b border-ink/10">
                    <td className="px-3 py-2">{user.email}</td>
                    <td className="px-3 py-2">{user.profile?.displayName ?? ""}</td>
                    <td className="px-3 py-2"><StatusPill status={user.role} /></td>
                    <td className="px-3 py-2"><StatusPill status={user.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (resource === "schools") {
      return (
        <form
          className="grid gap-3 md:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            runAction("/api/admin/schools", "POST", {
              name: textFields.name,
              shortName: textFields.shortName,
              domains: (textFields.domains ?? "").split(",").map((item) => item.trim()).filter(Boolean)
            });
          }}
        >
          <input className={inputClass} placeholder="学校名称" value={textFields.name ?? ""} onChange={(event) => setTextFields({ ...textFields, name: event.target.value })} />
          <input className={inputClass} placeholder="简称" value={textFields.shortName ?? ""} onChange={(event) => setTextFields({ ...textFields, shortName: event.target.value })} />
          <input className={inputClass} placeholder="邮箱域名，逗号分隔" value={textFields.domains ?? ""} onChange={(event) => setTextFields({ ...textFields, domains: event.target.value })} />
          <button className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper">新增学校</button>
        </form>
      );
    }

    if (resource === "majors") {
      const schools = data?.schools ?? [];
      const selectedSchoolId = textFields.schoolId || schools[0]?.id || "";
      const faculties = (data?.faculties ?? []).filter((faculty: any) => !selectedSchoolId || faculty.schoolId === selectedSchoolId);
      const selectedType = textFields.type ?? "major";
      return (
        <form
          className="grid gap-3 md:grid-cols-6"
          onSubmit={(event) => {
            event.preventDefault();
            runAction("/api/admin/majors", "POST", {
              ...textFields,
              schoolId: selectedSchoolId,
              facultyId: textFields.facultyId || faculties[0]?.id
            });
          }}
        >
          <select className={inputClass} value={selectedType} onChange={(event) => setTextFields({ ...textFields, type: event.target.value })}>
            <option value="faculty">Faculty</option>
            <option value="major">Major</option>
            <option value="semester">Semester</option>
          </select>
          <select className={inputClass} value={selectedSchoolId} onChange={(event) => setTextFields({ ...textFields, schoolId: event.target.value, facultyId: "" })}>
            {schools.map((school: any) => <option key={school.id} value={school.id}>{school.shortName} · {school.name}</option>)}
          </select>
          <input className={inputClass} placeholder="名称" value={textFields.name ?? ""} onChange={(event) => setTextFields({ ...textFields, name: event.target.value })} />
          {selectedType === "major" ? (
            <select className={inputClass} value={textFields.facultyId || faculties[0]?.id || ""} onChange={(event) => setTextFields({ ...textFields, facultyId: event.target.value })}>
              {faculties.map((faculty: any) => <option key={faculty.id} value={faculty.id}>{faculty.name}</option>)}
            </select>
          ) : null}
          {selectedType === "semester" ? (
            <>
              <input className={inputClass} placeholder="年份，例如 2025" value={textFields.year ?? ""} onChange={(event) => setTextFields({ ...textFields, year: event.target.value })} />
              <select className={inputClass} value={textFields.term ?? "Fall"} onChange={(event) => setTextFields({ ...textFields, term: event.target.value })}>
                {["Fall", "Spring", "Summer"].map((item) => <option key={item}>{item}</option>)}
              </select>
            </>
          ) : null}
          <button className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper">新增结构项</button>
        </form>
      );
    }

    if (resource === "courses") {
      const courses = data?.courses ?? [];
      const pagination = data?.pagination ?? { page: 1, totalPages: 1, total: courses.length };
      const sources = data?.filters?.sources ?? [];
      const tags = data?.filters?.tags ?? [];
      return (
        <div className="grid gap-5">
          <div className="border border-ink/15 bg-chalk p-4">
            <h3 className="text-lg font-semibold text-ink">Course catalog search</h3>
            <p className="mt-1 text-sm leading-6 text-ink/62">课程目录是 Course；每届学生课程安排是 curriculum rules。相同 title 可以对应不同 code，实际身份以课程代码为准。</p>
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_160px_180px_1fr_auto_auto]">
              <input className={inputClass} placeholder="Search code or title, e.g. Principles of" value={courseQuery} onChange={(event) => { setCourseQuery(event.target.value); setCoursePage(1); }} />
              <select className={inputClass} value={courseStatusFilter} onChange={(event) => { setCourseStatusFilter(event.target.value); setCoursePage(1); }}>
                {["all", "active", "inactive", "archived"].map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select className={inputClass} value={courseSourceFilter} onChange={(event) => { setCourseSourceFilter(event.target.value); setCoursePage(1); }}>
                <option value="all">all sources</option>
                {sources.map((item: string) => <option key={item} value={item}>{item}</option>)}
              </select>
              <input className={inputClass} list="course-tag-options" placeholder="Filter tag" value={courseTagFilter} onChange={(event) => { setCourseTagFilter(event.target.value); setCoursePage(1); }} />
              <datalist id="course-tag-options">{tags.map((item: string) => <option key={item} value={item} />)}</datalist>
              <button type="button" className="rounded-sm border border-ink/30 px-3 py-2 text-sm font-semibold" onClick={() => setCoursePage(Math.max(1, coursePage - 1))}>Prev</button>
              <button type="button" className="rounded-sm border border-ink/30 px-3 py-2 text-sm font-semibold" onClick={() => setCoursePage(Math.min(pagination.totalPages ?? 1, coursePage + 1))}>Next</button>
            </div>
            <p className="mt-3 text-sm font-semibold text-ink/64">Page {pagination.page ?? coursePage} / {pagination.totalPages ?? 1} · {pagination.total ?? courses.length} courses</p>
            <div className="mt-4 max-h-[520px] overflow-auto border border-ink/10 bg-paper">
              <table className="w-full min-w-[980px] border-collapse text-left text-sm">
                <thead className="sticky top-0 bg-ink text-paper">
                  <tr>
                    {["Code", "Title", "Credits", "Status", "Source", "Tags", "Usage", "Action"].map((header) => <th key={header} className="px-3 py-2">{header}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {courses.map((course: any) => (
                    <tr key={course.id} className={`border-b border-ink/10 ${selectedCourse?.id === course.id ? "bg-mist/60" : ""}`}>
                      <td className="px-3 py-2 font-semibold">{course.code}</td>
                      <td className="px-3 py-2">{course.title}</td>
                      <td className="px-3 py-2">{course.credits ?? ""}</td>
                      <td className="px-3 py-2"><StatusPill status={course.status} /></td>
                      <td className="px-3 py-2">{course.source}</td>
                      <td className="max-w-[260px] px-3 py-2 text-xs text-ink/62">{Array.isArray(course.categoryTags) ? course.categoryTags.join(", ") : ""}</td>
                      <td className="px-3 py-2 text-xs text-ink/62">{course.usage?.totalRules ?? 0} rules · {course._count?.offerings ?? 0} offerings</td>
                      <td className="px-3 py-2">
                        <button type="button" className="rounded-sm border border-ink/30 px-2 py-1 text-xs font-semibold" onClick={() => openCourseEditor(course)}>Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {selectedCourse ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-ink/15 bg-mist/30 px-3 py-2 text-sm">
                <p className="font-semibold text-ink">正在编辑：{selectedCourse.code} · {selectedCourse.title}</p>
                <button type="button" className="rounded-sm border border-ink/30 px-3 py-1 font-semibold" onClick={() => courseEditorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                  跳到编辑表单
                </button>
              </div>
            ) : (
              <p className="mt-4 border border-ink/10 bg-paper px-3 py-2 text-sm text-ink/62">点击某门课程右侧的 Edit 后，会打开这门课的视觉化编辑表单。</p>
            )}
          </div>

          <form
            className="grid gap-3 border border-ink/15 p-4 md:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              runAction("/api/admin/courses", "POST", textFields, {
                busy: "create-course",
                success: (response) => `已新增课程：${response.course?.code} ${response.course?.title}`,
                after: (response) => {
                  if (response.course?.id) setSelectedId(response.course.id);
                  setTextFields({});
                }
              });
            }}
          >
            <div className="md:col-span-4">
              <h3 className="text-lg font-semibold text-ink">Add course</h3>
              <p className="mt-1 text-sm text-ink/62">默认添加到 BNBU，不需要填写内部 schoolId。</p>
            </div>
            <input className={inputClass} placeholder="课程代码" value={textFields.code ?? ""} onChange={(event) => setTextFields({ ...textFields, code: event.target.value })} />
            <input className={inputClass} placeholder="课程名称" value={textFields.title ?? ""} onChange={(event) => setTextFields({ ...textFields, title: event.target.value })} />
            <input className={inputClass} placeholder="学分" value={textFields.credits ?? ""} onChange={(event) => setTextFields({ ...textFields, credits: event.target.value })} />
            <input className={inputClass} placeholder="标签，逗号分隔" value={textFields.categoryTags ?? ""} onChange={(event) => setTextFields({ ...textFields, categoryTags: event.target.value })} />
            <textarea className={`${inputClass} md:col-span-3`} rows={3} placeholder="课程描述" value={textFields.description ?? ""} onChange={(event) => setTextFields({ ...textFields, description: event.target.value })} />
            <button disabled={Boolean(busyAction)} className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper disabled:opacity-50">{busyAction === "create-course" ? "新增中..." : "新增课程"}</button>
          </form>

          {selectedCourse ? (
            <div ref={courseEditorRef} className="scroll-mt-24 grid gap-4 border border-ink/15 p-4">
              <div>
                <h3 className="text-lg font-semibold text-ink">Edit {selectedCourse.code} · {selectedCourse.title}</h3>
                <p className="mt-1 text-sm text-ink/62">保存后这些字段会被标记为管理员手动覆盖，后续 JSON 导入默认不覆盖它们。</p>
              </div>
              <form
                className="grid gap-3 md:grid-cols-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  runAction(`/api/admin/courses/${selectedCourse.id}`, "PATCH", courseDraftPayload(), {
                    busy: "save-course",
                    success: (response) => `已保存课程：${response.course?.code} ${response.course?.title}`
                  });
                }}
              >
                <Field label="Code"><input className={inputClass} value={courseDraft.code ?? ""} onChange={(event) => setCourseDraft({ ...courseDraft, code: event.target.value })} /></Field>
                <Field label="Title"><input className={inputClass} value={courseDraft.title ?? ""} onChange={(event) => setCourseDraft({ ...courseDraft, title: event.target.value })} /></Field>
                <Field label="Credits"><input className={inputClass} value={courseDraft.credits ?? ""} onChange={(event) => setCourseDraft({ ...courseDraft, credits: event.target.value })} /></Field>
                <Field label="Course type"><input className={inputClass} value={courseDraft.courseType ?? ""} onChange={(event) => setCourseDraft({ ...courseDraft, courseType: event.target.value })} /></Field>
                <Field label="Status">
                  <select className={inputClass} value={courseDraft.status ?? "active"} onChange={(event) => setCourseDraft({ ...courseDraft, status: event.target.value })}>
                    {["active", "inactive", "archived"].map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </Field>
                <Field label="Category tags"><input className={inputClass} value={courseDraft.categoryTags ?? ""} onChange={(event) => setCourseDraft({ ...courseDraft, categoryTags: event.target.value })} /></Field>
                <Field label="Owner unit JSON"><textarea className={inputClass} rows={4} value={courseDraft.ownerUnit ?? "{}"} onChange={(event) => setCourseDraft({ ...courseDraft, ownerUnit: event.target.value })} /></Field>
                <Field label="Manual note"><textarea className={inputClass} rows={4} value={courseDraft.manualNote ?? ""} onChange={(event) => setCourseDraft({ ...courseDraft, manualNote: event.target.value })} /></Field>
                <Field label="Description"><textarea className={inputClass} rows={4} value={courseDraft.description ?? ""} onChange={(event) => setCourseDraft({ ...courseDraft, description: event.target.value })} /></Field>
                <div className="md:col-span-3">
                  <button disabled={Boolean(busyAction)} className="rounded-sm bg-forest px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busyAction === "save-course" ? "保存中..." : "保存课程"}</button>
                </div>
              </form>
              <div className="grid gap-4 border border-ink/15 bg-chalk p-3">
                <div>
                  <p className="text-sm font-semibold text-ink">Course offerings</p>
                  <p className="mt-1 text-xs text-ink/58">Course 是课程目录；CourseOffering 是某学期开课配置，可从这里生成或复用 Course Board。</p>
                </div>
                <form
                  className="grid gap-3 md:grid-cols-5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    runAction(`/api/admin/courses/${selectedCourse.id}/offerings`, "POST", {
                      semesterId: textFields.offeringSemesterId || data?.semesters?.[0]?.id,
                      teacherName: textFields.offeringTeacherName,
                      section: textFields.offeringSection,
                      status: textFields.offeringStatus || "active",
                      createBoard: true,
                      boardTitle: textFields.offeringBoardTitle
                    }, {
                      busy: "create-offering",
                      success: (response) => response.reused ? "已复用并更新开课配置。" : "已新增开课配置并生成 Course Board。"
                    });
                  }}
                >
                  <select className={inputClass} value={textFields.offeringSemesterId || data?.semesters?.[0]?.id || ""} onChange={(event) => setTextFields({ ...textFields, offeringSemesterId: event.target.value })}>
                    {(data?.semesters ?? []).map((semester: any) => <option key={semester.id} value={semester.id}>{semester.name} · {semester.term}</option>)}
                  </select>
                  <input className={inputClass} placeholder="老师（可选）" value={textFields.offeringTeacherName ?? ""} onChange={(event) => setTextFields({ ...textFields, offeringTeacherName: event.target.value })} />
                  <input className={inputClass} placeholder="Section（可选）" value={textFields.offeringSection ?? ""} onChange={(event) => setTextFields({ ...textFields, offeringSection: event.target.value })} />
                  <input className={inputClass} placeholder="Board 标题（可选）" value={textFields.offeringBoardTitle ?? ""} onChange={(event) => setTextFields({ ...textFields, offeringBoardTitle: event.target.value })} />
                  <button disabled={Boolean(busyAction)} className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper disabled:opacity-50">{busyAction === "create-offering" ? "保存中..." : "新增开课"}</button>
                </form>
                <div className="max-h-52 overflow-auto border border-ink/10 bg-paper">
                  <table className="w-full min-w-[760px] border-collapse text-left text-xs">
                    <thead className="bg-ink text-paper"><tr>{["Semester", "Teacher", "Section", "Boards", "Status"].map((header) => <th key={header} className="px-3 py-2">{header}</th>)}</tr></thead>
                    <tbody>
                      {(selectedCourse.offerings ?? []).map((offering: any) => (
                        <tr key={offering.id} className="border-b border-ink/10">
                          <td className="px-3 py-2">{offering.semester?.name ?? ""}</td>
                          <td className="px-3 py-2">{offering.teacherName ?? ""}</td>
                          <td className="px-3 py-2">{offering.section ?? ""}</td>
                          <td className="px-3 py-2">{offering.boards?.length ?? 0}</td>
                          <td className="px-3 py-2"><StatusPill status={offering.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <form
                className="grid gap-3 border border-rust/30 bg-rust/5 p-3 md:grid-cols-[1fr_1fr_auto]"
                onSubmit={(event) => {
                  event.preventDefault();
                  runAction(`/api/admin/courses/${selectedCourse.id}/merge`, "POST", {
                    targetCourseId: textFields.mergeTargetCourseId,
                    adminNote: textFields.mergeNote
                  }, {
                    busy: "merge-course",
                    success: (response) => response.message ?? "课程已合并。"
                  });
                }}
              >
                <select className={inputClass} value={textFields.mergeTargetCourseId ?? ""} onChange={(event) => setTextFields({ ...textFields, mergeTargetCourseId: event.target.value })}>
                  <option value="">选择合并目标课程</option>
                  {courses.filter((course: any) => course.id !== selectedCourse.id).map((course: any) => <option key={course.id} value={course.id}>{course.code} · {course.title}</option>)}
                </select>
                <input className={inputClass} placeholder="合并备注（可选）" value={textFields.mergeNote ?? ""} onChange={(event) => setTextFields({ ...textFields, mergeNote: event.target.value })} />
                <button disabled={Boolean(busyAction) || !textFields.mergeTargetCourseId} className="rounded-sm border border-rust px-4 py-2 text-sm font-semibold text-rust disabled:opacity-50">{busyAction === "merge-course" ? "合并中..." : "合并并归档源课"}</button>
              </form>
              <details className="border border-ink/15 bg-chalk p-3">
                <summary className="cursor-pointer text-sm font-semibold text-ink">Advanced JSON editor</summary>
                <p className="mt-2 text-sm leading-6 text-ink/60">备用入口：只接受课程目录字段，不直接编辑内部 schoolId、rule 或 offering。</p>
                <textarea
                  className={`${inputClass} mt-3 font-mono text-xs`}
                  rows={12}
                  value={courseDraft.rawJson ?? courseRawJsonText()}
                  onChange={(event) => setCourseDraft({ ...courseDraft, rawJson: event.target.value })}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-sm border border-ink/30 px-3 py-2 text-sm font-semibold"
                    onClick={() => setCourseDraft({ ...courseDraft, rawJson: courseRawJsonText() })}
                  >
                    从表单生成 JSON
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(busyAction)}
                    className="rounded-sm bg-ink px-3 py-2 text-sm font-semibold text-paper disabled:opacity-50"
                    onClick={() => {
                      try {
                        const payload = coursePayloadFromRawJson(courseDraft.rawJson ?? "{}");
                        runAction(`/api/admin/courses/${selectedCourse.id}`, "PATCH", payload, {
                          busy: "save-course-json",
                          success: (response) => `已通过 JSON 保存课程：${response.course?.code} ${response.course?.title}`
                        });
                      } catch (error) {
                        setResult({ type: "error", message: error instanceof Error ? error.message : "课程 JSON 格式错误。" });
                      }
                    }}
                  >
                    {busyAction === "save-course-json" ? "保存中..." : "使用 JSON 保存"}
                  </button>
                </div>
              </details>
              <div className="grid gap-3 md:grid-cols-4">
                <div className="border border-ink/15 bg-chalk p-3">
                  <p className="text-sm font-semibold text-ink">Manual override fields</p>
                  <p className="mt-2 text-sm text-ink/62">{Array.isArray(selectedCourse.manualOverrideFields) && selectedCourse.manualOverrideFields.length ? selectedCourse.manualOverrideFields.join(", ") : "None"}</p>
                </div>
                {[
                  ["Admission years", selectedCourse.usage?.cohortYears],
                  ["Majors", selectedCourse.usage?.majors],
                  ["Relative terms", selectedCourse.usage?.relativeTerms],
                  ["Academic terms", selectedCourse.usage?.academicTerms]
                ].map(([label, values]) => (
                  <div key={label as string} className="max-h-44 overflow-auto border border-ink/15 bg-chalk p-3">
                    <p className="text-sm font-semibold text-ink">{label as string}</p>
                    <div className="mt-2 grid gap-1 text-sm text-ink/62">
                      {Array.isArray(values) && values.length ? values.slice(0, 12).map((item: any) => <p key={item.key} className="flex justify-between gap-3"><span>{item.key}</span><strong>{item.count}</strong></p>) : <p>None</p>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="border border-ink/15">
                <div className="border-b border-ink/10 bg-chalk px-3 py-2">
                  <p className="text-sm font-semibold text-ink">Academic term configuration</p>
                  <p className="mt-1 text-xs text-ink/58">显示这门课会在真实哪个学期配置给哪年入学、哪个专业或受众的学生。</p>
                </div>
                <div className="max-h-72 overflow-auto">
                  <table className="w-full min-w-[920px] border-collapse text-left text-xs">
                    <thead className="sticky top-0 bg-ink text-paper"><tr>{["Academic term", "Admission", "Audience", "Relative term", "Classification", "Action", "Rule"].map((header) => <th key={header} className="px-3 py-2">{header}</th>)}</tr></thead>
                    <tbody>
                      {(selectedCourse.usage?.academicTermRows ?? []).length ? (selectedCourse.usage?.academicTermRows ?? []).map((row: any) => (
                        <tr key={`${row.ruleId}-${row.entryYear}-${row.audience}-${row.relativeTermCode}`} className="border-b border-ink/10">
                          <td className="px-3 py-2 font-semibold">{row.academicTermLabel}</td>
                          <td className="px-3 py-2">{row.entryYear} {row.entryTerm}</td>
                          <td className="px-3 py-2">{row.audience}</td>
                          <td className="px-3 py-2">{row.relativeTermCode}</td>
                          <td className="px-3 py-2">{row.classification}</td>
                          <td className="px-3 py-2">{row.studentAction}</td>
                          <td className="px-3 py-2">{row.externalId}</td>
                        </tr>
                      )) : (
                        <tr>
                          <td className="px-3 py-4 text-sm text-ink/48" colSpan={7}>No academic term configuration rows for this course.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="max-h-72 overflow-auto border border-ink/15">
                <table className="w-full min-w-[820px] border-collapse text-left text-xs">
                  <thead className="sticky top-0 bg-ink text-paper"><tr>{["Rule", "Admission", "Major", "Term", "Classification", "Action"].map((header) => <th key={header} className="px-3 py-2">{header}</th>)}</tr></thead>
                  <tbody>
                    {(selectedCourse.usage?.rules ?? []).map((rule: any) => (
                      <tr key={rule.id} className="border-b border-ink/10">
                        <td className="px-3 py-2">{rule.externalId}</td>
                        <td className="px-3 py-2">{rule.cohortYears?.join(", ")}</td>
                        <td className="px-3 py-2">{rule.allMajors ? "ALL" : rule.majorCodes?.join(", ")}</td>
                        <td className="px-3 py-2">{rule.relativeTermCodes?.join(", ")}</td>
                        <td className="px-3 py-2">{rule.classification}</td>
                        <td className="px-3 py-2">{rule.studentAction}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      );
    }

    if (resource === "boards") {
      const offerings = data?.offerings ?? [];
      const selectedOfferingId = textFields.courseOfferingId || offerings[0]?.id || "";
      const offeringLabel = (offering: any) => `${offering.course?.code ?? ""} ${offering.course?.title ?? ""} · ${offering.semester?.name ?? ""}${offering.section ? ` · ${offering.section}` : ""}`;
      return (
        <div className="grid gap-5">
          <form
            className="grid gap-3 md:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              runAction("/api/admin/boards", "POST", {
                courseOfferingId: selectedOfferingId,
                title: textFields.title,
                rules: textFields.rules,
                status
              });
            }}
          >
            <select className={inputClass} value={selectedOfferingId} onChange={(event) => setTextFields({ ...textFields, courseOfferingId: event.target.value })}>
              {offerings.map((offering: any) => <option key={offering.id} value={offering.id}>{offeringLabel(offering)}</option>)}
            </select>
            <input className={inputClass} placeholder="Course Board 标题" value={textFields.title ?? ""} onChange={(event) => setTextFields({ ...textFields, title: event.target.value })} />
            <input className={inputClass} placeholder="规则文案（可选）" value={textFields.rules ?? ""} onChange={(event) => setTextFields({ ...textFields, rules: event.target.value })} />
            <button className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper">新增 Course Board</button>
          </form>
          <form
            className="grid gap-3 md:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              runAction(`/api/admin/boards/${selectedId}`, "PATCH", { status, title: textFields.title, rules: textFields.rules });
            }}
          >
            <select className={inputClass} value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
              {primaryRows.map((row) => <option key={row.id} value={row.id}>{selectedLabel(row)}</option>)}
            </select>
            <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>
              {["active", "paused", "closed"].map((item) => <option key={item}>{item}</option>)}
            </select>
            <input className={inputClass} placeholder="规则文案（可选）" value={textFields.rules ?? ""} onChange={(event) => setTextFields({ ...textFields, rules: event.target.value })} />
            <button className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper">保存 Course Board</button>
          </form>
        </div>
      );
    }

    if (resource === "teamaking-posts" || resource === "team-up-requests") {
      const statusOptions = resource === "teamaking-posts" ? ["open", "paused", "closed", "expired"] : ["reported", "closed", "deleted"];
      const path = resource === "teamaking-posts" ? `/api/admin/teamaking-posts/${selectedId}` : `/api/admin/team-up-requests/${selectedId}`;
      return (
        <form
          className="grid gap-3 md:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault();
            runAction(path, "PATCH", { status });
          }}
        >
          <select className={inputClass} value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
            {primaryRows.map((row) => <option key={row.id} value={row.id}>{selectedLabel(row)}</option>)}
          </select>
          <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>
            {statusOptions.map((item) => <option key={item}>{item}</option>)}
          </select>
          <button className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper">保存状态</button>
        </form>
      );
    }

    if (resource === "support-tickets") {
      const tickets = data?.tickets ?? [];
      const summary = data?.summary ?? {};
      const selectedTicket = tickets.find((ticket: any) => ticket.id === selectedId) ?? tickets[0];
      const categoryLabels: Record<string, string> = {
        missing_course: "缺失课程",
        course_config_error: "课程配置错误",
        bug: "Bug",
        error_report: "报错",
        admin_request: "后台需求",
        other: "其他"
      };
      const ticketStatusValue = ["open", "in_progress", "resolved", "closed"].includes(status) ? status : selectedTicket?.status ?? "open";
      const selectTicket = (ticket: any) => {
        setSelectedId(ticket.id);
        setStatus(ticket.status ?? "open");
        setAdminNote(ticket.adminNote ?? "");
        setTextFields({ ...textFields, adminReply: ticket.adminReply ?? "" });
      };
      return (
        <div className="grid gap-5">
          <div className="grid gap-3 md:grid-cols-4">
            {[
              ["全部工单", summary.total ?? tickets.length],
              ["当前显示", summary.visible ?? tickets.length],
              ["待处理", summary.byStatus?.open ?? 0],
              ["处理中", summary.byStatus?.in_progress ?? 0]
            ].map(([label, value]) => (
              <div key={label as string} className="border border-ink/15 bg-chalk px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink/48">{label as string}</p>
                <p className="mt-1 text-2xl font-semibold text-ink">{String(value ?? 0)}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
            <input
              className={inputClass}
              placeholder="搜索标题、描述、邮箱、课程代码或备注"
              value={ticketQuery}
              onChange={(event) => setTicketQuery(event.target.value)}
            />
            <select className={inputClass} value={ticketCategoryFilter} onChange={(event) => setTicketCategoryFilter(event.target.value)}>
              <option value="all">全部类型</option>
              {Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select className={inputClass} value={ticketStatusFilter} onChange={(event) => setTicketStatusFilter(event.target.value)}>
              {["all", "open", "in_progress", "resolved", "closed"].map((item) => <option key={item} value={item}>{item === "all" ? "全部状态" : item}</option>)}
            </select>
          </div>
          <div className="max-h-[420px] overflow-auto border border-ink/15">
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-ink text-paper">
                <tr>{["类型", "状态", "标题", "提交人", "创建时间", "更新时间", "操作"].map((header) => <th key={header} className="px-3 py-2">{header}</th>)}</tr>
              </thead>
              <tbody>
                {tickets.length ? tickets.map((ticket: any) => (
                  <tr key={ticket.id} className={`border-b border-ink/10 ${selectedTicket?.id === ticket.id ? "bg-mist/60" : ""}`}>
                    <td className="px-3 py-2 font-semibold">{categoryLabels[ticket.category] ?? ticket.category}</td>
                    <td className="px-3 py-2"><StatusPill status={ticket.status} /></td>
                    <td className="max-w-[280px] truncate px-3 py-2">{ticket.title}</td>
                    <td className="max-w-[220px] truncate px-3 py-2">{ticket.submittedBy?.profile?.displayName ?? ticket.email ?? ticket.submittedBy?.email ?? "未登录用户"}</td>
                    <td className="px-3 py-2">{ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : ""}</td>
                    <td className="px-3 py-2">{ticket.updatedAt ? new Date(ticket.updatedAt).toLocaleString() : ""}</td>
                    <td className="px-3 py-2">
                      <button type="button" className="rounded-sm border border-ink/30 px-2 py-1 text-xs font-semibold" onClick={() => selectTicket(ticket)}>查看 / 处理</button>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={7} className="px-3 py-4 text-ink/48">没有符合筛选条件的工单。</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {selectedTicket ? (
            <div className="grid gap-4 border border-ink/15 bg-chalk p-4 lg:grid-cols-[1fr_1fr]">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-ink/48">Selected ticket</p>
                <h3 className="mt-1 text-lg font-semibold text-ink">{categoryLabels[selectedTicket.category] ?? selectedTicket.category} · {selectedTicket.title}</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink/70">{selectedTicket.description}</p>
                {selectedTicket.relatedUrl ? <p className="mt-2 text-sm text-ink/58">相关页面：{selectedTicket.relatedUrl}</p> : null}
                <p className="mt-2 text-sm text-ink/58">联系：{selectedTicket.email ?? selectedTicket.submittedBy?.email ?? "未提供"}</p>
              </div>
              <form
                className="grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  runAction(`/api/admin/support-tickets/${selectedTicket.id}`, "PATCH", { status: ticketStatusValue, adminNote, adminReply: textFields.adminReply }, {
                    busy: "save-ticket",
                    success: (response) => `已更新工单：${response.ticket?.title ?? selectedTicket.title}`
                  });
                }}
              >
                <Field label="状态">
                  <select className={inputClass} value={ticketStatusValue} onChange={(event) => setStatus(event.target.value)}>
                    {["open", "in_progress", "resolved", "closed"].map((item) => <option key={item}>{item}</option>)}
                  </select>
                </Field>
                <Field label="管理员备注">
                  <textarea className={inputClass} rows={4} value={adminNote} onChange={(event) => setAdminNote(event.target.value)} placeholder="内部处理记录，不直接展示给用户" />
                </Field>
                <Field label="给用户的回复">
                  <textarea className={inputClass} rows={4} value={textFields.adminReply ?? ""} onChange={(event) => setTextFields({ ...textFields, adminReply: event.target.value })} placeholder="需要回传给用户时填写" />
                </Field>
                <button disabled={Boolean(busyAction)} className="w-fit rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper disabled:opacity-50">
                  {busyAction === "save-ticket" ? "保存中..." : "保存工单处理结果"}
                </button>
              </form>
            </div>
          ) : null}
        </div>
      );
    }

    if (resource === "configs") {
      const key = textFields.key ?? "developer_contact";
      const value = key === "system_status" ? { status: textFields.systemStatus ?? "active", message: textFields.value ?? "" } : { text: textFields.value ?? "" };
      return (
        <form
          className="grid gap-3 md:grid-cols-[220px_180px_1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            runAction(`/api/admin/configs/${key}`, "PATCH", { value });
          }}
        >
          <select className={inputClass} value={key} onChange={(event) => setTextFields({ ...textFields, key: event.target.value })}>
            {["developer_contact", "landing_page", "onboarding_guide", "course_board_rules", "system_status"].map((item) => <option key={item}>{item}</option>)}
          </select>
          <select className={inputClass} value={textFields.systemStatus ?? "active"} onChange={(event) => setTextFields({ ...textFields, systemStatus: event.target.value })} disabled={key !== "system_status"}>
            {["active", "paused"].map((item) => <option key={item}>{item}</option>)}
          </select>
          <input className={inputClass} placeholder={key === "system_status" ? "暂停提示文案" : "配置内容"} value={textFields.value ?? ""} onChange={(event) => setTextFields({ ...textFields, value: event.target.value })} />
          <button className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper">保存配置</button>
        </form>
      );
    }

    return <p className="text-sm text-ink/62">这个管理页目前只展示数据。</p>;
  }

  return (
    <PageShell title={title} eyebrow="Admin" description={description} aside="admin">
      {loading ? <LoadingState /> : <ErrorBox message={error} />}
      <div className="grid gap-5">
        {!["course-imports", "courses", "versions", "logs", "support-tickets", "content"].includes(resource) ? rows.map(([key, rows]) => {
          const filteredRows = rows.filter((row) => !adminTableQuery || JSON.stringify(row).toLowerCase().includes(adminTableQuery.toLowerCase()));
          const rawColumns = Object.keys(rows[0] ?? { empty: "" }).filter((column) => column !== "appVersionId");
          const columns = [...rawColumns.filter((column) => column !== "id").slice(0, 7), ...(rawColumns.includes("id") ? ["id"] : [])];
          return (
            <Card key={key}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-ink">{key}</h2>
                  <span className="rounded-lg bg-mist px-2.5 py-1 text-xs font-semibold text-moss">{filteredRows.length} / {rows.length} records</span>
                </div>
                <input className={`${inputClass} md:max-w-xs`} value={adminTableQuery} onChange={(event) => setAdminTableQuery(event.target.value)} placeholder="搜索邮箱、名称、role、code、year/status" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-ink/10 text-ink/58">
                      {key === "users" ? <th className="px-3 py-2 font-semibold">Profile</th> : null}
                      {columns.map((column) => (
                          <th key={column} className="px-3 py-2 font-semibold">
                            {column}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => (
                      <tr key={row.id ?? JSON.stringify(row).slice(0, 20)} className="border-b border-ink/6">
                        {key === "users" ? (
                          <td className="px-3 py-2">
                            <Link href={`/profile/${row.id}`} className="border border-ink/30 px-2 py-1 text-xs font-semibold">查看 Profile</Link>
                          </td>
                        ) : null}
                        {columns.map((column) => (
                            <td key={column} className="max-w-[220px] truncate px-3 py-2 text-ink/72">
                              {column === "status" || column === "role" ? <StatusPill status={previewValue(row[column])} /> : previewValue(row[column])}
                            </td>
                          ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          );
        }) : null}
        <Card>
          <h2 className="text-xl font-semibold text-ink">无代码管理操作</h2>
          <p className="mt-2 text-sm leading-6 text-ink/62">使用表单、下拉框和按钮完成管理，不需要手写接口路径或 JSON。</p>
          {result ? (
            <div className={`mt-4 border px-3 py-2 text-sm font-medium ${
              result.type === "error"
                ? "border-rust/40 bg-rust/5 text-rust"
                : result.type === "info"
                  ? "border-gold/40 bg-gold/10 text-ink"
                  : "border-forest/30 bg-forest/10 text-forest"
            }`}>
              {result.message}
            </div>
          ) : null}
          <div className="mt-4">{renderAdminForm()}</div>
        </Card>
      </div>
    </PageShell>
  );
}

export function CrawlerPortalPage() {
  const [refresh, setRefresh] = useState(0);
  const { data, error, loading } = useApi("/api/crawler/options", [refresh]);
  const { data: jobsData } = useApi("/api/crawler/jobs", [refresh]);
  const [form, setForm] = useState<Record<string, string>>({
    name: "",
    target: "programme_handbook",
    handbookUrl: "https://ar.bnbu.edu.cn/current_students/student_handbook/programme_handbook.htm",
    cohorts: "2025,2024",
    academicYear: "2026",
    term: "Spring",
    limit: "all",
    outputMode: "download",
    databaseAction: "download_only",
    instruction: "爬取 2025 和 2024 admission 的 programme handbook，输出 2026 Spring 的课程配置 JSON。"
  });
  const [result, setResult] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const jobs = jobsData?.jobs ?? [];
    if (!jobs.some((job: any) => job.status === "running")) return;
    const timer = window.setTimeout(() => setRefresh((value) => value + 1), 2000);
    return () => window.clearTimeout(timer);
  }, [jobsData, refresh]);

  async function startJob(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const response = await api("/api/crawler/jobs", { method: "POST", body: JSON.stringify(form) });
      setResult({ type: "success", message: response.message ?? `已启动任务：${response.job?.id}` });
      setRefresh((value) => value + 1);
    } catch (error) {
      setResult({ type: "error", message: error instanceof Error ? error.message : "启动爬虫失败。" });
    } finally {
      setBusy(false);
    }
  }

  const jobs = jobsData?.jobs ?? [];
  const outputs = jobsData?.outputs ?? data?.outputs ?? [];
  const targets = data?.targets ?? [];

  return (
    <PageShell
      title="BNBU Crawler Portal"
      eyebrow="Crawler"
      aside="none"
      description="独立爬虫入口：以每年 admission programme handbook 为准生成 cleaned JSON；也可在管理员确认后创建导入批次或直接批准写入线上数据库。"
    >
      {loading ? <LoadingState /> : <ErrorBox message={error} />}
      {error && /请先完成|unauthorized|API_UNAUTHORIZED/i.test(error) ? (
        <Card>
          <h2 className="text-xl font-semibold text-ink">需要管理员登录</h2>
          <p className="mt-2 text-sm leading-6 text-ink/62">爬虫入口使用同一套管理员账号密码。请先登录，再回到本页面启动任务。</p>
          <Link href="/admin-login" className="mt-4 inline-flex rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper">进入管理员登录</Link>
        </Card>
      ) : null}
      <div className="grid gap-5">
        <Card>
          <h2 className="text-xl font-semibold text-ink">Crawl request</h2>
          <p className="mt-2 text-sm leading-6 text-ink/62">当前唯一可执行目标是 programme handbook。它按 admission year 生成四年课程安排；BNBU class schedule 只是时间表，不作为课程存在或 CourseBoard 配置依据。Academic year / term 只用于预览“如果现在激活 Course Board，应匹配哪一批规则”。</p>
          {result ? (
            <div className={`mt-4 border px-3 py-2 text-sm font-medium ${
              result.type === "error" ? "border-rust/40 bg-rust/5 text-rust" : "border-forest/30 bg-forest/10 text-forest"
            }`}>
              {result.message}
            </div>
          ) : null}
          <form className="mt-4 grid gap-4" onSubmit={startJob}>
            <Field label="Job name" help="给本次任务起一个可读名称；不填时系统会用 admission years 自动生成。">
              <input className={inputClass} placeholder="例如 2025+2024 admission handbook full crawl" value={form.name ?? ""} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </Field>
            <Field label="自然语言说明">
              <textarea className={inputClass} rows={4} value={form.instruction ?? ""} onChange={(event) => setForm({ ...form, instruction: event.target.value })} />
            </Field>
            <div className="grid gap-3 md:grid-cols-3">
              {targets.map((target: any) => (
                <label key={target.value} className={`border border-ink/15 p-3 text-sm ${target.supported ? "bg-paper" : "bg-chalk opacity-60"}`}>
                  <span className="flex items-center gap-2 font-semibold text-ink">
                    <input type="radio" name="target" value={target.value} checked={(form.target ?? "programme_handbook") === target.value} disabled={!target.supported} onChange={(event) => setForm({ ...form, target: event.target.value })} />
                    {target.label}
                  </span>
                  <span className="mt-2 block leading-5 text-ink/60">{target.description}</span>
                </label>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="Handbook URL"><input className={inputClass} value={form.handbookUrl ?? ""} onChange={(event) => setForm({ ...form, handbookUrl: event.target.value })} /></Field>
              <Field label="Admission years"><input className={inputClass} value={form.cohorts ?? ""} onChange={(event) => setForm({ ...form, cohorts: event.target.value })} /></Field>
              <Field label="Programme codes"><input className={inputClass} placeholder="ACCT,MCOM 可留空" value={form.programmes ?? ""} onChange={(event) => setForm({ ...form, programmes: event.target.value })} /></Field>
              <Field label="Faculty codes"><input className={inputClass} placeholder="FBM,FHSS 可留空" value={form.facultyCodes ?? ""} onChange={(event) => setForm({ ...form, facultyCodes: event.target.value })} /></Field>
              <Field label="Activation preview year" help="用于预览 Course Board 激活，不改变 admission-year 课程安排。"><input className={inputClass} value={form.academicYear ?? ""} onChange={(event) => setForm({ ...form, academicYear: event.target.value })} /></Field>
              <Field label="Activation preview term" help="Fall/Spring 只用于计算当前学期会命中哪些 relative terms；课程安排仍按 admission year 存储。">
                <select className={inputClass} value={form.term ?? "Spring"} onChange={(event) => setForm({ ...form, term: event.target.value })}>
                  {["Spring", "Fall"].map((item) => <option key={item}>{item}</option>)}
                </select>
              </Field>
              <Field label="Limit"><input className={inputClass} value={form.limit ?? "all"} onChange={(event) => setForm({ ...form, limit: event.target.value })} /></Field>
              <Field label="Output mode">
                <select className={inputClass} value={form.outputMode ?? "download"} onChange={(event) => setForm({ ...form, outputMode: event.target.value })}>
                  <option value="download">download-only storage</option>
                  <option value="git_import_json">course_imports/bnbu</option>
                </select>
              </Field>
              <Field label="After crawl" help="默认只生成下载文件；如选择直接批准，会写入线上课程目录和 admission-year 课程安排。">
                <select className={inputClass} value={form.databaseAction ?? "download_only"} onChange={(event) => setForm({ ...form, databaseAction: event.target.value })}>
                  <option value="download_only">只生成并下载 JSON</option>
                  <option value="create_pending">创建待审批导入批次</option>
                  <option value="approve_import">直接批准并更新线上数据库</option>
                </select>
              </Field>
            </div>
            {form.databaseAction === "approve_import" ? (
              <div className="border border-rust/30 bg-rust/5 px-3 py-2 text-sm leading-6 text-rust">
                这个选项会在爬虫成功后自动创建导入批次并批准写入数据库；同 admission year 的旧 pending 批次会被标记为 rejected，已有课程和用户数据不会被清空。
              </div>
            ) : null}
            <button disabled={busy} className="w-fit rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper disabled:opacity-50">
              {busy ? "启动中..." : "启动爬虫"}
            </button>
          </form>
        </Card>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-ink">Jobs</h2>
            <button type="button" onClick={() => setRefresh((value) => value + 1)} className="rounded-sm border border-ink/30 px-3 py-2 text-sm font-semibold">刷新</button>
          </div>
          <div className="mt-4 max-h-80 overflow-auto border border-ink/15">
            <table className="w-full min-w-[820px] border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-ink text-paper"><tr>{["Job", "Status", "Admission years", "Activation preview", "Started", "Result", "Actions", "Log"].map((header) => <th key={header} className="px-3 py-2">{header}</th>)}</tr></thead>
              <tbody>
                {jobs.length ? jobs.map((job: any) => (
                  <tr key={job.id} className="border-b border-ink/10">
                    <td className="px-3 py-2">
                      <p className="font-semibold">{job.name ?? job.id}</p>
                      <p className="mt-1 text-xs text-ink/48">{job.id}</p>
                    </td>
                    <td className="px-3 py-2"><StatusPill status={job.status} /></td>
                    <td className="px-3 py-2">{job.input?.cohorts?.join?.(", ") ?? ""}</td>
                    <td className="px-3 py-2">{job.input?.semesterCode ?? "not set"}</td>
                    <td className="px-3 py-2">{job.startedAt ? new Date(job.startedAt).toLocaleString() : ""}</td>
                    <td className="max-w-[300px] px-3 py-2 text-xs text-ink/64">
                      {job.errorMessage ? <span className="text-rust">{job.errorMessage}</span> : job.status === "completed" ? "Completed" : "Waiting for output"}
                      {job.imports?.length ? (
                        <div className="mt-2 grid gap-1">
                          {job.imports.map((item: any) => (
                            <p key={`${item.outputName}-${item.batchId ?? item.error}`} className={item.status === "failed" ? "text-rust" : "text-forest"}>
                              {item.outputName}: {item.status}{item.batchId ? ` · batch ${item.batchId}` : ""}{item.error ? ` · ${item.error}` : ""}
                            </p>
                          ))}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        {job.outputs?.length ? (
                          <a className="rounded-sm border border-ink/30 px-2 py-1 text-xs font-semibold" href={`/api/crawler/jobs/${job.id}/download`}>下载整包备份</a>
                        ) : null}
                        {job.outputs?.map((output: any) => (
                          <a key={output.storageKey} className="rounded-sm border border-ink/20 px-2 py-1 text-xs font-semibold text-ink/70" href={output.downloadUrl}>可导入 JSON：{output.name}</a>
                        ))}
                      </div>
                    </td>
                    <td className="max-w-[360px] px-3 py-2"><pre className="max-h-32 overflow-auto whitespace-pre-wrap text-xs">{(job.logs ?? []).join("").slice(-4000)}</pre></td>
                  </tr>
                )) : (
                  <tr><td colSpan={8} className="px-3 py-4 text-ink/50">No crawler jobs yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-semibold text-ink">Download outputs</h2>
          <div className="mt-4 max-h-80 overflow-auto border border-ink/15">
            <table className="w-full min-w-[780px] border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-ink text-paper"><tr>{["File", "Size", "Modified", "Action"].map((header) => <th key={header} className="px-3 py-2">{header}</th>)}</tr></thead>
              <tbody>
                {outputs.length ? outputs.map((file: any) => (
                  <tr key={file.storageKey} className="border-b border-ink/10">
                    <td className="px-3 py-2 font-semibold">{file.name}</td>
                    <td className="px-3 py-2">{formatFileSize(file.size)}</td>
                    <td className="px-3 py-2">{file.modifiedAt ? new Date(file.modifiedAt).toLocaleString() : ""}</td>
                    <td className="px-3 py-2"><a className="rounded-sm border border-ink/30 px-3 py-1.5 text-xs font-semibold" href={file.downloadUrl}>下载 JSON</a></td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} className="px-3 py-4 text-ink/50">No outputs yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </PageShell>
  );
}
