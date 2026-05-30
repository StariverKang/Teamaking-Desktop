"use client";

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronRight, FileText, Folder, LifeBuoy, Mail } from "lucide-react";
import { EmptyState, StatusPill } from "@/components/app-shell";
import {
  contentBreadcrumb,
  extractMarkdownHeadingIdByLine,
  extractMarkdownHeadings,
  flattenContentDocuments as flattenContentDocumentsCore,
  headingId,
  relatedContentDocuments
} from "@/lib/content-markdown";

export function textList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

export function contentImageUrls(value: unknown) {
  return textList(value).slice(0, 3);
}

export function MarkdownRenderer({ children, withHeadingIds = false }: { children: string; withHeadingIds?: boolean }) {
  const headingIdsByLine = withHeadingIds ? extractMarkdownHeadingIdByLine(children || "") : new Map<number, string>();
  const headingStyles = {
    h1: "mt-12 scroll-mt-24 border-b border-ink/15 pb-4 text-4xl font-semibold leading-tight text-ink first:mt-0 md:text-5xl",
    h2: "mt-11 scroll-mt-24 border-b border-ink/12 pb-3 text-3xl font-semibold leading-tight text-ink first:mt-0 md:text-[2.1rem]",
    h3: "mt-8 scroll-mt-24 text-2xl font-semibold leading-snug text-ink md:text-[1.55rem]",
    h4: "mt-6 scroll-mt-24 text-lg font-semibold uppercase leading-snug text-coral"
  };
  const headingComponent = (Tag: "h1" | "h2" | "h3" | "h4") => {
    function Heading({ children: headingChildren, node }: { children?: React.ReactNode; node?: { position?: { start?: { line?: number } } } }) {
      const id = withHeadingIds
        ? headingIdsByLine.get(node?.position?.start?.line ?? 0) ?? headingId(textFromReactChildren(headingChildren))
        : undefined;
      return <Tag id={id} className={headingStyles[Tag]}>{headingChildren}</Tag>;
    }
    return Heading;
  };
  const components = {
    h1: headingComponent("h1"),
    h2: headingComponent("h2"),
    h3: headingComponent("h3"),
    h4: headingComponent("h4"),
    p: ({ children: paragraphChildren }: { children?: React.ReactNode }) => (
      <p className="my-4 text-[1.04rem] font-normal leading-8 text-ink/82">{paragraphChildren}</p>
    ),
    ul: ({ children: listChildren }: { children?: React.ReactNode }) => (
      <ul className="my-5 grid list-disc gap-2 pl-6 text-[1.04rem] leading-8 text-ink/82 marker:text-coral">{listChildren}</ul>
    ),
    ol: ({ children: listChildren }: { children?: React.ReactNode }) => (
      <ol className="my-5 grid list-decimal gap-2 pl-6 text-[1.04rem] leading-8 text-ink/82 marker:font-semibold marker:text-coral">{listChildren}</ol>
    ),
    li: ({ children: itemChildren }: { children?: React.ReactNode }) => (
      <li className="pl-1">{itemChildren}</li>
    ),
    a: ({ href, children: linkChildren }: { href?: string; children?: React.ReactNode }) => (
      <a href={href} className="font-semibold text-coral underline decoration-coral/35 underline-offset-4 hover:decoration-coral">
        {linkChildren}
      </a>
    ),
    strong: ({ children: strongChildren }: { children?: React.ReactNode }) => (
      <strong className="font-semibold text-ink">{strongChildren}</strong>
    ),
    blockquote: ({ children: quoteChildren }: { children?: React.ReactNode }) => (
      <blockquote className="my-6 border-l-4 border-coral/70 bg-chalk px-5 py-3 text-[1.02rem] leading-8 text-ink/72">
        {quoteChildren}
      </blockquote>
    ),
    table: ({ children: tableChildren }: { children?: React.ReactNode }) => (
      <div className="my-6 overflow-x-auto border border-ink/15 bg-paper">
        <table className="min-w-full border-collapse text-sm leading-6">{tableChildren}</table>
      </div>
    ),
    th: ({ children: cellChildren }: { children?: React.ReactNode }) => (
      <th className="border-b border-ink/20 bg-ink px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-paper">
        {cellChildren}
      </th>
    ),
    td: ({ children: cellChildren }: { children?: React.ReactNode }) => (
      <td className="border-b border-ink/10 px-3 py-2 align-top text-ink/78">{cellChildren}</td>
    ),
    code: ({ className, children: codeChildren }: { className?: string; children?: React.ReactNode }) => (
      <code className={className ? "text-paper" : "rounded-sm bg-mist px-1.5 py-0.5 text-[0.92em] font-semibold text-ink"}>{codeChildren}</code>
    ),
    pre: ({ children: preChildren }: { children?: React.ReactNode }) => (
      <pre className="my-6 overflow-x-auto border border-ink/18 bg-ink p-4 text-sm leading-7 text-paper">{preChildren}</pre>
    ),
    hr: () => <hr className="my-9 border-ink/15" />
  };

  return (
    <div className="max-w-none text-ink">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{children || ""}</ReactMarkdown>
    </div>
  );
}

function textFromReactChildren(children: React.ReactNode): string {
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(textFromReactChildren).join(" ");
  if (children && typeof children === "object" && "props" in children) {
    return textFromReactChildren((children as { props?: { children?: React.ReactNode } }).props?.children);
  }
  return "";
}

export const contentKindLabels: Record<string, string> = {
  help: "帮助中心",
  developer_log: "开发者日志",
  developer_contact: "联系开发者"
};

export const flattenContentDocuments = flattenContentDocumentsCore;

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

const contentDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

const contentDateTimeFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23"
});

function formatContentDate(value: string | Date, withTime = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return (withTime ? contentDateTimeFormatter : contentDateFormatter).format(date);
}

export function ContentDocumentReader({
  document,
  emptyTitle = "选择一篇文档",
  allDocuments = [],
  onSelectDocument,
  showArticleTools = false
}: {
  document?: any;
  emptyTitle?: string;
  allDocuments?: any[];
  onSelectDocument?: (document: any) => void;
  showArticleTools?: boolean;
}) {
  if (!document) return <EmptyState title={emptyTitle} body="从左侧文档树选择一个条目后，会在这里显示正文。" />;
  if (contentNodeType(document) === "folder") {
    return <EmptyState title={document.title || "分类文件夹"} body="这是一个分类文件夹，用来组织子文档；正文内容请在其下创建文档。" />;
  }
  const flatDocuments = allDocuments.length && allDocuments.some((item) => Array.isArray(item.children)) ? flattenContentDocumentsCore(allDocuments) : allDocuments;
  const breadcrumb = contentBreadcrumb(document, flatDocuments);
  const headings = extractMarkdownHeadings(document.bodyMarkdown ?? "");
  const related = relatedContentDocuments(document, flatDocuments, 4);
  return (
    <article className="grid gap-7">
      <div className="grid gap-4">
        <div className="min-w-0">
          {showArticleTools ? (
            <ContentBreadcrumb document={document} breadcrumb={breadcrumb} onSelectDocument={onSelectDocument} />
          ) : (
            <p className="text-xs font-semibold uppercase tracking-wide text-coral">{contentKindLabels[document.kind] ?? document.kind} / {document.slug}</p>
          )}
          <h2 className="mt-3 text-3xl font-semibold text-ink">{document.title}</h2>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-ink/56">
            {document.publishedAt ? <span>Published {formatContentDate(document.publishedAt)}</span> : null}
            {document.updatedAt ? <span>Updated {formatContentDate(document.updatedAt, true)}</span> : null}
          </div>
          {document.summary ? <p className="mt-3 text-sm leading-6 text-ink/64">{document.summary}</p> : null}
          {showArticleTools && headings.length ? <ArticleTableOfContents headings={headings} /> : null}
          {contentImageUrls(document.imageUrls).length ? (
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {contentImageUrls(document.imageUrls).map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={url} src={url} alt={document.title} className="max-h-64 w-full border border-ink/20 object-contain" />
              ))}
            </div>
          ) : null}
          <div className="mt-6">
            {document.bodyMarkdown ? <MarkdownRenderer withHeadingIds={showArticleTools}>{document.bodyMarkdown}</MarkdownRenderer> : <p className="text-sm text-ink/52">这篇文档还没有正文。</p>}
          </div>
        </div>
      </div>
      {showArticleTools ? <ArticleSupportAndRelated related={related} onSelectDocument={onSelectDocument} /> : null}
    </article>
  );
}

function ContentBreadcrumb({ document, breadcrumb, onSelectDocument }: { document: any; breadcrumb: any[]; onSelectDocument?: (document: any) => void }) {
  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm text-ink/58" aria-label="Article path">
      <button type="button" className="font-semibold text-ink hover:text-coral" onClick={() => onSelectDocument?.(document)}>
        All Collections
      </button>
      <ChevronRight size={15} aria-hidden />
      <span>{contentKindLabels[document.kind] ?? document.kind}</span>
      {breadcrumb.map((item) => (
        <span key={item.id} className="inline-flex items-center gap-1">
          <ChevronRight size={15} aria-hidden />
          <button
            type="button"
            onClick={() => onSelectDocument?.(item)}
            className={`hover:text-coral ${item.id === document.id ? "font-semibold text-ink" : ""}`}
          >
            {item.title}
          </button>
        </span>
      ))}
    </nav>
  );
}

function ArticleTableOfContents({ headings }: { headings: { depth: number; text: string; id: string }[] }) {
  return (
    <details open className="mt-5 border border-ink/15 bg-paper p-4">
      <summary className="cursor-pointer text-lg font-semibold text-ink">本文目录</summary>
      <HeadingLinks headings={headings} />
    </details>
  );
}

function HeadingLinks({ headings }: { headings: { depth: number; text: string; id: string }[] }) {
  return (
    <div className="mt-3 grid gap-2 text-sm text-ink/62">
      {headings.map((heading) => (
        <a
          key={heading.id}
          href={`#${heading.id}`}
          className="leading-5 hover:font-semibold hover:text-ink"
          style={{ paddingLeft: `${Math.max(0, heading.depth - 2) * 24}px` }}
        >
          {heading.text}
        </a>
      ))}
    </div>
  );
}

function ArticleSupportAndRelated({ related, onSelectDocument }: { related: any[]; onSelectDocument?: (document: any) => void }) {
  return (
    <div className="grid gap-7 border-t border-ink/12 pt-6">
      <section className="rounded-sm border border-ink/18 bg-chalk p-5">
        <h3 className="text-xl font-semibold text-ink">Need more help?</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Link href="/support" className="group border border-ink/18 bg-paper p-4 hover:border-coral">
            <LifeBuoy className="mb-4 text-coral" size={28} aria-hidden />
            <span className="block text-lg font-semibold text-ink group-hover:text-coral">提交 Support Ticket</span>
            <span className="mt-2 block text-sm leading-6 text-ink/62">课程、账号、上传或页面报错都可以在工单里附链接和截图。</span>
          </Link>
          <Link href="/contact-developer" className="group border border-ink/18 bg-paper p-4 hover:border-coral">
            <Mail className="mb-4 text-coral" size={28} aria-hidden />
            <span className="block text-lg font-semibold text-ink group-hover:text-coral">联系开发者</span>
            <span className="mt-2 block text-sm leading-6 text-ink/62">查看开发者联系方式和平台维护说明。</span>
          </Link>
        </div>
      </section>
      {related.length ? (
        <section>
          <h3 className="text-xl font-semibold text-ink">Related articles</h3>
          <div className="mt-4 grid gap-3">
            {related.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectDocument?.(item)}
                className="group flex items-center justify-between gap-4 border border-ink/18 bg-paper p-4 text-left hover:border-coral"
              >
                <span>
                  <span className="block text-base font-semibold text-ink group-hover:text-coral">{item.title}</span>
                  {item.summary ? <span className="mt-1 block text-sm leading-6 text-ink/58">{item.summary}</span> : null}
                </span>
                <ChevronRight size={20} aria-hidden />
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
