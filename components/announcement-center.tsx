"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, Check, Megaphone, X } from "lucide-react";
import { localeCookieName, normalizeLocale, type Locale } from "@/lib/i18n";

type Announcement = {
  id: string;
  titleZh: string;
  titleEn?: string | null;
  bodyZh: string;
  bodyEn?: string | null;
  status: string;
  priority?: number;
  publishedAt?: string | null;
  readAt?: string | null;
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
  if (!response.ok) throw new Error(data.error ?? "Request failed.");
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

function localized(announcement: Announcement, field: "title" | "body", locale: Locale) {
  if (field === "title") return locale === "en" ? announcement.titleEn || announcement.titleZh : announcement.titleZh;
  return locale === "en" ? announcement.bodyEn || announcement.bodyZh : announcement.bodyZh;
}

function dismissedKey(id: string) {
  return `teamaking_announcement_dismissed_${id}`;
}

export function AnnouncementCenter() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [locale, setLocale] = useState<Locale>("zh");
  const [open, setOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    setLocale(readLocale());
    api("/api/announcements")
      .then((data) => setAnnouncements(data.announcements ?? []))
      .catch(() => setAnnouncements([]));
  }, []);

  useEffect(() => {
    const listener = (event: Event) => setLocale((event as CustomEvent<Locale>).detail ?? readLocale());
    window.addEventListener("teamaking:locale", listener);
    return () => window.removeEventListener("teamaking:locale", listener);
  }, []);

  const unread = useMemo(() => {
    return announcements.filter((item) => !item.readAt && (typeof window === "undefined" || !window.localStorage.getItem(dismissedKey(item.id))));
  }, [announcements]);
  const featured = unread[0] ?? announcements[0];

  useEffect(() => {
    if (featured && !featured.readAt && !window.localStorage.getItem(dismissedKey(featured.id))) setOpen(true);
  }, [featured]);

  async function markRead(announcement: Announcement) {
    window.localStorage.setItem(dismissedKey(announcement.id), new Date().toISOString());
    setAnnouncements((items) => items.map((item) => item.id === announcement.id ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item));
    setOpen(false);
    await api(`/api/announcements/${announcement.id}/read`, { method: "POST" }).catch(() => null);
  }

  if (!featured) return null;

  return (
    <>
      <div className="sticky top-[66px] z-20 border-b border-ink/15 bg-gold/12 px-5 py-2" data-no-translate>
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 text-sm text-ink">
          <button type="button" className="flex min-w-0 items-center gap-2 text-left font-semibold" onClick={() => setOpen(true)}>
            <Megaphone size={16} aria-hidden />
            <span className="truncate">{localized(featured, "title", locale)}</span>
            {unread.length ? <span className="border border-rust/30 bg-rust/10 px-2 py-0.5 text-xs text-rust">{unread.length}</span> : null}
          </button>
          <div className="flex items-center gap-2">
            <button type="button" className="rounded-sm border border-ink/25 px-2 py-1 text-xs font-semibold" onClick={() => setHistoryOpen(true)}>
              {locale === "zh" ? "公告历史" : "History"}
            </button>
            <Link href="/announcements" className="rounded-sm border border-ink/25 px-2 py-1 text-xs font-semibold">
              {locale === "zh" ? "查看全部" : "View all"}
            </Link>
          </div>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 px-4" data-no-translate>
          <div className="w-full max-w-xl border-2 border-ink bg-paper p-5 shadow-soft">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2">
                <Bell size={18} aria-hidden />
                <p className="text-xs font-semibold uppercase tracking-wide text-rust">{locale === "zh" ? "系统公告" : "System announcement"}</p>
              </div>
              <button type="button" className="border border-ink/25 p-1" onClick={() => setOpen(false)} aria-label="Close">
                <X size={16} aria-hidden />
              </button>
            </div>
            <h2 className="mt-4 text-2xl font-semibold text-ink">{localized(featured, "title", locale)}</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-ink/72">{localized(featured, "body", locale)}</p>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <button type="button" className="inline-flex items-center gap-2 rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper" onClick={() => markRead(featured)}>
                <Check size={16} aria-hidden />
                {locale === "zh" ? "知道了" : "Got it"}
              </button>
              <button type="button" className="rounded-sm border border-ink/30 px-4 py-2 text-sm font-semibold" onClick={() => setHistoryOpen(true)}>
                {locale === "zh" ? "查看历史公告" : "View history"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {historyOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 px-4" data-no-translate>
          <div className="max-h-[80vh] w-full max-w-2xl overflow-auto border-2 border-ink bg-paper p-5 shadow-soft">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold text-ink">{locale === "zh" ? "公告历史" : "Announcement history"}</h2>
              <button type="button" className="border border-ink/25 p-1" onClick={() => setHistoryOpen(false)} aria-label="Close">
                <X size={16} aria-hidden />
              </button>
            </div>
            <div className="mt-4 divide-y divide-ink/12 border-y border-ink/12">
              {announcements.map((announcement) => (
                <article key={announcement.id} className="py-4">
                  <h3 className="font-semibold text-ink">{localized(announcement, "title", locale)}</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink/68">{localized(announcement, "body", locale)}</p>
                  {announcement.publishedAt ? <p className="mt-2 text-xs text-ink/45">{new Date(announcement.publishedAt).toLocaleString()}</p> : null}
                </article>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
