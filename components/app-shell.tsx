"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BookOpen, LayoutDashboard, MailCheck, Menu, Settings, Sparkles, UserRound, UsersRound } from "lucide-react";
import { adminNav, studentNav } from "@/lib/ui-data";
import { LanguageSwitcher } from "@/components/language-runtime";
import clsx from "clsx";

export function Navbar() {
  return (
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
          <Link
            href="/login"
            className="focus-ring inline-flex items-center gap-2 border border-ink bg-rust px-3 py-2 text-sm font-semibold text-paper shadow-soft md:px-4"
          >
            <MailCheck size={16} aria-hidden />
            <span className="hidden sm:inline">登录 / 注册</span>
          </Link>
        </div>
      </div>
    </header>
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
  children,
  aside = "student"
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  children: React.ReactNode;
  aside?: "student" | "admin" | "none";
}) {
  const nav = aside === "admin" ? adminNav : studentNav;

  return (
    <main className="mx-auto grid max-w-[1440px] gap-4 px-3 pb-24 pt-5 md:px-5 md:py-7 lg:grid-cols-[228px_1fr]">
      {aside !== "none" ? <Sidebar items={nav} admin={aside === "admin"} /> : null}
      <section className={clsx("min-w-0", aside === "none" && "lg:col-span-2")}>
        <div className="mb-5 border-b border-ink/18 pb-4">
          {eyebrow ? <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-coral">{eyebrow}</p> : null}
          <h1 className="font-serif text-3xl font-semibold leading-tight text-ink md:text-5xl">
            <CourseLikeTitle title={title} />
          </h1>
          {description ? <p className="mt-3 max-w-3xl text-base leading-7 text-ink/68">{description}</p> : null}
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
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-ink bg-chalk/98 px-2 py-2 shadow-[0_-1px_0_rgba(17,19,15,0.08)] lg:hidden">
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

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx("border border-ink/70 bg-chalk/92 p-4 shadow-soft md:p-5", className)}>{children}</div>;
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <Card className="text-center">
      <div className="mx-auto mb-3 grid h-9 w-9 place-items-center border border-ink/20 bg-mist text-moss">
        <UsersRound size={18} aria-hidden />
      </div>
      <h3 className="font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-ink/62">{body}</p>
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
