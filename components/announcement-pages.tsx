"use client";

import { FormEvent, useEffect, useState } from "react";
import { Archive, Check, Send } from "lucide-react";
import { Card, EmptyState, LoadingState, PageShell, StatusPill } from "@/components/app-shell";
import { localeCookieName, normalizeLocale, type Locale } from "@/lib/i18n";

type Announcement = {
  id: string;
  titleZh: string;
  titleEn?: string | null;
  bodyZh: string;
  bodyEn?: string | null;
  status: string;
  priority?: number;
  startsAt?: string | null;
  endsAt?: string | null;
  publishedAt?: string | null;
  archivedAt?: string | null;
  readAt?: string | null;
  readCount?: number;
  createdAt?: string;
  updatedAt?: string;
};

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
  if (!response.ok) throw new Error(data.error ?? "请求失败，请稍后再试。");
  return data;
}

function readLocale(): Locale {
  if (typeof document === "undefined") return "zh";
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${localeCookieName}=`));
  return normalizeLocale(cookie?.split("=")[1]) ?? "zh";
}

function announcementTitle(item: Announcement, locale: Locale) {
  return locale === "en" ? item.titleEn || item.titleZh : item.titleZh;
}

function announcementBody(item: Announcement, locale: Locale) {
  return locale === "en" ? item.bodyEn || item.bodyZh : item.bodyZh;
}

function formatTime(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "";
}

function AnnouncementArticle({ item, locale }: { item: Announcement; locale: Locale }) {
  return (
    <article className="border-2 border-ink bg-chalk p-5 shadow-soft" data-no-translate>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-rust">{locale === "zh" ? "系统公告" : "System announcement"}</p>
          <h2 className="mt-2 text-xl font-semibold text-ink">{announcementTitle(item, locale)}</h2>
        </div>
        <StatusPill status={item.status} />
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-ink/72">{announcementBody(item, locale)}</p>
      <div className="mt-4 flex flex-wrap gap-3 text-xs text-ink/52">
        {item.publishedAt ? <span>{locale === "zh" ? "发布：" : "Published: "}{formatTime(item.publishedAt)}</span> : null}
        {item.readAt ? <span>{locale === "zh" ? "已读：" : "Read: "}{formatTime(item.readAt)}</span> : null}
      </div>
    </article>
  );
}

export function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [locale, setLocale] = useState<Locale>("zh");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLocale(readLocale());
    api("/api/announcements")
      .then((data) => {
        setAnnouncements(data.announcements ?? []);
        setError("");
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const listener = (event: Event) => setLocale((event as CustomEvent<Locale>).detail ?? readLocale());
    window.addEventListener("teamaking:locale", listener);
    return () => window.removeEventListener("teamaking:locale", listener);
  }, []);

  return (
    <PageShell title="Announcements" eyebrow="System" description="查看管理员发布给所有用户的公告历史。">
      {loading ? <LoadingState /> : null}
      {error ? <div className="border border-rust/40 bg-rust/5 px-3 py-2 text-sm font-medium text-rust">{error}</div> : null}
      <div className="grid gap-4">
        {announcements.map((item) => <AnnouncementArticle key={item.id} item={item} locale={locale} />)}
        {!loading && announcements.length === 0 ? <EmptyState title="暂无公告。" body="管理员发布公告后会出现在这里。" /> : null}
      </div>
    </PageShell>
  );
}

export function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [form, setForm] = useState({
    titleZh: "",
    titleEn: "",
    bodyZh: "",
    bodyEn: "",
    priority: "0",
    status: "draft"
  });

  async function load() {
    setLoading(true);
    try {
      const data = await api("/api/admin/announcements");
      setAnnouncements(data.announcements ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch((err: Error) => setResult(err.message));
  }, []);

  async function createAnnouncement(event: FormEvent) {
    event.preventDefault();
    setBusyAction("create");
    setResult("");
    try {
      const data = await api("/api/admin/announcements", { method: "POST", body: JSON.stringify(form) });
      setResult(data.message ?? "公告已保存。");
      setForm({ titleZh: "", titleEn: "", bodyZh: "", bodyEn: "", priority: "0", status: "draft" });
      await load();
    } catch (err) {
      setResult(err instanceof Error ? err.message : "公告保存失败。");
    } finally {
      setBusyAction("");
    }
  }

  async function action(id: string, actionName: "publish" | "archive") {
    setBusyAction(`${actionName}-${id}`);
    setResult("");
    try {
      const data = await api(`/api/admin/announcements/${id}/${actionName}`, { method: "POST" });
      setResult(data.message ?? "公告已更新。");
      await load();
    } catch (err) {
      setResult(err instanceof Error ? err.message : "公告操作失败。");
    } finally {
      setBusyAction("");
    }
  }

  return (
    <PageShell title="Announcements" eyebrow="Admin" description="管理员可以面向所有用户发布公告；公告会在全站顶部显示，并以弹窗提醒用户。 " aside="admin">
      <div className="grid gap-5">
        <Card>
          <h2 className="text-xl font-semibold text-ink">发布公告</h2>
          {result ? <div className="mt-4 border border-ink/20 bg-paper px-3 py-2 text-sm font-medium text-forest">{result}</div> : null}
          <form className="mt-4 grid gap-4" onSubmit={createAnnouncement}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-ink">
                中文标题
                <input className="focus-ring w-full rounded-sm border border-ink/30 bg-paper px-3 py-2 text-sm text-ink" value={form.titleZh} onChange={(event) => setForm({ ...form, titleZh: event.target.value })} required />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-ink">
                English title
                <input className="focus-ring w-full rounded-sm border border-ink/30 bg-paper px-3 py-2 text-sm text-ink" value={form.titleEn} onChange={(event) => setForm({ ...form, titleEn: event.target.value })} />
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-ink">
                中文正文
                <textarea className="focus-ring w-full rounded-sm border border-ink/30 bg-paper px-3 py-2 text-sm text-ink" rows={6} value={form.bodyZh} onChange={(event) => setForm({ ...form, bodyZh: event.target.value })} required />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-ink">
                English body
                <textarea className="focus-ring w-full rounded-sm border border-ink/30 bg-paper px-3 py-2 text-sm text-ink" rows={6} value={form.bodyEn} onChange={(event) => setForm({ ...form, bodyEn: event.target.value })} />
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="grid gap-2 text-sm font-semibold text-ink">
                优先级
                <input type="number" className="focus-ring w-full rounded-sm border border-ink/30 bg-paper px-3 py-2 text-sm text-ink" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })} />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-ink">
                状态
                <select className="focus-ring w-full rounded-sm border border-ink/30 bg-paper px-3 py-2 text-sm text-ink" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                  <option value="draft">草稿</option>
                  <option value="published">创建后立即发布</option>
                </select>
              </label>
            </div>
            <button disabled={busyAction === "create"} className="inline-flex w-fit items-center gap-2 rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper disabled:opacity-50">
              <Send size={15} aria-hidden />
              {busyAction === "create" ? "保存中..." : "保存公告"}
            </button>
          </form>
        </Card>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-ink">公告历史</h2>
            <button type="button" onClick={() => load()} className="rounded-sm border border-ink/30 px-3 py-2 text-sm font-semibold">刷新</button>
          </div>
          {loading ? <LoadingState /> : null}
          <div className="mt-4 grid gap-3">
            {announcements.map((item) => (
              <article key={item.id} className="border border-ink/20 bg-paper p-4" data-no-translate>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-rust">{item.titleEn ? `${item.titleZh} / ${item.titleEn}` : item.titleZh}</p>
                    <h3 className="mt-1 text-lg font-semibold text-ink">{item.titleZh}</h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink/66">{item.bodyZh}</p>
                    {item.bodyEn ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink/50">{item.bodyEn}</p> : null}
                    <p className="mt-2 text-xs text-ink/45">发布：{formatTime(item.publishedAt)} · 阅读：{item.readCount ?? 0}</p>
                  </div>
                  <StatusPill status={item.status} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {item.status !== "published" ? (
                    <button type="button" disabled={busyAction === `publish-${item.id}`} onClick={() => action(item.id, "publish")} className="inline-flex items-center gap-2 rounded-sm border border-ink/30 px-3 py-2 text-sm font-semibold disabled:opacity-50">
                      <Check size={15} aria-hidden />
                      发布
                    </button>
                  ) : null}
                  {item.status !== "archived" ? (
                    <button type="button" disabled={busyAction === `archive-${item.id}`} onClick={() => action(item.id, "archive")} className="inline-flex items-center gap-2 rounded-sm border border-ink/30 px-3 py-2 text-sm font-semibold text-rust disabled:opacity-50">
                      <Archive size={15} aria-hidden />
                      归档
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
            {!loading && announcements.length === 0 ? <EmptyState title="暂无公告。" body="发布第一条公告后会出现在这里。" /> : null}
          </div>
        </Card>
      </div>
    </PageShell>
  );
}
