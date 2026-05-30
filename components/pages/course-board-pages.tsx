"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { Handshake, Plus, Search } from "lucide-react";
import {
  Card,
  EmptyState,
  LoadingState,
  PageShell
} from "@/components/app-shell";
import {
  CourseCard,
  ProfileCard,
  TeamakingPostCard,
  TeamUpRequestCard
} from "@/components/cards";
import { ErrorBox, Field, inputClass } from "@/components/pages/page-primitives";
import { CopyTarget, EditableCopy, useCopyText } from "@/components/site-copy-runtime";
import { contributionTypes, strengths } from "@/lib/constants";

import { api, useApi } from "@/lib/client/api";
import { ToggleGroup } from "@/components/pages/shared/portfolio-parts";
import { OfficialAcademicLinks, CourseCommentsSection } from "@/components/pages/shared/academic-parts";

export function CoursesPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"recommended" | "mine" | "search">("recommended");
  const [searchPage, setSearchPage] = useState(1);
  const searchPageSize = 10;
  const { data: me, loading: authLoading } = useApi("/api/auth/me");
  const isAuthed = Boolean(me?.user);
  const { data: recommended } = useApi(isAuthed ? "/api/courses/recommended" : null, [isAuthed]);
  const { data: myCourses } = useApi(isAuthed ? "/api/courses/my" : null, [isAuthed]);
  const { data: search, error: searchError, loading: searchLoading } = useApi(
    isAuthed ? `/api/courses/search?q=${encodeURIComponent(q)}&page=${searchPage}&pageSize=${searchPageSize}` : null,
    [q, searchPage, searchPageSize, isAuthed]
  );
  const officialLinks = recommended?.officialLinks ?? myCourses?.officialLinks ?? [];
  const searchPagination = search?.pagination ?? { page: searchPage, pageSize: searchPageSize, total: 0, totalPages: 1 };
  const courseSearchPlaceholder = useCopyText("courses.search.placeholder", "搜索课程代码或课程名称，例如 COM3003；free elective 可直接打开课程板");

  async function openCourseBoard(course: any) {
    const result = await api(`/api/courses/${course.id}/join`, { method: "POST" });
    const boardId = result?.board?.id ?? course.offerings?.[0]?.boards?.[0]?.id;
    if (boardId) router.push(`/boards/${boardId}`);
  }

  return (
    <PageShell title="Course Boards" eyebrow="Courses" description="浏览课程板；只有在某课程下发布 Post 或发送 TeamUp 后，才算参与这个 Course Board。" titleCopyKey="courses.page.title" eyebrowCopyKey="courses.page.eyebrow" descriptionCopyKey="courses.page.description">
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
              ["BUS2002", "Marketing Principles", "Posting or TeamUp actions require verified identity."]
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
        <OfficialAcademicLinks links={officialLinks} />
        <Card data-onboarding-target="courses-search">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/15 pb-3">
            <div className="flex flex-wrap gap-2">
              {[
                ["recommended", "Recommended", "courses.tab.recommended"],
                ["mine", "我的课程", "courses.tab.mine"],
                ["search", "Search / Free elective", "courses.tab.search"]
              ].map(([key, label, copyKey]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key as typeof tab)}
                  className={`border px-3 py-2 text-sm font-semibold ${tab === key ? "border-ink bg-ink text-paper" : "border-ink/25 bg-paper text-ink"}`}
                >
                  <EditableCopy copyKey={copyKey} fallback={label} />
                </button>
              ))}
            </div>
            <p className="text-xs leading-5 text-ink/55">
              <EditableCopy copyKey="courses.search.note" fallback="只有发布 Teamaking Post 或发送 TeamUp Interest 后，课程板才会进入“我的课程”；只浏览不会加入。" />
            </p>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Search size={18} aria-hidden />
            <CopyTarget copyKey="courses.search.placeholder" className="flex-1">
              <input
                className={inputClass}
                value={q}
                onChange={(event) => {
                  setQ(event.target.value);
                  setSearchPage(1);
                  if (event.target.value.trim()) setTab("search");
                }}
                placeholder={courseSearchPlaceholder}
              />
            </CopyTarget>
          </div>
          {tab === "search" && q.trim() ? (
            <div className="mt-4 border-t border-ink/15 pt-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink/50"><EditableCopy copyKey="courses.search.resultLabel" fallback="Recommended by match score" /></p>
                <p className="text-xs text-ink/52">
                  {searchPagination.total} results · page {searchPagination.page} / {searchPagination.totalPages}
                </p>
              </div>
              {searchLoading ? <LoadingState /> : null}
              <ErrorBox message={searchError} />
              <div className="grid gap-2">
                {(search?.courses ?? []).map((course: any) => {
                  return (
                    <div key={course.id} className="grid gap-3 border border-ink/15 bg-paper px-3 py-3 md:grid-cols-[1fr_auto] md:items-center">
                      <div>
                        <p className="text-sm font-semibold text-ink">{course.code} · {course.title}</p>
                        <p className="mt-1 text-xs text-ink/58">{course.matchReason} · score {course.score}</p>
                      </div>
                      <div className="flex gap-2">
                        <Link href={`/courses/${course.id}`} className="border border-ink/30 px-3 py-2 text-xs font-semibold hover:bg-mist/50">
                          详情
                        </Link>
                        <button onClick={() => openCourseBoard(course)} className="border border-ink bg-ink px-3 py-2 text-xs font-semibold text-paper">
                          打开课程板
                        </button>
                      </div>
                    </div>
                  );
                })}
                {!searchLoading && (search?.courses ?? []).length === 0 ? (
                  <EmptyState title="没有找到匹配课程" body="可以换一个课程代码、英文关键词，或通过右下角工单提交缺失课程。" titleCopyKey="courses.empty.search.title" bodyCopyKey="courses.empty.search.body" />
                ) : null}
              </div>
              {searchPagination.totalPages > 1 ? (
                <div className="pagination-safe-zone mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink/15 pt-3">
                  <p className="text-xs text-ink/52">
                    Showing {(searchPagination.page - 1) * searchPagination.pageSize + 1}
                    {"-"}
                    {Math.min(searchPagination.page * searchPagination.pageSize, searchPagination.total)} of {searchPagination.total}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={searchPagination.page <= 1}
                      onClick={() => setSearchPage((page) => Math.max(1, page - 1))}
                      className="border border-ink/30 px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      disabled={searchPagination.page >= searchPagination.totalPages}
                      onClick={() => setSearchPage((page) => Math.min(searchPagination.totalPages, page + 1))}
                      className="border border-ink/30 px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </Card>
        {tab === "recommended" ? (
        <section>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <h2 className="font-serif text-2xl font-semibold text-ink"><EditableCopy copyKey="courses.recommended.title" fallback="Recommended courses" /></h2>
            {recommended?.academicContext?.relativeTermCode ? (
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/52">
                {recommended.academicContext.semester?.name} · {recommended.academicContext.relativeTermCode}
              </p>
            ) : null}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {(recommended?.courses ?? []).map((course: any) => (
              <CourseCard key={course.id} course={course} onJoin={openCourseBoard} />
            ))}
            {(recommended?.courses ?? []).length === 0 ? (
              <Card>
                <h3 className="font-serif text-xl font-semibold text-ink">暂时没有匹配到本学期专业课程</h3>
                <p className="mt-2 text-sm leading-6 text-ink/64">
                  请确认个人 Profile 中的 admission year、major 已保存，并确认对应年份 handbook JSON 已由管理员批准导入。
                </p>
              </Card>
            ) : null}
          </div>
        </section>
        ) : null}
        {tab === "mine" ? (
        <section>
          <h2 className="mb-3 font-serif text-2xl font-semibold text-ink"><EditableCopy copyKey="courses.mine.title" fallback="我的课程" /></h2>
          <div className="grid gap-3">
            {(myCourses?.memberships ?? []).map((membership: any) => {
              const board = membership.board;
              const offering = board?.courseOffering;
              const course = offering?.course;
              return (
                <div key={membership.id} className="grid gap-3 border border-ink/35 bg-chalk/90 p-4 md:grid-cols-[1fr_auto] md:items-center">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-coral">{offering?.semester?.name ?? "Course Board"} · section {membership.sectionCode ?? "1001"}</p>
                    <h3 className="mt-1 font-serif text-xl font-semibold text-ink">{course?.code} · {course?.title ?? board?.title}</h3>
                    <p className="mt-2 text-xs text-ink/56">{membership.source === "teamaking_post" ? "已发布 Open to Team" : "已发送 TeamUp Interest"}</p>
                    {membership.advisory ? (
                      <p className="mt-3 border-l-2 border-coral bg-coral/8 px-3 py-2 text-sm leading-6 text-coral">{membership.advisory.message}</p>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/courses/${course?.id}`} className="border border-ink/30 px-3 py-2 text-sm font-semibold hover:bg-mist/50">
                      详情
                    </Link>
                    <Link href={`/boards/${board?.id}`} className="border border-ink bg-ink px-3 py-2 text-sm font-semibold text-paper">
                      进入课程板
                    </Link>
                  </div>
                </div>
              );
            })}
            {(myCourses?.memberships ?? []).length === 0 ? <EmptyState title="还没有参与中的课程板" body="打开课程板后，发布 Teamaking Post 或对某条 Post 发送 TeamUp，才会出现在这里。" titleCopyKey="courses.empty.mine.title" bodyCopyKey="courses.empty.mine.body" /> : null}
          </div>
        </section>
        ) : null}
        <Card>
          <h2 className="font-serif text-xl font-semibold text-ink"><EditableCopy copyKey="courses.missing.title" fallback="缺失课程 / bug / 报错" /></h2>
          <p className="mt-2 text-sm leading-6 text-ink/64">
            <EditableCopy copyKey="courses.missing.body" fallback="缺失课程不再走复杂审核机制。请直接提交工单，管理员会私下确认并处理。" />
          </p>
          <Link href="/support" className="focus-ring mt-4 inline-flex w-fit items-center gap-2 border border-ink/40 px-4 py-2 font-semibold hover:bg-mist/60">
            <Plus size={16} aria-hidden />
            <EditableCopy copyKey="courses.missing.submit" fallback="提交工单" />
          </Link>
        </Card>
      </div>
      ) : null}
    </PageShell>
  );
}

export function CourseDetailPage({ courseId }: { courseId: string }) {
  const router = useRouter();
  const { data, error, loading } = useApi(`/api/courses/${courseId}`);
  const course = data?.course;
  const [joinMessage, setJoinMessage] = useState("");

  async function openCourseBoardFromCourse() {
    if (!course) return;
    setJoinMessage("");
    const result = await api(`/api/courses/${course.id}/join`, { method: "POST" });
    const boardId = result?.board?.id;
    if (boardId) router.push(`/boards/${boardId}`);
    else setJoinMessage(result?.message ?? "已打开课程板。");
  }

  return (
    <PageShell title={course ? `${course.code} ${course.title}` : "Course Detail"} eyebrow="Course" description="课程详情、开课学期和对应 Course Board。" descriptionCopyKey="courseDetail.page.description">
      {loading ? <LoadingState /> : <ErrorBox message={error} />}
      {course ? (
        <div className="grid gap-5">
          <OfficialAcademicLinks links={data?.officialLinks} />
          <Card>
            <p className="text-sm font-semibold text-coral">{course.code}</p>
            <h2 className="mt-1 font-serif text-2xl font-semibold text-ink">{course.title}</h2>
            <p className="mt-3 text-sm leading-6 text-ink/68">{course.description || "暂无课程描述。"}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="button" onClick={openCourseBoardFromCourse} className="border border-ink bg-ink px-4 py-2 text-sm font-semibold text-paper">
                打开 Course Board
              </button>
              <p className="text-xs leading-5 text-ink/56">只浏览或打开不会加入；发布 Post 或发送 TeamUp 后才会进入 Course People。</p>
            </div>
            {joinMessage ? <p className="mt-3 text-sm font-medium text-forest">{joinMessage}</p> : null}
          </Card>
          <CourseCommentsSection courseId={course.id} />
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
  const [boardMessage, setBoardMessage] = useState("");
  const [sectionCode, setSectionCode] = useState("1001");
  const [sectionFilter, setSectionFilter] = useState("all");
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
  const sections = boardData?.sections ?? [];
  const visiblePeople = (people?.people ?? []).filter((item: any) => sectionFilter === "all" || item.sectionCode === sectionFilter);
  const sectionPlaceholder = useCopyText("board.section.placeholder", "1001");
  const outcomePlaceholder = useCopyText("board.post.outcome.placeholder", "A polished report with strong argumentation and clean slides.");

  useEffect(() => {
    if (course && !postForm.title) {
      setPostForm((current) => ({ ...current, title: `Open to Team for ${course.code}` }));
    }
  }, [course, postForm.title]);

  useEffect(() => {
    if (boardData?.myMembership?.sectionCode) setSectionCode(boardData.myMembership.sectionCode);
  }, [boardData?.myMembership?.sectionCode]);

  async function leaveBoard() {
    setBoardMessage("");
    const result = await api(`/api/boards/${boardId}/leave`, { method: "DELETE" });
    setBoardMessage(result?.message ?? "已离开这个 Course Board。");
    setRefresh((value) => value + 1);
  }

  async function changeSection(event: FormEvent) {
    event.preventDefault();
    const result = await api(`/api/boards/${boardId}/membership-section`, { method: "PATCH", body: JSON.stringify({ sectionCode }) });
    setBoardMessage(result?.message ?? "已更新 section。");
    setRefresh((value) => value + 1);
  }

  async function createPost(event: FormEvent) {
    event.preventDefault();
    const result = await api(`/api/boards/${boardId}/teamaking-posts`, { method: "POST", body: JSON.stringify({ ...postForm, sectionCode }) });
    setBoardMessage(result?.message ?? "Teamaking Post 已发布；你已参与这个 Course Board。");
    setRefresh((value) => value + 1);
  }

  return (
    <PageShell title={board?.title ?? "Course Board"} eyebrow="Course Board" description="Open to Team 是协作信号；发布 Post 或发送 TeamUp 后才会进入 Course People。" descriptionCopyKey="board.page.description">
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
                <h2 className="text-2xl font-semibold text-ink">
                  {course?.id ? <Link href={`/courses/${course.id}`} className="underline decoration-ink/20 underline-offset-4 hover:text-coral">{course?.title}</Link> : course?.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-ink/68">
                  开放时间：{board.openFrom ? new Date(board.openFrom).toLocaleDateString() : "当前学期开放"} - {board.openUntil ? new Date(board.openUntil).toLocaleDateString() : "学期结束前"}
                </p>
                <p className="mt-2 text-sm text-ink/58">当前平台成员：{boardData.memberCount}</p>
              </div>
              {boardData.isJoined ? (
                <button onClick={leaveBoard} className="focus-ring rounded-sm bg-ink px-4 py-2 font-semibold text-white">
                  Leave Course Board
                </button>
              ) : (
                <div className="max-w-xs border border-ink/20 bg-paper px-3 py-2 text-sm leading-6 text-ink/62">
                  浏览不会加入；发布 Post 或发送 TeamUp 后才会显示在 Course People。
                </div>
              )}
            </div>
            <form onSubmit={boardData.isJoined ? changeSection : (event) => event.preventDefault()} className="mt-5 grid gap-3 border border-ink/15 bg-paper p-4">
              <div>
                <p className="text-sm font-semibold text-ink">Section / 班级</p>
                <p className="mt-1 text-xs leading-5 text-ink/58">
                  输入 10xx 格式的 section 编号。如果这门课没有多个 section/班级，默认使用 1001。创建 Post 时会用这个 section；已经参与后可继续更新。
                </p>
              </div>
              {sections.length ? (
                <div className="flex flex-wrap gap-2">
                  {sections.map((section: any) => (
                    <button
                      key={section.code}
                      type="button"
                      onClick={() => setSectionCode(section.code)}
                      className={`rounded-sm border px-3 py-1.5 text-sm font-semibold ${sectionCode === section.code ? "border-ink bg-ink text-paper" : "border-ink/25 bg-chalk text-ink"}`}
                    >
                      {section.code} · {section.memberCount ?? 0}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="grid gap-2 md:grid-cols-[180px_auto]">
                <CopyTarget copyKey="board.section.placeholder"><input className={inputClass} value={sectionCode} maxLength={4} onChange={(event) => setSectionCode(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder={sectionPlaceholder} /></CopyTarget>
                {boardData.isJoined ? (
                  <button className="w-fit rounded-sm border border-ink/40 px-4 py-2 text-sm font-semibold">
                    Update section
                  </button>
                ) : (
                  <p className="self-center text-xs leading-5 text-ink/52">这个 section 会在你发布 Post 后写入 Course People。</p>
                )}
              </div>
            </form>
            {boardMessage ? (
              <div className="mt-4 border border-ink/20 bg-paper px-3 py-2 text-sm text-ink/68">
                <span>{boardMessage}</span>
                {boardMessage.includes("course_config_error") ? (
                  <Link href="/support" className="ml-2 font-semibold text-coral">提交配置错误工单</Link>
                ) : null}
              </div>
            ) : null}
          </Card>
          <Card>
            <h2 className="text-xl font-semibold text-ink">Create Teamaking Post</h2>
            {!boardData.isJoined ? (
              <p className="mt-2 text-sm leading-6 text-ink/62">
                发布后才会算作参与这个 Course Board，并出现在 Dashboard 的当前课程板和 Course People 中。
              </p>
            ) : null}
            <form onSubmit={createPost} className="mt-4 grid gap-4">
              <Field label="标题" labelCopyKey="board.post.title.label">
                <input className={inputClass} value={postForm.title} onChange={(event) => setPostForm({ ...postForm, title: event.target.value })} />
              </Field>
              <Field label="Strengths">
                <ToggleGroup values={strengths} selected={postForm.strengths} onChange={(values) => setPostForm({ ...postForm, strengths: values })} />
              </Field>
              <Field label="Contribution types">
                <ToggleGroup values={contributionTypes} selected={postForm.contributionTypes} onChange={(values) => setPostForm({ ...postForm, contributionTypes: values })} />
              </Field>
              <Field label="Expected outcome" labelCopyKey="board.post.outcome.label">
                <CopyTarget copyKey="board.post.outcome.placeholder"><textarea className={inputClass} rows={3} value={postForm.expectedOutcome} onChange={(event) => setPostForm({ ...postForm, expectedOutcome: event.target.value })} placeholder={outcomePlaceholder} /></CopyTarget>
              </Field>
              <Field label="Visibility">
                <select className={inputClass} value={postForm.visibility} onChange={(event) => setPostForm({ ...postForm, visibility: event.target.value })}>
                  <option value="same_course_board">同一 Course Board 可见</option>
                  <option value="same_school">同校可见</option>
                </select>
              </Field>
              <button className="focus-ring inline-flex w-fit items-center gap-2 rounded-sm bg-coral px-4 py-2 font-semibold text-white">
                <Plus size={16} aria-hidden />
                Create Teamaking Post
              </button>
            </form>
          </Card>
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
            <div className="grid gap-4">
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setSectionFilter("all")} className={`rounded-sm px-3 py-2 text-sm font-semibold ${sectionFilter === "all" ? "bg-ink text-paper" : "border border-ink/30"}`}>All sections</button>
                {sections.map((section: any) => (
                  <button key={section.code} onClick={() => setSectionFilter(section.code)} className={`rounded-sm px-3 py-2 text-sm font-semibold ${sectionFilter === section.code ? "bg-ink text-paper" : "border border-ink/30"}`}>
                    {section.code} · {section.memberCount ?? 0}
                  </button>
                ))}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {visiblePeople.map((item: any) => (
                  <div key={item.id} className="grid gap-2">
                    <ProfileCard user={item.user} />
                    <span className="w-fit border border-ink/20 bg-chalk px-2 py-1 text-xs font-semibold text-ink/62">Section {item.sectionCode ?? "未选择"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </PageShell>
  );
}

export function TeamakingPostPage({ postId }: { postId: string }) {
  const [refresh, setRefresh] = useState(0);
  const { data: me } = useApi("/api/auth/me");
  const { data, error, loading } = useApi(`/api/teamaking-posts/${postId}`, [refresh]);
  const [form, setForm] = useState({ message: "", senderContribution: "" });
  const [message, setMessage] = useState("");
  const post = data?.post;
  const isOwnPost = Boolean(me?.user?.id && post?.userId === me.user.id);
  const { data: interests } = useApi(isOwnPost ? `/api/teamaking-posts/${postId}/interests` : null, [refresh, isOwnPost, postId]);

  async function teamUp(event: FormEvent) {
    event.preventDefault();
    const result = await api(`/api/teamaking-posts/${postId}/team-up`, { method: "POST", body: JSON.stringify(form) });
    setMessage(result.existing ? "你已经发送过 TeamUp Interest；这个课程板会继续显示在当前课程板中。" : "TeamUp Interest 已发送；你现在会进入这个课程板的 Course People。");
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
            {isOwnPost ? (
              <p className="mt-4 border border-ink/20 bg-paper px-3 py-2 text-sm text-ink/68">这是你自己发布的 Teamaking Post，不能给自己发送 TeamUp Interest。</p>
            ) : (
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
            )}
            {message ? <p className="mt-3 text-sm font-medium text-moss">{message}</p> : null}
          </Card>
          {isOwnPost ? (
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
          ) : null}
        </div>
      ) : null}
    </PageShell>
  );
}
