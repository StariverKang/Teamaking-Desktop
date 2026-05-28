"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  FormEvent,
  useEffect,
  useMemo,
  useState
} from "react";

import {
  Check,
  MessageCircle,
  Send,
  X
} from "lucide-react";
import {
  Card,
  EmptyState,
  LoadingState,
  PageShell,
  StatusPill
} from "@/components/app-shell";
import { CourseCard, TeamakingPostCard } from "@/components/cards";
import { OnboardingTourRestartButton, requestOnboardingTourStart } from "@/components/onboarding-tour";
import { ErrorBox, Field, inputClass } from "@/components/pages/page-primitives";

import { contactVisibilityOptions, defaultContactVisibility } from "@/lib/contact";
import { api, useApi } from "@/lib/client/api";
import { normalizeAcademicSelection, OfficialAcademicLinks } from "@/components/pages/shared/academic-parts";
import { defaultEntryYear, entryTermOptions, PaginatedGrid } from "@/components/pages/shared/portfolio-parts";

export function OnboardingPage() {
  const router = useRouter();
  const { data, error, loading } = useApi("/api/onboarding");
  const [form, setForm] = useState({ displayName: "", grade: "Year 2", entryYear: defaultEntryYear, entryTerm: "Fall", facultyId: "", majorId: "" });
  const academicLock = data?.academicLock;
  const majors = useMemo(() => (data?.majors ?? []).filter((major: any) => !form.facultyId || major.facultyId === form.facultyId), [data, form.facultyId]);

  useEffect(() => {
    if (data?.user) {
      const academicSelection = normalizeAcademicSelection(
        data.faculties ?? [],
        data.majors ?? [],
        data.user.profile?.facultyId,
        data.user.profile?.majorId
      );
      setForm((current) => ({
        ...current,
        displayName: data.user.profile?.displayName ?? data.user.email?.split("@")[0] ?? "",
        grade: data.academicLock?.grade ?? data.user.profile?.grade ?? current.grade,
        entryYear: data.academicLock?.entryYear ?? data.user.profile?.entryYear ?? current.entryYear,
        entryTerm: data.academicLock?.entryTerm ?? data.user.profile?.entryTerm ?? current.entryTerm,
        facultyId: academicSelection.facultyId,
        majorId: academicSelection.majorId
      }));
    }
  }, [data]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    await api("/api/onboarding", { method: "POST", body: JSON.stringify(form) });
    requestOnboardingTourStart(1);
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
              <p>2. 浏览 Course Board，找到对应课程下的协作信号。</p>
              <p>3. 发布 Open to Team 信号，或对同课 Post 发 TeamUp 后，才会进入 Course People。</p>
              <p>4. 最终沟通和组队在平台外完成，MVP 主要通过 WeChat 联系。</p>
            </div>
            <button type="button" onClick={() => router.push("/dashboard")} className="focus-ring mt-5 rounded-lg border border-ink/12 px-4 py-2 font-semibold">
              暂时跳过
            </button>
          </Card>
          <Card data-onboarding-target="academic-form">
            <form onSubmit={submit} className="grid gap-4">
              <Field label="显示名称">
                <input className={inputClass} value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} />
              </Field>
              <Field label="年级 / Academic Year">
                <input className={inputClass} value={form.grade} readOnly={Boolean(academicLock?.locked)} onChange={(event) => setForm({ ...form, grade: event.target.value })} />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="入学年份 / Entry Year" help={academicLock?.locked ? "由邮箱第二位数字推断，特殊情况联系管理员覆盖。" : undefined}>
                  <input className={inputClass} type="number" value={form.entryYear} readOnly={Boolean(academicLock?.locked)} onChange={(event) => setForm({ ...form, entryYear: Number(event.target.value) })} />
                </Field>
                <Field label="入学学期 / Entry Term">
                  <select className={inputClass} value={form.entryTerm} disabled={Boolean(academicLock?.locked)} onChange={(event) => setForm({ ...form, entryTerm: event.target.value })}>
                    {entryTermOptions.map((term) => <option key={term}>{term}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Faculty / College">
                <select
                  className={inputClass}
                  value={form.facultyId}
                  onChange={(event) => setForm({ ...form, ...normalizeAcademicSelection(data.faculties ?? [], data.majors ?? [], event.target.value, null) })}
                >
                  {(data.faculties ?? []).map((faculty: any) => (
                    <option key={faculty.id} value={faculty.id}>
                      {faculty.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Major">
                <select className={inputClass} value={form.majorId} onChange={(event) => setForm({ ...form, majorId: event.target.value })} disabled={majors.length === 0}>
                  {majors.length === 0 ? <option value="">请先选择 Faculty</option> : null}
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
  const activeMemberships = (me?.user?.memberships ?? []).filter((membership: any) => membership.status !== "opted_out");
  const currentMemberships = activeMemberships.filter((membership: any) => membership.board?.courseOffering?.semester?.isCurrent);
  const historyMemberships = activeMemberships.filter((membership: any) => !membership.board?.courseOffering?.semester?.isCurrent);

  return (
    <PageShell title="Dashboard" eyebrow="Student App" description="这里集中显示推荐课程、近期 Open to Team 信号、资料完整度和 Team Up 请求。">
      {loading ? <LoadingState /> : <ErrorBox message={error} />}
      {!loading && !me?.user ? (
        <EmptyState title="还没有登录" body="请先使用学校邮箱完成验证登录，再进入 TEAMAKING 的学生端。" />
      ) : null}
      {me?.user ? (
        <div className="grid gap-5">
          <div className="grid gap-5 md:grid-cols-3">
            <Card data-onboarding-target="dashboard-profile-health">
              <p className="text-sm text-ink/58">Profile completion</p>
              <p className="mt-2 text-3xl font-semibold text-ink">{me.user.onboardingCompleted ? "80%" : "35%"}</p>
              <p className="mt-2 text-sm text-ink/62">完善 portfolio 和联系方式后，协作信号会更可信。</p>
              <OnboardingTourRestartButton className="mt-3 rounded-sm border border-ink/30 px-3 py-2 text-xs font-semibold text-ink" />
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
                  浏览课程板
                </Link>
                <Link className="rounded-lg border border-ink/12 px-3 py-2 text-sm font-semibold" href="/profile/me">
                  编辑 Profile
                </Link>
              </div>
            </Card>
          </div>
          <OfficialAcademicLinks links={recommended?.officialLinks} />
          <section>
            <h2 className="mb-3 text-xl font-semibold text-ink">My current Course Boards</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {currentMemberships.map((membership: any) => {
                const board = membership.board;
                const course = board?.courseOffering?.course;
                return (
                  <Link key={membership.id} href={`/boards/${board.id}`} className="border-2 border-ink bg-paper p-4 transition hover:-translate-y-0.5 hover:shadow-hard">
                    <p className="text-sm font-semibold text-coral">{course?.code}</p>
                    <h3 className="mt-1 text-lg font-semibold text-ink">{course?.title ?? board.title}</h3>
                    <p className="mt-2 text-xs text-ink/58">{membership.source === "teamaking_post" ? "已发布 Open to Team" : "已发送 TeamUp Interest"} · {board?.courseOffering?.semester?.name}</p>
                  </Link>
                );
              })}
              {currentMemberships.length === 0 ? <p className="text-sm text-ink/58">当前还没有参与中的 Course Board。发布某课程的 Teamaking Post，或对该课程 Post 发送 TeamUp 后会显示在这里。</p> : null}
            </div>
          </section>
          <section>
            <h2 className="mb-3 text-xl font-semibold text-ink">Recommended courses</h2>
            <PaginatedGrid items={recommended?.courses ?? []} render={(course) => <CourseCard key={course.id} course={course} />} />
          </section>
          {historyMemberships.length ? (
            <section>
              <h2 className="mb-3 text-xl font-semibold text-ink">Historical Course Boards</h2>
              <div className="grid gap-2">
                {historyMemberships.slice(0, 6).map((membership: any) => (
                  <Link key={membership.id} href={`/boards/${membership.board.id}`} className="border border-ink/15 bg-paper px-3 py-2 text-sm font-semibold text-ink">
                    {membership.board.courseOffering.course.code} · {membership.board.courseOffering.course.title} · {membership.board.courseOffering.semester.name}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
          <section>
            <h2 className="mb-3 text-xl font-semibold text-ink">Recent Open to Team posts</h2>
            <PaginatedGrid items={matches?.posts ?? []} render={(post) => <TeamakingPostCard key={post.id} post={post} />} />
          </section>
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
        <Card data-onboarding-target="contact-visibility">
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
  const [refreshKey, setRefreshKey] = useState(0);
  const { data: mine, loading: mineLoading } = useApi(me?.user ? "/api/support-tickets/mine" : null, [me?.user?.id, refreshKey]);

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
      setRefreshKey((value) => value + 1);
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
        <Card data-onboarding-target="support-ticket">
          <form onSubmit={submit} className="grid gap-4">
            <Field label="联系邮箱">
              <input className={inputClass} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="可选，但建议填写" />
            </Field>
            <Field label="工单类型">
              <select className={inputClass} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
                <option value="missing_course">缺失课程</option>
                <option value="course_config_error">课程配置错误</option>
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
      {me?.user ? (
        <div className="mt-5">
          <Card>
            <h2 className="text-xl font-semibold text-ink">我的工单</h2>
            {mineLoading ? <p className="mt-3 text-sm text-ink/56">正在读取...</p> : null}
            <div className="mt-4 grid gap-3">
              {(mine?.tickets ?? []).length ? mine.tickets.map((ticket: any) => (
                <div key={ticket.id} className="border border-ink/15 bg-chalk p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-semibold text-ink">{ticket.title}</p>
                    <StatusPill status={ticket.status} />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-ink/62">{ticket.description}</p>
                  {ticket.adminReply ? (
                    <p className="mt-3 border border-forest/20 bg-paper px-3 py-2 text-sm leading-6 text-forest">管理员回复：{ticket.adminReply}</p>
                  ) : null}
                </div>
              )) : <p className="text-sm text-ink/56">还没有提交过工单。</p>}
            </div>
          </Card>
        </div>
      ) : null}
    </PageShell>
  );
}

export function SupportWidget() {
  const pathname = usePathname();
  const { data: me } = useApi("/api/auth/me");
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    email: "",
    category: "bug",
    title: "",
    description: ""
  });

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
      setMessage("工单已提交。");
      setForm({ email: me?.user?.email ?? "", category: "bug", title: "", description: "" });
    }
  }

  if (pathname?.startsWith("/admin") || pathname?.startsWith("/crawler")) return null;

  return (
    <div className="fixed bottom-20 right-4 z-40 lg:bottom-5 lg:right-5">
      {open ? (
        <div className="mb-3 w-[min(360px,calc(100vw-40px))] border-2 border-ink bg-paper p-4 shadow-hard">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-ink">联系管理员</h2>
            <button type="button" onClick={() => setOpen(false)} className="border border-ink/30 p-1"><X size={16} aria-hidden /></button>
          </div>
          <form onSubmit={submit} className="mt-3 grid gap-3">
            <input className={inputClass} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="联系邮箱" />
            <select className={inputClass} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
              <option value="missing_course">缺失课程</option>
              <option value="course_config_error">课程配置错误</option>
              <option value="bug">Bug</option>
              <option value="error_report">报错</option>
              <option value="admin_request">后台需求</option>
              <option value="other">其他</option>
            </select>
            <input className={inputClass} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="标题" />
            <textarea className={inputClass} rows={4} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="请描述问题或需求" />
            <button className="bg-ink px-3 py-2 text-sm font-semibold text-paper">提交工单</button>
          </form>
          <ErrorBox message={error} />
          {message ? <p className="mt-2 text-sm font-medium text-forest">{message}</p> : null}
        </div>
      ) : null}
      <button type="button" onClick={() => setOpen((value) => !value)} data-testid="support-widget-toggle" className="focus-ring inline-flex h-12 w-12 items-center justify-center rounded-full border-2 border-ink bg-coral text-paper shadow-hard" aria-label="提交支持工单">
        <MessageCircle size={22} aria-hidden />
      </button>
    </div>
  );
}
