"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import {
  ArrowRight,
  Check,
  KeyRound,
  MailCheck,
  Send
} from "lucide-react";
import { Card, PageShell } from "@/components/app-shell";

import { ErrorBox, Field, inputClass } from "@/components/pages/page-primitives";

import { api } from "@/lib/client/api";

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
        <div className="border border-ink/18 bg-chalk/92 p-5 shadow-soft">
          <div className="border border-ink/18 bg-mist/55 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink/16 pb-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-coral">What TEAMAKING is for</p>
                <h2 className="mt-1 font-serif text-2xl font-semibold text-ink">把课程协作信号放到同一个地方</h2>
              </div>
              <span className="border border-coral/35 bg-coral/10 px-2.5 py-1 text-xs font-semibold text-coral">course + people + proof</span>
            </div>
            <div className="mt-4 grid gap-3">
              {[
                ["展示个人成果", "用作品、证书、简历摘要和联系方式，让同学先看到你真实做过什么。"],
                ["按目标成绩找组员", "在课程板里说明你希望冲 A / A- / B+，或只求稳过，匹配节奏相近的小组作业伙伴。"],
                ["讨论课程内容", "围绕真实课程发帖、评价课程、整理经验，减少只靠群聊找信息的混乱。"]
              ].map(([title, body], index) => (
                <div key={title} className="border border-ink/16 bg-chalk/75 p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center border border-ink/18 bg-paper text-xs font-semibold text-ink">{index + 1}</span>
                    <div>
                      <p className="font-semibold text-ink">{title}</p>
                      <p className="mt-1 text-sm leading-6 text-ink/62">{body}</p>
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
