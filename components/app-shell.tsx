"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { HTMLAttributes } from "react";
import { useEffect, useState } from "react";
import { BookOpen, Database, Download, HardDrive, LayoutDashboard, LogOut, MailCheck, Menu, Settings, Sparkles, Upload, UserRound, UsersRound, Wifi, WifiOff } from "lucide-react";
import { api } from "@/lib/client/api";
import { adminNav, studentNav } from "@/lib/ui-data";
import { LanguageSwitcher } from "@/components/language-runtime";
import { EditableCopy } from "@/components/site-copy-runtime";
import clsx from "clsx";

export function Navbar() {
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-ink/70 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-3 py-2.5 md:px-5">
          <Link href="/" className="flex items-center gap-2 text-ink">
            <span className="grid h-8 w-8 place-items-center border border-ink bg-ink text-paper">
              <Sparkles size={16} aria-hidden />
            </span>
            <span className="font-serif text-xl font-semibold tracking-normal">TEAMAKING</span>
          </Link>
          <nav className="hidden items-center gap-1 text-sm text-ink/70 lg:flex">
            <NavItem href="/dashboard" label="Dashboard" />
            <NavItem href="/courses" label="Courses" />
            <NavItem href="/matches" label="Matches" />
            <NavItem href="/announcements" label="Announcements" />
            <NavItem href="/support" label="Support" />
          </nav>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <AuthNav />
          </div>
        </div>
      </header>
      <DesktopStatusBar />
    </>
  );
}

function DesktopStatusBar() {
  const [status, setStatus] = useState<any>(null);
  const [online, setOnline] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;
    api("/api/desktop/health")
      .then((data) => {
        if (!alive) return;
        setStatus(data);
        document.documentElement.classList.add("teamaking-desktop-runtime");
      })
      .catch(() => {
        if (alive) setStatus(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!status || typeof window === "undefined") return;
    const update = () => setOnline(window.navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, [status]);

  async function importBackup(file?: File) {
    if (!file) return;
    setMessage("正在导入备份...");
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/desktop/backup/import", { method: "POST", body: formData });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error ?? "备份导入失败。");
      return;
    }
    setMessage(data.message ?? "备份已导入，请重启桌面端。");
  }

  if (!status) return null;

  return (
    <div className="border-b border-ink/16 bg-chalk/92">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs text-ink/68 md:px-5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 border border-ink/16 bg-paper px-2 py-1 font-semibold text-ink">
            <HardDrive size={13} aria-hidden />
            本机工作区
          </span>
          <span className="inline-flex min-w-0 items-center gap-1 border border-ink/12 px-2 py-1">
            <Database size={13} aria-hidden />
            <span className={status.ok ? "text-forest" : "text-rust"}>{status.ok ? "数据库正常" : "数据库异常"}</span>
          </span>
          <span className="inline-flex min-w-0 items-center gap-1 border border-ink/12 px-2 py-1">
            {online ? <Wifi size={13} aria-hidden /> : <WifiOff size={13} aria-hidden />}
            {online ? "联网" : "离线"}
          </span>
          <span className="max-w-[44vw] truncate" title={status.dataDir} data-no-translate>{status.dataDir}</span>
        </div>
        <div className="flex items-center gap-2">
          {message ? <span className="hidden max-w-[340px] truncate text-forest md:inline">{message}</span> : null}
          <Link href="/api/desktop/backup/export" prefetch={false} className="focus-ring inline-flex items-center gap-1 border border-ink/30 px-2 py-1 font-semibold hover:bg-mist/60">
            <Download size={13} aria-hidden />
            备份
          </Link>
          <label className="focus-ring inline-flex cursor-pointer items-center gap-1 border border-ink/30 px-2 py-1 font-semibold hover:bg-mist/60">
            <Upload size={13} aria-hidden />
            导入
            <input
              type="file"
              accept=".zip,application/zip"
              className="sr-only"
              onChange={(event) => {
                void importBackup(event.target.files?.[0]);
                event.currentTarget.value = "";
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
}

function AuthNav() {
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let alive = true;
    api("/api/auth/me")
      .then((data) => {
        if (alive) setUser(data.user ?? null);
      })
      .catch(() => {
        if (alive) setUser(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [pathname]);

  async function logout() {
    setLoggingOut(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
      setUser(null);
      window.location.href = "/";
    } catch {
      setLoggingOut(false);
    }
  }

  if (loading) {
    return <div className="h-9 w-28 border border-ink/12 bg-ink/5" aria-hidden />;
  }

  if (!user) {
    return (
      <Link
        href="/login?mode=register"
        className="focus-ring inline-flex items-center gap-2 border border-ink bg-rust px-3 py-2 text-sm font-semibold text-paper shadow-soft md:px-4"
      >
        <MailCheck size={16} aria-hidden />
        <span className="hidden sm:inline">登录 / 注册</span>
      </Link>
    );
  }

  const profile = user.profile ?? {};
  const displayName = profile.displayName ?? user.email?.split("@")[0] ?? "Profile";
  const initials = String(displayName).trim().slice(0, 2).toUpperCase() || "U";

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/profile/me"
        className="focus-ring inline-flex max-w-[210px] items-center gap-2 border border-ink/25 bg-paper px-2 py-1.5 text-sm font-semibold text-ink hover:bg-mist/70"
      >
        <span
          className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden border border-ink/25 bg-mist bg-cover bg-center text-xs font-bold text-ink"
          style={profile.avatarUrl ? { backgroundImage: `url(${profile.avatarUrl})` } : undefined}
          data-no-translate
          aria-hidden
        >
          {profile.avatarUrl ? null : initials}
        </span>
        <span className="hidden min-w-0 sm:block">
          <span className="block truncate leading-tight" data-no-translate>{displayName}</span>
          <span className="block text-[11px] font-semibold leading-tight text-ink/58">Profile</span>
        </span>
      </Link>
      <button
        type="button"
        onClick={logout}
        disabled={loggingOut}
        className="focus-ring inline-flex items-center gap-1.5 border border-rust/45 bg-rust/10 px-2.5 py-2 text-sm font-semibold text-rust disabled:opacity-50"
      >
        {loggingOut ? <UserRound size={16} aria-hidden /> : <LogOut size={16} aria-hidden />}
        <span className="hidden md:inline">{loggingOut ? "Logging out..." : "Logout"}</span>
      </button>
    </div>
  );
}

function NavItem({ href, label }: { href: string; label: string }) {
  const [count, setCount] = useState(0);
  const pathname = usePathname();
  const active = pathname === href || (href !== "/admin" && href !== "/dashboard" && pathname.startsWith(`${href}/`));

  useEffect(() => {
    if (!["/team-up-requests", "/inbox"].includes(href)) return;
    let alive = true;
    fetch("/api/notifications/summary")
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!alive || !data?.summary) return;
        setCount(href === "/team-up-requests" ? data.summary.teamUpInterests ?? 0 : data.summary.followRequests ?? 0);
      })
      .catch(() => null);
    return () => {
      alive = false;
    };
  }, [href]);

  return (
    <Link
      href={href}
      className={clsx(
        "relative inline-flex shrink-0 items-center gap-1 whitespace-nowrap border border-transparent px-2.5 py-1.5 hover:border-ink/20 hover:bg-mist/60",
        active && "border-ink/35 bg-mist/70 text-ink"
      )}
    >
      {label}
      {count > 0 ? <span className="ml-1 rounded-full bg-coral px-1.5 py-0.5 text-[10px] font-semibold text-paper">{count}</span> : null}
    </Link>
  );
}

function CourseLikeTitle({ title }: { title: string }) {
  const match = /^([A-Z]{2,}\d{3,4}[A-Z]?)\s+(.+)$/.exec(title.trim());
  if (!match) return <>{title}</>;
  return (
    <>
      <span className="mb-2 block font-sans text-lg font-semibold tracking-[0.08em] text-coral md:text-2xl">
        {match[1]}
      </span>
      <span className="block">{match[2]}</span>
    </>
  );
}

export function PageShell({
  title,
  eyebrow,
  description,
  titleCopyKey,
  eyebrowCopyKey,
  descriptionCopyKey,
  children,
  aside = "student",
  workspace = false
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  titleCopyKey?: string;
  eyebrowCopyKey?: string;
  descriptionCopyKey?: string;
  children: React.ReactNode;
  aside?: "student" | "admin" | "none";
  workspace?: boolean;
}) {
  const nav = aside === "admin" ? adminNav : studentNav;
  const workspaceMode = workspace || aside === "admin";

  return (
    <main
      data-onboarding-fallback
      className={clsx(
        "mx-auto grid max-w-[1440px] gap-4 px-3 pb-24 pt-5 md:px-5 md:py-7",
        aside === "none" ? "lg:grid-cols-1" : "lg:grid-cols-[228px_minmax(0,1fr)]",
        workspaceMode && "lg:h-[calc(100vh-3.35rem)] lg:overflow-hidden lg:pb-4 lg:pt-4"
      )}
    >
      {aside !== "none" ? <Sidebar items={nav} admin={aside === "admin"} /> : null}
      <section
        data-workspace-scroll={workspaceMode ? "true" : undefined}
        className={clsx(
          "min-w-0",
          workspaceMode && "admin-page workspace-scroll-panel lg:h-full lg:overflow-y-auto lg:pr-2",
          aside === "none" && !workspaceMode && "lg:col-span-2"
        )}
      >
        <div
          className={clsx(
            "mb-5 border-b border-ink/18 pb-4",
            workspaceMode && "lg:sticky lg:top-0 lg:z-20 lg:mb-4 lg:bg-paper/95 lg:pb-3 lg:pt-1 lg:backdrop-blur"
          )}
        >
          {eyebrow ? <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-coral"><EditableCopy copyKey={eyebrowCopyKey} fallback={eyebrow} /></p> : null}
          <h1 className={clsx("font-serif text-3xl font-semibold leading-tight text-ink", workspaceMode ? "md:text-3xl" : "md:text-5xl")}>
            {titleCopyKey ? <EditableCopy copyKey={titleCopyKey} fallback={title} /> : <CourseLikeTitle title={title} />}
          </h1>
          {description ? (
            <p className={clsx("mt-3 max-w-3xl leading-7 text-ink/68", workspaceMode ? "text-sm" : "text-base")}>
              <EditableCopy copyKey={descriptionCopyKey} fallback={description} />
            </p>
          ) : null}
        </div>
        {children}
      </section>
      {aside !== "none" ? <MobileNav items={nav} admin={aside === "admin"} /> : null}
    </main>
  );
}

function Sidebar({ items, admin }: { items: { href: string; label: string }[]; admin?: boolean }) {
  return (
    <aside className="hidden h-fit max-h-[calc(100vh-6.5rem)] overflow-auto border border-ink/70 bg-chalk/95 p-2 shadow-soft lg:sticky lg:top-20 lg:block">
      <div className="mb-2 flex items-center gap-2 border-b border-ink/15 px-2 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink/58">
        {admin ? <Settings size={16} aria-hidden /> : <LayoutDashboard size={16} aria-hidden />}
        {admin ? "Admin Panel" : "Student App"}
      </div>
      <div className="grid gap-1">
        {items.map((item) => (
          <NavItem key={item.href} href={item.href} label={item.label} />
        ))}
      </div>
    </aside>
  );
}

function MobileNav({ items, admin }: { items: { href: string; label: string }[]; admin?: boolean }) {
  return (
    <nav className="desktop-mobile-nav fixed inset-x-0 bottom-0 z-40 border-t border-ink bg-chalk/98 px-2 py-2 shadow-[0_-1px_0_rgba(17,19,15,0.08)] lg:hidden">
      <div className="sr-only">
        <Menu size={13} aria-hidden />
        {admin ? "Admin" : "Navigate"}
      </div>
      <div className="flex gap-2 overflow-x-auto pl-12 pr-16 pb-[env(safe-area-inset-bottom)]">
        {items.map((item) => (
          <NavItem key={item.href} href={item.href} label={item.label} />
        ))}
      </div>
    </nav>
  );
}

export function Card({ children, className, ...props }: HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) {
  return <div className={clsx("min-w-0 border border-ink/70 bg-chalk/92 p-4 shadow-soft md:p-5", className)} {...props}>{children}</div>;
}

export function EmptyState({ title, body, titleCopyKey, bodyCopyKey }: { title: string; body: string; titleCopyKey?: string; bodyCopyKey?: string }) {
  return (
    <Card className="text-center">
      <div className="mx-auto mb-3 grid h-9 w-9 place-items-center border border-ink/20 bg-mist text-moss">
        <UsersRound size={18} aria-hidden />
      </div>
      <h3 className="font-semibold text-ink"><EditableCopy copyKey={titleCopyKey} fallback={title} /></h3>
      <p className="mt-2 text-sm leading-6 text-ink/62"><EditableCopy copyKey={bodyCopyKey} fallback={body} /></p>
    </Card>
  );
}

export function LoadingState() {
  return (
    <Card>
      <div className="h-4 w-32 animate-pulse bg-ink/10" />
      <div className="mt-4 grid gap-3">
        <div className="h-3 animate-pulse bg-ink/10" />
        <div className="h-3 w-5/6 animate-pulse bg-ink/10" />
        <div className="h-3 w-2/3 animate-pulse bg-ink/10" />
      </div>
    </Card>
  );
}

export function SkillBadge({ children }: { children: React.ReactNode }) {
  return <span className="border border-ink/22 bg-mist/60 px-2.5 py-1 text-xs font-medium text-forest">{children}</span>;
}

export function StatusPill({ status }: { status?: string }) {
  const color =
    status === "mutual"
      ? "bg-moss/18 text-moss"
    : status === "reported"
        ? "bg-coral/18 text-coral"
        : status === "viewed"
          ? "bg-gold/20 text-ink"
          : "bg-ink/8 text-ink/72";

  return <span className={clsx("border border-ink/20 px-2.5 py-1 text-xs font-semibold", color)}>{status ?? "unknown"}</span>;
}

export function CourseIcon() {
  return (
    <span className="grid h-9 w-9 place-items-center border border-ink/25 bg-mist text-forest">
      <BookOpen size={17} aria-hidden />
    </span>
  );
}

export function UserIcon() {
  return (
    <span className="grid h-9 w-9 place-items-center border border-rust/30 bg-rust/10 text-rust">
      <UserRound size={17} aria-hidden />
    </span>
  );
}
