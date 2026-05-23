# TEAMAKING MVP

TEAMAKING 是一个面向大学课程协作的 teammate discovery 平台。它不是队长招募系统，也不创建正式 Team；MVP 的核心是：

- Proof-of-Work Profile：让同学先看到你实际做过什么。
- Course Boards：学生自己加入课程板，出现在 Course People 中。
- Open to Team Signals：在课程板里发布 Teamaking Post，表达自己愿意组队。
- TeamUp Interests：别人可以对某条 Teamaking Post 发送轻量兴趣表达，最终沟通主要在平台外完成。

## 开发者先读

任何开发者或 agent 接手本项目时，请先读：

1. `docs/INTERACTION_TERMS.md`：固定交互项专用名词，尤其是 Teamaking Post、TeamUp Interest、Inbox、Follow Request 的区别。
2. `PROJECT_LOG.md`：了解已做改动、验收记录、遗留问题和临时方案。
3. 本 README：启动方式、产品边界、API 摘要和检查命令。

Agent 开发原则：

- 需要依赖、插件或文档解析能力时，可以自行安装并更新依赖文件。
- 不确定的功能、权限或交互必须直接提问，不能靠臆测补需求。
- 不要增加用户未要求的冗余功能；确实需要新增时先确认。
- 每完成一个任务都要主动运行可行性验证，再汇报结果。
- 任何 schema、API、交互词汇变化都要同步更新 `docs/INTERACTION_TERMS.md` 和 `PROJECT_LOG.md`。

中文产品句子：

> Your work speaks before you team up.  
> 让认真做事的人，先被看见。

## 技术栈

- Frontend：Next.js App Router + React + TypeScript
- Styling：Tailwind CSS
- Backend/API：Next.js Route Handlers
- Database：PostgreSQL
- ORM：Prisma
- Auth：学校邮箱验证码登录；本地验收可使用 `/demo-access` 绕过验证码
- File upload：本地验收写入 `public/uploads`，数据库记录 `fileUrl/storageKey/mime/extension/metadata`；后续可替换为对象存储

## 本地启动

1. 安装依赖：

```bash
npm install
```

2. 准备 PostgreSQL，并修改 `.env`：

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/teamaking?schema=public"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
RESEND_API_KEY="re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
RESEND_FROM_EMAIL="TEAMAKING <verify@your-domain.com>"
RESEND_TEST_RECIPIENT_EMAIL=""
EMAIL_DEBUG_CODE_RESPONSE="false"
```

当前机器没有检测到 Docker，因此项目不默认提供 Docker 启动命令。你可以使用本机 PostgreSQL、学校服务器数据库或云数据库。

3. 生成 Prisma Client：

```bash
npm run prisma:generate
```

4. 创建数据库表：

```bash
npm run prisma:migrate -- --name init
```

5. 写入演示数据：

```bash
npm run seed
```

如果本机暂时没有 PostgreSQL，`/demo-access` 会退回本地视觉演示模式，仍可查看学生端、管理员端、Profile 上传预览等前端逻辑；真实数据写入仍需要 PostgreSQL。

6. 启动开发服务器：

```bash
npm run dev
```

打开 `http://localhost:3000`。

## 验收入口

### 演示验收模式

如果只验收业务逻辑和前端展示，也可以使用演示入口：

```text
http://localhost:3000/demo-access
```

可选择：

- `Media Student`：普通学生视角
- `CS Student`：跨专业学生视角
- `School Admin`：管理员视角

演示入口会直接设置本地 session，不需要邮箱验证码。生产环境默认关闭演示访问；如确需打开，需要设置：

```env
ENABLE_DEMO_ACCESS=true
```

### 正式邮箱路径

正式路径仍保留：

```text
http://localhost:3000/login
```

正式邮箱路径会通过 Resend 发送验证码。开发环境没有配置 `RESEND_API_KEY` 时，接口会把验证码返回给前端并自动填入，方便本地调试；生产环境必须配置 `RESEND_API_KEY` 和 `RESEND_FROM_EMAIL`。

没有自有域名时，可以在开发环境使用 Resend 测试发件地址 `TEAMAKING <onboarding@resend.dev>`。如果测试域名只能投递到 Resend 账号邮箱，可设置 `RESEND_TEST_RECIPIENT_EMAIL`：用户仍在登录页输入学校邮箱，验证码仍绑定这个学校邮箱，但邮件会投递到测试收件箱。

## Demo 账号

这些账号由 seed 创建，也可以通过 `/demo-access` 直接进入：

- `media.student@mail.bnbu.edu.cn`
- `cs.student@mail.bnbu.edu.cn`
- `business.admin@mail.bnbu.edu.cn`

其中 `business.admin@mail.bnbu.edu.cn` 是管理后台演示账号，可以进入 `/admin`。

## 核心流程

1. 用户进入 `/`。
2. 在 `/login` 输入学校邮箱。
3. 系统检查邮箱域名是否存在于 `SchoolEmailDomain`。
4. 系统创建验证码，并通过 Resend 发送到学校邮箱。
5. 用户输入验证码后登录，系统通过邮箱域名识别学校。
6. 首次用户进入 `/onboarding`，填写年级、Faculty、Major。
7. 用户在 `/courses` 查看推荐课程或搜索课程；未登录时只显示示例，不读取真实课程板或用户数据。
8. 用户加入 Course Board 后，会出现在该课程板的 Course People 中。
9. 用户可以在 `/boards/[boardId]` 创建 Teamaking Post。
10. 其他用户可以在 Teamaking Post 详情页点击 Team Up。
11. Team Up Request 状态可以按正向流程 `sent → viewed → mutual` 变化，也可以进入 `archived` 或 `reported`。

## 重要产品边界

MVP 明确不实现：

- 官方选课验证
- 学校网站爬虫
- AI matching
- Formal Team entity
- Team leader workflow
- Join team application workflow
- accepted / rejected 申请状态
- public rating system
- public negative reviews
- payment
- WeChat mini-program
- complex project management workspace
- 未登录用户查看真实 Course Board、Course People、Teamaking Post 或用户联系方式

MVP 保留 TODO 扩展点：

- crawler-based course sync
- AI recommendation
- WeChat mini-program
- richer contact methods
- advanced endorsement system
- file storage integration
- official school partnership integration

## 主要目录

```text
app/
  api/[...route]/route.ts       # 统一 API Route Handler
  demo-access/                  # 本地验收绕过邮箱验证码入口
  support/                      # 工单入口，处理 bug、报错、缺失课程等
  dashboard/                    # 学生 Dashboard
  profile/me/                   # 个人 Profile 编辑、上传和预览
  profile/[userId]/              # 公开 Profile 展示
  courses/                      # 课程搜索和详情
  boards/[boardId]/             # Course Board，两栏：Open to Team / Course People
  teamaking-posts/[postId]/     # Teamaking Post 详情和 Team Up
  team-up-requests/             # TeamUp Menu：发给我发布的 Post 的 TeamUp Interest
  inbox/                        # Follow Request 收件箱
  admin/                        # 管理后台
components/
  app-shell.tsx                 # 导航、页面布局、通用状态组件
  cards.tsx                     # CourseCard、ProfileCard、TeamakingPostCard 等
  client-pages.tsx              # 页面级客户端交互
lib/
  prisma.ts                     # Prisma Client 单例
  session.ts                    # HttpOnly cookie session
  contact.ts                    # 联系方式可见性逻辑
  constants.ts                  # 固定选项和状态流转
  profile-assets.ts             # Profile 文件后缀、预览类型、本地简历解析
prisma/
  schema.prisma                 # PostgreSQL 数据模型
  seed.ts                       # BNBU 演示数据
```

## API 摘要

认证：

- `POST /api/auth/send-code`
- `POST /api/auth/verify-code`
- `GET /api/auth/me`
- `POST /api/demo/login`

学生端：

- `GET /api/onboarding`
- `POST /api/onboarding`
- `GET /api/profile/me`
- `PATCH /api/profile/me`
- `POST /api/profile/me/portfolio-items`
- `PATCH /api/profile/me/portfolio-items/:portfolioItemId`
- `DELETE /api/profile/me/portfolio-items/:portfolioItemId`
- `GET /api/profile/:userId`
- `GET /api/contact-info/me`
- `PATCH /api/contact-info/me`
- `POST /api/uploads`
- `GET /api/courses/recommended`
- `GET /api/courses/search?q=`
- `POST /api/courses/submit`（deprecated，会转为工单）
- `GET /api/boards/:boardId`
- `POST /api/boards/:boardId/join`
- `DELETE /api/boards/:boardId/leave`
- `GET /api/boards/:boardId/open-to-team`
- `GET /api/boards/:boardId/people`
- `POST /api/boards/:boardId/teamaking-posts`
- `GET /api/teamaking-posts/:postId`
- `PATCH /api/teamaking-posts/:postId`
- `DELETE /api/teamaking-posts/:postId`
- `POST /api/teamaking-posts/:postId/team-up`
- `GET /api/teamaking-posts/:postId/interests`
- `GET /api/team-up-interests/received`
- `POST /api/team-up-interests/:id/mutual`
- `POST /api/team-up-interests/:id/refuse`
- `POST /api/team-up-interests/:id/withdraw`
- `GET /api/follow-requests/inbox`
- `POST /api/follow-requests/:id/accept`
- `POST /api/follow-requests/:id/refuse`
- `POST /api/follow-requests/:id/withdraw`
- `GET /api/matches`
- `POST /api/support-tickets`

管理端：

- `GET /api/admin/users`
- `PATCH /api/admin/users/:userId`
- `GET /api/admin/schools`
- `POST /api/admin/schools`
- `PATCH /api/admin/schools/:schoolId`
- `GET /api/admin/majors`
- `POST /api/admin/majors`
- `GET /api/admin/courses`
- `POST /api/admin/courses`
- `PATCH /api/admin/courses/:courseId`
- `POST /api/admin/courses/:courseId/merge`
- `GET /api/admin/course-submissions`
- `POST /api/admin/course-submissions/:id/approve`
- `POST /api/admin/course-submissions/:id/reject`
- `POST /api/admin/course-submissions/:id/merge`
- `GET /api/admin/boards`
- `PATCH /api/admin/boards/:boardId`
- `GET /api/admin/teamaking-posts`
- `PATCH /api/admin/teamaking-posts/:postId`
- `GET /api/admin/team-up-requests/reported`
- `PATCH /api/admin/team-up-requests/:requestId`
- `GET /api/admin/support-tickets`
- `PATCH /api/admin/support-tickets/:id`
- `GET /api/admin/configs`
- `PATCH /api/admin/configs/:key`
- `GET /api/admin/logs`

## 代码说明

### 邮箱验证

`/api/auth/send-code` 会从邮箱中取出域名，例如 `media.student@mail.bnbu.edu.cn` 的域名是 `mail.bnbu.edu.cn`。系统只允许存在于 `SchoolEmailDomain` 且状态为 `active` 的域名登录。

`/api/auth/verify-code` 校验验证码后，会创建或更新 `User`，并自动创建：

- `UserProfile`
- `ContactInfo`

其中 `ContactInfo.schoolEmail` 一定复制自 `User.email`，前端接口不会允许用户修改。

### Course Board

`CourseBoardMembership` 只代表学生在 TEAMAKING 平台内手动加入课程板。它不代表官方选课，也不连接学校教务系统。

未登录用户不能读取真实 Course Board 数据。页面可以展示静态示例，但 API 不返回真实课程板、成员、Open to Team posts 或联系方式。

### 课程搜索

课程搜索同时匹配课程代码和课程名称。接口会返回 `score` 和 `matchReason`，前端推荐栏按匹配度从高到低展示。

### 工单系统

缺失课程不再走复杂提交审核流程。所有 bug、报错、缺失课程和后台需求统一通过 `/support` 提交工单，由管理员在 `/admin/support-tickets` 处理。

`UserSubmittedCourse` 模型暂时保留以兼容历史数据，但不再作为主要产品入口。

### Profile 与本地上传

个人 Profile 支持昵称、头像、主页背景、一句话定位、个人简介、技能标签和“擅长产出的领域”标签。学校邮箱来自登录邮箱，只读且默认展示；WeChat ID、WeChat QR、LinkedIn/主页、个人邮箱可以选择性填写，并配置可见范围。

作品证明支持个人作品、课程作品、报告、PPT、代码、设计稿、图像、音频、GPA 截图、获奖证书、技能/职业认证、简历等类型。文件后缀覆盖 md、Word、表格、PDF、PPT、图像、音频、设计稿、代码和压缩包等常见格式。

本地上传写入 `public/uploads/<userId>/...`，该目录已加入 `.gitignore`。接口返回并保存 `fileUrl`、`storageKey`、`fileName`、`fileMimeType`、`fileSize`、`fileExtension`、`previewKind`、`parsedText`、`resumeParsedData`。后续接入云存储时，保持这些字段结构不变即可。

简历解析当前支持 txt/md/代码类文本、PDF、Word `.docx` 的本地文本提取；旧 `.doc`、PPT、表格会先保存文件元数据，后续可接云端文档解析服务。

### Teamaking Post

Teamaking Post 是 “Open to Team” 状态，不是 leader-centered 招募帖。模型中刻意不包含 team size、leader badge、申请人数、accepted/rejected 等字段。

### TeamUp Interest

TeamUp Interest 是轻量兴趣表达，不是加入团队申请。状态由交互行为触发，不在列表里手动标记：

- `sent`
- `viewed`
- `mutual`
- `withdrawn`
- `refused`
- `closed`
- `deleted`
- `reported`

不要使用 `accepted`、`rejected` 或 `contacted`。Inbox 不显示 TeamUp Interest；Inbox 只显示 Follow Request。

### Contact Visibility

联系方式可见性统一在 Contact Info 配置，创建 Teamaking Post 时不再单独勾选联系方式：

- `private`：任何人不可见。
- `public`：公开展示；MVP 中限同校已验证用户。
- `after_teamup_sent`：查看者向该用户的特定 Teamaking Post 发送 TeamUp Interest 后可见。
- `mutual_teamup`：双方进入 mutual TeamUp 后可见。
- `mutual_follow`：双方成为 mutual follow 后可见。

### Shared Demo State

无 PostgreSQL 时，`/demo-access` 会使用服务端共享 demo state。两个浏览器分别登录不同 demo 账号后，Teamaking Post、TeamUp Interest、Follow Request、Support Ticket 和 Admin 数据可以互通。

## 常用检查命令

```bash
npm run prisma:validate
npm run typecheck
npm run build
```

## 开发日志规范

项目必须维护独立日志文件：

```text
PROJECT_LOG.md
```

任何后续开发者在做以下事情后，都必须追加记录：

- 新功能
- bug 修复
- UI 风格调整
- 数据库 schema 或 seed 变化
- API 行为变化
- 验收问题和解决过程
- 遇到的阻塞、绕路、临时方案

每条日志建议包含：

- 日期
- 执行者
- 背景
- 改动内容
- 解决方法
- 验证结果
- 遗留问题

README 只保留项目说明和操作指南；详细过程不要混进 README，应写入 `PROJECT_LOG.md`。
