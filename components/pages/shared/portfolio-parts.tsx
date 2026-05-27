"use client";

import { useEffect, useState } from "react";
import { Award, FileText, Image as ImageIcon, Link as LinkIcon, Music, Trash2, X } from "lucide-react";
import { EmptyState, SkillBadge, StatusPill } from "@/components/app-shell";
import { formatFileSize } from "@/components/pages/page-primitives";
import { MarkdownRenderer, textList } from "@/components/pages/shared/content-parts";

export function FilePreviewModal({ item, onClose }: { item: any; onClose: () => void }) {
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

export const portfolioTypeLabels: Record<string, string> = {
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

export const portfolioTypes = Object.keys(portfolioTypeLabels).filter((type) => type !== "resume" && type !== "career_certification");
export const currentCalendarYear = new Date().getFullYear();
export const defaultEntryYear = new Date().getMonth() + 1 >= 8 ? currentCalendarYear : currentCalendarYear - 1;
export const entryTermOptions = ["Fall", "Spring"];

export const acceptedProfileFiles = [
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

export function tagsFromText(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function tagsToText(value: unknown) {
  return Array.isArray(value) ? value.join(", ") : "";
}

export function uniqueTextList(values: unknown[]) {
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

export function renderResumeParsedData(parsed: any, fallbackFileName: string) {
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

export function previewIcon(kind?: string) {
  if (kind === "image") return <ImageIcon size={16} aria-hidden />;
  if (kind === "audio") return <Music size={16} aria-hidden />;
  if (kind === "pdf" || kind === "office" || kind === "markdown" || kind === "text") return <FileText size={16} aria-hidden />;
  if (kind === "design") return <Award size={16} aria-hidden />;
  return <LinkIcon size={16} aria-hidden />;
}

export const honorTypes = new Set(["gpa_screenshot", "award_certificate", "skill_certification", "career_certification", "language_score"]);

export function isHonorItem(item: any) {
  return honorTypes.has(item.type);
}

export const portfolioEvidenceSections = [
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

export function PortfolioEvidenceSection({ section, items, editable, onDelete, onEdit }: { section: (typeof portfolioEvidenceSections)[number]; items: any[]; editable?: boolean; onDelete?: (id: string) => void; onEdit?: (item: any) => void }) {
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

export function fileFamily(item: any) {
  if (item.previewKind === "pdf") return "report";
  if (item.previewKind === "office" && ["ppt", "pptx"].includes(item.fileExtension)) return "slides";
  if (item.previewKind === "text" && ["js", "jsx", "ts", "tsx", "py", "java", "c", "cpp", "go", "rs"].includes(item.fileExtension)) return "code";
  if (item.previewKind === "design") return "design";
  if (item.type === "slides" || item.type === "report" || item.type === "code" || item.type === "design") return item.type;
  return "other";
}

export function portfolioPreviewState(item: any) {
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

export function PaginatedGrid({
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
        <div className="pagination-safe-zone flex items-center justify-between border border-ink/20 bg-paper px-3 py-2 text-sm">
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

export function ToggleGroup({
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

export function PortfolioEvidenceCard({ item, editable, onDelete, onEdit }: { item: any; editable?: boolean; onDelete?: (id: string) => void; onEdit?: (item: any) => void }) {
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
