"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { Card, LoadingState, PageShell } from "@/components/app-shell";
import { ErrorBox, Field, inputClass } from "@/components/pages/page-primitives";
import { useApi } from "@/lib/client/api";

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
