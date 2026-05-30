"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  ArrowRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Check,
  LayoutDashboard,
  KeyRound,
  MailCheck,
  Send,
  ShieldCheck,
  UsersRound
} from "lucide-react";
import { Card, PageShell } from "@/components/app-shell";
import { CopyTarget, EditableCopy, useCopyText } from "@/components/site-copy-runtime";

import { ErrorBox, Field, inputClass } from "@/components/pages/page-primitives";

import { api } from "@/lib/client/api";
import { loginModeFromValue, type LoginMode } from "@/lib/login-mode";

const publicExperienceStorageKey = "teamaking.publicExperience.seen.v1";

const landingFeatures = [
  {
    titleKey: "landing.feature.profile.title",
    bodyKey: "landing.feature.profile.body",
    title: "通过作品展示个人工作能力",
    body: "把作品、课程项目、证明材料和简历摘要放在一个可被理解的 Profile 里。",
    href: "/help?article=proof-of-work-profile"
  },
  {
    titleKey: "landing.feature.team.title",
    bodyKey: "landing.feature.team.body",
    title: "基于个人履历与真实水平的课程/赛事学术匹配",
    body: "用个人履历、公开成果和协作信号，寻找更接近真实能力与目标的伙伴。",
    href: "/help?article=matches"
  },
  {
    titleKey: "landing.feature.course.title",
    bodyKey: "landing.feature.course.body",
    title: "课程内容讨论与共学",
    body: "围绕 Course Board 聚合课程经验、Open to Team 信号和同课讨论。",
    href: "/help?article=course-board-basics"
  }
];

export function LandingPage() {
  const router = useRouter();
  const loginCta = useCopyText("landing.cta.login", "用学校邮箱开始");
  const learnCta = useCopyText("landing.cta.demo", "了解TEAMAKING");
  const contactCta = useCopyText("landing.cta.contact", "联系开发者");

  useEffect(() => {
    if (typeof window === "undefined" || window.sessionStorage.getItem(publicExperienceStorageKey)) return;
    const timer = window.setTimeout(async () => {
      if (window.location.pathname !== "/") return;
      try {
        const data = await api("/api/auth/me");
        if (data?.user) return;
      } catch {
        // Treat auth failures as an anonymous public visit.
      }
      window.sessionStorage.setItem(publicExperienceStorageKey, "1");
      router.push("/experience");
    }, 3500);
    return () => window.clearTimeout(timer);
  }, [router]);

  return (
    <main className="mx-auto max-w-7xl px-5 py-10">
      <section className="grid min-h-[calc(100vh-140px)] items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-coral"><EditableCopy copyKey="landing.hero.eyebrow" fallback="Proof-of-Work Profile + Course Boards" /></p>
          <h1 className="text-5xl font-semibold leading-tight text-ink md:text-7xl"><EditableCopy copyKey="landing.hero.title" fallback="TEAMAKING" /></h1>
          <p className="mt-5 text-2xl font-semibold text-moss"><EditableCopy copyKey="landing.hero.tagline" fallback="Your work speaks before you team up." /></p>
          <p className="mt-3 text-xl text-ink/68"><EditableCopy copyKey="landing.hero.subtitle" fallback="让认真做事的人，先被看见。" /></p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login?mode=register" className="focus-ring inline-flex items-center gap-2 rounded-lg bg-coral px-5 py-3 font-semibold text-white shadow-soft">
              <MailCheck size={18} aria-hidden />
              {loginCta}
            </Link>
            <Link href="/help?article=what-is-teamaking" className="focus-ring inline-flex items-center gap-2 rounded-sm bg-ink px-5 py-3 font-semibold text-paper">
              {learnCta}
              <ArrowRight size={18} aria-hidden />
            </Link>
            <Link href="/contact-developer" className="focus-ring inline-flex items-center gap-2 rounded-sm border border-ink/40 bg-paper px-5 py-3 font-semibold text-ink">
              {contactCta}
              <ArrowRight size={18} aria-hidden />
            </Link>
          </div>
        </div>
        <div className="border border-ink/18 bg-chalk/92 p-5 shadow-soft">
          <div className="border border-ink/18 bg-mist/55 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink/16 pb-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-coral"><EditableCopy copyKey="landing.panel.eyebrow" fallback="What TEAMAKING is for" /></p>
                <h2 className="mt-1 font-serif text-2xl font-semibold text-ink"><EditableCopy copyKey="landing.panel.title" fallback="把课程协作信号放到同一个地方" /></h2>
              </div>
              <span className="border border-coral/35 bg-coral/10 px-2.5 py-1 text-xs font-semibold text-coral">course + people + proof</span>
            </div>
            <div className="mt-4 grid gap-3">
              {landingFeatures.map((feature, index) => (
                <div key={feature.titleKey} className="border border-ink/16 bg-chalk/75 p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center border border-ink/18 bg-paper text-xs font-semibold text-ink">{index + 1}</span>
                    <div>
                      <Link href={feature.href} className="font-semibold text-ink underline decoration-ink/20 underline-offset-4 hover:text-coral hover:decoration-coral">
                        <EditableCopy copyKey={feature.titleKey} fallback={feature.title} />
                      </Link>
                      <p className="mt-1 text-sm leading-6 text-ink/62"><EditableCopy copyKey={feature.bodyKey} fallback={feature.body} /></p>
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

type ExperienceSlide = {
  eyebrow: string;
  title: string;
  body: string;
  href?: string;
  icon: typeof LayoutDashboard;
  accent: string;
  scene: "dashboard" | "profile" | "course" | "matches" | "help";
};

const experienceSlides: ExperienceSlide[] = [
  {
    eyebrow: "Step 1",
    title: "先看 Dashboard 的整体状态",
    body: "推荐课程、Profile 完整度、TeamUp 提醒和官方查询入口会集中在学生首页。",
    icon: LayoutDashboard,
    accent: "bg-coral",
    scene: "dashboard"
  },
  {
    eyebrow: "Step 2",
    title: "用作品证明真实贡献",
    body: "Proof-of-Work Profile 让同学先看到项目、材料、技能和可验证经历。",
    href: "/help?article=proof-of-work-profile",
    icon: ShieldCheck,
    accent: "bg-forest",
    scene: "profile"
  },
  {
    eyebrow: "Step 3",
    title: "进入课程内容讨论与共学",
    body: "Course Board 聚合课程说明、Open to Team 信号和同课协作入口。",
    href: "/help?article=course-board-basics",
    icon: BookOpen,
    accent: "bg-moss",
    scene: "course"
  },
  {
    eyebrow: "Step 4",
    title: "基于履历与真实水平匹配伙伴",
    body: "Matches 和 TeamUp Interest 帮你从课程、作品和协作目标附近找到人。",
    href: "/help?article=matches",
    icon: UsersRound,
    accent: "bg-rust",
    scene: "matches"
  },
  {
    eyebrow: "Step 5",
    title: "遇到问题先看帮助中心和开发者页面",
    body: "帮助中心解释功能边界；开发者页面记录迭代和维护信息。下一步会进入邮箱注册。",
    href: "/help",
    icon: BookOpen,
    accent: "bg-ink",
    scene: "help"
  }
];

export function ExperiencePage() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const slide = experienceSlides[index];
  const Icon = slide.icon;
  const isLast = index === experienceSlides.length - 1;

  function next() {
    if (isLast) {
      router.push("/login?mode=register");
      return;
    }
    setIndex((value) => Math.min(value + 1, experienceSlides.length - 1));
  }

  return (
    <main className="mx-auto grid min-h-[calc(100vh-72px)] max-w-7xl content-center gap-6 px-5 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-coral">Experience TEAMAKING</p>
          <h1 className="mt-2 text-4xl font-semibold text-ink md:text-6xl">先快速走一遍平台</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/" className="focus-ring border border-ink/30 px-3 py-2 text-sm font-semibold text-ink">结束引导</Link>
          <Link href="/login?mode=register" className="focus-ring bg-coral px-3 py-2 text-sm font-semibold text-white">直接注册</Link>
        </div>
      </div>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] lg:items-stretch">
        <div className="border border-ink/18 bg-chalk p-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-ink/52">{slide.eyebrow} / {experienceSlides.length}</p>
          <div className={`mt-5 grid h-12 w-12 place-items-center ${slide.accent} text-paper`}>
            <Icon size={22} aria-hidden />
          </div>
          <h2 className="mt-5 text-3xl font-semibold leading-tight text-ink">{slide.title}</h2>
          <p className="mt-4 text-base leading-7 text-ink/68">{slide.body}</p>
          {slide.href ? (
            <Link href={slide.href} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-coral">
              阅读对应帮助文档
              <ArrowRight size={16} aria-hidden />
            </Link>
          ) : null}
          <div className="mt-8 flex flex-wrap gap-2">
            <button type="button" disabled={index === 0} onClick={() => setIndex((value) => Math.max(value - 1, 0))} className="focus-ring inline-flex items-center gap-2 border border-ink/30 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40">
              <ChevronLeft size={16} aria-hidden />
              上一步
            </button>
            <button type="button" onClick={next} className="focus-ring inline-flex items-center gap-2 bg-ink px-3 py-2 text-sm font-semibold text-paper">
              {isLast ? "进入邮箱注册" : "下一步"}
              <ChevronRight size={16} aria-hidden />
            </button>
          </div>
          <div className="mt-6 flex gap-2" aria-label="体验引导进度">
            {experienceSlides.map((item, itemIndex) => (
              <button
                key={item.title}
                type="button"
                onClick={() => setIndex(itemIndex)}
                className={`h-2 flex-1 border border-ink/20 ${itemIndex === index ? "bg-ink" : "bg-paper"}`}
                aria-label={`跳到第 ${itemIndex + 1} 步`}
              />
            ))}
          </div>
        </div>
        <ExperienceMockup scene={slide.scene} />
      </section>
    </main>
  );
}

function ExperienceMockup({ scene }: { scene: ExperienceSlide["scene"] }) {
  const rows = useMemo(() => {
    if (scene === "profile") return ["作品证明 Profile", "课程项目报告", "GPA / 证书材料", "联系方式可见性"];
    if (scene === "course") return ["Course Board", "课程说明", "Open to Team", "共学讨论"];
    if (scene === "matches") return ["Matches", "个人履历线索", "TeamUp Interest", "目标接近"];
    if (scene === "help") return ["Help Center", "Developer Log", "Contact Developer", "Support Ticket"];
    return ["Profile completion", "Recommended courses", "TeamUp reminders", "Official references"];
  }, [scene]);

  return (
    <div className="min-h-[430px] border-2 border-ink bg-paper p-4 shadow-hard" aria-label="不可交互的 TEAMAKING 功能演示截图">
      <div className="flex items-center justify-between border-b-2 border-ink pb-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center bg-ink text-paper">T</span>
          <span className="font-serif text-xl font-semibold">TEAMAKING</span>
        </div>
        <span className="border border-ink/20 px-2 py-1 text-xs font-semibold text-ink/54">static preview</span>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-[0.65fr_1.35fr]">
        <div className="grid gap-2">
          {["Dashboard", "Profile", "Courses", "Matches", "Help"].map((item) => (
            <div key={item} className={`border px-3 py-2 text-sm font-semibold ${item.toLowerCase().includes(scene === "course" ? "courses" : scene) ? "border-coral bg-coral/10 text-coral" : "border-ink/12 bg-chalk text-ink/62"}`}>
              {item}
            </div>
          ))}
        </div>
        <div className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="border border-ink/14 bg-mist/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-coral">{rows[0]}</p>
              <div className="mt-4 h-16 bg-paper" />
            </div>
            <div className="border border-ink/14 bg-chalk p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-moss">{rows[1]}</p>
              <div className="mt-4 grid gap-2">
                <span className="h-3 bg-ink/18" />
                <span className="h-3 w-3/4 bg-ink/14" />
                <span className="h-3 w-1/2 bg-ink/10" />
              </div>
            </div>
          </div>
          <div className="border border-ink/14 bg-paper p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-ink">{rows[2]}</p>
              <span className="border border-forest/30 bg-forest/10 px-2 py-1 text-xs font-semibold text-forest">preview</span>
            </div>
            <div className="mt-4 grid gap-2">
              {[0, 1, 2].map((item) => (
                <div key={item} className="grid grid-cols-[56px_1fr_auto] items-center gap-3 border border-ink/10 bg-chalk px-3 py-2">
                  <span className="h-8 bg-coral/20" />
                  <span className="grid gap-1">
                    <span className="h-3 bg-ink/18" />
                    <span className="h-2 w-2/3 bg-ink/10" />
                  </span>
                  <span className="border border-ink/20 px-2 py-1 text-xs text-ink/54">{rows[3]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LoginPage({ initialMode = "register" }: { initialMode?: LoginMode } = {}) {
  const router = useRouter();
  const [mode, setMode] = useState<LoginMode>(() => loginModeFromValue(initialMode));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const emailPlaceholder = useCopyText("login.email.placeholder", "your.name@mail.bnbu.edu.cn");
  const passwordPlaceholder = useCopyText("login.password.placeholder", "输入密码");

  function resetState(nextMode: LoginMode) {
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

    if (result?.redirectPath) router.push(result.redirectPath);
    else if (result?.user?.onboardingCompleted) router.push("/dashboard");
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

    if (result?.redirectPath) {
      setMode("login");
      setPassword("");
      setCode("");
      setDevCode("");
      setMessage(result.message ?? "处理完成，请登录。");
      return;
    }
    if (result?.user?.onboardingCompleted) router.push("/dashboard");
    else if (result?.user) router.push("/onboarding");
  }

  return (
    <PageShell title="测试环境入口" eyebrow="Authentication" description="测试环境账号会被保存，便于你重复登录、编辑资料、上传作品和继续测试；正式上线前可能统一清理测试数据。" titleCopyKey="login.page.title" descriptionCopyKey="login.page.description" aside="none">
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
              <Field label="学校邮箱" labelCopyKey="login.email.label">
                <CopyTarget copyKey="login.email.placeholder"><input className={inputClass} value={email} onChange={(event) => setEmail(event.target.value)} placeholder={emailPlaceholder} /></CopyTarget>
              </Field>
              <Field label="密码" labelCopyKey="login.password.label">
                <CopyTarget copyKey="login.password.placeholder"><input className={inputClass} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={passwordPlaceholder} /></CopyTarget>
              </Field>
              <button type="submit" disabled={isLoggingIn} className="focus-ring inline-flex w-fit items-center gap-2 rounded-lg bg-ink px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
                <KeyRound size={16} aria-hidden />
                {isLoggingIn ? "登录中..." : <EditableCopy copyKey="login.submit" fallback="登录" />}
              </button>
            </form>
          ) : (
            <div className="grid gap-6">
              <form onSubmit={sendCode} className="grid gap-4">
                <Field label="学校邮箱" labelCopyKey="login.email.label">
                  <CopyTarget copyKey="login.email.placeholder"><input className={inputClass} value={email} onChange={(event) => setEmail(event.target.value)} placeholder={emailPlaceholder} /></CopyTarget>
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
    const result = await api("/api/auth/admin-login", {
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
    <PageShell title="演示验收入口" eyebrow="Demo Access" description="这个入口只用于本地和验收环境，绕过邮箱验证码，帮助你直接检查业务逻辑与前端展示。" titleCopyKey="demo.page.title" descriptionCopyKey="demo.page.description" aside="none">
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
