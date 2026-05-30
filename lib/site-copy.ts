import { defaultOnboardingGuide } from "@/lib/onboarding-guide";
import type { Locale } from "@/lib/i18n";

export type SiteCopyLocale = "zh" | "en";
export type SiteCopyValue = Partial<Record<SiteCopyLocale, string>>;
export type SiteCopyValues = Record<string, SiteCopyValue>;

export type SiteCopyKind =
  | "page"
  | "section"
  | "card"
  | "label"
  | "placeholder"
  | "button"
  | "empty"
  | "tour"
  | "notice";

export type SiteCopyEntry = {
  key: string;
  route: string;
  group: string;
  label: string;
  kind: SiteCopyKind;
  defaultValue: Required<SiteCopyValue>;
  maxLength: number;
};

const maxLengthByKind: Record<SiteCopyKind, number> = {
  page: 220,
  section: 180,
  card: 420,
  label: 120,
  placeholder: 180,
  button: 120,
  empty: 420,
  tour: 520,
  notice: 520
};

function zh(value: string) {
  return value;
}

function en(value: string) {
  return value;
}

function entry(input: Omit<SiteCopyEntry, "maxLength"> & { maxLength?: number }): SiteCopyEntry {
  return {
    ...input,
    maxLength: input.maxLength ?? maxLengthByKind[input.kind]
  };
}

const onboardingTourEntries = defaultOnboardingGuide.steps.flatMap((step) => [
  entry({
    key: `onboarding.tour.${step.id}.title`,
    route: step.route,
    group: "Onboarding Tour",
    label: `${step.id} title`,
    kind: "tour",
    defaultValue: { zh: step.title, en: step.title }
  }),
  entry({
    key: `onboarding.tour.${step.id}.body`,
    route: step.route,
    group: "Onboarding Tour",
    label: `${step.id} body`,
    kind: "tour",
    defaultValue: { zh: step.body, en: step.body }
  })
]);

export const siteCopyEntries: SiteCopyEntry[] = [
  entry({
    key: "landing.hero.eyebrow",
    route: "/",
    group: "Landing",
    label: "Landing eyebrow",
    kind: "page",
    defaultValue: { zh: zh("Proof-of-Work Profile + Course Boards"), en: en("Proof-of-Work Profile + Course Boards") }
  }),
  entry({
    key: "landing.hero.title",
    route: "/",
    group: "Landing",
    label: "Landing title",
    kind: "page",
    defaultValue: { zh: zh("TEAMAKING"), en: en("TEAMAKING") }
  }),
  entry({
    key: "landing.hero.tagline",
    route: "/",
    group: "Landing",
    label: "Landing tagline",
    kind: "page",
    defaultValue: { zh: zh("Your work speaks before you team up."), en: en("Your work speaks before you team up.") }
  }),
  entry({
    key: "landing.hero.subtitle",
    route: "/",
    group: "Landing",
    label: "Landing subtitle",
    kind: "page",
    defaultValue: { zh: zh("让认真做事的人，先被看见。"), en: en("Let serious work be seen before people team up.") }
  }),
  entry({
    key: "landing.cta.login",
    route: "/",
    group: "Landing",
    label: "Start CTA",
    kind: "button",
    defaultValue: { zh: zh("用学校邮箱开始"), en: en("Start with school email") }
  }),
  entry({
    key: "landing.cta.demo",
    route: "/",
    group: "Landing",
    label: "Demo CTA",
    kind: "button",
    defaultValue: { zh: zh("进入演示验收"), en: en("Enter demo review") }
  }),
  entry({
    key: "landing.cta.contact",
    route: "/",
    group: "Landing",
    label: "Contact CTA",
    kind: "button",
    defaultValue: { zh: zh("联系开发者"), en: en("Contact developer") }
  }),
  entry({
    key: "landing.panel.eyebrow",
    route: "/",
    group: "Landing",
    label: "Landing panel eyebrow",
    kind: "section",
    defaultValue: { zh: zh("What TEAMAKING is for"), en: en("What TEAMAKING is for") }
  }),
  entry({
    key: "landing.panel.title",
    route: "/",
    group: "Landing",
    label: "Landing panel title",
    kind: "section",
    defaultValue: { zh: zh("把课程协作信号放到同一个地方"), en: en("Put course collaboration signals in one place") }
  }),
  entry({
    key: "landing.feature.profile.title",
    route: "/",
    group: "Landing",
    label: "Profile feature title",
    kind: "card",
    defaultValue: { zh: zh("展示个人成果"), en: en("Show real work") }
  }),
  entry({
    key: "landing.feature.profile.body",
    route: "/",
    group: "Landing",
    label: "Profile feature body",
    kind: "card",
    defaultValue: { zh: zh("用作品、证书、简历摘要和联系方式，让同学先看到你真实做过什么。"), en: en("Use work, certificates, resume summaries, and contact settings so classmates can see what you have actually done.") }
  }),
  entry({
    key: "landing.feature.team.title",
    route: "/",
    group: "Landing",
    label: "Team feature title",
    kind: "card",
    defaultValue: { zh: zh("按目标成绩找组员"), en: en("Find teammates by target outcome") }
  }),
  entry({
    key: "landing.feature.team.body",
    route: "/",
    group: "Landing",
    label: "Team feature body",
    kind: "card",
    defaultValue: { zh: zh("在课程板里说明你希望冲 A / A- / B+，或只求稳过，匹配节奏相近的小组作业伙伴。"), en: en("Use Course Boards to explain whether you are aiming for A, A-, B+, or a steady pass, then find classmates with similar pace.") }
  }),
  entry({
    key: "landing.feature.course.title",
    route: "/",
    group: "Landing",
    label: "Course feature title",
    kind: "card",
    defaultValue: { zh: zh("讨论课程内容"), en: en("Discuss course work") }
  }),
  entry({
    key: "landing.feature.course.body",
    route: "/",
    group: "Landing",
    label: "Course feature body",
    kind: "card",
    defaultValue: { zh: zh("围绕真实课程发帖、评价课程、整理经验，减少只靠群聊找信息的混乱。"), en: en("Post around real courses, review course work, and collect experience instead of relying only on scattered group chats.") }
  }),

  entry({
    key: "login.page.title",
    route: "/login",
    group: "Authentication",
    label: "Login page title",
    kind: "page",
    defaultValue: { zh: zh("测试环境入口"), en: en("Testing Environment Entry") }
  }),
  entry({
    key: "login.page.description",
    route: "/login",
    group: "Authentication",
    label: "Login page description",
    kind: "page",
    defaultValue: { zh: zh("测试环境账号会被保存，便于你重复登录、编辑资料、上传作品和继续测试；正式上线前可能统一清理测试数据。"), en: en("Testing accounts are saved so you can log in again, edit profiles, upload work, and keep testing. Test data may be cleared before launch.") }
  }),
  entry({
    key: "login.email.label",
    route: "/login",
    group: "Authentication",
    label: "School email label",
    kind: "label",
    defaultValue: { zh: zh("学校邮箱"), en: en("School email") }
  }),
  entry({
    key: "login.email.placeholder",
    route: "/login",
    group: "Authentication",
    label: "School email placeholder",
    kind: "placeholder",
    defaultValue: { zh: zh("your.name@mail.bnbu.edu.cn"), en: en("your.name@mail.bnbu.edu.cn") }
  }),
  entry({
    key: "login.password.label",
    route: "/login",
    group: "Authentication",
    label: "Password label",
    kind: "label",
    defaultValue: { zh: zh("密码"), en: en("Password") }
  }),
  entry({
    key: "login.password.placeholder",
    route: "/login",
    group: "Authentication",
    label: "Password placeholder",
    kind: "placeholder",
    defaultValue: { zh: zh("输入密码"), en: en("Enter password") }
  }),
  entry({
    key: "login.submit",
    route: "/login",
    group: "Authentication",
    label: "Login submit",
    kind: "button",
    defaultValue: { zh: zh("登录"), en: en("Log in") }
  }),
  entry({
    key: "demo.page.title",
    route: "/demo-access",
    group: "Demo Access",
    label: "Demo page title",
    kind: "page",
    defaultValue: { zh: zh("演示验收入口"), en: en("Demo Review Entry") }
  }),
  entry({
    key: "demo.page.description",
    route: "/demo-access",
    group: "Demo Access",
    label: "Demo page description",
    kind: "page",
    defaultValue: { zh: zh("这个入口只用于本地和验收环境，绕过邮箱验证码，帮助你直接检查业务逻辑与前端展示。"), en: en("This entry is only for local and review environments. It bypasses email verification so you can inspect flows and UI directly.") }
  }),

  entry({
    key: "onboarding.page.title",
    route: "/onboarding",
    group: "Onboarding",
    label: "Onboarding page title",
    kind: "page",
    defaultValue: { zh: zh("完成基础引导"), en: en("Complete Basic Onboarding") }
  }),
  entry({
    key: "onboarding.page.description",
    route: "/onboarding",
    group: "Onboarding",
    label: "Onboarding page description",
    kind: "page",
    defaultValue: { zh: zh("这里不会验证官方选课，只用来帮助系统推荐课程板，并让同学理解你的协作背景。"), en: en("This does not verify official enrollment. It helps TEAMAKING recommend Course Boards and explain your collaboration context.") }
  }),
  entry({
    key: "onboarding.use.title",
    route: "/onboarding",
    group: "Onboarding",
    label: "How to use title",
    kind: "section",
    defaultValue: { zh: zh("TEAMAKING 使用方式"), en: en("How TEAMAKING Works") }
  }),
  entry({
    key: "onboarding.field.displayName",
    route: "/onboarding",
    group: "Onboarding",
    label: "Display name field",
    kind: "label",
    defaultValue: { zh: zh("显示名称"), en: en("Display name") }
  }),
  entry({
    key: "onboarding.field.grade",
    route: "/onboarding",
    group: "Onboarding",
    label: "Academic year field",
    kind: "label",
    defaultValue: { zh: zh("年级 / Academic Year"), en: en("Academic year") }
  }),
  entry({
    key: "onboarding.field.entryYear",
    route: "/onboarding",
    group: "Onboarding",
    label: "Entry year field",
    kind: "label",
    defaultValue: { zh: zh("入学年份 / Entry Year"), en: en("Entry year") }
  }),
  entry({
    key: "onboarding.field.entryTerm",
    route: "/onboarding",
    group: "Onboarding",
    label: "Entry term field",
    kind: "label",
    defaultValue: { zh: zh("入学学期 / Entry Term"), en: en("Entry term") }
  }),
  entry({
    key: "onboarding.field.faculty",
    route: "/onboarding",
    group: "Onboarding",
    label: "Faculty field",
    kind: "label",
    defaultValue: { zh: zh("Faculty / College"), en: en("Faculty / College") }
  }),
  entry({
    key: "onboarding.field.major",
    route: "/onboarding",
    group: "Onboarding",
    label: "Major field",
    kind: "label",
    defaultValue: { zh: zh("Major"), en: en("Major") }
  }),
  entry({
    key: "onboarding.submit",
    route: "/onboarding",
    group: "Onboarding",
    label: "Onboarding submit",
    kind: "button",
    defaultValue: { zh: zh("保存并进入 Dashboard"), en: en("Save and Enter Dashboard") }
  }),
  entry({
    key: "onboarding.tour.action.skip",
    route: "*",
    group: "Onboarding Tour",
    label: "Tour skip button",
    kind: "button",
    defaultValue: { zh: zh("跳过"), en: en("Skip") }
  }),
  entry({
    key: "onboarding.tour.action.previous",
    route: "*",
    group: "Onboarding Tour",
    label: "Tour previous button",
    kind: "button",
    defaultValue: { zh: zh("上一步"), en: en("Previous") }
  }),
  entry({
    key: "onboarding.tour.action.next",
    route: "*",
    group: "Onboarding Tour",
    label: "Tour next button",
    kind: "button",
    defaultValue: { zh: zh("下一步"), en: en("Next") }
  }),
  entry({
    key: "onboarding.tour.action.done",
    route: "*",
    group: "Onboarding Tour",
    label: "Tour done button",
    kind: "button",
    defaultValue: { zh: zh("完成"), en: en("Done") }
  }),

  entry({
    key: "dashboard.page.title",
    route: "/dashboard",
    group: "Dashboard",
    label: "Dashboard title",
    kind: "page",
    defaultValue: { zh: zh("Dashboard"), en: en("Dashboard") }
  }),
  entry({
    key: "dashboard.page.description",
    route: "/dashboard",
    group: "Dashboard",
    label: "Dashboard description",
    kind: "page",
    defaultValue: { zh: zh("这里集中显示推荐课程、近期 Open to Team 信号、资料完整度和 Team Up 请求。"), en: en("This page brings together recommended courses, recent Open to Team signals, profile completeness, and TeamUp requests.") }
  }),
  entry({
    key: "dashboard.profile.title",
    route: "/dashboard",
    group: "Dashboard",
    label: "Profile completion card title",
    kind: "card",
    defaultValue: { zh: zh("Profile completion"), en: en("Profile completion") }
  }),
  entry({
    key: "dashboard.profile.body",
    route: "/dashboard",
    group: "Dashboard",
    label: "Profile completion card body",
    kind: "card",
    defaultValue: { zh: zh("完善 portfolio 和联系方式后，协作信号会更可信。"), en: en("Complete your portfolio and contact settings so collaboration signals feel more trustworthy.") }
  }),
  entry({
    key: "dashboard.teamup.title",
    route: "/dashboard",
    group: "Dashboard",
    label: "TeamUp reminder card title",
    kind: "card",
    defaultValue: { zh: zh("TeamUp Interest reminders"), en: en("TeamUp Interest reminders") }
  }),
  entry({
    key: "dashboard.quickLinks.title",
    route: "/dashboard",
    group: "Dashboard",
    label: "Quick links title",
    kind: "card",
    defaultValue: { zh: zh("Quick links"), en: en("Quick links") }
  }),
  entry({
    key: "dashboard.currentBoards.title",
    route: "/dashboard",
    group: "Dashboard",
    label: "Current Course Boards heading",
    kind: "section",
    defaultValue: { zh: zh("My current Course Boards"), en: en("My current Course Boards") }
  }),
  entry({
    key: "dashboard.recommended.title",
    route: "/dashboard",
    group: "Dashboard",
    label: "Recommended courses heading",
    kind: "section",
    defaultValue: { zh: zh("Recommended courses"), en: en("Recommended courses") }
  }),
  entry({
    key: "dashboard.recentPosts.title",
    route: "/dashboard",
    group: "Dashboard",
    label: "Recent posts heading",
    kind: "section",
    defaultValue: { zh: zh("Recent Open to Team posts"), en: en("Recent Open to Team posts") }
  }),

  entry({
    key: "courses.page.title",
    route: "/courses",
    group: "Course Boards",
    label: "Courses title",
    kind: "page",
    defaultValue: { zh: zh("Course Boards"), en: en("Course Boards") }
  }),
  entry({
    key: "courses.page.eyebrow",
    route: "/courses",
    group: "Course Boards",
    label: "Courses eyebrow",
    kind: "page",
    defaultValue: { zh: zh("Courses"), en: en("Courses") }
  }),
  entry({
    key: "courses.page.description",
    route: "/courses",
    group: "Course Boards",
    label: "Courses description",
    kind: "page",
    defaultValue: { zh: zh("浏览课程板；只有在某课程下发布 Post 或发送 TeamUp 后，才算参与这个 Course Board。"), en: en("Browse Course Boards. You only participate after posting under a course or sending TeamUp for that course.") }
  }),
  entry({
    key: "courses.tab.recommended",
    route: "/courses",
    group: "Course Boards",
    label: "Recommended tab",
    kind: "button",
    defaultValue: { zh: zh("Recommended"), en: en("Recommended") }
  }),
  entry({
    key: "courses.tab.mine",
    route: "/courses",
    group: "Course Boards",
    label: "My courses tab",
    kind: "button",
    defaultValue: { zh: zh("我的课程"), en: en("My courses") }
  }),
  entry({
    key: "courses.tab.search",
    route: "/courses",
    group: "Course Boards",
    label: "Search tab",
    kind: "button",
    defaultValue: { zh: zh("Search / Free elective"), en: en("Search / Free elective") }
  }),
  entry({
    key: "courses.search.note",
    route: "/courses",
    group: "Course Boards",
    label: "Course search note",
    kind: "notice",
    defaultValue: { zh: zh("只有发布 Teamaking Post 或发送 TeamUp Interest 后，课程板才会进入“我的课程”；只浏览不会加入。"), en: en("A Course Board enters My courses only after you publish a Teamaking Post or send TeamUp Interest. Browsing alone does not join it.") }
  }),
  entry({
    key: "courses.search.placeholder",
    route: "/courses",
    group: "Course Boards",
    label: "Course search placeholder",
    kind: "placeholder",
    defaultValue: { zh: zh("搜索课程代码或课程名称，例如 COM3003；free elective 可直接打开课程板"), en: en("Search course code or title, e.g. COM3003; free elective can open a Course Board directly") }
  }),
  entry({
    key: "courses.search.resultLabel",
    route: "/courses",
    group: "Course Boards",
    label: "Search result label",
    kind: "section",
    defaultValue: { zh: zh("Recommended by match score"), en: en("Recommended by match score") }
  }),
  entry({
    key: "courses.recommended.title",
    route: "/courses",
    group: "Course Boards",
    label: "Recommended courses heading",
    kind: "section",
    defaultValue: { zh: zh("Recommended courses"), en: en("Recommended courses") }
  }),
  entry({
    key: "courses.mine.title",
    route: "/courses",
    group: "Course Boards",
    label: "My courses heading",
    kind: "section",
    defaultValue: { zh: zh("我的课程"), en: en("My courses") }
  }),
  entry({
    key: "courses.empty.search.title",
    route: "/courses",
    group: "Course Boards",
    label: "No course search result title",
    kind: "empty",
    defaultValue: { zh: zh("没有找到匹配课程"), en: en("No matching courses") }
  }),
  entry({
    key: "courses.empty.search.body",
    route: "/courses",
    group: "Course Boards",
    label: "No course search result body",
    kind: "empty",
    defaultValue: { zh: zh("可以换一个课程代码、英文关键词，或通过右下角工单提交缺失课程。"), en: en("Try another course code or English keyword, or submit a missing-course ticket from the lower-right support entry.") }
  }),
  entry({
    key: "courses.empty.mine.title",
    route: "/courses",
    group: "Course Boards",
    label: "No my courses title",
    kind: "empty",
    defaultValue: { zh: zh("还没有参与中的课程板"), en: en("No active Course Boards yet") }
  }),
  entry({
    key: "courses.empty.mine.body",
    route: "/courses",
    group: "Course Boards",
    label: "No my courses body",
    kind: "empty",
    defaultValue: { zh: zh("打开课程板后，发布 Teamaking Post 或对某条 Post 发送 TeamUp，才会出现在这里。"), en: en("Open a Course Board, then publish a Teamaking Post or send TeamUp to a post for it to appear here.") }
  }),
  entry({
    key: "courses.missing.title",
    route: "/courses",
    group: "Course Boards",
    label: "Missing course card title",
    kind: "card",
    defaultValue: { zh: zh("缺失课程 / bug / 报错"), en: en("Missing course / bug / error") }
  }),
  entry({
    key: "courses.missing.body",
    route: "/courses",
    group: "Course Boards",
    label: "Missing course card body",
    kind: "card",
    defaultValue: { zh: zh("缺失课程不再走复杂审核机制。请直接提交工单，管理员会私下确认并处理。"), en: en("Missing courses no longer use a complex review flow. Submit a ticket and an admin will check and handle it.") }
  }),
  entry({
    key: "courses.missing.submit",
    route: "/courses",
    group: "Course Boards",
    label: "Submit ticket button",
    kind: "button",
    defaultValue: { zh: zh("提交工单"), en: en("Submit ticket") }
  }),

  entry({
    key: "officialLinks.eyebrow",
    route: "/courses",
    group: "Official References",
    label: "Official references eyebrow",
    kind: "section",
    defaultValue: { zh: zh("Official references"), en: en("Official references") }
  }),
  entry({
    key: "officialLinks.title",
    route: "/courses",
    group: "Official References",
    label: "Official references title",
    kind: "section",
    defaultValue: { zh: zh("官方查询入口"), en: en("Official reference links") }
  }),
  entry({
    key: "officialLinks.description",
    route: "/courses",
    group: "Official References",
    label: "Official references description",
    kind: "notice",
    defaultValue: { zh: zh("TEAMAKING 的 Course Board 是平台内协作入口；专业介绍、官方四年安排和真实选课请以学校网站与 MIS 为准。"), en: en("TEAMAKING Course Boards are in-app collaboration entries. For programme information, official four-year plans, and real enrollment, use school websites and MIS.") }
  }),
  entry({
    key: "officialLinks.programme.label",
    route: "/courses",
    group: "Official References",
    label: "Programme link label",
    kind: "label",
    defaultValue: { zh: zh("BNBU 专业介绍"), en: en("BNBU programme introduction") }
  }),
  entry({
    key: "officialLinks.handbook.label",
    route: "/courses",
    group: "Official References",
    label: "Handbook link label",
    kind: "label",
    defaultValue: { zh: zh("AR 官方四年课程安排"), en: en("AR official four-year curriculum") }
  }),
  entry({
    key: "officialLinks.mis.label",
    route: "/courses",
    group: "Official References",
    label: "MIS link label",
    kind: "label",
    defaultValue: { zh: zh("MIS 本学期真实选课 / 课表"), en: en("MIS real enrollment / timetable") }
  }),

  entry({
    key: "courseDetail.page.description",
    route: "/courses/[courseId]",
    group: "Course Detail",
    label: "Course detail description",
    kind: "page",
    defaultValue: { zh: zh("课程详情、开课学期和对应 Course Board。"), en: en("Course details, available semesters, and related Course Boards.") }
  }),
  entry({
    key: "board.page.description",
    route: "/boards/[boardId]",
    group: "Course Board",
    label: "Board page description",
    kind: "page",
    defaultValue: { zh: zh("Open to Team 是协作信号；发布 Post 或发送 TeamUp 后才会进入 Course People。"), en: en("Open to Team is a collaboration signal. You enter Course People after publishing a post or sending TeamUp.") }
  }),
  entry({
    key: "board.section.placeholder",
    route: "/boards/[boardId]",
    group: "Course Board",
    label: "Section placeholder",
    kind: "placeholder",
    defaultValue: { zh: zh("1001"), en: en("1001") }
  }),
  entry({
    key: "board.post.title.label",
    route: "/boards/[boardId]",
    group: "Course Board",
    label: "Post title field label",
    kind: "label",
    defaultValue: { zh: zh("标题"), en: en("Title") }
  }),
  entry({
    key: "board.post.outcome.label",
    route: "/boards/[boardId]",
    group: "Course Board",
    label: "Expected outcome label",
    kind: "label",
    defaultValue: { zh: zh("Expected outcome"), en: en("Expected outcome") }
  }),
  entry({
    key: "board.post.outcome.placeholder",
    route: "/boards/[boardId]",
    group: "Course Board",
    label: "Expected outcome placeholder",
    kind: "placeholder",
    defaultValue: { zh: zh("A polished report with strong argumentation and clean slides."), en: en("A polished report with strong argumentation and clean slides.") }
  }),

  entry({
    key: "teamup.page.title",
    route: "/team-up-requests",
    group: "TeamUp",
    label: "TeamUp menu title",
    kind: "page",
    defaultValue: { zh: zh("TeamUp Menu"), en: en("TeamUp Menu") }
  }),
  entry({
    key: "teamup.page.description",
    route: "/team-up-requests",
    group: "TeamUp",
    label: "TeamUp menu description",
    kind: "page",
    defaultValue: { zh: zh("这里只显示发给你发布的 Teamaking Posts 的 TeamUp Interest 提醒；查看详情会把 sent 自动推进为 viewed。"), en: en("This page only shows TeamUp Interest reminders for Teamaking Posts you published. Opening details moves sent to viewed.") }
  }),
  entry({
    key: "inbox.page.title",
    route: "/inbox",
    group: "Social",
    label: "Inbox title",
    kind: "page",
    defaultValue: { zh: zh("Inbox"), en: en("Inbox") }
  }),
  entry({
    key: "friends.page.title",
    route: "/friends",
    group: "Social",
    label: "Friends title",
    kind: "page",
    defaultValue: { zh: zh("Friends"), en: en("Friends") }
  }),
  entry({
    key: "friends.search.placeholder",
    route: "/friends",
    group: "Social",
    label: "Friends search placeholder",
    kind: "placeholder",
    defaultValue: { zh: zh("搜索姓名、邮箱、专业、年级"), en: en("Search name, email, major, or year") }
  }),
  entry({
    key: "matches.page.title",
    route: "/matches",
    group: "Social",
    label: "Matches title",
    kind: "page",
    defaultValue: { zh: zh("Matches"), en: en("Matches") }
  }),
  entry({
    key: "matches.page.description",
    route: "/matches",
    group: "Social",
    label: "Matches description",
    kind: "page",
    defaultValue: { zh: zh("优先推荐同一课程记录、二度/三度好友网络；同专业和同校开放展示只作为补充排序，不再显示为标签。"), en: en("Prioritizes shared course records and second/third-degree networks. Same-major and same-school visibility only supplement ranking.") }
  }),

  entry({
    key: "contactInfo.page.title",
    route: "/contact-info",
    group: "Contact Info",
    label: "Contact info title",
    kind: "page",
    defaultValue: { zh: zh("Contact Info"), en: en("Contact Info") }
  }),
  entry({
    key: "contactInfo.page.description",
    route: "/contact-info",
    group: "Contact Info",
    label: "Contact info description",
    kind: "page",
    defaultValue: { zh: zh("联系方式可以按可见范围展示。学校邮箱只读，用来证明身份真实性。"), en: en("Contact information can be shown by visibility level. School email is read-only and proves identity.") }
  }),
  entry({
    key: "support.page.title",
    route: "/support",
    group: "Support",
    label: "Support title",
    kind: "page",
    defaultValue: { zh: zh("Support Ticket"), en: en("Support Ticket") }
  }),
  entry({
    key: "support.page.description",
    route: "/support",
    group: "Support",
    label: "Support description",
    kind: "page",
    defaultValue: { zh: zh("缺失课程、bug、报错、后台需求都走工单。这个入口替代原来的课程提交审核机制。"), en: en("Missing courses, bugs, errors, and admin requests all use tickets. This replaces the old course-submission review flow.") }
  }),
  entry({
    key: "support.email.label",
    route: "/support",
    group: "Support",
    label: "Support email label",
    kind: "label",
    defaultValue: { zh: zh("联系邮箱"), en: en("Contact email") }
  }),
  entry({
    key: "support.description.placeholder",
    route: "/support",
    group: "Support",
    label: "Support description placeholder",
    kind: "placeholder",
    defaultValue: { zh: zh("请描述问题或需求"), en: en("Describe the problem or request") }
  }),
  entry({
    key: "support.widget.placeholder",
    route: "*",
    group: "Support Widget",
    label: "Support widget placeholder",
    kind: "placeholder",
    defaultValue: { zh: zh("请描述问题或需求"), en: en("Describe the issue or request") }
  }),

  entry({
    key: "profileEditor.page.title",
    route: "/profile/me",
    group: "Profile",
    label: "Profile editor title",
    kind: "page",
    defaultValue: { zh: zh("Proof-of-Work Profile"), en: en("Proof-of-Work Profile") }
  }),
  entry({
    key: "profileEditor.page.description",
    route: "/profile/me",
    group: "Profile",
    label: "Profile editor description",
    kind: "page",
    defaultValue: { zh: zh("编辑个人展示页：联系方式、头像背景、技能标签、作品证明、GPA 截图、证书和简历解析都在这里维护。"), en: en("Edit your public profile: contact settings, avatar, background, skill tags, work evidence, GPA screenshots, certificates, and resume analysis.") }
  }),
  entry({
    key: "profileEditor.displayName.label",
    route: "/profile/me",
    group: "Profile",
    label: "Display name label",
    kind: "label",
    defaultValue: { zh: zh("显示名称"), en: en("Display name") }
  }),
  entry({
    key: "profileEditor.nickname.label",
    route: "/profile/me",
    group: "Profile",
    label: "Nickname label",
    kind: "label",
    defaultValue: { zh: zh("昵称 / 别名"), en: en("Nickname / alias") }
  }),
  entry({
    key: "profileEditor.nickname.placeholder",
    route: "/profile/me",
    group: "Profile",
    label: "Nickname placeholder",
    kind: "placeholder",
    defaultValue: { zh: zh("例如 Mia / slides person"), en: en("e.g. Mia / slides person") }
  }),
  entry({
    key: "profileEditor.headline.label",
    route: "/profile/me",
    group: "Profile",
    label: "Headline label",
    kind: "label",
    defaultValue: { zh: zh("一句话定位"), en: en("One-line positioning") }
  }),
  entry({
    key: "profileEditor.headline.placeholder",
    route: "/profile/me",
    group: "Profile",
    label: "Headline placeholder",
    kind: "placeholder",
    defaultValue: { zh: zh("例如 Research and presentation collaborator"), en: en("e.g. Research and presentation collaborator") }
  }),
  entry({
    key: "profilePublic.page.description",
    route: "/profile/[userId]",
    group: "Profile",
    label: "Public profile description",
    kind: "page",
    defaultValue: { zh: zh("同校已验证用户可以查看对方允许展示的基础资料、联系方式和作品证明。"), en: en("Verified users from the same school can view visible profile basics, contact details, and work evidence.") }
  }),

  entry({
    key: "announcements.page.title",
    route: "/announcements",
    group: "Announcements",
    label: "Announcements title",
    kind: "page",
    defaultValue: { zh: zh("Announcements"), en: en("Announcements") }
  }),
  entry({
    key: "announcements.page.description",
    route: "/announcements",
    group: "Announcements",
    label: "Announcements description",
    kind: "page",
    defaultValue: { zh: zh("查看管理员发布给所有用户的公告历史。"), en: en("View the announcement history published by admins for all users.") }
  }),

  ...onboardingTourEntries
];

export const siteCopyEntryMap = new Map(siteCopyEntries.map((item) => [item.key, item]));

export const siteCopyDefaultValues: SiteCopyValues = Object.fromEntries(
  siteCopyEntries.map((item) => [item.key, item.defaultValue])
);

export function isSiteCopyLocale(value: string): value is SiteCopyLocale {
  return value === "zh" || value === "en";
}

export function normalizeSiteCopyValues(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = "values" in value && value.values && typeof value.values === "object" ? value.values : value;
  const normalized: SiteCopyValues = {};
  for (const [key, copyValue] of Object.entries(raw as Record<string, unknown>)) {
    const entryForKey = siteCopyEntryMap.get(key);
    if (!entryForKey || !copyValue || typeof copyValue !== "object" || Array.isArray(copyValue)) continue;
    const next: SiteCopyValue = {};
    for (const locale of ["zh", "en"] as const) {
      const text = (copyValue as Record<string, unknown>)[locale];
      if (typeof text !== "string") continue;
      const trimmed = text.trim();
      if (trimmed) next[locale] = trimmed.slice(0, entryForKey.maxLength);
    }
    if (next.zh || next.en) normalized[key] = next;
  }
  return normalized;
}

export function mergeSiteCopyValues(...sources: Array<SiteCopyValues | undefined | null>): SiteCopyValues {
  const merged: SiteCopyValues = {};
  for (const source of sources) {
    if (!source) continue;
    for (const [key, value] of Object.entries(source)) {
      const entryForKey = siteCopyEntryMap.get(key);
      if (!entryForKey) continue;
      merged[key] = {
        ...(merged[key] ?? {}),
        ...value
      };
    }
  }
  return merged;
}

export function siteCopyText(values: SiteCopyValues, key: string, fallback: string, locale: Locale) {
  const value = values[key];
  return value?.[locale] || value?.zh || value?.en || fallback;
}

export function changedSiteCopyKeys(left: SiteCopyValues, right: SiteCopyValues) {
  return siteCopyEntries
    .filter((entryForKey) => {
      const a = left[entryForKey.key] ?? {};
      const b = right[entryForKey.key] ?? {};
      return (a.zh ?? "") !== (b.zh ?? "") || (a.en ?? "") !== (b.en ?? "");
    })
    .map((entryForKey) => entryForKey.key);
}
