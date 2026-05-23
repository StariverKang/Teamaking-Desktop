"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowRight, Award, Check, FileText, Handshake, Image as ImageIcon, KeyRound, Link as LinkIcon, MailCheck, Music, Plus, Search, Send, Settings, Trash2, UserRound } from "lucide-react";
import { Card, EmptyState, LoadingState, PageShell, SkillBadge, StatusPill } from "@/components/app-shell";
import { CourseCard, ProfileCard, TeamakingPostCard, TeamUpRequestCard } from "@/components/cards";
import { contributionTypes, strengths } from "@/lib/constants";
import { contactVisibilityOptions, defaultContactVisibility } from "@/lib/contact";

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
  if (!response.ok) {
    throw new Error(data.error ?? "请求失败，请稍后再试。");
  }

  return data;
}

async function uploadProfileFile(file: File, purpose: string) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("purpose", purpose);

  const response = await fetch("/api/uploads", {
    method: "POST",
    body: formData
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error ?? "上传失败，请稍后再试。");
  }

  return data.upload;
}

function useApi(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!path) {
      setData(null);
      setError("");
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);
    api(path)
      .then((value) => {
        if (alive) {
          setData(value);
          setError("");
        }
      })
      .catch((err: Error) => {
        if (alive) setError(err.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);

  return { data, error, loading };
}

function ErrorBox({ message }: { message?: string }) {
  if (!message) return null;
  return <div className="rounded-lg border border-coral/25 bg-coral/10 px-4 py-3 text-sm text-coral">{message}</div>;
}

function Field({
  label,
  children,
  help
}: {
  label: string;
  children: React.ReactNode;
  help?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-ink">
      <span>{label}</span>
      {children}
      {help ? <span className="text-xs font-normal leading-5 text-ink/56">{help}</span> : null}
    </label>
  );
}

const inputClass = "focus-ring w-full rounded-sm border border-ink/30 bg-paper px-3 py-2 text-sm text-ink";

const portfolioTypeLabels: Record<string, string> = {
  portfolio: "个人作品",
  coursework: "课程作品",
  report: "报告 / 论文",
  slides: "PPT / 展示",
  code: "代码",
  design: "设计稿",
  audio: "音频",
  image: "图像",
  gpa_screenshot: "GPA 截图",
  language_score: "语言成绩",
  award_certificate: "获奖证书",
  skill_certification: "技能认证",
  career_certification: "职业认证",
  resume: "简历",
  other: "其他"
};

const portfolioTypes = Object.keys(portfolioTypeLabels);

const acceptedProfileFiles = [
  ".md",
  ".markdown",
  ".txt",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
  ".tsv",
  ".pdf",
  ".ppt",
  ".pptx",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".heic",
  ".mp3",
  ".wav",
  ".m4a",
  ".aac",
  ".flac",
  ".ogg",
  ".fig",
  ".sketch",
  ".xd",
  ".psd",
  ".ai",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".py",
  ".java",
  ".c",
  ".cpp",
  ".h",
  ".cs",
  ".go",
  ".rs",
  ".rb",
  ".php",
  ".html",
  ".css",
  ".json",
  ".yaml",
  ".yml",
  ".zip",
  ".rar",
  ".7z"
].join(",");

function tagsFromText(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function tagsToText(value: unknown) {
  return Array.isArray(value) ? value.join(", ") : "";
}

function formatFileSize(value?: number) {
  if (!value) return "";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function previewIcon(kind?: string) {
  if (kind === "image") return <ImageIcon size={16} aria-hidden />;
  if (kind === "audio") return <Music size={16} aria-hidden />;
  if (kind === "pdf" || kind === "office" || kind === "markdown" || kind === "text") return <FileText size={16} aria-hidden />;
  if (kind === "design") return <Award size={16} aria-hidden />;
  return <LinkIcon size={16} aria-hidden />;
}

const honorTypes = new Set(["gpa_screenshot", "award_certificate", "skill_certification", "career_certification", "language_score"]);

function isHonorItem(item: any) {
  return honorTypes.has(item.type);
}

function fileFamily(item: any) {
  if (item.previewKind === "pdf") return "report";
  if (item.previewKind === "office" && ["ppt", "pptx"].includes(item.fileExtension)) return "slides";
  if (item.previewKind === "text" && ["js", "jsx", "ts", "tsx", "py", "java", "c", "cpp", "go", "rs"].includes(item.fileExtension)) return "code";
  if (item.previewKind === "design") return "design";
  if (item.type === "slides" || item.type === "report" || item.type === "code" || item.type === "design") return item.type;
  return "other";
}

function PaginatedGrid({
  items,
  render,
  pageSize = 4,
  gridClassName = "grid gap-4 md:grid-cols-2"
}: {
  items: any[];
  render: (item: any) => React.ReactNode;
  pageSize?: number;
  gridClassName?: string;
}) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const visible = items.slice(safePage * pageSize, safePage * pageSize + pageSize);

  useEffect(() => {
    if (page > pageCount - 1) setPage(Math.max(0, pageCount - 1));
  }, [page, pageCount]);

  return (
    <div className="grid gap-3">
      <div className={gridClassName}>{visible.map(render)}</div>
      {items.length > pageSize ? (
        <div className="flex items-center justify-between border border-ink/20 bg-paper px-3 py-2 text-sm">
          <button type="button" className="focus-ring border border-ink/30 px-3 py-1 font-semibold disabled:opacity-40" disabled={safePage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>
            Previous
          </button>
          <span className="text-ink/62">{safePage + 1} / {pageCount}</span>
          <button type="button" className="focus-ring border border-ink/30 px-3 py-1 font-semibold disabled:opacity-40" disabled={safePage >= pageCount - 1} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}>
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ToggleGroup({
  values,
  selected,
  onChange
}: {
  values: string[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => {
        const active = selected.includes(value);
        return (
          <button
            key={value}
            type="button"
            onClick={() => onChange(active ? selected.filter((item) => item !== value) : [...selected, value])}
            className={`focus-ring rounded-lg border px-3 py-2 text-sm font-semibold ${
              active ? "border-moss bg-moss text-white" : "border-ink/12 bg-white text-ink/70 hover:bg-mist"
            }`}
          >
            {value}
          </button>
        );
      })}
    </div>
  );
}

export function LandingPage() {
  return (
    <main className="mx-auto max-w-7xl px-5 py-10">
      <section className="grid min-h-[calc(100vh-140px)] items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-coral">Proof-of-Work Profile + Course Boards</p>
          <h1 className="text-5xl font-semibold leading-tight text-ink md:text-7xl">TEAMAKING</h1>
          <p className="mt-5 text-2xl font-semibold text-moss">Your work speaks before you team up.</p>
          <p className="mt-3 text-xl text-ink/68">让认真做事的人，先被看见。</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login" className="focus-ring inline-flex items-center gap-2 rounded-lg bg-coral px-5 py-3 font-semibold text-white shadow-soft">
              <MailCheck size={18} aria-hidden />
              用学校邮箱开始
            </Link>
            <Link href="/demo-access" className="focus-ring inline-flex items-center gap-2 rounded-sm bg-ink px-5 py-3 font-semibold text-paper">
              进入演示验收
              <ArrowRight size={18} aria-hidden />
            </Link>
            <Link href="/courses" className="focus-ring inline-flex items-center gap-2 rounded-sm border border-ink/40 bg-paper px-5 py-3 font-semibold text-ink">
              先看看 Course Boards
              <ArrowRight size={18} aria-hidden />
            </Link>
          </div>
        </div>
        <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
          <div className="rounded-lg bg-mist p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-ink">COM3003 Media Ethics</p>
              <span className="rounded-lg bg-coral px-2.5 py-1 text-xs font-semibold text-white">Open to Team</span>
            </div>
            <div className="mt-4 grid gap-3">
              {["Proof-of-Work Profile", "Course People", "Lightweight Team Up"].map((item, index) => (
                <div key={item} className="rounded-lg bg-white p-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-gold/20 text-sm font-semibold text-ink">{index + 1}</span>
                    <div>
                      <p className="font-semibold text-ink">{item}</p>
                      <p className="text-sm text-ink/58">学生展示贡献、加入课程板、轻量联系彼此。</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  function resetState(nextMode: "login" | "register" | "reset") {
    setMode(nextMode);
    setCode("");
    setDevCode("");
    setMessage("");
    setError("");
  }

  async function passwordLogin(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsLoggingIn(true);
    const result = await api("/api/auth/password-login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    }).catch((err: Error) => {
      setError(err.message);
      return null;
    }).finally(() => {
      setIsLoggingIn(false);
    });

    if (result?.user?.onboardingCompleted) router.push("/dashboard");
    else if (result?.user) router.push("/onboarding");
  }

  async function sendCode(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSendingCode(true);
    const endpoint = mode === "reset" ? "/api/auth/password-reset/send-code" : "/api/auth/register/send-code";
    const result = await api(endpoint, {
      method: "POST",
      body: JSON.stringify({ email })
    }).catch((err: Error) => {
      setError(err.message);
      return null;
    }).finally(() => {
      setIsSendingCode(false);
    });

    if (result) {
      const debugCode = typeof result.code === "string" ? result.code : "";
      setDevCode(debugCode);
      if (debugCode) setCode(debugCode);
      setMessage(debugCode ? `验证码已生成。开发环境验证码：${debugCode}` : result.message ?? "验证码已发送，请查看你的学校邮箱。");
    }
  }

  async function completeWithCode(event: FormEvent) {
    event.preventDefault();
    setError("");
    setIsCompleting(true);
    const endpoint = mode === "reset" ? "/api/auth/password-reset/complete" : "/api/auth/register/complete";
    const result = await api(endpoint, {
      method: "POST",
      body: JSON.stringify({ email, code, password })
    }).catch((err: Error) => {
      setError(err.message);
      return null;
    }).finally(() => {
      setIsCompleting(false);
    });

    if (result?.user?.onboardingCompleted) router.push("/dashboard");
    else if (result?.user) router.push("/onboarding");
  }

  return (
    <PageShell title="测试环境入口" eyebrow="Authentication" description="测试环境账号会被保存，便于你重复登录、编辑资料、上传作品和继续测试；正式上线前可能统一清理测试数据。" aside="none">
      <div className="mb-5 inline-flex flex-wrap gap-2 border border-ink/20 bg-chalk p-1">
        {[
          ["login", "账号密码登录"],
          ["register", "邮箱注册"],
          ["reset", "找回密码"]
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => resetState(key as "login" | "register" | "reset")}
            className={`rounded-sm px-4 py-2 text-sm font-semibold ${mode === key ? "bg-ink text-paper" : "text-ink/68 hover:bg-mist"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-coral">{mode === "login" ? "Login" : mode === "register" ? "Register" : "Password Reset"}</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">{mode === "login" ? "已注册用户登录" : mode === "register" ? "学校邮箱注册" : "找回密码"}</h2>
            <p className="mt-2 text-sm leading-6 text-ink/64">
              {mode === "login"
                ? "已注册用户使用学校邮箱和密码登录。"
                : mode === "register"
                  ? "未注册用户先接收学校邮箱验证码，再设置密码完成注册。"
                  : "忘记密码时，用学校邮箱接收验证码后设置新密码。"}
            </p>
          </div>

          {mode === "login" ? (
            <form onSubmit={passwordLogin} className="grid gap-4">
              <Field label="学校邮箱">
                <input className={inputClass} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="your.name@mail.bnbu.edu.cn" />
              </Field>
              <Field label="密码">
                <input className={inputClass} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="输入密码" />
              </Field>
              <button type="submit" disabled={isLoggingIn} className="focus-ring inline-flex w-fit items-center gap-2 rounded-lg bg-ink px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
                <KeyRound size={16} aria-hidden />
                {isLoggingIn ? "登录中..." : "登录"}
              </button>
            </form>
          ) : (
            <div className="grid gap-6">
              <form onSubmit={sendCode} className="grid gap-4">
                <Field label="学校邮箱">
                  <input className={inputClass} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="your.name@mail.bnbu.edu.cn" />
                </Field>
                <button type="submit" disabled={isSendingCode} className="focus-ring inline-flex w-fit items-center gap-2 rounded-lg bg-ink px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
                  <Send size={16} aria-hidden />
                  {isSendingCode ? "发送中..." : "发送验证码"}
                </button>
              </form>
              {message ? <p className="rounded-lg bg-mist px-4 py-3 text-sm font-medium text-moss">{message}</p> : null}
              {devCode ? <p className="text-xs text-ink/58">本地调试提示：验证码已经自动填入下方输入框。</p> : null}
              <form onSubmit={completeWithCode} className="grid gap-4">
                <Field label="验证码">
                  <input className={inputClass} value={code} onChange={(event) => setCode(event.target.value)} placeholder="6 位验证码" />
                </Field>
                <Field label={mode === "register" ? "设置密码" : "设置新密码"}>
                  <input className={inputClass} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 8 位" />
                </Field>
                <button type="submit" disabled={isCompleting} className="focus-ring inline-flex w-fit items-center gap-2 rounded-lg bg-coral px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
                  <Check size={16} aria-hidden />
                  {isCompleting ? "处理中..." : mode === "register" ? "完成注册" : "重设密码并登录"}
                </button>
              </form>
            </div>
          )}
        </Card>

        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-coral">Test Notice</p>
          <h2 className="mt-2 text-xl font-semibold text-ink">测试用户说明</h2>
          <p className="mt-3 text-sm leading-6 text-ink/64">这个版本用于正式域名上的功能测试。测试账号、资料、作品上传和重复登录会暂时保留，方便继续验证流程。</p>
          <p className="mt-3 text-sm leading-6 text-ink/64">这些数据仍属于测试环境数据，不作为正式上线后的长期生产数据承诺。</p>
        </Card>
      </div>
      <div className="mt-5">
        <ErrorBox message={error} />
      </div>
    </PageShell>
  );
}

export function AdminLoginPage() {
  const router = useRouter();
  const [developerEmail, setDeveloperEmail] = useState("");
  const [developerPassword, setDeveloperPassword] = useState("");
  const [error, setError] = useState("");
  const [isDeveloperLoggingIn, setIsDeveloperLoggingIn] = useState(false);

  async function developerLogin(event: FormEvent) {
    event.preventDefault();
    setError("");
    setIsDeveloperLoggingIn(true);
    const result = await api("/api/auth/developer-login", {
      method: "POST",
      body: JSON.stringify({ email: developerEmail, password: developerPassword })
    }).catch((err: Error) => {
      setError(err.message);
      return null;
    }).finally(() => {
      setIsDeveloperLoggingIn(false);
    });

    if (result?.user) router.push("/admin");
  }

  return (
    <PageShell title="管理入口" eyebrow="Admin Access" description="这个入口只给维护者和管理员使用，不从主系统导航跳转。" aside="none">
      <div className="max-w-xl">
        <Card>
          <form onSubmit={developerLogin} className="grid gap-4">
            <Field label="管理员账号">
              <input className={inputClass} value={developerEmail} onChange={(event) => setDeveloperEmail(event.target.value)} placeholder="admin@teamingapp.org" />
            </Field>
            <Field label="管理员密码">
              <input className={inputClass} type="password" value={developerPassword} onChange={(event) => setDeveloperPassword(event.target.value)} placeholder="输入维护密码" />
            </Field>
            <button type="submit" disabled={isDeveloperLoggingIn} className="focus-ring inline-flex w-fit items-center gap-2 rounded-lg bg-ink px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
              <KeyRound size={16} aria-hidden />
              {isDeveloperLoggingIn ? "登录中..." : "进入管理后台"}
            </button>
          </form>
          <div className="mt-5">
            <ErrorBox message={error} />
          </div>
        </Card>
      </div>
    </PageShell>
  );
}

export function DemoAccessPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const accounts = [
    { key: "media", label: "Media Student", body: "普通学生视角：查看 dashboard、课程、课程板和 Team Up 流程。" },
    { key: "cs", label: "CS Student", body: "跨专业学生视角：用于检查 discovery、profile 和课程板成员展示。" },
    { key: "admin", label: "School Admin", body: "管理员视角：进入无代码后台，处理工单和配置数据。" }
  ];

  async function login(account: string) {
    setError("");
    const result = await api("/api/demo/login", { method: "POST", body: JSON.stringify({ account }) }).catch((err: Error) => {
      setError(err.message);
      return null;
    });
    if (result?.redirectPath) router.push(result.redirectPath);
  }

  return (
    <PageShell title="演示验收入口" eyebrow="Demo Access" description="这个入口只用于本地和验收环境，绕过邮箱验证码，帮助你直接检查业务逻辑与前端展示。" aside="none">
      <ErrorBox message={error} />
      <div className="grid gap-4 md:grid-cols-3">
        {accounts.map((account) => (
          <Card key={account.key}>
            <p className="text-xs font-semibold uppercase tracking-wide text-rust">Demo identity</p>
            <h2 className="mt-2 text-xl font-semibold text-ink">{account.label}</h2>
            <p className="mt-3 min-h-20 text-sm leading-6 text-ink/68">{account.body}</p>
            <button onClick={() => login(account.key)} className="focus-ring mt-5 inline-flex items-center gap-2 rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper">
              使用此身份进入
              <ArrowRight size={15} aria-hidden />
            </button>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}

export function OnboardingPage() {
  const router = useRouter();
  const { data, error, loading } = useApi("/api/onboarding");
  const [form, setForm] = useState({ displayName: "", grade: "Year 2", facultyId: "", majorId: "" });
  const majors = useMemo(() => (data?.majors ?? []).filter((major: any) => !form.facultyId || major.facultyId === form.facultyId), [data, form.facultyId]);

  useEffect(() => {
    if (data?.user) {
      setForm((current) => ({
        ...current,
        displayName: data.user.profile?.displayName ?? data.user.email?.split("@")[0] ?? "",
        facultyId: data.faculties?.[0]?.id ?? "",
        majorId: data.majors?.[0]?.id ?? ""
      }));
    }
  }, [data]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    await api("/api/onboarding", { method: "POST", body: JSON.stringify(form) });
    router.push("/dashboard");
  }

  return (
    <PageShell title="完成基础引导" eyebrow="Onboarding" description="这里不会验证官方选课，只用来帮助系统推荐课程板，并让同学理解你的协作背景。">
      {loading ? <LoadingState /> : <ErrorBox message={error} />}
      {data ? (
        <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <Card>
            <h2 className="text-xl font-semibold text-ink">TEAMAKING 使用方式</h2>
            <div className="mt-4 grid gap-3 text-sm leading-6 text-ink/68">
              <p>1. 完成 Proof-of-Work Profile，让别人先看到你的实际贡献。</p>
              <p>2. 自己加入 Course Board，出现在 Course People 里。</p>
              <p>3. 发布 Open to Team 信号，其他同学可以轻量 Team Up。</p>
              <p>4. 最终沟通和组队在平台外完成，MVP 主要通过 WeChat 联系。</p>
            </div>
            <button type="button" onClick={() => router.push("/dashboard")} className="focus-ring mt-5 rounded-lg border border-ink/12 px-4 py-2 font-semibold">
              暂时跳过
            </button>
          </Card>
          <Card>
            <form onSubmit={submit} className="grid gap-4">
              <Field label="显示名称">
                <input className={inputClass} value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} />
              </Field>
              <Field label="年级 / Academic Year">
                <select className={inputClass} value={form.grade} onChange={(event) => setForm({ ...form, grade: event.target.value })}>
                  {["Year 1", "Year 2", "Year 3", "Year 4"].map((grade) => (
                    <option key={grade}>{grade}</option>
                  ))}
                </select>
              </Field>
              <Field label="Faculty / College">
                <select className={inputClass} value={form.facultyId} onChange={(event) => setForm({ ...form, facultyId: event.target.value, majorId: "" })}>
                  {(data.faculties ?? []).map((faculty: any) => (
                    <option key={faculty.id} value={faculty.id}>
                      {faculty.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Major">
                <select className={inputClass} value={form.majorId} onChange={(event) => setForm({ ...form, majorId: event.target.value })}>
                  {majors.map((major: any) => (
                    <option key={major.id} value={major.id}>
                      {major.name}
                    </option>
                  ))}
                </select>
              </Field>
              <button type="submit" className="focus-ring inline-flex w-fit items-center gap-2 rounded-lg bg-coral px-4 py-2 font-semibold text-white">
                <Check size={16} aria-hidden />
                保存并进入 Dashboard
              </button>
            </form>
          </Card>
        </div>
      ) : null}
    </PageShell>
  );
}

export function DashboardPage() {
  const { data: me, loading, error } = useApi("/api/auth/me");
  const { data: recommended } = useApi("/api/courses/recommended", [me?.user?.id]);
  const { data: matches } = useApi("/api/matches", [me?.user?.id]);
  const { data: interests } = useApi("/api/team-up-interests/received", [me?.user?.id]);

  return (
    <PageShell title="Dashboard" eyebrow="Student App" description="这里集中显示推荐课程、近期 Open to Team 信号、资料完整度和 Team Up 请求。">
      {loading ? <LoadingState /> : <ErrorBox message={error} />}
      {!loading && !me?.user ? (
        <EmptyState title="还没有登录" body="请先使用学校邮箱完成验证登录，再进入 TEAMAKING 的学生端。" />
      ) : null}
      {me?.user ? (
        <div className="grid gap-5">
          <div className="grid gap-5 md:grid-cols-3">
            <Card>
              <p className="text-sm text-ink/58">Profile completion</p>
              <p className="mt-2 text-3xl font-semibold text-ink">{me.user.onboardingCompleted ? "80%" : "35%"}</p>
              <p className="mt-2 text-sm text-ink/62">完善 portfolio 和联系方式后，协作信号会更可信。</p>
            </Card>
            <Card>
              <p className="text-sm text-ink/58">TeamUp Interest reminders</p>
              <p className="mt-2 text-3xl font-semibold text-ink">{interests?.interests?.length ?? 0}</p>
              <Link href="/team-up-requests" className="mt-3 inline-flex text-sm font-semibold text-coral">
                查看请求
              </Link>
            </Card>
            <Card>
              <p className="text-sm text-ink/58">Quick links</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link className="rounded-lg border border-ink/12 px-3 py-2 text-sm font-semibold" href="/courses">
                  加入课程板
                </Link>
                <Link className="rounded-lg border border-ink/12 px-3 py-2 text-sm font-semibold" href="/profile/me">
                  编辑 Profile
                </Link>
              </div>
            </Card>
          </div>
          <section>
            <h2 className="mb-3 text-xl font-semibold text-ink">Recommended courses</h2>
            <PaginatedGrid items={recommended?.courses ?? []} render={(course) => <CourseCard key={course.id} course={course} />} />
          </section>
          <section>
            <h2 className="mb-3 text-xl font-semibold text-ink">Recent Open to Team posts</h2>
            <PaginatedGrid items={matches?.posts ?? []} render={(post) => <TeamakingPostCard key={post.id} post={post} />} />
          </section>
        </div>
      ) : null}
    </PageShell>
  );
}

function PortfolioEvidenceCard({ item, editable, onDelete }: { item: any; editable?: boolean; onDelete?: (id: string) => void }) {
  const typeLabel = portfolioTypeLabels[item.type] ?? item.type ?? "作品";
  return (
    <div className="border-2 border-ink bg-paper p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="border border-ink/30 bg-chalk px-2 py-1 text-xs font-semibold text-ink">{typeLabel}</span>
            {item.visibility ? <StatusPill status={item.visibility} /> : null}
          </div>
          <h3 className="mt-3 text-lg font-semibold text-ink">{item.title}</h3>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink/66">{item.contributionDescription}</p>
        </div>
        {editable && onDelete ? (
          <button type="button" onClick={() => onDelete(item.id)} className="focus-ring border border-ink/40 px-3 py-2 text-sm font-semibold text-rust">
            <Trash2 size={15} aria-hidden />
          </button>
        ) : null}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
        <div className="grid gap-2 text-sm text-ink/62">
          {item.myRole ? <p>我的角色：{item.myRole}</p> : null}
          {item.semesterText ? <p>时间：{item.semesterText}</p> : null}
          {item.fileName ? <p>文件：{item.fileName} {formatFileSize(item.fileSize) ? `· ${formatFileSize(item.fileSize)}` : ""}</p> : null}
        </div>
        <div className="flex flex-wrap items-start gap-2">
            {item.fileUrl ? (
              <a href={item.fileUrl} target="_blank" className="inline-flex items-center gap-1 border border-ink/40 px-2 py-1 text-xs font-semibold" rel="noreferrer">
                {previewIcon(item.previewKind)}
                预览
              </a>
            ) : null}
            {item.externalUrl ? (
              <a href={item.externalUrl} target="_blank" className="inline-flex items-center gap-1 border border-ink/40 px-2 py-1 text-xs font-semibold" rel="noreferrer">
                <LinkIcon size={13} aria-hidden />
                外部链接
              </a>
            ) : null}
        </div>
      </div>
    </div>
  );
}

export function ProfileEditorPage() {
  const { data, error, loading } = useApi("/api/profile/me");
  const { data: onboarding } = useApi("/api/onboarding");
  const [saved, setSaved] = useState("");
  const [uploading, setUploading] = useState("");
  const [portfolioItems, setPortfolioItems] = useState<any[]>([]);
  const [workOwnershipFilter, setWorkOwnershipFilter] = useState("all");
  const [workTypeFilter, setWorkTypeFilter] = useState("all");
  const [form, setForm] = useState({
    displayName: "",
    nickname: "",
    headline: "",
    bio: "",
    grade: "Year 2",
    facultyId: "",
    majorId: "",
    avatarUrl: "",
    backgroundImageUrl: "",
    outputTagsText: "research brief, slides, prototype",
    openToBeDiscovered: true,
    skillsText: "academic writing, research",
    resumeUrl: "",
    resumeFileName: "",
    resumeParsedData: {} as Record<string, unknown>
  });
  const [contact, setContact] = useState<any>({
    schoolEmail: "",
    wechatId: "",
    wechatQrImageUrl: "",
    linkedinUrl: "",
    personalEmail: "",
    visibilitySettings: defaultContactVisibility
  });
  const [portfolioForm, setPortfolioForm] = useState<any>({
    title: "",
    type: "portfolio",
    myRole: "",
    semesterText: "",
    contributionDescription: "",
    outcome: "",
    reflection: "",
    externalUrl: "",
    visibility: "same_school",
    isGroupWork: false,
    isPinned: false,
    fileName: "",
    fileMimeType: "",
    fileSize: 0,
    fileExtension: "",
    storageKey: "",
    fileUrl: "",
    previewKind: "link",
    parsedText: "",
    metadata: {}
  });

  useEffect(() => {
    if (data?.user) {
      const profile = data.user.profile;
      setForm({
        displayName: profile?.displayName ?? "",
        nickname: profile?.nickname ?? "",
        headline: profile?.headline ?? "",
        bio: profile?.bio ?? "",
        grade: profile?.grade ?? "Year 2",
        facultyId: profile?.facultyId ?? onboarding?.faculties?.[0]?.id ?? "",
        majorId: profile?.majorId ?? onboarding?.majors?.[0]?.id ?? "",
        avatarUrl: profile?.avatarUrl ?? "",
        backgroundImageUrl: profile?.backgroundImageUrl ?? "",
        outputTagsText: tagsToText(profile?.outputTags),
        openToBeDiscovered: profile?.openToBeDiscovered ?? true,
        skillsText: (data.user.skills ?? []).map((item: any) => item.skill.name).join(", "),
        resumeUrl: profile?.resumeUrl ?? "",
        resumeFileName: profile?.resumeFileName ?? "",
        resumeParsedData: profile?.resumeParsedData ?? {}
      });
    }
    if (data?.portfolioItems) setPortfolioItems(data.portfolioItems);
    if (data?.contactInfo) {
      setContact({
        ...data.contactInfo,
        visibilitySettings: {
          ...defaultContactVisibility,
          ...(data.contactInfo.visibilitySettings ?? {})
        }
      });
    } else if (data?.user?.email) {
      setContact((current: any) => ({ ...current, schoolEmail: data.user.email }));
    }
  }, [data, onboarding]);

  async function uploadAndApply(file: File | undefined, purpose: string, apply: (upload: any) => void) {
    if (!file) return;
    setUploading(purpose);
    setSaved("");
    try {
      const upload = await uploadProfileFile(file, purpose);
      apply(upload);
      setSaved("文件已上传，点击保存后会写入 Profile 数据。");
    } catch (err) {
      setSaved(err instanceof Error ? err.message : "上传失败。");
    } finally {
      setUploading("");
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaved("");
    await api("/api/profile/me", {
      method: "PATCH",
      body: JSON.stringify({
        displayName: form.displayName,
        nickname: form.nickname,
        headline: form.headline,
        bio: form.bio,
        grade: form.grade,
        facultyId: form.facultyId,
        majorId: form.majorId,
        avatarUrl: form.avatarUrl,
        backgroundImageUrl: form.backgroundImageUrl,
        outputTags: tagsFromText(form.outputTagsText),
        openToBeDiscovered: form.openToBeDiscovered,
        resumeUrl: form.resumeUrl,
        resumeFileName: form.resumeFileName,
        resumeParsedData: form.resumeParsedData,
        contactInfo: contact,
        skills: tagsFromText(form.skillsText)
      })
    });
    setSaved("个人资料、联系方式、头像/背景、简历解析信息已保存。");
  }

  async function createPortfolioItem(event: FormEvent) {
    event.preventDefault();
    setSaved("");
    const sameHonorTypeCount = portfolioItems.filter((item) => item.type === portfolioForm.type).length;
    const pinnedCount = portfolioItems.filter((item) => item.isPinned).length;
    if (isHonorItem(portfolioForm) && sameHonorTypeCount >= 3) {
      setSaved("语言成绩、GPA、奖项/认证每类最多上传 3 个。");
      return;
    }
    if (portfolioForm.isPinned && pinnedCount >= 3) {
      setSaved("每个用户最多置顶 3 个过往成果。");
      return;
    }
    const result = await api("/api/profile/me/portfolio-items", {
      method: "POST",
      body: JSON.stringify({
        ...portfolioForm,
        metadata: {
          ...(portfolioForm.metadata ?? {}),
          createdFrom: "profile_editor"
        }
      })
    });
    setSaved("作品/证明材料已保存。");
    setPortfolioForm({
      title: "",
      type: "portfolio",
      myRole: "",
      semesterText: "",
      contributionDescription: "",
      outcome: "",
      reflection: "",
      externalUrl: "",
      visibility: "same_school",
      isGroupWork: false,
      isPinned: false,
      fileName: "",
      fileMimeType: "",
      fileSize: 0,
      fileExtension: "",
      storageKey: "",
      fileUrl: "",
      previewKind: "link",
      parsedText: "",
      metadata: {}
    });
    if (result?.portfolioItem) {
      setPortfolioItems((current) => [result.portfolioItem, ...current]);
    }
  }

  async function deletePortfolioItem(id: string) {
    await api(`/api/profile/me/portfolio-items/${id}`, { method: "DELETE" });
    setPortfolioItems((current) => current.filter((item) => item.id !== id));
    setSaved("作品/证明材料已删除。");
  }

  return (
    <PageShell title="Proof-of-Work Profile" eyebrow="Profile" description="编辑个人展示页：联系方式、头像背景、技能标签、作品证明、GPA 截图、证书和简历解析都在这里维护。">
      {loading ? <LoadingState /> : <ErrorBox message={error} />}
      {data ? (
        <div className="grid gap-5">
          <Card className="p-0">
            <div
              className="min-h-[170px] border-b-2 border-ink bg-mist p-5"
              style={form.backgroundImageUrl ? { backgroundImage: `linear-gradient(rgba(248,246,239,.72), rgba(248,246,239,.88)), url(${form.backgroundImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
            >
              <div className="flex flex-wrap items-end gap-4">
                <div className="grid h-24 w-24 place-items-center overflow-hidden border-2 border-ink bg-chalk">
                  {form.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.avatarUrl} alt="avatar preview" className="h-full w-full object-cover" />
                  ) : (
                    <UserRound size={34} aria-hidden className="text-ink/55" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-rust">Profile preview</p>
                  <h2 className="mt-1 text-3xl font-semibold text-ink">{form.displayName || "未命名用户"}</h2>
                  <p className="mt-2 text-sm text-ink/68">{form.nickname || "可填写昵称"} · {form.headline || "可填写一句个人定位"}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {tagsFromText(form.outputTagsText).map((tag) => <SkillBadge key={tag}>{tag}</SkillBadge>)}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <form onSubmit={submit} className="grid gap-5">
            <Card>
              <h2 className="text-xl font-semibold text-ink">基础展示信息</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label="显示名称">
                  <input className={inputClass} value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} />
                </Field>
                <Field label="昵称 / 别名">
                  <input className={inputClass} value={form.nickname} onChange={(event) => setForm({ ...form, nickname: event.target.value })} placeholder="例如 Mia / slides person" />
                </Field>
                <Field label="一句话定位">
                  <input className={inputClass} value={form.headline} onChange={(event) => setForm({ ...form, headline: event.target.value })} placeholder="例如 Research and presentation collaborator" />
                </Field>
                <Field label="头像 URL / 上传后自动填入">
                  <div className="grid gap-2">
                    <input className={inputClass} value={form.avatarUrl} onChange={(event) => setForm({ ...form, avatarUrl: event.target.value })} />
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg,.webp,.gif,.svg"
                      onChange={(event) => uploadAndApply(event.target.files?.[0], "avatar", (upload) => setForm((current) => ({ ...current, avatarUrl: upload.fileUrl })))}
                    />
                  </div>
                </Field>
                <Field label="主页背景 URL / 上传后自动填入">
                  <div className="grid gap-2">
                    <input className={inputClass} value={form.backgroundImageUrl} onChange={(event) => setForm({ ...form, backgroundImageUrl: event.target.value })} />
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg,.webp,.gif,.svg"
                      onChange={(event) => uploadAndApply(event.target.files?.[0], "background", (upload) => setForm((current) => ({ ...current, backgroundImageUrl: upload.fileUrl })))}
                    />
                  </div>
                </Field>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <Field label="年级">
                  <select className={inputClass} value={form.grade} onChange={(event) => setForm({ ...form, grade: event.target.value })}>
                    {["Year 1", "Year 2", "Year 3", "Year 4"].map((grade) => <option key={grade}>{grade}</option>)}
                  </select>
                </Field>
                <Field label="Faculty">
                  <select className={inputClass} value={form.facultyId} onChange={(event) => setForm({ ...form, facultyId: event.target.value })}>
                    {(onboarding?.faculties ?? []).map((faculty: any) => <option key={faculty.id} value={faculty.id}>{faculty.name}</option>)}
                  </select>
                </Field>
                <Field label="Major">
                  <select className={inputClass} value={form.majorId} onChange={(event) => setForm({ ...form, majorId: event.target.value })}>
                    {(onboarding?.majors ?? []).map((major: any) => <option key={major.id} value={major.id}>{major.name}</option>)}
                  </select>
                </Field>
              </div>
              <div className="mt-4 grid gap-4">
                <Field label="个人简介">
                  <textarea className={inputClass} rows={4} value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} />
                </Field>
                <Field label="技能标签，用英文逗号分隔" help="例如 academic writing, PPT design, data analysis">
                  <input className={inputClass} value={form.skillsText} onChange={(event) => setForm({ ...form, skillsText: event.target.value })} />
                </Field>
                <Field label="擅长产出领域 Tag，用英文逗号分隔" help="例如 research brief, slides, prototype, interview notes">
                  <input className={inputClass} value={form.outputTagsText} onChange={(event) => setForm({ ...form, outputTagsText: event.target.value })} />
                </Field>
              </div>
            </Card>

            <Card>
              <h2 className="text-xl font-semibold text-ink">联系方式与可见性</h2>
              <p className="mt-2 text-sm leading-6 text-ink/62">学校邮箱来自登录邮箱，默认展示为身份凭证，不允许前端编辑；微信、二维码、LinkedIn、个人邮箱都可以选择性填写。</p>
              <div className="mt-4 grid gap-3">
                <Field label="学校邮箱（只读，默认展示）">
                  <input className={`${inputClass} bg-ink/5`} value={contact.schoolEmail || data.user.email} readOnly />
                </Field>
                {[
                  ["wechatId", "WeChat ID"],
                  ["wechatQrImageUrl", "WeChat QR 图片 URL"],
                  ["linkedinUrl", "LinkedIn / 个人主页"],
                  ["personalEmail", "个人邮箱"]
                ].map(([key, label]) => (
                  <div key={key} className="grid gap-3 border border-ink/25 bg-paper p-3 md:grid-cols-[1fr_220px]">
                    <Field label={label}>
                      <div className="grid gap-2">
                        <input className={inputClass} value={contact[key] ?? ""} onChange={(event) => setContact({ ...contact, [key]: event.target.value })} />
                        {key === "wechatQrImageUrl" ? (
                          <input
                            type="file"
                            accept=".png,.jpg,.jpeg,.webp,.gif"
                            onChange={(event) => uploadAndApply(event.target.files?.[0], "contact_qr", (upload) => setContact((current: any) => ({ ...current, wechatQrImageUrl: upload.fileUrl })))}
                          />
                        ) : null}
                      </div>
                    </Field>
                    <Field label="可见范围">
                      <select
                        className={inputClass}
                        value={contact.visibilitySettings?.[key] ?? defaultContactVisibility[key as keyof typeof defaultContactVisibility]}
                        onChange={(event) => setContact({ ...contact, visibilitySettings: { ...contact.visibilitySettings, [key]: event.target.value } })}
                      >
                        {contactVisibilityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </Field>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <h2 className="text-xl font-semibold text-ink">简历上传与解析</h2>
              <p className="mt-2 text-sm leading-6 text-ink/62">当前本地解析支持 txt / md / 代码类文本提取；PDF、Word、PPT、表格会先保存文件元数据，后续可接云端解析服务。</p>
              <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr]">
                <Field label="简历 URL">
                  <input className={inputClass} value={form.resumeUrl} onChange={(event) => setForm({ ...form, resumeUrl: event.target.value })} />
                </Field>
                <Field label="上传简历">
                  <input
                    type="file"
                    accept={acceptedProfileFiles}
                    onChange={(event) =>
                      uploadAndApply(event.target.files?.[0], "resume", (upload) =>
                        setForm((current) => ({
                          ...current,
                          resumeUrl: upload.fileUrl,
                          resumeFileName: upload.fileName,
                          resumeParsedData: upload.resumeParsedData ?? {}
                        }))
                      )
                    }
                  />
                </Field>
              </div>
              <div className="mt-4 border border-ink/25 bg-paper p-3 text-sm leading-6 text-ink/66">
                <p className="font-semibold text-ink">{form.resumeFileName || "尚未上传简历"}</p>
                <p>解析摘要：{String((form.resumeParsedData as any)?.summary ?? "上传后会在这里显示解析结果。")}</p>
                {Array.isArray((form.resumeParsedData as any)?.skills) ? <p>识别技能：{((form.resumeParsedData as any).skills as string[]).join(", ")}</p> : null}
              </div>
            </Card>

            <label className="flex items-center gap-2 text-sm font-semibold text-ink">
              <input type="checkbox" checked={form.openToBeDiscovered} onChange={(event) => setForm({ ...form, openToBeDiscovered: event.target.checked })} />
              允许同校用户在 discovery 中看到我
            </label>
            <button type="submit" className="focus-ring inline-flex w-fit items-center gap-2 rounded-sm bg-ink px-4 py-2 font-semibold text-paper">
              <Check size={16} aria-hidden />
              保存 Profile 与联系方式
            </button>
          </form>

          <Card>
            <h2 className="text-xl font-semibold text-ink">新增作品 / 证明材料</h2>
            <p className="mt-2 text-sm leading-6 text-ink/62">兼容 md、Word、表格、PDF、PPT、图像、音频、设计稿、代码等主流文件后缀；GPA 截图、获奖证书、技能/职业认证也作为证明材料管理。</p>
            <form onSubmit={createPortfolioItem} className="mt-4 grid gap-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="标题">
                  <input className={inputClass} value={portfolioForm.title} onChange={(event) => setPortfolioForm({ ...portfolioForm, title: event.target.value })} />
                </Field>
                <Field label="类型">
                  <select className={inputClass} value={portfolioForm.type} onChange={(event) => setPortfolioForm({ ...portfolioForm, type: event.target.value })}>
                    {portfolioTypes.map((type) => <option key={type} value={type}>{portfolioTypeLabels[type]}</option>)}
                  </select>
                </Field>
                <Field label="可见范围">
                  <select className={inputClass} value={portfolioForm.visibility} onChange={(event) => setPortfolioForm({ ...portfolioForm, visibility: event.target.value })}>
                    <option value="private">仅自己</option>
                    <option value="same_school">同校可见</option>
                    <option value="same_course_board">同课程板可见</option>
                    <option value="public">公开</option>
                  </select>
                </Field>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="我的角色">
                  <input className={inputClass} value={portfolioForm.myRole} onChange={(event) => setPortfolioForm({ ...portfolioForm, myRole: event.target.value })} />
                </Field>
                <Field label="学期 / 时间">
                  <input className={inputClass} value={portfolioForm.semesterText} onChange={(event) => setPortfolioForm({ ...portfolioForm, semesterText: event.target.value })} />
                </Field>
                <Field label="外部链接（可选）">
                  <input className={inputClass} value={portfolioForm.externalUrl} onChange={(event) => setPortfolioForm({ ...portfolioForm, externalUrl: event.target.value })} />
                </Field>
              </div>
              <Field label="上传文件">
                <input
                  type="file"
                  accept={acceptedProfileFiles}
                  onChange={(event) =>
                    uploadAndApply(event.target.files?.[0], portfolioForm.type, (upload) =>
                      setPortfolioForm((current: any) => ({
                        ...current,
                        ...upload,
                        title: current.title || upload.fileName,
                        metadata: { ...(current.metadata ?? {}), resumeParsedData: upload.resumeParsedData }
                      }))
                    )
                  }
                />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="贡献说明">
                  <textarea className={inputClass} rows={4} value={portfolioForm.contributionDescription} onChange={(event) => setPortfolioForm({ ...portfolioForm, contributionDescription: event.target.value })} />
                </Field>
                <Field label="结果 / 复盘">
                  <textarea className={inputClass} rows={4} value={`${portfolioForm.outcome}${portfolioForm.outcome && portfolioForm.reflection ? "\n" : ""}${portfolioForm.reflection}`} onChange={(event) => {
                    const [outcome = "", ...rest] = event.target.value.split("\n");
                    setPortfolioForm({ ...portfolioForm, outcome, reflection: rest.join("\n") });
                  }} />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                <input type="checkbox" checked={portfolioForm.isGroupWork} onChange={(event) => setPortfolioForm({ ...portfolioForm, isGroupWork: event.target.checked })} />
                这是小组作品
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                <input type="checkbox" checked={portfolioForm.isPinned} onChange={(event) => setPortfolioForm({ ...portfolioForm, isPinned: event.target.checked })} />
                置顶展示（最多 3 个）
              </label>
              {portfolioForm.fileName ? <PortfolioEvidenceCard item={portfolioForm} /> : null}
              <button className="focus-ring inline-flex w-fit items-center gap-2 rounded-sm bg-rust px-4 py-2 font-semibold text-paper">
                <Plus size={16} aria-hidden />
                保存作品 / 证明
              </button>
            </form>
          </Card>

          <Card>
            <h2 className="text-xl font-semibold text-ink">已保存的作品与证明</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {["all", "individual", "group"].map((value) => (
                <button key={value} type="button" onClick={() => setWorkOwnershipFilter(value)} className={`border px-3 py-2 text-sm font-semibold ${workOwnershipFilter === value ? "border-ink bg-ink text-paper" : "border-ink/30 bg-paper"}`}>
                  {value === "all" ? "全部" : value === "individual" ? "个人作品" : "小组成果"}
                </button>
              ))}
              {["all", "slides", "report", "code", "design", "other"].map((value) => (
                <button key={value} type="button" onClick={() => setWorkTypeFilter(value)} className={`border px-3 py-2 text-sm font-semibold ${workTypeFilter === value ? "border-rust bg-rust text-paper" : "border-ink/30 bg-paper"}`}>
                  {value === "all" ? "全部类型" : value}
                </button>
              ))}
            </div>
            {(() => {
              const works = portfolioItems.filter((item) => !isHonorItem(item));
              const honors = portfolioItems.filter(isHonorItem);
              const pinned = works.filter((item) => item.isPinned).slice(0, 3);
              const filteredWorks = works.filter((item) => {
                const ownershipOk = workOwnershipFilter === "all" || (workOwnershipFilter === "group" ? item.isGroupWork : !item.isGroupWork);
                const typeOk = workTypeFilter === "all" || fileFamily(item) === workTypeFilter;
                return ownershipOk && typeOk;
              });
              return (
                <div className="mt-5 grid gap-6">
                  <section>
                    <h3 className="mb-3 text-lg font-semibold text-ink">置顶成果</h3>
                    {pinned.length > 0 ? <PaginatedGrid items={pinned} pageSize={3} render={(item) => <PortfolioEvidenceCard key={item.id} item={item} editable onDelete={deletePortfolioItem} />} /> : <EmptyState title="还没有置顶成果" body="勾选置顶展示后，会优先显示最多三个作品。" />}
                  </section>
                  <section>
                    <h3 className="mb-3 text-lg font-semibold text-ink">作品成果</h3>
                    {filteredWorks.length > 0 ? <PaginatedGrid items={filteredWorks} render={(item) => <PortfolioEvidenceCard key={item.id} item={item} editable onDelete={deletePortfolioItem} />} /> : <EmptyState title="还没有匹配的作品" body="调整筛选条件或上传新的作品成果。" />}
                  </section>
                  <section>
                    <h3 className="mb-3 text-lg font-semibold text-ink">语言成绩 / GPA / 奖项荣誉</h3>
                    {honors.length > 0 ? <PaginatedGrid items={honors} pageSize={3} render={(item) => <PortfolioEvidenceCard key={item.id} item={item} editable onDelete={deletePortfolioItem} />} /> : <EmptyState title="还没有荣誉证明" body="语言成绩、GPA、奖项和认证会独立显示，不与作品混在一起。" />}
                  </section>
                </div>
              );
            })()}
          </Card>

          {uploading ? <p className="text-sm font-medium text-rust">正在上传：{uploading}</p> : null}
          {saved ? <p className="border border-ink/20 bg-paper px-3 py-2 text-sm font-medium text-forest">{saved}</p> : null}
        </div>
      ) : null}
    </PageShell>
  );
}

export function PublicProfilePage({ userId }: { userId: string }) {
  const { data, error, loading } = useApi(`/api/profile/${userId}`);
  const [followMessage, setFollowMessage] = useState("");
  const profile = data?.user?.profile;
  const contact = data?.contactInfo ?? data?.user?.contactInfo ?? {};

  async function follow() {
    const result = await api(`/api/profile/${userId}/follow-request`, { method: "POST" });
    setFollowMessage(result.existing ? "关注申请已存在。" : "关注申请已发送。");
  }

  return (
    <PageShell title={profile?.displayName ?? "用户 Profile"} eyebrow="Proof-of-Work Profile" description="同校已验证用户可以查看对方允许展示的基础资料、联系方式和作品证明。">
      {loading ? <LoadingState /> : <ErrorBox message={error} />}
      {data?.user ? (
        <div className="grid gap-5">
          <Card>
            <div
              className="min-h-[180px] border-2 border-ink bg-mist p-5"
              style={profile?.backgroundImageUrl ? { backgroundImage: `linear-gradient(rgba(248,246,239,.72), rgba(248,246,239,.9)), url(${profile.backgroundImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
            >
              <div className="flex flex-wrap items-end gap-4">
                <div className="grid h-24 w-24 place-items-center overflow-hidden border-2 border-ink bg-chalk">
                  {profile?.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.avatarUrl} alt={profile.displayName} className="h-full w-full object-cover" />
                  ) : (
                    <UserRound size={34} aria-hidden />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-rust">{profile?.nickname || data.user.email}</p>
                  <h2 className="mt-1 text-3xl font-semibold text-ink">{profile?.displayName}</h2>
                  <p className="mt-2 text-sm text-ink/68">{profile?.headline || `${profile?.grade ?? ""} · ${profile?.major?.name ?? ""}`}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Array.isArray(profile?.outputTags) ? profile.outputTags.map((tag: string) => <SkillBadge key={tag}>{tag}</SkillBadge>) : null}
                  </div>
                </div>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-ink/68">{profile?.bio}</p>
            <button type="button" onClick={follow} className="focus-ring mt-4 rounded-sm bg-rust px-4 py-2 text-sm font-semibold text-paper">
              申请关注
            </button>
            {followMessage ? <p className="mt-2 text-sm font-medium text-moss">{followMessage}</p> : null}
          </Card>
          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <Card>
              <h2 className="text-xl font-semibold text-ink">Contact</h2>
              <div className="mt-4 grid gap-2 text-sm leading-6 text-ink/68">
                <p>学校邮箱：{contact.schoolEmail ?? data.user.email}</p>
                {contact.wechatId ? <p>WeChat：{contact.wechatId}</p> : null}
                {contact.linkedinUrl ? <p>LinkedIn / 主页：{contact.linkedinUrl}</p> : null}
                {contact.personalEmail ? <p>个人邮箱：{contact.personalEmail}</p> : null}
                {contact.wechatQrImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={contact.wechatQrImageUrl} alt="WeChat QR" className="mt-3 h-32 w-32 border border-ink/30 object-cover" />
                ) : null}
              </div>
            </Card>
            <ProfileCard user={data.user} />
          </div>
          <Card>
            <h2 className="text-xl font-semibold text-ink">Portfolio evidence</h2>
            {(() => {
              const works = (data.portfolioItems ?? []).filter((item: any) => !isHonorItem(item));
              const honors = (data.portfolioItems ?? []).filter(isHonorItem);
              const pinned = works.filter((item: any) => item.isPinned).slice(0, 3);
              return (
                <div className="mt-4 grid gap-6">
                  {pinned.length > 0 ? (
                    <section>
                      <h3 className="mb-3 text-lg font-semibold text-ink">Pinned Work</h3>
                      <PaginatedGrid items={pinned} pageSize={3} render={(item) => <PortfolioEvidenceCard key={item.id} item={item} />} />
                    </section>
                  ) : null}
                  <section>
                    <h3 className="mb-3 text-lg font-semibold text-ink">Works</h3>
                    {works.length > 0 ? <PaginatedGrid items={works} render={(item) => <PortfolioEvidenceCard key={item.id} item={item} />} /> : <EmptyState title="还没有公开作品" body="对方还没有展示可见的作品成果。" />}
                  </section>
                  <section>
                    <h3 className="mb-3 text-lg font-semibold text-ink">Honors</h3>
                    {honors.length > 0 ? <PaginatedGrid items={honors} pageSize={3} render={(item) => <PortfolioEvidenceCard key={item.id} item={item} />} /> : <EmptyState title="还没有公开荣誉" body="语言成绩、GPA、奖项和认证会独立展示。" />}
                  </section>
                </div>
              );
            })()}
          </Card>
        </div>
      ) : null}
    </PageShell>
  );
}

export function ContactInfoPage() {
  const { data, error, loading } = useApi("/api/contact-info/me");
  const [saved, setSaved] = useState("");
  const [form, setForm] = useState<any>({
    schoolEmail: "",
    wechatId: "",
    wechatQrImageUrl: "",
    linkedinUrl: "",
    personalEmail: "",
    visibilitySettings: defaultContactVisibility
  });

  useEffect(() => {
    if (data?.contactInfo) {
      setForm({
        ...data.contactInfo,
        visibilitySettings: {
          ...defaultContactVisibility,
          ...(data.contactInfo.visibilitySettings ?? {})
        }
      });
    }
  }, [data]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    await api("/api/contact-info/me", { method: "PATCH", body: JSON.stringify(form) });
    setSaved("联系方式已保存。schoolEmail 始终来自登录邮箱，不会被前端修改。");
  }

  return (
    <PageShell title="Contact Info" eyebrow="Visibility Settings" description="联系方式可以按可见范围展示。学校邮箱只读，用来证明身份真实性。">
      {loading ? <LoadingState /> : <ErrorBox message={error} />}
      {data ? (
        <Card>
          <form onSubmit={submit} className="grid gap-4">
            <Field label="学校邮箱（只读）">
              <input className={`${inputClass} bg-ink/5`} value={form.schoolEmail ?? ""} readOnly />
            </Field>
            {[
              ["wechatId", "WeChat ID"],
              ["wechatQrImageUrl", "WeChat QR placeholder URL"],
              ["linkedinUrl", "LinkedIn URL"],
              ["personalEmail", "Personal Email"]
            ].map(([key, label]) => (
              <div key={key} className="grid gap-3 rounded-lg border border-ink/10 p-4 md:grid-cols-[1fr_240px]">
                <Field label={label}>
                  <input className={inputClass} value={form[key] ?? ""} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
                </Field>
                <Field label="可见范围">
                  <select
                    className={inputClass}
                    value={form.visibilitySettings?.[key] ?? defaultContactVisibility[key as keyof typeof defaultContactVisibility]}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        visibilitySettings: { ...form.visibilitySettings, [key]: event.target.value }
                      })
                    }
                  >
                    {contactVisibilityOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            ))}
            <button type="submit" className="focus-ring inline-flex w-fit items-center gap-2 rounded-lg bg-coral px-4 py-2 font-semibold text-white">
              <Check size={16} aria-hidden />
              保存联系方式
            </button>
            {saved ? <p className="text-sm font-medium text-moss">{saved}</p> : null}
          </form>
        </Card>
      ) : null}
    </PageShell>
  );
}

export function SupportPage() {
  const { data: me } = useApi("/api/auth/me");
  const [form, setForm] = useState({
    email: "",
    category: "missing_course",
    title: "",
    description: "",
    relatedUrl: ""
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (me?.user?.email) setForm((current) => ({ ...current, email: me.user.email }));
  }, [me]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");
    const result = await api("/api/support-tickets", { method: "POST", body: JSON.stringify(form) }).catch((err: Error) => {
      setError(err.message);
      return null;
    });
    if (result) {
      setMessage("工单已提交。管理员会在后台查看并处理。");
      setForm({ email: me?.user?.email ?? "", category: "missing_course", title: "", description: "", relatedUrl: "" });
    }
  }

  return (
    <PageShell title="Support Ticket" eyebrow="Admin contact" description="缺失课程、bug、报错、后台需求都走工单。这个入口替代原来的课程提交审核机制。" aside="none">
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <h2 className="text-xl font-semibold text-ink">可以提交什么</h2>
          <div className="mt-4 grid gap-3 text-sm leading-6 text-ink/68">
            <p>缺失课程：写清课程代码、课程名、学期或老师。</p>
            <p>bug / 报错：写清你在哪个页面、点了什么、看到什么错误。</p>
            <p>后台需求：写清希望管理员改什么数据或配置。</p>
            <p>开发者联系方式会由管理员在 Site Config 中维护。</p>
          </div>
        </Card>
        <Card>
          <form onSubmit={submit} className="grid gap-4">
            <Field label="联系邮箱">
              <input className={inputClass} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="可选，但建议填写" />
            </Field>
            <Field label="工单类型">
              <select className={inputClass} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
                <option value="missing_course">缺失课程</option>
                <option value="bug">Bug</option>
                <option value="error_report">报错</option>
                <option value="admin_request">后台需求</option>
                <option value="other">其他</option>
              </select>
            </Field>
            <Field label="标题">
              <input className={inputClass} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            </Field>
            <Field label="详细说明">
              <textarea className={inputClass} rows={6} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            </Field>
            <Field label="相关页面 URL（可选）">
              <input className={inputClass} value={form.relatedUrl} onChange={(event) => setForm({ ...form, relatedUrl: event.target.value })} placeholder="/courses 或错误页面地址" />
            </Field>
            <button className="focus-ring inline-flex w-fit items-center gap-2 rounded-sm bg-ink px-4 py-2 font-semibold text-paper">
              <Send size={16} aria-hidden />
              提交工单
            </button>
          </form>
          <ErrorBox message={error} />
          {message ? <p className="mt-3 border border-ink/20 bg-paper px-3 py-2 text-sm font-medium text-forest">{message}</p> : null}
        </Card>
      </div>
    </PageShell>
  );
}

export function CoursesPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [refresh, setRefresh] = useState(0);
  const { data: me, loading: authLoading } = useApi("/api/auth/me");
  const isAuthed = Boolean(me?.user);
  const { data: recommended } = useApi(isAuthed ? "/api/courses/recommended" : null, [refresh, isAuthed]);
  const { data: search } = useApi(isAuthed ? `/api/courses/search?q=${encodeURIComponent(q)}` : null, [q, refresh, isAuthed]);

  async function joinFirstBoard(course: any) {
    const board = course.offerings?.[0]?.boards?.[0];
    if (!board) return;
    await api(`/api/boards/${board.id}/join`, { method: "POST" });
    router.push(`/boards/${board.id}`);
  }

  return (
    <PageShell title="Course Boards" eyebrow="Courses" description="搜索或加入课程板。加入只代表你在 TEAMAKING 平台内自选加入，不代表官方选课。">
      {!isAuthed ? (
        <div className="grid gap-5">
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-rust">Public preview</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">未登录时只展示课程板示例</h2>
            <p className="mt-3 text-sm leading-6 text-ink/68">
              为保护学生资料，未登录用户不能读取真实课程、Course Board、Open to Team posts 或 Course People。请使用学校邮箱登录，或进入演示验收模式查看完整逻辑。
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/demo-access" className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper">
                演示验收模式
              </Link>
              <Link href="/login" className="rounded-sm border border-ink/40 px-4 py-2 text-sm font-semibold">
                学校邮箱登录
              </Link>
            </div>
          </Card>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["COM3003", "Media Ethics", "Open to Team posts are hidden before login."],
              ["CST1001", "Introduction to Programming", "Course People are hidden before login."],
              ["BUS2002", "Marketing Principles", "Join actions require verified identity."]
            ].map(([code, title, body]) => (
              <Card key={code}>
                <p className="text-sm font-semibold text-rust">{code}</p>
                <h3 className="mt-2 text-lg font-semibold text-ink">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-ink/62">{body}</p>
              </Card>
            ))}
          </div>
          {authLoading ? <p className="text-sm text-ink/56">正在确认登录状态；未确认前不会读取真实课程或学生数据。</p> : null}
        </div>
      ) : null}
      {isAuthed ? (
      <div className="grid gap-5">
        <Card>
          <div className="flex items-center gap-3">
            <Search size={18} aria-hidden />
            <input className={inputClass} value={q} onChange={(event) => setQ(event.target.value)} placeholder="搜索课程代码或课程名称，例如 COM3003" />
          </div>
          {q.trim() ? (
            <div className="mt-4 border-t border-ink/15 pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/50">Recommended by match score</p>
              <div className="grid gap-2">
                {(search?.courses ?? []).slice(0, 8).map((course: any) => {
                  const board = course.offerings?.[0]?.boards?.[0];
                  return (
                    <div key={course.id} className="grid gap-3 border border-ink/15 bg-paper px-3 py-3 md:grid-cols-[1fr_auto] md:items-center">
                      <div>
                        <p className="text-sm font-semibold text-ink">{course.code} · {course.title}</p>
                        <p className="mt-1 text-xs text-ink/58">{course.matchReason} · score {course.score}</p>
                      </div>
                      <div className="flex gap-2">
                        <Link href={`/courses/${course.id}`} className="rounded-sm border border-ink/30 px-3 py-2 text-xs font-semibold">
                          详情
                        </Link>
                        {board ? (
                          <button onClick={() => joinFirstBoard(course)} className="rounded-sm bg-ink px-3 py-2 text-xs font-semibold text-paper">
                            加入课程板
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </Card>
        <section>
          <h2 className="mb-3 text-xl font-semibold text-ink">Recommended courses</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {(recommended?.courses ?? []).map((course: any) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        </section>
        <Card>
          <h2 className="text-xl font-semibold text-ink">缺失课程 / bug / 报错</h2>
          <p className="mt-2 text-sm leading-6 text-ink/64">
            缺失课程不再走复杂审核机制。请直接提交工单，管理员会私下确认并处理。
          </p>
          <Link href="/support" className="focus-ring mt-4 inline-flex w-fit items-center gap-2 rounded-sm border border-ink/40 px-4 py-2 font-semibold">
            <Plus size={16} aria-hidden />
            提交工单
          </Link>
        </Card>
      </div>
      ) : null}
    </PageShell>
  );
}

export function CourseDetailPage({ courseId }: { courseId: string }) {
  const { data, error, loading } = useApi(`/api/courses/${courseId}`);
  const course = data?.course;

  return (
    <PageShell title={course ? `${course.code} ${course.title}` : "Course Detail"} eyebrow="Course" description="课程详情、开课学期和对应 Course Board。">
      {loading ? <LoadingState /> : <ErrorBox message={error} />}
      {course ? (
        <div className="grid gap-5">
          <Card>
            <p className="text-sm font-semibold text-coral">{course.code}</p>
            <h2 className="mt-1 text-2xl font-semibold text-ink">{course.title}</h2>
            <p className="mt-3 text-sm leading-6 text-ink/68">{course.description || "暂无课程描述。"}</p>
          </Card>
          <div className="grid gap-4 md:grid-cols-2">
            {(course.offerings ?? []).map((offering: any) => (
              <Card key={offering.id}>
                <p className="font-semibold text-ink">{offering.semester?.name}</p>
                <p className="mt-1 text-sm text-ink/62">{offering.teacherName ?? "未配置老师"} · {offering.section ?? "默认班级"}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(offering.boards ?? []).map((board: any) => (
                    <Link key={board.id} href={`/boards/${board.id}`} className="rounded-lg bg-coral px-3 py-2 text-sm font-semibold text-white">
                      进入 {board.title}
                    </Link>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}

export function BoardPage({ boardId }: { boardId: string }) {
  const [tab, setTab] = useState<"posts" | "people">("posts");
  const [refresh, setRefresh] = useState(0);
  const { data: me, loading: authLoading } = useApi("/api/auth/me");
  const isAuthed = Boolean(me?.user);
  const { data: boardData, error, loading } = useApi(isAuthed ? `/api/boards/${boardId}` : null, [refresh, isAuthed]);
  const { data: posts } = useApi(isAuthed ? `/api/boards/${boardId}/open-to-team` : null, [refresh, isAuthed]);
  const { data: people } = useApi(isAuthed ? `/api/boards/${boardId}/people` : null, [refresh, isAuthed]);
  const [postForm, setPostForm] = useState({
    title: "",
    strengths: [] as string[],
    contributionTypes: [] as string[],
    expectedOutcome: "",
    portfolioItemIds: [] as string[],
    visibility: "same_course_board"
  });

  const board = boardData?.board;
  const course = board?.courseOffering?.course;

  useEffect(() => {
    if (course && !postForm.title) {
      setPostForm((current) => ({ ...current, title: `Open to Team for ${course.code}` }));
    }
  }, [course, postForm.title]);

  async function joinOrLeave() {
    if (boardData?.isJoined) {
      await api(`/api/boards/${boardId}/leave`, { method: "DELETE" });
    } else {
      await api(`/api/boards/${boardId}/join`, { method: "POST" });
    }
    setRefresh((value) => value + 1);
  }

  async function createPost(event: FormEvent) {
    event.preventDefault();
    await api(`/api/boards/${boardId}/teamaking-posts`, { method: "POST", body: JSON.stringify(postForm) });
    setRefresh((value) => value + 1);
  }

  return (
    <PageShell title={board?.title ?? "Course Board"} eyebrow="Course Board" description="Open to Team 是协作信号；Course People 是平台内自选加入名单，不是官方选课名单。">
      {authLoading || loading ? <LoadingState /> : <ErrorBox message={error} />}
      {!isAuthed ? (
        <div className="grid gap-5">
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-rust">Privacy boundary</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">登录前不能查看真实 Course Board 数据</h2>
            <p className="mt-3 text-sm leading-6 text-ink/68">
              真实课程板包含学生资料、Open to Team posts、联系方式可见性和 Course People。未登录用户只能看到这个结构示例。
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/demo-access" className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper">
                演示验收模式
              </Link>
              <Link href="/login" className="rounded-sm border border-ink/40 px-4 py-2 text-sm font-semibold">
                学校邮箱登录
              </Link>
            </div>
          </Card>
          <Card>
            <div className="flex gap-2">
              <span className="border border-ink/30 bg-ink px-3 py-2 text-sm font-semibold text-paper">Open to Team</span>
              <span className="border border-ink/30 px-3 py-2 text-sm font-semibold">Course People</span>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="border border-dashed border-ink/30 p-4">
                <p className="font-semibold text-ink">Open to Team 示例卡片</p>
                <p className="mt-2 text-sm leading-6 text-ink/62">真实姓名、专业、作品证明和联系方式在登录前全部隐藏。</p>
              </div>
              <div className="border border-dashed border-ink/30 p-4">
                <p className="font-semibold text-ink">Course People 示例区域</p>
                <p className="mt-2 text-sm leading-6 text-ink/62">这里只说明信息架构，不展示任何真实用户。</p>
              </div>
            </div>
          </Card>
          {authLoading ? <p className="text-sm text-ink/56">正在确认登录状态；未确认前不会读取真实课程板、帖子或成员数据。</p> : null}
        </div>
      ) : null}
      {board ? (
        <div className="grid gap-5">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-coral">{course?.code}</p>
                <h2 className="text-2xl font-semibold text-ink">{course?.title}</h2>
                <p className="mt-3 text-sm leading-6 text-ink/68">
                  开放时间：{board.openFrom ? new Date(board.openFrom).toLocaleDateString() : "当前学期开放"} - {board.openUntil ? new Date(board.openUntil).toLocaleDateString() : "学期结束前"}
                </p>
                <p className="mt-2 text-sm text-ink/58">当前平台成员：{boardData.memberCount}</p>
              </div>
              <button onClick={joinOrLeave} className="focus-ring rounded-lg bg-ink px-4 py-2 font-semibold text-white">
                {boardData.isJoined ? "Leave Course Board" : "Join Course Board"}
              </button>
            </div>
          </Card>
          {boardData.isJoined ? (
            <Card>
              <h2 className="text-xl font-semibold text-ink">Create Teamaking Post</h2>
              <form onSubmit={createPost} className="mt-4 grid gap-4">
                <Field label="标题">
                  <input className={inputClass} value={postForm.title} onChange={(event) => setPostForm({ ...postForm, title: event.target.value })} />
                </Field>
                <Field label="Strengths">
                  <ToggleGroup values={strengths} selected={postForm.strengths} onChange={(values) => setPostForm({ ...postForm, strengths: values })} />
                </Field>
                <Field label="Contribution types">
                  <ToggleGroup values={contributionTypes} selected={postForm.contributionTypes} onChange={(values) => setPostForm({ ...postForm, contributionTypes: values })} />
                </Field>
                <Field label="Expected outcome">
                  <textarea className={inputClass} rows={3} value={postForm.expectedOutcome} onChange={(event) => setPostForm({ ...postForm, expectedOutcome: event.target.value })} placeholder="A polished report with strong argumentation and clean slides." />
                </Field>
                <Field label="Visibility">
                  <select className={inputClass} value={postForm.visibility} onChange={(event) => setPostForm({ ...postForm, visibility: event.target.value })}>
                    <option value="same_course_board">同一 Course Board 可见</option>
                    <option value="same_school">同校可见</option>
                  </select>
                </Field>
                <button className="focus-ring inline-flex w-fit items-center gap-2 rounded-lg bg-coral px-4 py-2 font-semibold text-white">
                  <Plus size={16} aria-hidden />
                  Create Teamaking Post
                </button>
              </form>
            </Card>
          ) : null}
          <div className="flex gap-2">
            <button onClick={() => setTab("posts")} className={`rounded-lg px-4 py-2 font-semibold ${tab === "posts" ? "bg-ink text-white" : "bg-white text-ink"}`}>
              Open to Team
            </button>
            <button onClick={() => setTab("people")} className={`rounded-lg px-4 py-2 font-semibold ${tab === "people" ? "bg-ink text-white" : "bg-white text-ink"}`}>
              Course People
            </button>
          </div>
          {tab === "posts" ? (
            <div className="grid gap-4 md:grid-cols-2">
              {(posts?.posts ?? []).map((post: any) => (
                <TeamakingPostCard key={post.id} post={post} />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {(people?.people ?? []).map((item: any) => (
                <ProfileCard key={item.id} user={item.user} />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </PageShell>
  );
}

export function TeamakingPostPage({ postId }: { postId: string }) {
  const [refresh, setRefresh] = useState(0);
  const { data, error, loading } = useApi(`/api/teamaking-posts/${postId}`, [refresh]);
  const { data: interests } = useApi(`/api/teamaking-posts/${postId}/interests`, [refresh]);
  const [form, setForm] = useState({ message: "", senderContribution: "" });
  const [message, setMessage] = useState("");
  const post = data?.post;

  async function teamUp(event: FormEvent) {
    event.preventDefault();
    const result = await api(`/api/teamaking-posts/${postId}/team-up`, { method: "POST", body: JSON.stringify(form) });
    setMessage(result.existing ? "你已经发送过 TeamUp Interest，可在对方回应前撤回。" : "TeamUp Interest 已发送。");
    setRefresh((value) => value + 1);
  }

  async function actOnInterest(id: string, action: "mutual" | "refuse" | "withdraw") {
    await api(`/api/team-up-interests/${id}/${action}`, { method: "POST" });
    setRefresh((value) => value + 1);
  }

  return (
    <PageShell title={post?.title ?? "Teamaking Post"} eyebrow="Open to Team" description="这是一个轻量协作信号，不是队长招募，也不是申请加入正式团队。">
      {loading ? <LoadingState /> : <ErrorBox message={error} />}
      {post ? (
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <TeamakingPostCard post={post} />
          <Card>
            <h2 className="text-xl font-semibold text-ink">Team Up</h2>
            <p className="mt-2 text-sm leading-6 text-ink/62">发送一条轻量联系请求，说明你想贡献什么。最终沟通和组队在平台外完成。</p>
            <form onSubmit={teamUp} className="mt-4 grid gap-4">
              <Field label="你的消息">
                <textarea className={inputClass} rows={4} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} />
              </Field>
              <Field label="你可以贡献什么">
                <textarea className={inputClass} rows={3} value={form.senderContribution} onChange={(event) => setForm({ ...form, senderContribution: event.target.value })} />
              </Field>
              <button className="focus-ring inline-flex w-fit items-center gap-2 rounded-lg bg-coral px-4 py-2 font-semibold text-white">
                <Handshake size={16} aria-hidden />
                Send Team Up
              </button>
            </form>
            {message ? <p className="mt-3 text-sm font-medium text-moss">{message}</p> : null}
          </Card>
          <div className="lg:col-span-2">
            <Card>
              <h2 className="text-xl font-semibold text-ink">TeamUp Interests for this Post</h2>
              <div className="mt-4 grid gap-4">
                {(interests?.interests ?? []).length > 0 ? (
                  (interests?.interests ?? []).map((interest: any) => (
                    <TeamUpRequestCard
                      key={interest.id}
                      request={interest}
                      actions={
                        <>
                          <button type="button" onClick={() => actOnInterest(interest.id, "mutual")} className="focus-ring rounded-sm bg-moss px-3 py-2 text-sm font-semibold text-white">
                            我也感兴趣
                          </button>
                          <button type="button" onClick={() => actOnInterest(interest.id, "refuse")} className="focus-ring rounded-sm border border-ink/40 px-3 py-2 text-sm font-semibold">
                            Refuse
                          </button>
                          <button type="button" onClick={() => actOnInterest(interest.id, "withdraw")} className="focus-ring rounded-sm border border-ink/40 px-3 py-2 text-sm font-semibold">
                            Withdraw
                          </button>
                        </>
                      }
                    />
                  ))
                ) : (
                  <EmptyState title="还没有 TeamUp Interest" body="有人对这条 Open to Team signal 感兴趣后，会显示在这里。" />
                )}
              </div>
            </Card>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}

export function TeamUpRequestsPage() {
  const [refresh, setRefresh] = useState(0);
  const { data: received } = useApi("/api/team-up-interests/received", [refresh]);

  async function actOnInterest(id: string, action: "mutual" | "refuse") {
    await api(`/api/team-up-interests/${id}/${action}`, { method: "POST" });
    setRefresh((value) => value + 1);
  }

  return (
    <PageShell title="TeamUp Menu" eyebrow="TeamUp Interests" description="这里只显示发给你发布的 Teamaking Posts 的 TeamUp Interest 提醒；查看详情会把 sent 自动推进为 viewed。">
      <div className="grid gap-6">
        <section>
          <h2 className="mb-3 text-xl font-semibold text-ink">Received TeamUp Interests</h2>
          <div className="grid gap-4">
            {(received?.interests ?? []).map((request: any) => (
              <TeamUpRequestCard
                key={request.id}
                request={request}
                actions={
                  <>
                    <button type="button" onClick={() => actOnInterest(request.id, "mutual")} className="focus-ring rounded-sm bg-moss px-3 py-2 text-sm font-semibold text-white">
                      我也感兴趣
                    </button>
                    <button type="button" onClick={() => actOnInterest(request.id, "refuse")} className="focus-ring rounded-sm border border-ink/40 px-3 py-2 text-sm font-semibold">
                      Refuse
                    </button>
                  </>
                }
              />
            ))}
            {(received?.interests ?? []).length === 0 ? <EmptyState title="还没有 TeamUp Interest" body="其他同学对你发布的 Teamaking Post 发起 TeamUp 后，会显示在这里。" /> : null}
          </div>
        </section>
      </div>
    </PageShell>
  );
}

export function InboxPage() {
  const [refresh, setRefresh] = useState(0);
  const { data, error, loading } = useApi("/api/follow-requests/inbox", [refresh]);

  async function act(id: string, action: "accept" | "refuse" | "withdraw") {
    await api(`/api/follow-requests/${id}/${action}`, { method: "POST" });
    setRefresh((value) => value + 1);
  }

  return (
    <PageShell title="Inbox" eyebrow="Follow Requests" description="Inbox 只处理用户之间的关注/好友申请，不显示 TeamUp Interest。">
      {loading ? <LoadingState /> : <ErrorBox message={error} />}
      <div className="grid gap-4">
        {(data?.requests ?? []).map((request: any) => (
          <Card key={request.id}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <ProfileCard user={request.sender} />
              <StatusPill status={request.status} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => act(request.id, "accept")} className="focus-ring rounded-sm bg-moss px-3 py-2 text-sm font-semibold text-white">
                Accept Follow
              </button>
              <button type="button" onClick={() => act(request.id, "refuse")} className="focus-ring rounded-sm border border-ink/40 px-3 py-2 text-sm font-semibold">
                Refuse
              </button>
            </div>
          </Card>
        ))}
        {(data?.requests ?? []).length === 0 ? <EmptyState title="没有关注申请" body="其他用户申请关注你时，会出现在这里。" /> : null}
      </div>
    </PageShell>
  );
}

export function MatchesPage() {
  const { data, error, loading } = useApi("/api/matches");

  return (
    <PageShell title="Matches" eyebrow="Discovery" description="MVP 使用简单规则推荐，不使用 AI，也不依赖官方选课数据库。">
      {loading ? <LoadingState /> : <ErrorBox message={error} />}
      <div className="grid gap-6">
        <section>
          <h2 className="mb-3 text-xl font-semibold text-ink">Relevant Teamaking Posts</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {(data?.posts ?? []).map((post: any) => (
              <div key={post.id} className="grid gap-2">
                <TeamakingPostCard post={post} />
                <div className="flex flex-wrap gap-2">
                  {(post.reasons ?? []).map((reason: string) => (
                    <SkillBadge key={reason}>{reason}</SkillBadge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
        <section>
          <h2 className="mb-3 text-xl font-semibold text-ink">Relevant Users</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {(data?.users ?? []).map((item: any) => (
              <div key={item.user.id} className="grid gap-2">
                <ProfileCard user={item.user} />
                <div className="flex flex-wrap gap-2">
                  {(item.reasons ?? []).map((reason: string) => (
                    <SkillBadge key={reason}>{reason}</SkillBadge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PageShell>
  );
}

export function AdminHomePage() {
  return (
    <PageShell title="Admin Dashboard" eyebrow="Admin" description="管理用户、学校、课程、课程提交、Course Boards、Teamaking Posts、Team Up Requests 和站点配置。" aside="admin">
      <div className="grid gap-4 md:grid-cols-3">
        {["Users & Roles", "Schools & Domains", "Course Boards", "Support Tickets", "Metrics", "Site Configs", "Audit Logs"].map((item) => (
          <Card key={item}>
            <Settings size={20} aria-hidden className="text-coral" />
            <h2 className="mt-3 font-semibold text-ink">{item}</h2>
            <p className="mt-2 text-sm leading-6 text-ink/62">所有管理端变更都会写入 AdminAuditLog。</p>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}

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

function previewValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value).slice(0, 80);
  return String(value);
}

function rowsFromData(data: any) {
  if (!data) return [];
  return Object.entries(data).filter(([, value]) => Array.isArray(value)) as [string, any[]][];
}

export function AdminResourcePage({
  title,
  endpoint,
  description,
  defaultActionPath
}: {
  title: string;
  endpoint: string;
  description: string;
  defaultActionPath?: string;
}) {
  const [refresh, setRefresh] = useState(0);
  const { data, error, loading } = useApi(endpoint, [refresh]);
  const rows = useMemo(() => rowsFromData(data), [data]);
  const primaryRows = useMemo(() => rows[0]?.[1] ?? [], [rows]);
  const [selectedId, setSelectedId] = useState("");
  const [status, setStatus] = useState("active");
  const [role, setRole] = useState("profile_completed_user");
  const [adminNote, setAdminNote] = useState("");
  const [textFields, setTextFields] = useState<Record<string, string>>({});
  const [result, setResult] = useState("");

  useEffect(() => {
    if (primaryRows.length > 0 && !selectedId) setSelectedId(primaryRows[0].id ?? primaryRows[0].key ?? "");
  }, [primaryRows, selectedId]);

  const resource = endpoint.includes("support-tickets")
    ? "support-tickets"
    : endpoint.includes("team-up-requests")
      ? "team-up-requests"
      : endpoint.split("/").filter(Boolean).pop() ?? "";

  async function runAction(path: string, method: string, body: Record<string, unknown>) {
    setResult("");
    const response = await api(path, { method, body: JSON.stringify(body) });
    setResult("操作已完成。");
    setRefresh((value) => value + 1);
  }

  function selectedLabel(row: any) {
    return row.profile?.displayName ?? row.title ?? row.name ?? row.key ?? row.email ?? row.id;
  }

  function renderAdminForm() {
    if (resource === "logs") {
      return <p className="text-sm leading-6 text-ink/62">审计日志只读，管理员操作会自动写入这里。</p>;
    }

    if (resource === "course-submissions") {
      return (
        <div className="grid gap-3">
          <p className="text-sm leading-6 text-ink/62">缺失课程提交审核已弃用。新的 bug、报错、缺失课程都走 Support Tickets。</p>
          <Link href="/admin/support-tickets" className="w-fit rounded-sm border border-ink/40 px-4 py-2 text-sm font-semibold">
            去处理工单
          </Link>
        </div>
      );
    }

    if (resource === "users") {
      return (
        <form
          className="grid gap-3 md:grid-cols-6"
          onSubmit={(event) => {
            event.preventDefault();
            runAction(`/api/admin/users/${selectedId}`, "PATCH", { role, status, suspendedUntil: textFields.suspendedUntil, adminNote, onboardingCompleted: true });
          }}
        >
          <select className={inputClass} value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
            {primaryRows.map((row) => <option key={row.id} value={row.id}>{selectedLabel(row)}</option>)}
          </select>
          <select className={inputClass} value={role} onChange={(event) => setRole(event.target.value)}>
            {["verified_user", "profile_completed_user", "course_moderator", "school_admin", "super_admin"].map((item) => <option key={item}>{item}</option>)}
          </select>
          <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>
            {["active", "suspended", "banned"].map((item) => <option key={item}>{item}</option>)}
          </select>
          <input className={inputClass} type="datetime-local" value={textFields.suspendedUntil ?? ""} onChange={(event) => setTextFields({ ...textFields, suspendedUntil: event.target.value })} />
          <input className={inputClass} placeholder="管理员备注" value={adminNote} onChange={(event) => setAdminNote(event.target.value)} />
          <button className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper">保存用户</button>
        </form>
      );
    }

    if (resource === "schools") {
      return (
        <form
          className="grid gap-3 md:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            runAction("/api/admin/schools", "POST", {
              name: textFields.name,
              shortName: textFields.shortName,
              domains: (textFields.domains ?? "").split(",").map((item) => item.trim()).filter(Boolean)
            });
          }}
        >
          <input className={inputClass} placeholder="学校名称" value={textFields.name ?? ""} onChange={(event) => setTextFields({ ...textFields, name: event.target.value })} />
          <input className={inputClass} placeholder="简称" value={textFields.shortName ?? ""} onChange={(event) => setTextFields({ ...textFields, shortName: event.target.value })} />
          <input className={inputClass} placeholder="邮箱域名，逗号分隔" value={textFields.domains ?? ""} onChange={(event) => setTextFields({ ...textFields, domains: event.target.value })} />
          <button className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper">新增学校</button>
        </form>
      );
    }

    if (resource === "majors") {
      return (
        <form
          className="grid gap-3 md:grid-cols-5"
          onSubmit={(event) => {
            event.preventDefault();
            runAction("/api/admin/majors", "POST", textFields);
          }}
        >
          <select className={inputClass} value={textFields.type ?? "major"} onChange={(event) => setTextFields({ ...textFields, type: event.target.value })}>
            <option value="faculty">Faculty</option>
            <option value="major">Major</option>
            <option value="semester">Semester</option>
          </select>
          <input className={inputClass} placeholder="schoolId" value={textFields.schoolId ?? ""} onChange={(event) => setTextFields({ ...textFields, schoolId: event.target.value })} />
          <input className={inputClass} placeholder="名称" value={textFields.name ?? ""} onChange={(event) => setTextFields({ ...textFields, name: event.target.value })} />
          <input className={inputClass} placeholder="facultyId / year / term" value={textFields.facultyId ?? textFields.year ?? ""} onChange={(event) => setTextFields({ ...textFields, facultyId: event.target.value, year: event.target.value })} />
          <button className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper">新增结构项</button>
        </form>
      );
    }

    if (resource === "courses") {
      return (
        <form
          className="grid gap-3 md:grid-cols-6"
          onSubmit={(event) => {
            event.preventDefault();
            runAction("/api/admin/courses", "POST", textFields);
          }}
        >
          <input className={inputClass} placeholder="schoolId" value={textFields.schoolId ?? ""} onChange={(event) => setTextFields({ ...textFields, schoolId: event.target.value })} />
          <input className={inputClass} placeholder="课程代码" value={textFields.code ?? ""} onChange={(event) => setTextFields({ ...textFields, code: event.target.value })} />
          <input className={inputClass} placeholder="课程名称" value={textFields.title ?? ""} onChange={(event) => setTextFields({ ...textFields, title: event.target.value })} />
          <input className={inputClass} placeholder="semesterId（可选）" value={textFields.semesterId ?? ""} onChange={(event) => setTextFields({ ...textFields, semesterId: event.target.value })} />
          <input className={inputClass} placeholder="老师 / section（可选）" value={textFields.teacherName ?? ""} onChange={(event) => setTextFields({ ...textFields, teacherName: event.target.value })} />
          <button className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper">新增课程</button>
        </form>
      );
    }

    if (resource === "boards") {
      return (
        <div className="grid gap-5">
          <form
            className="grid gap-3 md:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              runAction("/api/admin/boards", "POST", {
                courseOfferingId: textFields.courseOfferingId,
                title: textFields.title,
                rules: textFields.rules,
                status
              });
            }}
          >
            <input className={inputClass} placeholder="courseOfferingId" value={textFields.courseOfferingId ?? ""} onChange={(event) => setTextFields({ ...textFields, courseOfferingId: event.target.value })} />
            <input className={inputClass} placeholder="Course Board 标题" value={textFields.title ?? ""} onChange={(event) => setTextFields({ ...textFields, title: event.target.value })} />
            <input className={inputClass} placeholder="规则文案（可选）" value={textFields.rules ?? ""} onChange={(event) => setTextFields({ ...textFields, rules: event.target.value })} />
            <button className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper">新增 Course Board</button>
          </form>
          <form
            className="grid gap-3 md:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              runAction(`/api/admin/boards/${selectedId}`, "PATCH", { status, title: textFields.title, rules: textFields.rules });
            }}
          >
            <select className={inputClass} value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
              {primaryRows.map((row) => <option key={row.id} value={row.id}>{selectedLabel(row)}</option>)}
            </select>
            <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>
              {["active", "paused", "closed"].map((item) => <option key={item}>{item}</option>)}
            </select>
            <input className={inputClass} placeholder="规则文案（可选）" value={textFields.rules ?? ""} onChange={(event) => setTextFields({ ...textFields, rules: event.target.value })} />
            <button className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper">保存 Course Board</button>
          </form>
        </div>
      );
    }

    if (resource === "teamaking-posts" || resource === "team-up-requests") {
      const statusOptions = resource === "teamaking-posts" ? ["open", "paused", "closed", "expired"] : ["reported", "archived"];
      const path = resource === "teamaking-posts" ? `/api/admin/teamaking-posts/${selectedId}` : `/api/admin/team-up-requests/${selectedId}`;
      return (
        <form
          className="grid gap-3 md:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault();
            runAction(path, "PATCH", { status });
          }}
        >
          <select className={inputClass} value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
            {primaryRows.map((row) => <option key={row.id} value={row.id}>{selectedLabel(row)}</option>)}
          </select>
          <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>
            {statusOptions.map((item) => <option key={item}>{item}</option>)}
          </select>
          <button className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper">保存状态</button>
        </form>
      );
    }

    if (resource === "support-tickets") {
      return (
        <form
          className="grid gap-3 md:grid-cols-[1fr_160px_1fr_1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            runAction(`/api/admin/support-tickets/${selectedId}`, "PATCH", { status, adminNote, adminReply: textFields.adminReply });
          }}
        >
          <select className={inputClass} value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
            {primaryRows.map((row) => <option key={row.id} value={row.id}>{selectedLabel(row)}</option>)}
          </select>
          <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>
            {["open", "in_progress", "resolved", "closed"].map((item) => <option key={item}>{item}</option>)}
          </select>
          <input className={inputClass} placeholder="管理员备注" value={adminNote} onChange={(event) => setAdminNote(event.target.value)} />
          <input className={inputClass} placeholder="给用户的回复" value={textFields.adminReply ?? ""} onChange={(event) => setTextFields({ ...textFields, adminReply: event.target.value })} />
          <button className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper">更新工单</button>
        </form>
      );
    }

    if (resource === "configs") {
      const key = textFields.key ?? "developer_contact";
      const value = key === "system_status" ? { status: textFields.systemStatus ?? "active", message: textFields.value ?? "" } : { text: textFields.value ?? "" };
      return (
        <form
          className="grid gap-3 md:grid-cols-[220px_180px_1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            runAction(`/api/admin/configs/${key}`, "PATCH", { value });
          }}
        >
          <select className={inputClass} value={key} onChange={(event) => setTextFields({ ...textFields, key: event.target.value })}>
            {["developer_contact", "landing_page", "onboarding_guide", "course_board_rules", "system_status"].map((item) => <option key={item}>{item}</option>)}
          </select>
          <select className={inputClass} value={textFields.systemStatus ?? "active"} onChange={(event) => setTextFields({ ...textFields, systemStatus: event.target.value })} disabled={key !== "system_status"}>
            {["active", "paused"].map((item) => <option key={item}>{item}</option>)}
          </select>
          <input className={inputClass} placeholder={key === "system_status" ? "暂停提示文案" : "配置内容"} value={textFields.value ?? ""} onChange={(event) => setTextFields({ ...textFields, value: event.target.value })} />
          <button className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper">保存配置</button>
        </form>
      );
    }

    return <p className="text-sm text-ink/62">这个管理页目前只展示数据。</p>;
  }

  return (
    <PageShell title={title} eyebrow="Admin" description={description} aside="admin">
      {loading ? <LoadingState /> : <ErrorBox message={error} />}
      <div className="grid gap-5">
        {rows.map(([key, rows]) => (
          <Card key={key}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-ink">{key}</h2>
              <span className="rounded-lg bg-mist px-2.5 py-1 text-xs font-semibold text-moss">{rows.length} records</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-ink/10 text-ink/58">
                    {Object.keys(rows[0] ?? { empty: "" })
                      .slice(0, 7)
                      .map((column) => (
                        <th key={column} className="px-3 py-2 font-semibold">
                          {column}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id ?? JSON.stringify(row).slice(0, 20)} className="border-b border-ink/6">
                      {Object.keys(rows[0] ?? { empty: "" })
                        .slice(0, 7)
                        .map((column) => (
                          <td key={column} className="max-w-[220px] truncate px-3 py-2 text-ink/72">
                            {column === "status" || column === "role" ? <StatusPill status={previewValue(row[column])} /> : previewValue(row[column])}
                          </td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ))}
        <Card>
          <h2 className="text-xl font-semibold text-ink">无代码管理操作</h2>
          <p className="mt-2 text-sm leading-6 text-ink/62">使用表单、下拉框和按钮完成管理，不需要手写接口路径或 JSON。</p>
          <div className="mt-4">{renderAdminForm()}</div>
          {result ? <p className="mt-4 border border-ink/20 bg-paper px-3 py-2 text-sm font-medium text-forest">{result}</p> : null}
        </Card>
      </div>
    </PageShell>
  );
}
