import Link from "next/link";
import { BookOpen, LayoutDashboard, MailCheck, Settings, Sparkles, UserRound, UsersRound } from "lucide-react";
import { adminNav, studentNav } from "@/lib/ui-data";
import clsx from "clsx";

export function Navbar() {
  return (
    <header className="sticky top-0 z-30 border-b-2 border-ink bg-paper/92 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-wide text-ink">
          <span className="grid h-9 w-9 place-items-center border border-ink bg-ink text-paper">
            <Sparkles size={18} aria-hidden />
          </span>
          TEAMAKING
        </Link>
        <nav className="hidden items-center gap-1 text-sm text-ink/72 md:flex">
          <NavItem href="/dashboard" label="Dashboard" />
          <NavItem href="/courses" label="Courses" />
          <NavItem href="/matches" label="Matches" />
          <NavItem href="/support" label="Support" />
          <NavItem href="/admin" label="Admin" />
        </nav>
        <Link
          href="/login"
          className="focus-ring inline-flex items-center gap-2 rounded-sm border border-ink bg-rust px-4 py-2 text-sm font-semibold text-paper shadow-soft"
        >
          <MailCheck size={16} aria-hidden />
          学校邮箱登录
        </Link>
      </div>
    </header>
  );
}

function NavItem({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="rounded-sm px-3 py-2 hover:bg-mist">
      {label}
    </Link>
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
    <main className="mx-auto grid max-w-7xl gap-6 px-5 py-8 lg:grid-cols-[250px_1fr]">
      {aside !== "none" ? <Sidebar items={nav} admin={aside === "admin"} /> : null}
      <section className={clsx("min-w-0", aside === "none" && "lg:col-span-2")}>
        <div className="mb-6">
          {eyebrow ? <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-coral">{eyebrow}</p> : null}
          <h1 className="text-3xl font-semibold text-ink md:text-4xl">{title}</h1>
          {description ? <p className="mt-3 max-w-3xl text-base leading-7 text-ink/68">{description}</p> : null}
        </div>
        {children}
      </section>
    </main>
  );
}

function Sidebar({ items, admin }: { items: { href: string; label: string }[]; admin?: boolean }) {
  return (
    <aside className="h-fit border-2 border-ink bg-chalk p-3 shadow-soft">
      <div className="mb-3 flex items-center gap-2 px-2 py-2 text-sm font-semibold text-ink/70">
        {admin ? <Settings size={16} aria-hidden /> : <LayoutDashboard size={16} aria-hidden />}
        {admin ? "Admin Panel" : "Student App"}
      </div>
      <div className="grid gap-1">
        {items.map((item) => (
          <Link key={item.href} href={item.href} className="rounded-sm border border-transparent px-3 py-2 text-sm text-ink/76 hover:border-ink/30 hover:bg-mist hover:text-ink">
            {item.label}
          </Link>
        ))}
      </div>
    </aside>
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx("border-2 border-ink bg-chalk p-5 shadow-soft", className)}>{children}</div>;
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <Card className="text-center">
      <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-lg bg-mist text-moss">
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
      <div className="h-4 w-32 animate-pulse rounded bg-ink/10" />
      <div className="mt-4 grid gap-3">
        <div className="h-3 animate-pulse rounded bg-ink/10" />
        <div className="h-3 w-5/6 animate-pulse rounded bg-ink/10" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-ink/10" />
      </div>
    </Card>
  );
}

export function SkillBadge({ children }: { children: React.ReactNode }) {
  return <span className="border border-ink/25 bg-mist px-2.5 py-1 text-xs font-medium text-forest">{children}</span>;
}

export function StatusPill({ status }: { status?: string }) {
  const color =
    status === "mutual"
      ? "bg-moss text-white"
      : status === "reported"
        ? "bg-coral text-white"
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
