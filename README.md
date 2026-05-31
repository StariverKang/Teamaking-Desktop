# TEAMAKING MVP

TEAMAKING 是一个面向大学课程协作的 teammate discovery 平台。它不是队长招募系统，也不创建正式 Team；MVP 的核心是：

- Proof-of-Work Profile：让同学先看到你实际做过什么。
- Course Boards：学生浏览课程板；只有在该课程下发布 Teamaking Post，或对该课程下的 Post 发送 TeamUp Interest 后，才算参与并出现在 Course People 中。
- Open to Team Signals：在课程板里发布 Teamaking Post，表达自己愿意组队。
- TeamUp Interests：别人可以对某条 Teamaking Post 发送轻量兴趣表达，最终沟通主要在平台外完成。
- Friends：Follow Request 被接受后，双方进入好友列表。
- Course Reviews：真实课程目录下支持按时间记录课程评价与多级回复。

## 开发者先读

任何开发者或 agent 接手本项目时，请先读：

1. `docs/INTERACTION_TERMS.md`：固定交互项专用名词，尤其是 Teamaking Post、TeamUp Interest、Inbox、Follow Request 的区别。
2. `PROJECT_LOG.md`：了解已做改动、验收记录、遗留问题和临时方案。
3. `docs/ENVIRONMENT_VARIABLES.md`：生产环境变量、腾讯云 SES、Neon、Vercel 和 DNS 填写指南。
4. `docs/BNBU_CRAWLER_ADMIN_VARIABLES.md`：BNBU crawler 页面所有字段、输出模式、Job 状态和下载区的管理员操作说明。
5. `docs/ERROR_CODES.md`：用户反馈报错代码、运行日志和错误类型对应表。
6. `docs/ACCEPTANCE_CHECKLIST.md`：测试版上线验收清单和验证命令。
7. `docs/PRE_LAUNCH_ISSUES.md`：记录不阻塞当前部署、但下次正式上线前必须复查或修复的 build/deploy warning 与上线风险。
8. 本 README：启动方式、产品边界、API 摘要和检查命令。

Agent 开发原则：

- 需要依赖、插件或文档解析能力时，可以自行安装并更新依赖文件。
- 不确定的功能、权限或交互必须直接提问，不能靠臆测补需求。
- 不要增加用户未要求的冗余功能；确实需要新增时先确认。
- 每完成一个任务都要主动运行可行性验证，再汇报结果。
- 任何 schema、API、交互词汇变化都要同步更新 `docs/INTERACTION_TERMS.md` 和 `PROJECT_LOG.md`。
- 任何 Vercel、npm、build、migration、邮件、存储或 DNS 阶段出现的非阻塞 warning，如果需要在下一次上线前调整，必须记录到 `docs/PRE_LAUNCH_ISSUES.md`，不能只留在聊天记录或临时笔记中。

中文产品句子：

> Your work speaks before you team up.  
> 让认真做事的人，先被看见。

## 技术栈

- Frontend：Next.js App Router + React + TypeScript
- Styling：Tailwind CSS
- Backend/API：Next.js Route Handlers
- Database：PostgreSQL
- ORM：Prisma
- Auth：学校邮箱注册 + 密码登录；`/login` 默认进入邮箱注册，`/login?mode=login|register|reset` 可显式切换；注册和找回密码使用学校邮箱验证码；本地验收可使用 `/demo-access` 绕过验证码
- File upload：本地验收写入 `public/uploads`，生产可用 Cloudflare R2；数据库记录 `fileUrl/storageKey/objectKey/mime/extension/scanStatus/metadata`
- I18n：系统框架支持简体中文 / English；首次访问按 IP 国家/地区写入语言 cookie，用户可手动切换，用户可编辑内容不自动翻译
- Content & Announcements：管理员在 `/admin/content` 统一维护联系开发者、开发者日志、帮助中心和全站公告；帮助中心/开发者日志支持文件夹树和文档树；`/help`、`/developer-log`、`/contact-developer` 对未登录用户公开，并在首屏使用服务端公开内容 payload，公告仍会在用户未阅读前弹窗提醒
- Public Experience：未登录首页保留“用学校邮箱开始 / 了解TEAMAKING / 联系开发者”三个入口，并在首次公开访问后自动进入 `/experience` 静态功能引导；该引导只展示不可交互的模拟 UI，最后跳回注册优先的登录页
- Site UI Copy：管理员可在 `/admin/site-copy` 或用户端浮动工具条维护短界面文案；草稿存入 `site_ui_copy_draft`，发布后写入 `site_ui_copy_published`，普通用户只读取已发布版本
- Admin Maintenance：管理员可在 `/admin/maintenance` 软清空当前课程组队状态；好友关系、课程参与历史、Teamaking Post 和 TeamUp Interest 记录会保留，用于后续推荐和审计追溯

## 本地启动

1. 安装依赖：

```bash
npm install
```

2. 准备 PostgreSQL，并修改 `.env`：

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/teamaking?schema=public"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
ADMIN_HOSTS="admin.teamingapp.org"
CRAWLER_HOSTS="crawler.teamingapp.org"
SESSION_COOKIE_DOMAIN=".teamingapp.org"
TENCENTCLOUD_SECRET_ID=""
TENCENTCLOUD_SECRET_KEY=""
TENCENTCLOUD_SES_REGION="ap-hongkong"
TENCENTCLOUD_SES_FROM_EMAIL="Developer_Teamaking <verify@notify.teamingapp.org>"
TENCENTCLOUD_SES_REGISTER_TEMPLATE_ID=""
TENCENTCLOUD_SES_RESET_TEMPLATE_ID=""
TENCENTCLOUD_SES_REPLY_TO_EMAIL=""
TENCENTCLOUD_SES_TEST_RECIPIENT_EMAIL=""
UPLOAD_STORAGE_MODE=""
R2_ACCOUNT_ID=""
R2_BUCKET=""
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
R2_PUBLIC_BASE_URL=""
EMAIL_DEBUG_CODE_RESPONSE="false"
```

更完整的线上和本地环境变量填写指南见 `docs/ENVIRONMENT_VARIABLES.md`。不要把真实数据库密码、腾讯云 SecretKey 或管理员密码写入 README、日志或 Git。

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

如果只验收业务逻辑和前端展示，也可以直接访问内部演示入口。该入口不再作为未登录首页 CTA 露出：

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

`/login` 会展示三个普通用户入口：

- 邮箱注册：未注册用户先接收验证码，再设置密码。
- 账号密码登录：已注册用户用学校邮箱和密码登录。
- 找回密码：通过学校邮箱验证码重设密码。

管理员入口不从主系统导航展示。生产环境建议把 `admin.teamingapp.org` 绑定到同一个 Vercel 项目，并设置 `ADMIN_HOSTS="admin.teamingapp.org"`；管理员通过 `/admin-login` 使用数据库中的正式管理员账号登录后台。

生产环境也支持用 Vercel 环境变量手动定义一个管理员账号。设置下面变量并重新部署后，使用该邮箱和密码登录 `/admin-login` 时，系统会自动在当前生产数据库中创建或更新这个管理员账号，不会删除已有用户、课程、导入批次或其它业务数据：

```env
ADMIN_BOOTSTRAP_EMAIL="admin@mail.bnbu.edu.cn"
ADMIN_BOOTSTRAP_PASSWORD="change-this-password"
ADMIN_BOOTSTRAP_ROLE="super_admin"
ADMIN_BOOTSTRAP_DISPLAY_NAME="TEAMAKING Admin"
```

`ADMIN_BOOTSTRAP_*` 是推荐方式；旧的 `DEVELOPER_LOGIN_*` 变量仍作为兼容 fallback，但不要再作为长期管理员密码管理方式。

爬虫入口使用同一套管理员账号密码。生产环境建议设置 `SESSION_COOKIE_DOMAIN=".teamingapp.org"`，这样在 `admin.teamingapp.org` 登录后，同一浏览器也能访问 `crawler.teamingapp.org`；也可以直接在 crawler 子域打开 `/admin-login` 使用同一组 `ADMIN_BOOTSTRAP_*` 账号密码登录。

创建或重置管理员账号：

```bash
npm run admin:create -- --email maintainer@example.com --password "change-this-password" --role super_admin --record-local
npm run admin:reset-password -- --email maintainer@example.com --password "new-password" --record-local
npm run admin:list
```

`--record-local` 会写入 `docs/admin-credentials.local.md`，该文件已加入 `.gitignore`，只能留在本机，不提交 Git。

## 测试与验收

完整验收清单见 `docs/ACCEPTANCE_CHECKLIST.md`。常用命令：

```bash
npm run prisma:validate
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run build
```

每次正式上线前还必须检查 `docs/PRE_LAUNCH_ISSUES.md`。其中所有 `Open` 且标记为 “Required before next production launch” 的问题，需要先修复、验证并改为 `Fixed`，或明确改为 `Deferred` 并写清楚延期原因。

需要真实数据库的 integration test 必须使用独立 `TEST_DATABASE_URL`，不要指向开发库或生产库。推荐单独创建 `teamaking_test` 数据库，复制生产/开发 schema 前先脱敏，运行测试前确认 URL 中包含 `test` 或明确的测试库名。

正式邮箱路径会通过腾讯云邮件推送 SES 发送验证码。开发环境没有配置 `TENCENTCLOUD_SECRET_ID` 时，接口会把验证码返回给前端并自动填入，方便本地调试；生产环境必须配置腾讯云 SES 相关环境变量。

腾讯云 SES 使用两套模板：注册模板写入 `TENCENTCLOUD_SES_REGISTER_TEMPLATE_ID`，找回密码模板写入 `TENCENTCLOUD_SES_RESET_TEMPLATE_ID`。模板变量建议包含 `{{code}}`、`{{email}}`、`{{schoolName}}`、`{{title}}`、`{{action}}`。

当前两套邮件模板已完成腾讯云审核；上线时仍必须在 Vercel 配置模板 ID、发信地址和 SecretId/SecretKey，并在部署后做一次注册验证码和找回密码验证码实测。

测试期默认使用本机 `public/uploads`；生产建议设置 `UPLOAD_STORAGE_MODE=r2` 并配置 Cloudflare R2。只有显式设置 `UPLOAD_STORAGE_MODE=inline` 时才使用内联 data URL。

简历 AI 摘要使用 OpenAI Responses API。生产环境可以设置 `OPENAI_API_KEY`，也可以由 `super_admin` 在 `/admin/ai-resume` 写入 SiteConfig；后台配置优先于环境变量。可选 `OPENAI_RESUME_MODEL` 默认是 `gpt-4.1-mini`。上传简历、重新整理简历和首次打开旧解析数据会生成结构化 `resume-ai-v1` 分析；未配置、后台暂停或调用失败时，系统会保留本地 fallback 摘要，不阻止上传或保存。后台不会回显完整 API key，审计日志和调用日志也不会记录简历原文。

## Demo 账号

这些账号由 seed 创建，也可以通过 `/demo-access` 直接进入：

- `media.student@mail.bnbu.edu.cn`
- `cs.student@mail.bnbu.edu.cn`
- `business.admin@mail.bnbu.edu.cn`

其中 `business.admin@mail.bnbu.edu.cn` 是管理后台演示账号，可以进入 `/admin`。

## 核心流程

1. 用户进入 `/`。
2. 未注册用户在 `/login` 选择邮箱注册，输入学校邮箱。
3. 系统检查邮箱域名是否存在于 `SchoolEmailDomain`。
4. 系统创建注册验证码，并通过腾讯云 SES 发送到学校邮箱。
5. 用户输入验证码并设置密码后完成注册，系统通过邮箱域名识别学校。
6. 已注册用户之后使用学校邮箱和密码登录；忘记密码时走找回密码验证码模板。
7. 首次用户进入 `/onboarding`，通过遮罩式新手引导了解平台；年级/入学年份优先由学校邮箱第二位数字自动推断，普通用户不能手动改。
8. 首页未登录第三个 CTA 进入 `/contact-developer`；未登录用户不能从首页直接跳到真实 Course Board 详情。
9. 用户在 `/courses` 查看推荐课程或搜索课程；未登录时只显示示例，不读取真实课程板或用户数据。
10. 用户打开 Course Board 只是浏览；不会因此出现在 Course People 或 Dashboard 当前课程板中。
11. 用户在 `/boards/[boardId]` 创建 Teamaking Post 后，才算参与该课程板，并进入 Course People。
12. 其他用户可以在 Teamaking Post 详情页点击 Team Up；发送 TeamUp Interest 后，也会算作参与该 Post 所属 Course Board。
13. TeamUp Interest 状态可以按正向流程 `sent → viewed → mutual` 变化，也可以进入 `withdrawn`、`refused`、`closed`、`deleted` 或 `reported`。
14. 用户可以在 `/friends` 查看 mutual follow 好友，在课程详情页评价真实课程，在 `/help`、`/developer-log`、`/contact-developer` 查看管理员维护的内容文档。
15. 管理员可以从用户端页面进入“编辑界面文案”模式，点选标题、说明、按钮、placeholder、empty state 和 onboarding tour 字样等短字段；保存后只是草稿，发布后普通用户才会看到。

## 重要产品边界

MVP 明确不实现：

- 官方选课验证
- AI matching
- Formal Team entity
- Team leader workflow
- Join team application workflow
- accepted / rejected 申请状态
- 点赞型课程评价或匿名差评系统
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
  api/[...route]/route.ts       # 极薄 Next.js API 入口，创建 route context 后交给 server module registry
  demo-access/                  # 本地验收绕过邮箱验证码入口
  support/                      # 工单入口，处理 bug、报错、缺失课程等
  friends/                      # Mutual follow 好友列表
  dashboard/                    # 学生 Dashboard
  profile/me/                   # 个人 Profile 编辑、上传和预览
  profile/[userId]/              # 公开 Profile 展示
  courses/                      # 课程搜索和详情
  boards/[boardId]/             # Course Board，两栏：Open to Team / Course People
  teamaking-posts/[postId]/     # Teamaking Post 详情和 Team Up
  team-up-requests/             # TeamUp Menu：发给我发布的 Post 的 TeamUp Interest
  inbox/                        # Follow Request 收件箱
  help/ developer-log/ contact-developer/
                                  # 管理员维护的 Markdown 内容中心
  admin/                        # 管理后台
  admin/site-copy/              # 短界面文案管理页
components/
  app-shell.tsx                 # 导航、页面布局、通用状态组件
  site-copy-runtime.tsx         # 用户端可点选字段、管理员浮动工具条和 copy runtime
  cards.tsx                     # CourseCard、ProfileCard、TeamakingPostCard 等
  client-pages.tsx              # 兼容空壳；新页面不要从这里导入
  pages/                        # 按 auth/student/profile/course-board/social/admin/content/crawler 拆分的页面模块
lib/
  site-copy.ts                  # typed site copy registry、默认值、fallback 和 diff helpers
  prisma.ts                     # Prisma Client 单例
  session.ts                    # HttpOnly cookie session
  contact.ts                    # 联系方式可见性逻辑
  constants.ts                  # 固定选项和状态流转
  profile-assets.ts             # Profile 文件后缀、预览类型、本地简历解析
  server/
    api/                        # application module、registry support 和按领域拆分的 API modules
    course-import/              # CourseImportWorkflow、payload、BNBU v2 校验和 curriculum matching
    crawler/                    # crawler module、runtime readiness、job/output lifecycle
    admin/versions-module.ts    # version list/checkpoint/download/restore-as-new-version
prisma/
  schema.prisma                 # PostgreSQL 数据模型
  seed.ts                       # BNBU 演示数据
```

## API 摘要

认证：

- `POST /api/auth/register/send-code`
- `POST /api/auth/register/complete`
- `POST /api/auth/password-login`
- `POST /api/auth/password-reset/send-code`
- `POST /api/auth/password-reset/complete`
- `POST /api/auth/admin-login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/demo/login`

学生端：

- `GET /api/onboarding`
- `POST /api/onboarding`
- `POST /api/onboarding/tour-dismiss`
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
- `GET /api/courses/:courseId/comments`
- `POST /api/courses/:courseId/comments`
- `POST /api/course-comments/:commentId/replies`
- `DELETE /api/course-comments/:commentId`
- `GET /api/boards/:boardId`
- `POST /api/boards/:boardId/join`（兼容旧入口；当前只返回课程板说明，不创建参与记录）
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
- `GET /api/friends`
- `GET /api/notifications/summary`
- `GET /api/site-copy`
- `GET /api/content?kind=help|developer_log|developer_contact`
- `GET /api/matches`
- `POST /api/support-tickets`
- `GET /api/support-tickets/mine`

管理端：

- `GET /api/admin/users`
- `PATCH /api/admin/users/:userId`
- `GET /api/admin/admin-users`
- `POST /api/admin/admin-users`
- `PATCH /api/admin/admin-users/:id`
- `GET /api/admin/schools`
- `POST /api/admin/schools`
- `PATCH /api/admin/schools/:schoolId`
- `GET /api/admin/majors`
- `POST /api/admin/majors`
- `GET /api/admin/courses`
- `POST /api/admin/courses`
- `PATCH /api/admin/courses/:courseId`
- `POST /api/admin/courses/:courseId/offerings`
- `PATCH /api/admin/course-offerings/:offeringId`
- `POST /api/admin/courses/:courseId/merge`
- `POST /api/admin/course-imports/validate`
- `GET /api/admin/course-imports`
- `POST /api/admin/course-imports`
- `POST /api/admin/course-imports/:importBatchId/approve`
- `POST /api/admin/course-imports/:importBatchId/reject`
- `GET /api/admin/content`
- `POST /api/admin/content`
- `PATCH /api/admin/content/:id`
- `DELETE /api/admin/content/:id`
- `GET /api/admin/site-copy`
- `PATCH /api/admin/site-copy/draft`
- `POST /api/admin/site-copy/publish`
- `POST /api/admin/site-copy/discard`
- `GET /api/admin/course-submissions`
- `POST /api/admin/course-submissions/:id/approve`
- `POST /api/admin/course-submissions/:id/reject`
- `POST /api/admin/course-submissions/:id/merge`
- `GET /api/admin/boards`
- `POST /api/admin/boards`
- `PATCH /api/admin/boards/:boardId`
- `GET /api/admin/teamaking-posts`
- `PATCH /api/admin/teamaking-posts/:postId`
- `GET /api/admin/team-up-requests/reported`
- `PATCH /api/admin/team-up-requests/:requestId`
- `GET /api/admin/support-tickets`
- `PATCH /api/admin/support-tickets/:id`
- `GET /api/admin/metrics`
- `GET /api/admin/configs`
- `PATCH /api/admin/configs/:key`
- `GET /api/admin/logs`
- `GET /api/admin/error-events`

## 代码说明

### 邮箱验证

`/api/auth/register/send-code` 会从邮箱中取出域名，例如 `media.student@mail.bnbu.edu.cn` 的域名是 `mail.bnbu.edu.cn`。系统只允许存在于 `SchoolEmailDomain` 且状态为 `active` 的域名注册。

`/api/auth/register/complete` 校验注册验证码后，会创建或更新 `User`，保存密码哈希，并自动创建：

- `UserProfile`
- `ContactInfo`

其中 `ContactInfo.schoolEmail` 一定复制自 `User.email`，前端接口不会允许用户修改。

已注册用户通过 `/api/auth/password-login` 登录；忘记密码通过 `/api/auth/password-reset/send-code` 和 `/api/auth/password-reset/complete` 重设。注册和找回密码各自使用独立的腾讯云 SES 模板。

`/api/auth/logout` 会清除 HttpOnly `teamaking_session`。如果生产环境配置了 `SESSION_COOKIE_DOMAIN`，服务端会同时过期当前 host-only cookie 和共享 domain cookie，避免旧 cookie 在刷新、静置或进入 Course Board 时重新恢复账号。

### 公开内容页面

`/help`、`/developer-log`、`/contact-developer` 和 `/experience` 是未登录可见页面。公开首页的主 CTA 为 `/login?mode=register`，说明入口为 `/help?article=what-is-teamaking`，联系入口为 `/contact-developer`；未登录浏览器首次打开首页时会在当前 session 内自动进入一次 `/experience`，用户可以随时结束引导。

帮助中心和开发者日志页面首屏通过 `getPublicContentPayload()` 服务端读取已发布的 `ContentDocument`，客户端再用 `/api/content?kind=help|developer_log|developer_contact` 刷新，数据库暂不可用或没有发布内容时会显示可读 fallback，而不是要求登录或空白报错。帮助中心和开发者日志使用文件夹树 + 文档阅读器；联系开发者是独立公开内容卡片。公开 API 只返回 `published` 文档。当前本地帮助中心草稿源在 `storage/help-center-drafts/`，`01-*` 到 `06-*` 用于公开帮助文档，`00-manifest.md` 和 `99-archive` 保持草稿/归档用途；`storage/` 被 `.gitignore` 忽略，发布到帮助中心仍需通过后台 Markdown 导入或内容发布流程。

### 界面短文案

Interface Copy 只维护框架级短字段，不是长文 CMS。可编辑范围包括页面 eyebrow/title/description、section heading、card 标题和说明、tab/button label、字段 label、help text、placeholder、empty state、onboarding tour 标题/正文/按钮、support widget 提示和官方参考区的固定包装文案。用户生成内容、课程数据、官方链接、帖子、Profile 正文、工单正文和 `/admin/content` 的文档正文不走这套系统。

默认文案集中定义在 `lib/site-copy.ts`。公开用户端通过 `GET /api/site-copy` 只读取已发布值；管理员通过 `/admin/site-copy` 或用户端“编辑界面文案”浮动工具条读取草稿合并视图。草稿存入 `SiteConfig.key=site_ui_copy_draft`，发布后写入 `SiteConfig.key=site_ui_copy_published` 并清空草稿，不需要 Prisma schema migration。每次保存、发布、丢弃都会写入 `AdminAuditLog`。

管理员在学生/公开页面打开编辑模式后，可直接点选被标记的字段打开侧边编辑器；普通用户永远只看到 published-over-default。文案支持 `zh` 和 `en`，缺某个语言时回退默认值。`onboarding_guide` 的 route、target selector 和 placement 仍由原配置控制，只有可见 title/body/button 字符串走 Interface Copy。

### Course Board

`CourseBoardMembership` 的用户可见参与记录只代表学生已经在该课程板下做过协作动作：发布 Teamaking Post（`source=teamaking_post`）或对该课程板下的 Post 发送 TeamUp Interest（`source=team_up`）。它不代表官方选课，也不连接学校教务系统。

只打开 Course Board、查看课程详情或浏览推荐课程，不算加入，也不会进入 Dashboard 的 My current Course Boards。旧的手动/自动 membership 数据不会作为用户可见 Course People 参与记录展示。

未登录用户不能读取真实 Course Board 数据。页面可以展示静态示例，但 API 不返回真实课程板、成员、Open to Team posts 或联系方式。

### 课程搜索

课程搜索同时匹配课程代码和课程名称。接口会返回 `score` 和 `matchReason`，前端推荐栏按匹配度从高到低展示。

### BNBU Course Import

真实课程数据由 BNBU crawler/清洗工具采集和清洗。主系统通过 `CourseImportWorkflow` 作为唯一业务入口处理 cleaned JSON：`schemaVersion` 建议为 `teamaking.bnbu_course_import.v2`（兼容 v1），`school.shortName` 必须为 `BNBU`。管理员可以在 `/admin/course-imports` 粘贴 JSON，或让 `/crawler` 在任务完成后创建 pending/直接批准；两条路径都会先形成可审计的 batch/dataset，批准后才会写入课程目录和 admission-year 课程安排规则。

Crawler 支持 `programme_handbook` 和 `course_catalog`：每年 admission handbook 是 admission-year programme plan、推荐课程和 CourseBoard 默认配置的权威来源；course catalog 则合并 Course Descriptions、University Core、General Education 三类学校级课程总表来源。Course catalog 只维护课程目录、描述和目录有效年份，不能把课程绑定到某个固定年级、专业或学期，也不能生成 default join / recommendation 规则。两者内容不同但相互补充，合在一起才形成准确配置。BNBU class schedule 只是学期时间安排，不作为课程存在、真实开课或 CourseBoard 配置依据。

BNBU 本科 admission relative term 统一按 Fall 入学解释：`2025 Fall = Y1S1`、`2026 Spring = Y1S2`、`2029 Spring = Y4S2`，从 `2029 Fall` 起年级显示为 `Graduated`。历史 `entryTerm` 字段保留兼容，但推荐课程、semester activation 和 default join 都按 Fall admission 计算；超过 `Y4S2` 的用户不再匹配 admission-year curriculum rules，仍可搜索所有 active catalog 课程。

爬虫入口已经拆成独立页面 `/crawler` 和 API `/api/crawler/*`。本地可直接访问；线上可通过 `CRAWLER_HOSTS` 配置独立 crawler 子域名。Crawler 默认只生成可下载 JSON；管理员也可以在 `After crawl` 中选择创建 pending 导入批次，或直接批准并更新线上数据库。每个 Job 完成后都会提供“下载本次爬取内容”按钮。`process_error`、`import_failed` 和 `AI enrich failed` 要分开诊断：错误摘要会从 stderr、exit code 和日志尾部提炼 PDF 依赖、网络/TLS、handbook 页匹配、admission mismatch、pending import blocker 等具体原因；即使任务显示失败，也先检查下载输出和 pending batch 状态。若要生成可提交的测试样本，可切换输出模式写入 `course_imports/bnbu/*.teamaking.json`。

Crawler 页面字段解释、变量表、Job 状态、下载区和常见误用见 `docs/BNBU_CRAWLER_ADMIN_VARIABLES.md`。这份文档面向非开发管理员，可直接作为操作手册使用。

上线前 crawler/import 验收必须使用 BNBU 真实页面和 PDF，而不是 mock payload：至少跑 `2023 limit=1` handbook smoke，下载单个 JSON 后走 workflow create pending/approve，并直接查数据库确认 programme、course、curriculum rule 以及 Programme Plan board 可见；再跑 `2025,2024,2023 limit=1` 小样本确认不会复现 `pdfjs-dist` / `pdf-parse` serverless tracing 缺包问题。`next.config.mjs` 的 `outputFileTracingIncludes` 必须保留 `scripts/bnbu-crawler`、`pdfjs-dist` 和 `pdf-parse` 相关 assets。

导入审批前会生成预览差异，包括新增/更新 Faculty、Major、Course、Curriculum Rule，当前学期将失效的旧规则，重点推荐规则数量、可搜索规则数量，以及预计会收到课程板推荐匹配的用户数量。管理员也可以选择已创建的配置操作并点击“查看差异”复核后再批准。

本地实验目录 `local_bnbu_course_pipeline/` 整个目录已加入 `.gitignore`；可提交的管线产物仍限制为 `course_imports/bnbu/*.teamaking.json`。Programme Handbook 推荐填某一年的 handbook 页面并一次爬一年，按 admission year 单独输出，例如 `bnbu-2025-admission-handbook.teamaking.json` 与 `bnbu-2024-admission-handbook.teamaking.json`；course catalog 输出 `bnbu-course-catalog.teamaking.json`。管理员可以分批校验、审批和对照数据库 coverage 查缺漏。handbook admission-year import 可以没有 `offerings[]`；Course Board 会按当前 academic term、学生 admission year、专业和 `relativeTermCodes` 激活。当前不抓取 syllabus/teamwork evidence；用户需要组队时自行发布 Teamaking Post。

导入页里的“一条配置操作”对应一次 JSON 输入。系统不会把一次 JSON 拆成多个 pending 操作；它只是把 JSON 理解并存成可查询的 `CourseImportDataset`、source refs、faculties、majors、courses、rules、offerings 等行。真正可编辑、可审计和可回溯的是这些课程目录和 admission-year 配置规则，而不是一个难读的大 payload。

Crawler job 会写入 `CrawlerJob`，包含自定义任务名、输入范围、激活预览学期、运行日志、错误摘要和输出文件引用。旧的随机 id 仍作为内部标识保留，但页面以管理员填写的任务名为主。

### Versions And Logs

管理员可在 `/admin/versions` 管理测试/正式版本。开启新版本时，系统会先为当前版本创建最终 checkpoint 并关闭旧版本，然后创建一个空白 active version；普通用户、课程、学期、导入数据不复制，只复制管理员账号和学校邮箱域名用于继续管理。Checkpoint 可下载为 JSON 快照，自动破坏性 replay 目前不会直接执行，以避免误删线上数据。

`/admin/logs` 展示 `OperationLog` 与 `AdminAuditLog`。系统记录写入、编辑、课程参与/退出、TeamUp/Follow 互动、工单、导入审批、版本操作等事件；翻页、跳转、只读浏览不会写日志。

JSON 顶层结构：

```json
{
  "schemaVersion": "teamaking.bnbu_course_import.v2",
  "generatedAt": "2026-05-24T10:30:00+08:00",
  "school": {
    "shortName": "BNBU",
    "name": "Beijing Normal-Hong Kong Baptist University",
    "emailDomain": "mail.bnbu.edu.cn"
  },
  "semester": {
    "code": "2026-Fall",
    "name": "2026 Fall",
    "academicYear": 2026,
    "term": "Fall",
    "isCurrentCandidate": false
  },
  "sourceRefs": [],
  "faculties": [],
  "majors": [],
  "courses": [],
  "offerings": [],
  "curriculumRules": []
}
```

`curriculumRules[].classification` 使用 BNBU 官方课程分类枚举：`major_required`、`major_elective`、`bba_core`、`faculty_required`、`college_core`、`common_core`、`required_core`、`elective_core`、`concentration_required`、`concentration_elective`、`university_core`、`university_core_chinese`、`university_core_english`、`university_core_ai_literacy`、`university_core_ppe`、`university_core_military_training`、`university_core_wpex`、`university_core_healthy_lifestyle`、`general_education`、`ge_level_1_foundational`、`ge_level_2_interdisciplinary_thematic`、`ge_level_3_capstone`、`free_elective`、`supporting_course`、`interdisciplinary_course`、`final_year_project`、`internship`、`unknown`。

`curriculumRules[].studentAction` 决定学生端行为：

- `default_join`：匹配学校、专业/院系、年级的学生会收到重点推荐，并可激活对应 Course Board；用户可见参与仍要等到发布 Post 或发送 TeamUp。
- `searchable_add`：课程可搜索、可打开 Course Board；适用于自由选修、通识、专业选修等。
- `recommend_only`：只展示推荐，不创建参与记录。
- `hidden`：后台保留，不展示给学生。

如果某课程对 MCOM Year 2 是 `major_required/default_join`，同时对其他专业是 `free_elective/searchable_add`，MCOM Year 2 学生会在推荐课程中优先看到它；其他专业学生可以搜索课程代码或名称打开 Course Board。两类用户都只有在该课程下发布 Teamaking Post，或对该课程下的 Post 发送 TeamUp Interest 后，才会进入用户可见的 Course People / My current Course Boards。

v2 推荐在 `curriculumRules[]` 中提供 `relativeTermCodes`，例如 `["Y2S1"]`。用户 Profile 会保存 `entryYear` 和 `entryTerm`，系统按当前学期动态计算学生的相对学期；`major_required`、`major_elective`、`concentration_required`、`concentration_elective` 必须带 `audience.majorCodes`，不能使用 `allMajors: true`。

### 工单系统

缺失课程不再走复杂提交审核流程。所有 bug、报错、缺失课程和后台需求统一通过 `/support` 提交工单，由管理员在 `/admin/support-tickets` 处理。

`UserSubmittedCourse` 模型暂时保留以兼容历史数据，但不再作为主要产品入口。

### Profile 与本地上传

个人 Profile 支持昵称、头像、主页背景、一句话定位、个人简介、技能标签和“擅长产出的领域”标签。学校邮箱来自登录邮箱，只读且默认展示；WeChat ID、WeChat QR、LinkedIn/主页、个人邮箱可以选择性填写，并配置可见范围。

Profile 和 onboarding 的专业选择先按 Faculty/College 收窄 Major 列表，只展示该 Faculty 下的正式 handbook 专业名称；切换 Faculty 时会自动切换到该 Faculty 下的可用专业，避免保留已废弃短名或跨学院专业。

作品证明支持个人作品、课程作品、报告、PPT、代码、设计稿、图像、音频、GPA 截图、获奖证书、技能/职业认证、简历等类型。文件后缀覆盖 md、Word、表格、PDF、PPT、图像、音频、设计稿、代码和压缩包等常见格式。

本地上传写入 `public/uploads/<userId>/...`，该目录已加入 `.gitignore`。接口返回并保存 `fileUrl`、`storageKey`、`storageMode`、`storageProvider`、`objectKey`、`fileName`、`fileMimeType`、`fileSize`、`fileExtension`、`previewKind`、`scanStatus`、`parsedText`、`resumeParsedData`。生产可设置 `UPLOAD_STORAGE_MODE=r2` 并配置 Cloudflare R2 环境变量切换对象存储。

简历解析当前支持 txt/md/代码类文本、PDF、Word `.docx`、旧 `.doc`、PPT/PPTX、CSV/TSV、Excel `.xls/.xlsx` 的本地文本提取。提取文本后会优先调用 OpenAI 生成 `resume-ai-v1` 结构化分析：候选人定位、归纳摘要、分组关键词和最多 8 条精选 Highlights；未配置 API 或调用失败时回退到本地压缩摘要。Profile 编辑页提供“重新 AI 整理当前简历”、首次打开旧解析数据自动整理、手动微调 Summary / Highlights，以及恢复 AI 版本。管理员可以在 `/admin/ai-resume` 配置启用状态、模型、API key、输入长度限制，并查看最近 100 次简历整理调用的模型、状态、摘要标题、Highlights 结果和耗时。旧 Office、加密文件或复杂扫描件如果无法稳定解析，系统会保存文件并在站内预览浮窗显示解析失败原因和原文件入口，不阻止上传。

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

## 线上部署与更新

当前生产部署链路：

- 代码仓库：`https://github.com/StariverKang/Teamaking`
- 生产平台：Vercel，项目名 `teamaking`
- 主域名：`https://teamingapp.org`
- 管理员子域名：`https://admin.teamingapp.org`
- 爬虫子域名：`https://crawler.teamingapp.org`
- 生产数据库：Neon PostgreSQL，使用 `production` branch
- 邮件服务：腾讯云邮件推送 SES

### Vercel 环境变量

生产环境变量、腾讯云 SES 模板 ID、管理员入口、Neon direct connection 和 DNS 填写指南集中记录在 `docs/ENVIRONMENT_VARIABLES.md`。Vercel 环境变量修改后，需要在 `Deployments` 中对最新 production deployment 执行 `Redeploy` 才会生效。

### 更新代码到线上

每次代码改动后：

```bash
npm run prisma:validate
npm run typecheck
npm run lint
npm run build
git status --short
git add .
git commit -m "描述这次改动"
git push origin main
```

Vercel 连接了 GitHub `main` 分支，推送成功后会自动创建新部署。部署成功后应在 Vercel `Deployments` 中确认最新 commit 处于 `Ready / Current`。

### 数据库迁移

如果改动包含 `prisma/schema.prisma` 或 `prisma/migrations`，推送代码后必须对 Neon 生产库执行迁移：

```bash
DATABASE_URL="Neon direct connection string" npx prisma migrate deploy
```

注意：

- 迁移使用 Neon 的 direct connection，不使用 connection pooling。
- direct connection 的 Neon `Connection pooling` 开关应为关闭状态，主机名通常不包含 `pooler`。
- 生产环境不要运行 `npm run seed`，它用于重置/写入演示数据。

### 管理员子域名 DNS

`admin.teamingapp.org` 指向同一个 Vercel 项目，但管理路径由 `ADMIN_HOSTS` 和 `middleware.ts` 限制。配置步骤：

1. 在 Vercel `Domains` 添加 `admin.teamingapp.org`，连接到 `Production`，不要设置 redirect。
2. 在 Cloudflare `DNS` 添加 Vercel 要求的记录，通常是 `CNAME admin -> <vercel-dns target>`。
3. Cloudflare 记录应为 `DNS only`，不要开启橙色代理。
4. 回 Vercel 等待 `Valid Configuration` 和 SSL 证书生成完成。

### 爬虫子域名 DNS

`crawler.teamingapp.org` 指向同一个 Vercel 项目，但只开放 `/crawler` 与 `/api/crawler/*`。配置步骤：

1. 在 Vercel `Domains` 添加 `crawler.teamingapp.org`，连接到 `Production`，不要设置 redirect。
2. 在 Vercel 环境变量中设置 `CRAWLER_HOSTS=crawler.teamingapp.org`。
3. 在 Cloudflare `DNS` 添加 Vercel 要求的 `CNAME crawler -> <vercel-dns target>`。
4. Cloudflare 记录应为 `DNS only`，等待 Vercel 显示 `Valid Configuration`。

### 线上测试清单

部署和迁移完成后，至少测试：

- `https://teamingapp.org/login` 可以打开，且默认显示“邮箱注册”；`/login?mode=login` 和 `/login?mode=reset` 仍能切到登录与找回密码。
- 未注册用户可以进入“邮箱注册”流程。
- 已注册用户可以用邮箱和密码登录。
- 找回密码可以发起验证码流程。
- `https://admin.teamingapp.org/admin-login` 可以打开。
- 管理员能用数据库中的正式管理员账号登录。
- 管理后台 `Users`、`Boards`、`Support Tickets`、`Metrics` 页面能读取数据库。
- 管理后台编辑用户状态、Course Board 或工单后，数据能刷新显示。
- 管理后台 `Content & Announcements` 可以按 tab 管理联系开发者、开发者日志、帮助中心和全站公告；帮助中心/开发者日志支持在树上分别新建分类文件夹和文档；主站任意页面顶部能看到公告条和弹窗，`/announcements` 能查看历史。
- 管理后台 `Interface Copy` 可以搜索短界面文案、保存草稿、发布和丢弃；管理员在 `/courses` 等学生端页面可打开“编辑界面文案”工具条，普通用户不应看到草稿，发布后用户端才更新。
- 无痕窗口或登出状态下，首页显示“用学校邮箱开始”“了解TEAMAKING”“联系开发者”，不露出“演示验收”入口；`/experience` 可翻页、不可触发真实业务，最后一步进入 `/login?mode=register`。
- `/help`、`/developer-log`、`/contact-developer` 和 `/api/content?kind=...` 均能读取已发布公开内容；登录相关帮助文章中的注册、登录、找回密码文字应能跳到对应 `/login?mode=...`。
- 点击登出后，刷新、静置或进入 Course Board 不应自动恢复账号；用 `/api/auth/me` 复核应返回未登录状态。
- 主站语言切换器能在中文/英文间切换；用浏览器无痕窗口模拟非中文地区时默认英文，手动切换后 cookie 会记住选择。
- 邮件模板：注册验证码和找回密码验证码都能发送到真实学校邮箱；Vercel 中 `EMAIL_DEBUG_CODE_RESPONSE=false`，前端响应不暴露验证码。

如果腾讯云 SES Secret、发信地址或模板 ID 未配置，生产验证码会失败。现在模板已审核通过，邮件发送应列为上线前必须通过的检查项。

## 数据存储与维护

运行数据存储位置：

- 用户、课程、Course Board、帖子、工单、验证码、管理员日志、密码哈希：Neon PostgreSQL。
- Vercel：只存部署产物和环境变量，不是业务数据库。
- GitHub：只存代码、Prisma schema 和 migration，不存业务数据。
- Cloudflare：只负责 DNS。
- 腾讯云 SES：只负责发邮件，不存主业务数据。

备份建议：

```bash
pg_dump "Neon direct connection string" --format=custom --file "teamaking-backup.dump"
```

大规模改数据前，优先在 Neon 创建 branch 或使用 point-in-time restore 能力恢复到某个时间点。清理数据前先备份；生产环境不要通过 `seed` 清库。

## 常用检查命令

```bash
npm run prisma:validate
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:e2e -- tests/e2e/smoke.spec.ts
```

BNBU crawler 相关改动还应至少跑一条完整旧 admission 和一条新 admission 小样本 smoke，例如：

```bash
node scripts/bnbu-crawler/run-handbook-preview.mjs --cohorts=2022 --limit=all --outDir=/tmp/teamaking-crawler-2022-full-verify --aiMode=off
node scripts/bnbu-crawler/run-handbook-preview.mjs --cohorts=2025 --limit=1 --outDir=/tmp/teamaking-crawler-2025-limit1-verify --aiMode=off
```

## 开发日志规范

项目必须维护独立工程日志文件：

```text
PROJECT_LOG.md
```

站内公开的 `/developer-log` 是面向用户的开发者日志内容，走 `/admin/content` 的 `developer_log` 文档模型；工程过程、检查命令、临时方案和 commit 记录仍写入 `PROJECT_LOG.md`，不要只写进站内内容或聊天记录。

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
