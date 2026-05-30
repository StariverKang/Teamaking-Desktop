"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { Check, Edit3, ExternalLink, RotateCcw, Send, X } from "lucide-react";

import { api, useApi } from "@/lib/client/api";
import { localeCookieName, normalizeLocale, type Locale } from "@/lib/i18n";
import {
  siteCopyDefaultValues,
  siteCopyEntryMap,
  siteCopyText,
  type SiteCopyEntry,
  type SiteCopyValue,
  type SiteCopyValues
} from "@/lib/site-copy";

const editModeStorageKey = "teamaking.siteCopy.editMode";

type SiteCopyPayload = {
  entries?: SiteCopyEntry[];
  values?: SiteCopyValues;
  publishedValues?: SiteCopyValues;
  published?: SiteCopyValues;
  draft?: SiteCopyValues;
  hasDraft?: boolean;
  changedKeys?: string[];
  message?: string;
};

type SiteCopyContextValue = {
  values: SiteCopyValues;
  adminPayload: SiteCopyPayload | null;
  editMode: boolean;
  isAdmin: boolean;
  locale: Locale;
  setEditMode: (value: boolean) => void;
  selectKey: (key: string) => void;
  refresh: () => void;
  applyAdminPayload: (payload: SiteCopyPayload) => void;
};

const SiteCopyContext = createContext<SiteCopyContextValue | null>(null);

function readLocale(): Locale {
  if (typeof window === "undefined") return "zh";
  const stored = normalizeLocale(window.localStorage.getItem(localeCookieName));
  if (stored) return stored;
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${localeCookieName}=`));
  return normalizeLocale(cookie?.split("=")[1]) ?? "zh";
}

function isAdminRole(role?: string | null) {
  return ["course_moderator", "school_admin", "super_admin"].includes(String(role ?? ""));
}

function publicRoute(pathname: string | null) {
  if (!pathname) return false;
  if (pathname.startsWith("/admin")) return false;
  if (pathname.startsWith("/crawler")) return false;
  return true;
}

export function SiteCopyRuntime({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [locale, setLocale] = useState<Locale>("zh");
  const [refreshTick, setRefreshTick] = useState(0);
  const [editMode, setEditModeState] = useState(false);
  const [selectedKey, setSelectedKey] = useState("");
  const [adminOverride, setAdminOverride] = useState<SiteCopyPayload | null>(null);
  const { data: auth } = useApi("/api/auth/me", [pathname]);
  const isAdmin = isAdminRole(auth?.user?.role);
  const { data: publicPayload } = useApi("/api/site-copy", [refreshTick]);
  const { data: adminPayloadRaw } = useApi(isAdmin ? "/api/admin/site-copy" : null, [isAdmin, refreshTick]);
  const adminPayload = adminOverride ?? adminPayloadRaw ?? null;
  const routeCanEdit = publicRoute(pathname);

  useEffect(() => {
    setLocale(readLocale());
    const listener = (event: Event) => {
      const next = normalizeLocale((event as CustomEvent<Locale>).detail);
      if (next) setLocale(next);
    };
    window.addEventListener("teamaking:locale", listener);
    return () => window.removeEventListener("teamaking:locale", listener);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setEditModeState(window.localStorage.getItem(editModeStorageKey) === "true");
  }, []);

  useEffect(() => {
    if (!isAdmin || !routeCanEdit) {
      setEditModeState(false);
      setSelectedKey("");
    }
  }, [isAdmin, routeCanEdit]);

  useEffect(() => {
    setAdminOverride(null);
  }, [adminPayloadRaw]);

  const values = useMemo(() => {
    const defaults = siteCopyDefaultValues;
    if (isAdmin && editMode && adminPayload?.values) return adminPayload.values;
    if (publicPayload?.values) return publicPayload.values;
    return defaults;
  }, [adminPayload?.values, editMode, isAdmin, publicPayload?.values]);

  function setEditMode(value: boolean) {
    setEditModeState(value);
    window.localStorage.setItem(editModeStorageKey, String(value));
    if (!value) setSelectedKey("");
  }

  const contextValue: SiteCopyContextValue = {
    values,
    adminPayload,
    editMode: editMode && isAdmin && routeCanEdit,
    isAdmin,
    locale,
    setEditMode,
    selectKey: setSelectedKey,
    refresh: () => setRefreshTick((value) => value + 1),
    applyAdminPayload: setAdminOverride
  };

  return (
    <SiteCopyContext.Provider value={contextValue}>
      {children}
      {isAdmin && routeCanEdit ? <SiteCopyToolbar selectedKey={selectedKey} onCloseEditor={() => setSelectedKey("")} /> : null}
    </SiteCopyContext.Provider>
  );
}

export function useSiteCopy() {
  return useContext(SiteCopyContext);
}

export function useCopyText(copyKey: string | undefined, fallback: string) {
  const context = useSiteCopy();
  if (!copyKey) return fallback;
  return siteCopyText(context?.values ?? siteCopyDefaultValues, copyKey, fallback, context?.locale ?? "zh");
}

export function EditableCopy({
  copyKey,
  fallback,
  className
}: {
  copyKey?: string;
  fallback: string;
  className?: string;
}) {
  const context = useSiteCopy();
  const text = useCopyText(copyKey, fallback);
  if (!copyKey || !context?.editMode || !siteCopyEntryMap.has(copyKey)) return <>{text}</>;
  return (
    <span
      role="button"
      tabIndex={0}
      data-site-copy-key={copyKey}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        context.selectKey(copyKey);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        context.selectKey(copyKey);
      }}
      className={`cursor-pointer rounded-sm outline outline-2 outline-coral/45 outline-offset-2 hover:bg-coral/10 ${className ?? ""}`}
      title="编辑界面文案"
    >
      {text}
    </span>
  );
}

export function CopyTarget({
  copyKey,
  children,
  className
}: {
  copyKey?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const context = useSiteCopy();
  if (!copyKey || !siteCopyEntryMap.has(copyKey)) return <>{children}</>;
  if (!context?.editMode) {
    return <span className={`block ${className ?? ""}`}>{children}</span>;
  }
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        context.selectKey(copyKey);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        context.selectKey(copyKey);
      }}
      className={`block cursor-pointer rounded-sm outline outline-2 outline-coral/45 outline-offset-2 ${className ?? ""}`}
      title="编辑这个字段文案"
    >
      {children}
    </span>
  );
}

function valueForEntry(payload: SiteCopyPayload | null, entry: SiteCopyEntry) {
  return {
    ...entry.defaultValue,
    ...(payload?.values?.[entry.key] ?? payload?.draft?.[entry.key] ?? payload?.published?.[entry.key])
  };
}

function SiteCopyToolbar({
  selectedKey,
  onCloseEditor
}: {
  selectedKey: string;
  onCloseEditor: () => void;
}) {
  const context = useSiteCopy();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  if (!context?.isAdmin) return null;
  const ctx = context;
  const selectedEntry = selectedKey ? siteCopyEntryMap.get(selectedKey) : null;
  const changedCount = ctx.adminPayload?.changedKeys?.length ?? 0;

  async function publish() {
    setBusy("publish");
    setMessage("");
    const response = await api("/api/admin/site-copy/publish", { method: "POST", body: JSON.stringify({}) })
      .catch((error: Error) => {
        setMessage(error.message);
        return null;
      })
      .finally(() => setBusy(""));
    if (response) {
      ctx.applyAdminPayload(response);
      ctx.refresh();
      setMessage(response.message ?? "界面文案已发布。");
    }
  }

  async function discard() {
    setBusy("discard");
    setMessage("");
    const response = await api("/api/admin/site-copy/discard", { method: "POST", body: JSON.stringify({}) })
      .catch((error: Error) => {
        setMessage(error.message);
        return null;
      })
      .finally(() => setBusy(""));
    if (response) {
      ctx.applyAdminPayload(response);
      ctx.refresh();
      setMessage(response.message ?? "界面文案草稿已丢弃。");
    }
  }

  return (
    <div className="fixed bottom-5 left-5 z-[70] max-w-[calc(100vw-2rem)]" data-no-translate>
      <div className="border-2 border-ink bg-paper p-2 shadow-hard">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => ctx.setEditMode(!ctx.editMode)}
            className={`inline-flex items-center gap-2 border px-3 py-2 text-sm font-semibold ${ctx.editMode ? "border-coral bg-coral text-paper" : "border-ink bg-paper text-ink"}`}
          >
            <Edit3 size={15} aria-hidden />
            编辑界面文案
          </button>
          <Link href="/admin/site-copy" className="inline-flex items-center gap-1 border border-ink/35 px-3 py-2 text-sm font-semibold">
            管理全部
            <ExternalLink size={14} aria-hidden />
          </Link>
          {changedCount ? (
            <button type="button" onClick={publish} disabled={Boolean(busy)} className="inline-flex items-center gap-1 border border-forest/40 bg-forest/10 px-3 py-2 text-sm font-semibold text-forest disabled:opacity-50">
              <Send size={14} aria-hidden />
              发布 {changedCount}
            </button>
          ) : null}
          {ctx.adminPayload?.hasDraft ? (
            <button type="button" onClick={discard} disabled={Boolean(busy)} className="inline-flex items-center gap-1 border border-rust/35 px-3 py-2 text-sm font-semibold text-rust disabled:opacity-50">
              <RotateCcw size={14} aria-hidden />
              丢弃草稿
            </button>
          ) : null}
        </div>
        {message ? <p className="mt-2 max-w-md text-xs font-semibold text-rust">{message}</p> : null}
      </div>
      {selectedEntry ? (
        <SiteCopyEditor
          entry={selectedEntry}
          initialValue={valueForEntry(context.adminPayload, selectedEntry)}
          onClose={onCloseEditor}
        />
      ) : null}
    </div>
  );
}

function SiteCopyEditor({
  entry,
  initialValue,
  onClose
}: {
  entry: SiteCopyEntry;
  initialValue: SiteCopyValue;
  onClose: () => void;
}) {
  const context = useSiteCopy();
  const [value, setValue] = useState<SiteCopyValue>(initialValue);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const activeEntryKey = useRef(entry.key);

  useEffect(() => {
    if (activeEntryKey.current === entry.key) return;
    activeEntryKey.current = entry.key;
    setValue(initialValue);
    setMessage("");
  }, [entry.key, initialValue]);

  async function saveDraft() {
    if (!context) return;
    setBusy(true);
    setMessage("");
    const response = await api("/api/admin/site-copy/draft", {
      method: "PATCH",
      body: JSON.stringify({ changes: { [entry.key]: value } })
    })
      .catch((error: Error) => {
        setMessage(error.message);
        return null;
      })
      .finally(() => setBusy(false));
    if (response) {
      context.applyAdminPayload(response);
      setMessage(response.message ?? "草稿已保存。");
    }
  }

  return (
    <section className="mt-3 w-[min(440px,calc(100vw-2rem))] border-2 border-ink bg-paper p-4 shadow-hard" data-no-translate>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-coral">{entry.group}</p>
          <h2 className="mt-1 text-lg font-semibold text-ink">{entry.label}</h2>
          <p className="mt-1 break-all text-xs text-ink/52">{entry.key}</p>
        </div>
        <button type="button" onClick={onClose} className="border border-ink/30 p-1">
          <X size={15} aria-hidden />
        </button>
      </div>
      <div className="mt-4 grid gap-3">
        <label className="grid gap-1 text-sm font-semibold text-ink">
          中文
          <textarea
            rows={3}
            maxLength={entry.maxLength}
            value={value.zh ?? ""}
            onChange={(event) => setValue((current) => ({ ...current, zh: event.target.value }))}
            className="focus-ring w-full border border-ink/30 bg-chalk/80 px-3 py-2 text-sm text-ink"
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-ink">
          English
          <textarea
            rows={3}
            maxLength={entry.maxLength}
            value={value.en ?? ""}
            onChange={(event) => setValue((current) => ({ ...current, en: event.target.value }))}
            className="focus-ring w-full border border-ink/30 bg-chalk/80 px-3 py-2 text-sm text-ink"
          />
        </label>
        <p className="text-xs text-ink/50">最多 {entry.maxLength} 个字符。保存后只是草稿，发布后普通用户才会看到。</p>
        {message ? <p className="text-sm font-semibold text-rust">{message}</p> : null}
        <button type="button" onClick={saveDraft} disabled={busy} className="inline-flex w-fit items-center gap-2 bg-ink px-4 py-2 text-sm font-semibold text-paper disabled:opacity-50">
          <Check size={15} aria-hidden />
          {busy ? "保存中..." : "保存草稿"}
        </button>
      </div>
    </section>
  );
}
