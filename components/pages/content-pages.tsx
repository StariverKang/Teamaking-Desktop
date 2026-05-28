"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";

import {
  Card,
  EmptyState,
  LoadingState,
  PageShell
} from "@/components/app-shell";

import { ErrorBox } from "@/components/pages/page-primitives";

import { useApi } from "@/lib/client/api";
import { flattenContentDocuments, firstContentDocument, ContentDocumentTree, ContentDocumentReader } from "@/components/pages/shared/content-parts";
import { searchContentDocuments } from "@/lib/content-markdown";

type PublicContentData = {
  documents?: any[];
  flatDocuments?: any[];
};

export function ContentDocumentsPage({ kind, title, eyebrow, description, initialData }: { kind: "help" | "developer_log" | "developer_contact"; title: string; eyebrow: string; description: string; initialData?: PublicContentData }) {
  const { data: liveData, error, loading: liveLoading } = useApi(`/api/content?kind=${kind}`);
  const data = liveData ?? initialData;
  const loading = liveLoading && !initialData;
  const documents = useMemo(() => data?.documents ?? [], [data?.documents]);
  const flatDocuments = useMemo(() => flattenContentDocuments(documents), [documents]);
  const [selectedDocId, setSelectedDocId] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!selectedDocId && flatDocuments.length) setSelectedDocId(flatDocuments[0].id);
  }, [flatDocuments, selectedDocId]);

  useEffect(() => {
    if (!flatDocuments.length || typeof window === "undefined") return;
    const slug = new URLSearchParams(window.location.search).get("article");
    if (!slug) return;
    const document = flatDocuments.find((item: any) => item.slug === slug);
    if (document) setSelectedDocId(document.id);
  }, [flatDocuments]);

  useEffect(() => {
    if (!documents.length) return;
    setExpandedIds((current) => {
      const next = new Set(current);
      documents.forEach((document: any) => next.add(document.id));
      return next;
    });
  }, [documents]);

  const selectedDocument = flatDocuments.find((document: any) => document.id === selectedDocId) ?? firstContentDocument(documents);
  const searchResults = useMemo(() => searchContentDocuments(query, flatDocuments).slice(0, 8), [query, flatDocuments]);
  const selectDocument = (document: any) => {
    setSelectedDocId(document.id);
    if (document.parentId) {
      setExpandedIds((current) => new Set(current).add(document.parentId));
    }
    if (typeof window !== "undefined" && document.slug) {
      const next = new URL(window.location.href);
      next.searchParams.set("article", document.slug);
      window.history.replaceState(null, "", next.toString());
    }
  };

  return (
    <PageShell title={title} eyebrow={eyebrow} description={description} aside="none">
      {loading ? <LoadingState /> : <ErrorBox message={error} />}
      <div className="grid gap-5">
        <Card>
          <label className="flex items-center gap-3 border-b border-ink px-2 py-3">
            <Search size={22} aria-hidden className="text-ink/52" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search for articles..."
              className="w-full bg-transparent text-lg font-medium text-ink outline-none placeholder:text-ink/42"
            />
          </label>
          {query.trim() ? (
            <div className="mt-4 grid gap-2">
              {searchResults.length ? searchResults.map((document: any) => (
                <button
                  key={document.id}
                  type="button"
                  onClick={() => selectDocument(document)}
                  className="border border-ink/15 bg-paper px-3 py-3 text-left hover:border-coral"
                >
                  <span className="block font-semibold text-ink">{document.title}</span>
                  <span className="mt-1 block text-sm text-ink/58">{document.summary || `/${document.slug}`}</span>
                </button>
              )) : <p className="text-sm text-ink/52">没有找到相关文章。可以换一个关键词，或提交 Support Ticket。</p>}
            </div>
          ) : null}
        </Card>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[340px_1fr]">
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
            onSelect={selectDocument}
            selectFolders
          />
        </Card>
        <Card>
          <ContentDocumentReader document={selectedDocument} allDocuments={flatDocuments} onSelectDocument={selectDocument} showArticleTools />
        </Card>
        {!loading && documents.length === 0 ? <EmptyState title="暂无内容" body="管理员发布内容后，会显示在这里。" /> : null}
      </div>
    </PageShell>
  );
}

export function ContactDeveloperPage({ initialData }: { initialData?: PublicContentData }) {
  const { data: liveData, error, loading: liveLoading } = useApi("/api/content?kind=developer_contact");
  const data = liveData ?? initialData;
  const loading = liveLoading && !initialData;
  const documents = useMemo(() => data?.documents ?? [], [data?.documents]);
  const selectedDocument = firstContentDocument(documents);

  return (
    <PageShell title="联系开发者" eyebrow="Contact" description="查看开发者简介、微信和邮箱；内容可由管理员在后台维护。" aside="none">
      {loading ? <LoadingState /> : <ErrorBox message={error} />}
      {!loading && selectedDocument ? (
        <Card>
          <ContentDocumentReader document={selectedDocument} emptyTitle="暂无内容" />
        </Card>
      ) : null}
      {!loading && !selectedDocument ? <EmptyState title="暂无内容" body="管理员发布内容后，会显示在这里。" /> : null}
    </PageShell>
  );
}
