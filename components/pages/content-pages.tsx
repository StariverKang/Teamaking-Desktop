"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Card,
  EmptyState,
  LoadingState,
  PageShell
} from "@/components/app-shell";

import { ErrorBox } from "@/components/pages/page-primitives";

import { useApi } from "@/lib/client/api";
import { flattenContentDocuments, firstContentDocument, ContentDocumentTree, ContentDocumentReader } from "@/components/pages/shared/content-parts";

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

export function ContactDeveloperPage() {
  const { data, error, loading } = useApi("/api/content?kind=developer_contact");
  const documents = useMemo(() => data?.documents ?? [], [data?.documents]);
  const selectedDocument = firstContentDocument(documents);

  return (
    <PageShell title="联系开发者" eyebrow="Contact" description="查看开发者简介、微信和邮箱；内容可由管理员在后台维护。">
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
