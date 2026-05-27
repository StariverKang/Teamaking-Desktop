"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FileText, Folder } from "lucide-react";
import { EmptyState, StatusPill } from "@/components/app-shell";

export function textList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

export function contentImageUrls(value: unknown) {
  return textList(value).slice(0, 3);
}

export function MarkdownRenderer({ children }: { children: string }) {
  return (
    <div className="prose prose-sm max-w-none text-ink prose-headings:text-ink prose-a:text-coral prose-strong:text-ink prose-code:rounded prose-code:bg-mist prose-code:px-1 prose-pre:bg-ink prose-pre:text-paper">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children || ""}</ReactMarkdown>
    </div>
  );
}

export const contentKindLabels: Record<string, string> = {
  help: "帮助中心",
  developer_log: "开发者日志",
  developer_contact: "联系开发者"
};

export function flattenContentDocuments(documents: any[]): any[] {
  const flat: any[] = [];
  const visit = (document: any) => {
    flat.push(document);
    (document.children ?? []).forEach(visit);
  };
  documents.forEach(visit);
  return flat;
}

export function buildContentTree(documents: any[]) {
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

export function firstContentDocument(documents: any[]): any | null {
  for (const document of documents) {
    if (contentNodeType(document) === "document") return document;
    const child = firstContentDocument(document.children ?? []);
    if (child) return child;
  }
  return null;
}

export function contentNodeType(document: any) {
  return document?.nodeType === "folder" ? "folder" : "document";
}

export function ContentDocumentTree({
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

export function ContentDocumentReader({ document, emptyTitle = "选择一篇文档" }: { document?: any; emptyTitle?: string }) {
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
