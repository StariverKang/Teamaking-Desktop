# TEAMAKING Project Log

本文件记录 TEAMAKING 从题目要求到可验收 MVP 的关键变更、思路变化、解决方式和踩坑。后续任何开发者修改项目，都应继续追加日志。

## 2026-05-23

### 初始化 MVP

- 背景：根据 `/Users/linxuequn/Desktop/Openclaw/quest.txt` 创建 TEAMAKING MVP。
- 思路：优先实现可运行的 Next.js + TypeScript + Tailwind + Prisma + PostgreSQL 项目，而不是继续使用空的 `demo.py`。
- 改动：
  - 创建 App Router 页面：landing、login、onboarding、dashboard、profile、contact-info、courses、boards、teamaking-posts、team-up-requests、matches、admin。
  - 创建统一 API Route Handler：`app/api/[...route]/route.ts`。
  - 创建 Prisma schema 和 seed。
  - 创建 README。
- 验证：
  - `npm run prisma:generate` 通过。
  - `npm run prisma:validate` 通过。
  - `npm run typecheck` 通过。
  - `npm run build` 通过。

### 邮箱域名变更

- 背景：用户指出 UIC/BNBU 邮箱后缀应为 `mail.bnbu.edu.cn`。
- 改动：
  - seed 中的 `SchoolEmailDomain` 改为 `mail.bnbu.edu.cn`。
  - demo 用户邮箱改为 `media.student@mail.bnbu.edu.cn`、`cs.student@mail.bnbu.edu.cn`、`business.admin@mail.bnbu.edu.cn`。
  - 登录页默认邮箱和 README 示例同步更新。
- 验证：
  - 搜索源码确认没有残留 `uic.edu.cn`。

### 项目目录重命名与 3000 端口问题

- 背景：用户将项目文件夹改名为 `Teamaking` 后，浏览器打开 `localhost:3000` 出现 `Internal Server Error`。
- 排查：
  - 发现旧的 `/Users/linxuequn/Desktop/Openclaw/codex_input` dev server 仍占用 3000。
  - 旧目录已经没有 `app/` 和 `package.json`，只剩 `.next`，导致 Next 报 `scandir .../codex_input/app` 失败。
  - 真正项目位于 `/Users/linxuequn/Desktop/Openclaw/Teamaking`。
- 解决：
  - 停止旧 `codex_input` dev server。
  - 清理 `codex_input/.next`。
  - 从 `Teamaking` 目录重新启动 dev server。
- 验证：
  - `http://localhost:3000/` 返回 `200 OK`。
  - `http://localhost:3000/login` 返回 `200 OK`。
  - `localhost:3001` 空闲。

### 可验收版需求复盘

- 背景：用户指出大部分功能因数据库/验证码/权限边界无法实际验收，需要专门的验收入口和产品逻辑修正。
- 主要问题：
  - 邮箱验证码目前不适合作为本地验收前提。
  - 未登录用户不应读取真实 Course Board、Course People 或用户数据。
  - 视觉风格过于柔和，需要更粗粝、理性、学术工作台式的质感。
  - 课程搜索需要代码和名称双重部分匹配，并按匹配度推荐。
  - 缺失课程审核机制过重，应改为工单。
  - 管理后台不能要求管理员手写 JSON。
  - 项目需要独立日志制度。

### Demo Access 与隐私边界

- 改动：
  - 新增 `/demo-access`。
  - 新增 `POST /api/demo/login`，本地/验收环境可绕过邮箱验证码进入 demo 身份。
  - 未登录访问 `/courses` 只展示示例。
  - 未登录访问 `/boards/[boardId]` 只展示 Course Board 结构示例。
  - API 层要求登录后才能读取真实 course、board、open-to-team、people、teamaking-post 数据。
- 解决的问题：
  - 不依赖真实邮箱服务即可验收前端和业务流程。
  - 防止未登录用户读取真实用户或课程板数据。

### 搜索、工单与后台

- 改动：
  - `/api/courses/search` 增加课程代码/课程名称匹配评分，返回 `score` 和 `matchReason`。
  - `/courses` 搜索框下新增推荐栏。
  - 新增 `SupportTicket` Prisma model。
  - 新增 `/support`。
  - 新增 `/api/support-tickets`。
  - 新增 `/admin/support-tickets`。
  - 缺失课程入口从审核流程改为工单。
  - 管理后台从“手写 endpoint + JSON body”改为下拉框、输入框和按钮。
- 解决的问题：
  - 课程搜索更符合不完整输入场景。
  - 管理员不需要代码基础即可处理常见后台事务。

### 视觉风格调整

- 改动：
  - 全局背景改为纸面网格质感。
  - 主色从柔和 SaaS 色改为墨黑、纸白、暗绿、锈红、低饱和灰。
  - 通用组件减少圆角和漂浮阴影，改为硬边框和轻微 offset shadow。
- 目标：
  - 形成“粗糙里带着理性的、不跟随大流审美但海纳百川的学术质感”。

### 遗留问题

- 真实邮箱服务尚未接入。
- 完整数据流仍需要 PostgreSQL migrate + seed。
- 管理后台已改为无代码表单，但未来还可以继续增强字段校验和更细的编辑弹窗。

### Profile 具体功能扩展

- 背景：用户要求个人页面从基础 Profile 扩展为可验收的个人展示系统，包含联系方式、头像背景、作品/证明材料、GPA 截图、证书、简历上传与解析等。
- 改动：
  - 扩展 `UserProfile`：新增昵称、头像、主页背景、一句话定位、产出标签、简历 URL、简历文件名和解析数据。
  - 扩展 `PortfolioItem`：新增文件名、MIME、大小、后缀、storageKey、previewKind、parsedText、metadata，用来承载 md、Word、表格、PDF、PPT、图像、音频、设计稿、代码、GPA 截图、获奖证书、技能/职业认证、简历等材料。
  - 新增 `lib/profile-assets.ts`，集中管理允许的文件后缀、预览类型判断、安全文件名和本地简历解析。
  - 新增 `POST /api/uploads`，本地验收时写入 `public/uploads/<userId>/...`，后续可替换成云存储。
  - 新增 `POST/PATCH/DELETE /api/profile/me/portfolio-items`，支持 Profile 内作品/证明材料的创建、更新、删除。
  - `/profile/me` 改为一体化编辑页：基础信息、联系方式、头像背景、简历解析、作品证明上传预览和保存。
  - `/profile/[userId]` 改为更完整的公开 Profile 展示页，包含头像背景、联系方式和作品预览。
  - 本地视觉演示模式增加 Profile/Portfolio mock 数据，避免无 PostgreSQL 时无法验收。
- 解决的问题：
  - 用户不再只能填写文字 Profile，可以上传和预览具体证明材料。
  - 学校邮箱保持登录来源只读，微信等联系方式可选择性添加和配置可见性。
  - 文件存储与业务字段解耦，后续接云存储时不需要重写 Profile 页面。
- 验证：
  - `npm run prisma:generate` 通过。
  - `npm run prisma:validate` 通过。
  - `npm run typecheck` 通过。
  - `npm run lint` 通过。
- 遗留问题：
  - PDF、Word、PPT、表格的深度内容解析尚未接入，当前只保存元数据；后续需要云端解析服务或专门文档解析库。
  - 本地上传适合验收，不适合生产；生产必须替换为对象存储。

### Interaction Terms、TeamUp Interest 与共享 Demo State 重构

- 背景：用户验收 UI/交互后指出 Teamaking Post、TeamUp Request/Interest、Inbox、Follow Request 的语义混用，且两个浏览器 demo 账号之间数据不互通，无法验收用户-用户和用户-管理员互动。
- 改动：
  - 新增 `docs/INTERACTION_TERMS.md`，固定交互项专用名词；README 新增“开发者先读”入口和 agent 开发原则。
  - 将 TeamUp Request 产品语义调整为 TeamUp Interest：`sent/viewed/mutual/withdrawn/refused/closed/deleted/reported`，并新增 `/api/team-up-interests/*` 行为接口。
  - `/team-up-requests` 改为 TeamUp Menu，只展示发给当前用户发布的 Teamaking Posts 的 TeamUp Interests；移除 Sent 区域和手动标记 viewed/mutual 的操作。
  - 新增 Follow Request 模型、API 和 `/inbox` 页面；Inbox 只处理关注/好友申请。
  - Contact Info 权限改为 `private/public/after_teamup_sent/mutual_teamup/mutual_follow`，由服务端过滤后返回。
  - 新增共享 demo store，让无 PostgreSQL 时的 demo 账号可以共享 Teamaking Posts、TeamUp Interests、Follow Requests、Support Tickets 和 Admin 数据。
  - Teamaking Post 卡片补齐课程名称、发起者基础信息、个人简介、Profile 入口和 TeamUp 入口，移除无效 open 状态按钮，区分 Profile tag 和 Signal tag。
  - Course Board 创建 Teamaking Post 时移除联系方式勾选；课程板顶部小字改为开放时间。
  - Courses 页删除重复的外部 Join Course Board 按钮和重复 Course search 区域。
  - Profile 作品展示改为紧凑卡片；作品与语言成绩/GPA/奖项荣誉分区；支持个人/小组与文件类型交叉筛选、最多 3 个置顶作品、荣誉类每类最多 3 个。
  - 简历本地解析接入 PDF 和 `.docx` 文本提取，旧 `.doc` 继续只保存元数据。
- 解决的问题：
  - 减少后续交接时对 quest/request/post/inbox 的误读。
  - demo 模式可以验收双账号互动和管理员查看。
  - 联系方式与 private portfolio 不再依赖前端隐藏。
- 验证：
  - `npm run prisma:generate` 通过。
  - `npm run typecheck` 通过。
  - `npm run lint` 通过。
  - `npm run prisma:validate` 通过。
  - `npm run build` 通过。
  - 本地使用 `DATABASE_URL` 指向不可用端口强制进入 `local_visual_demo`，完成双账号 smoke test：Media/CS/Admin 登录、自己不能给自己 TeamUp、TeamUp Interest `sent -> viewed -> mutual`、发送后联系方式可见、sender 撤回、Follow Request 进入 Inbox 并被接受、Admin 可查看共享 TeamUp/Follow 数据。

## 2026-05-24

### 线上密码登录、隐藏管理员入口与管理后台增强

- 背景：
  - 项目已上线到 Vercel，并绑定 `teamingapp.org`。
  - 用户要求普通用户不再使用一次性验证码登录，而是“学校邮箱注册 + 设置密码 + 后续密码登录”。
  - 管理员入口需要从主系统中移除，改为父域名下隐藏子域名访问。
  - 测试用户数据需要暂时保留，支持重复登录、编辑资料、上传和继续测试。
- 改动：
  - 新增密码哈希工具 `lib/password.ts`，使用 PBKDF2 保存密码哈希。
  - 扩展 `User`：新增 `passwordHash`、`status`、`suspendedUntil`、`adminNote`。
  - 扩展 `EmailVerification`：新增 `purpose`，区分 `register` 和 `reset_password`。
  - 扩展 `SupportTicket`：新增 `adminReply`、`adminRepliedAt`。
  - 新增 migration：`prisma/migrations/20260523160000_auth_admin_upgrade/migration.sql`。
  - 改造 `/api/auth/*`：
    - `POST /api/auth/register/send-code`
    - `POST /api/auth/register/complete`
    - `POST /api/auth/password-login`
    - `POST /api/auth/password-reset/send-code`
    - `POST /api/auth/password-reset/complete`
    - `POST /api/auth/developer-login`
  - `/login` 改为普通用户入口：邮箱注册、账号密码登录、找回密码。
  - 新增 `/admin-login`，管理员通过维护账号登录。
  - 新增 `middleware.ts`，限制 `/admin`、`/admin-login`、`/api/admin/*` 和 `/api/auth/developer-login` 只能在本地或 `ADMIN_HOSTS` 指定域名访问。
  - 主导航移除 `Admin`，避免从主系统直接跳转管理后台。
  - 管理后台增强：
    - Users：支持角色、账号状态、限时禁止操作和管理员备注。
    - Support Tickets：支持管理员回复和备注。
    - Boards：支持手动新增 Course Board，并编辑状态和规则。
    - Courses：新增课程时可选创建 offering 和 Course Board。
    - Metrics：新增 `/admin/metrics` 和 `GET /api/admin/metrics`，支持时间范围统计和 CSV 下载。
    - Configs：支持 `system_status`，可把系统临时切到 `paused`。
  - API dispatch 增加系统暂停检查，`auth/admin/demo` 之外的接口在暂停时返回维护提示。
  - Vercel 上传环境下，4MB 内文件改为内联 data URL 保存到数据库字段，避免 serverless 文件系统不持久导致测试数据丢失。
- 解决的问题：
  - 普通用户可注册、设置密码、重复登录和继续编辑测试数据。
  - 管理员入口与主系统隔离，主域名下不可直接访问管理后台。
  - 管理员可以实际读写 Neon 数据库中的用户、工单、课程、Course Board 和站点配置。
  - 测试版本的上传数据能够随用户数据暂存，不依赖 Vercel 临时文件系统。
- 验证：
  - `npx prisma format` 通过。
  - `npx prisma generate` 通过。
  - `npx prisma validate` 通过。
  - `npx prisma migrate dev` 本地通过。
  - `npm run typecheck` 通过。
  - `npm run lint` 通过。
  - `npm run build` 通过。
  - 本地 smoke test：`/login`、`/admin-login`、`/admin` 返回 `200 OK`。
  - Git commit：`aca1ad7 Add password auth and hidden admin access`。

### GitHub、Vercel、Neon 与管理员子域名上线

- 背景：
  - 用户需要把本地 commit 同步到 GitHub，并由 Vercel 自动部署。
  - GitHub HTTPS push 需要 token，终端中直接输入 GitHub 密码会失败。
- 操作结果：
  - commit `aca1ad7` 已同步到 GitHub `main`。
  - Vercel 最新 production deployment 使用 `aca1ad7`，状态为 `Ready / Current`。
  - Vercel 环境变量已新增/更新：
    - `ADMIN_HOSTS=admin.teamingapp.org`
    - `DEVELOPER_LOGIN_EMAIL`
    - `DEVELOPER_LOGIN_PASSWORD`
    - `DEVELOPER_LOGIN_ROLE=school_admin`
    - `DEVELOPER_LOGIN_DISPLAY_NAME`
    - `NEXT_PUBLIC_APP_URL=https://teamingapp.org`
    - `ENABLE_DEMO_ACCESS=false`
    - `EMAIL_DEBUG_CODE_RESPONSE=false`
  - Neon production branch 已使用 direct connection 执行：
    - `DATABASE_URL="..." npx prisma migrate deploy`
  - 线上迁移输出：`All migrations have been successfully applied.`
  - Vercel 添加 `admin.teamingapp.org`，Cloudflare DNS 配置后管理员子域名可访问。
- 注意事项：
  - 生产数据库迁移必须使用 Neon direct connection，不使用 pooled connection。
  - 生产环境不要运行 `npm run seed`。
  - 业务数据存储在 Neon PostgreSQL；Vercel 不存业务数据，Cloudflare 只做 DNS，GitHub 只存代码和 migration。

### 腾讯云 SES 接入进度

- 背景：
  - 项目需要把验证码邮件服务切换到腾讯云邮件推送 SES。
  - 注册验证码与找回密码验证码需要使用两套独立模板。
- 代码改动：
  - 移除 Resend 依赖，安装 `tencentcloud-sdk-nodejs-ses`。
  - 重写 `lib/email.ts`：
    - 使用腾讯云 SES `SendEmail`。
    - 支持 `TENCENTCLOUD_SECRET_ID`、`TENCENTCLOUD_SECRET_KEY`、`TENCENTCLOUD_SES_REGION`。
    - 支持独立模板：
      - `TENCENTCLOUD_SES_REGISTER_TEMPLATE_ID`
      - `TENCENTCLOUD_SES_RESET_TEMPLATE_ID`
    - 支持 `TENCENTCLOUD_SES_FROM_EMAIL` 和可选 `TENCENTCLOUD_SES_REPLY_TO_EMAIL`。
    - 开发环境无腾讯云密钥时仍可通过 debug code 继续本地调试。
- 腾讯云控制台配置进度：
  - 发信域名：`notify.teamingapp.org`。
  - 腾讯云 SES 地域：中国香港，对应环境变量 `TENCENTCLOUD_SES_REGION=ap-hongkong`。
  - Cloudflare DNS 已完成并通过验证：
    - `MX notify -> mxbiz1.qq.com`
    - `TXT notify -> v=spf1 include:qcloudmail.com ~all`
    - `TXT qcloud._domainkey.notify -> v=DKIM1; k=rsa; p=...`
    - `TXT _dmarc.notify -> v=DMARC1; p=none`
  - 发信地址已创建：
    - `verify@notify.teamingapp.org`
    - 发件人别名：`Developer_Teamaking`
  - Vercel 发信地址变量应为：
    - `TENCENTCLOUD_SES_FROM_EMAIL=Developer_Teamaking <verify@notify.teamingapp.org>`
  - 腾讯云模板已创建，等待审核：
    - `179674`：`TEAMAKING 注册验证码`

### BNBU 课程导入规范与默认 Course Board 配置

- 背景：
  - 用户明确课程数据由外部爬虫采集，TEAMAKING 只接收清洗后的业务 JSON。
  - “BNBU 官方课程分类补充”是之前“Teamaking 课程数据导入规范”的分类维度补充，总体任务仍包括导入、审核、自动对接用户基础数据、默认加入、手动退出和历史课程。
- 改动：
  - 新增 BNBU cleaned JSON 校验模块 `lib/bnbu-course-import.ts`，支持 `teamaking.bnbu_course_import.v1`。
  - 扩展 Prisma schema：
    - `Faculty/Major/Semester` 新增可选 `code`，用于 BNBU 稳定代码匹配。
    - `Course` 新增 `credits/ownerUnit/categoryTags/sourceRefIds`。
    - `CourseOffering` 新增 `sourceRefIds`。
    - 新增 `CourseImportBatch`、`CourseCurriculumRule`、`CourseSyllabusMetadata`。
    - `CourseBoardMembership` 新增 `source/status/originRuleId/leftAt`，支持默认加入与 opt-out。
  - 新增 migration `20260524120000_bnbu_course_import`。
  - 新增管理员 API：
    - `POST /api/admin/course-imports/validate`
    - `GET /api/admin/course-imports`
    - `POST /api/admin/course-imports`
    - `POST /api/admin/course-imports/:id/approve`
    - `POST /api/admin/course-imports/:id/reject`
  - 新增 `/admin/course-imports` 页面和后台导航入口，可粘贴 JSON 校验、创建待审批批次、批准或拒绝。
  - 批准导入后会 upsert BNBU school/domain、Faculty、Major、Semester、Course、Offering、Course Board、Curriculum Rule 和 syllabus teamwork metadata。
  - `default_join` 规则会根据学生 onboarding 的学校、专业/院系、年级默认创建 Course Board membership；`searchable_add` 不自动加入。
  - 学生退出自动加入的 Course Board 时保留 `opted_out`，后续同一规则导入不会自动加回，并提示通过工单反馈 `course_config_error`。
  - Dashboard 增加当前/历史 Course Boards 展示，旧学期 Course Board 会进入历史区。
- BNBU 分类覆盖：
  - `major_required`、`major_elective`、`bba_core`、`faculty_required`、`college_core`、`common_core`、`required_core`、`elective_core`、`concentration_required`、`concentration_elective`、`university_core` 及 University Core 子类、GE Level 1/2/3、`free_elective`、`supporting_course`、`interdisciplinary_course`、`final_year_project`、`internship`、`unknown`。

### BNBU 爬虫与清洗程序需求文档

- 背景：用户需要一份可交给外部开发者的 Markdown 文档，说明如何实现 `Crawler -> JSONL -> Python 清洗 -> JSON -> Frontend/API` 的完整数据管线。
- 改动：
  - 新增 `docs/BNBU_COURSE_CRAWLER_REQUIREMENTS.md`。
  - 文档覆盖 raw JSONL schema、cleaned JSON schema、各节点功能、卡点、校验要求、正式数据库字段映射、课程分类和 studentAction 规则。
  - 明确 crawler 不输出 memberships；默认加入由 TEAMAKING 在管理员批准导入后根据 `default_join` curriculum rules 生成。

### Course Import 差异预览

- 背景：用户要求补齐导入预览/差异对比，避免管理员盲批课程配置。
- 改动：
  - 新增导入 preview 计算：校验 JSON 时同步返回新增/更新 Faculty、Major、Course、Rule 数量，当前学期会失效的旧 rule 数量，默认加入 rule 数量，可搜索 rule 数量，以及预计默认加入用户数。
  - `GET /api/admin/course-imports/:id` 支持查看某个已创建批次的 preview。
  - `/admin/course-imports` 页面展示 Import Preview、validation errors/warnings、样例新增课程、更新课程、新增规则、将失效规则、默认加入规则和可搜索规则。
  - 创建待审批批次时把 preview 写入 `validationSummary`，方便后续审计。

### BNBU Import v2 与相对学期匹配

- 背景：用户指出 handbook 中的 2025/Fall 等年份不能直接当真实当前学期，programme handbook 只能生成 curriculum rules，真实 Course Board 必须来自 timetable/course-list offering。
- 改动：
  - 新增 `teamaking.bnbu_course_import.v2` 校验，兼容 v1。
  - `UserProfile` 增加 `entryYear` 和 `entryTerm`；`CourseCurriculumRule` 增加 `relativeTermCodes`。
  - default join 和 recommended courses 在 v2 下按学生入学信息与当前 semester 动态计算 `Y1S1`、`Y2S2` 等相对学期。
  - v2 校验阻止 programme-scoped rules 使用 `allMajors: true`，要求 `majorCodes`，并阻止 handbook/curriculum-only source 伪造成 offerings。
  - 历史 semester 不允许 `isCurrentCandidate: true`；unknown classification 必须用 `recommend_only` 或 `hidden`。
  - 新增 `course_imports/bnbu/` 用于提交最终 cleaned JSON，并 gitignore 本地 `local_bnbu_course_pipeline/` 工具目录。
    - `179675`：`TEAMAKING 找回密码验证码`
  - Vercel 已添加：
    - `TENCENTCLOUD_SES_REGION=ap-hongkong`
    - `TENCENTCLOUD_SES_FROM_EMAIL=Developer_Teamaking <verify@notify.teamingapp.org>`
    - `TENCENTCLOUD_SES_REGISTER_TEMPLATE_ID=179674`
    - `TENCENTCLOUD_SES_RESET_TEMPLATE_ID=179675`
- 待完成：
  - 腾讯云模板审核通过。
  - Vercel 添加 `TENCENTCLOUD_SECRET_ID` 和 `TENCENTCLOUD_SECRET_KEY`。
  - Vercel Redeploy。
  - 在线测试 `/login` 注册验证码和找回密码验证码真实投递。

### 文档整理

- 背景：
  - 用户希望把特殊环境变量、上线、更新、测试和数据维护说明沉淀下来。
  - 用户要求具体变更详情写入开发日志，而不是全部堆在 README。
- 改动：
  - 新增 `docs/ENVIRONMENT_VARIABLES.md`，集中记录：
    - Vercel 环境变量填写位置和 redeploy 要求。
    - `NEXT_PUBLIC_APP_URL`、`ADMIN_HOSTS`、管理员登录变量。
    - Neon `DATABASE_URL` 与 direct connection migration 规则。
    - 腾讯云 SES 地域、发信地址、模板 ID、DNS 记录和 API 密钥填写规则。
    - 上传存储策略。
    - 上线前检查清单。
  - README 增加 `docs/ENVIRONMENT_VARIABLES.md` 为开发者必读文档。
  - README 的 Vercel 环境变量部分改为引用专门指南，避免 README 成为密钥和值的混杂清单。

### 版本化数据集、线上爬虫入口与操作日志

- 背景：
  - 用户要求 crawler 能脱离 Codex 手动运行，并最终以独立子域名形式提供前端入口。
  - 用户要求导入 JSON 后不只保存单个巨大 payload，而是拆成线上数据集、保留导入/编辑日志。
  - 用户要求引入测试阶段/软件版本概念，支持开启新空白版本、保存旧版本最终状态，并记录现实时间操作日志。
- 改动：
  - 新增 `AppVersion`、`VersionCheckpoint`、`VersionCheckpointChunk`、`OperationLog`。
  - `User`、`EmailVerification`、`School`、`CourseImportBatch`、`CourseImportDataset`、`AdminAuditLog` 增加 `appVersionId`，用户邮箱和学校简称唯一性改为版本内唯一。
  - 新增 `CourseImportDataset` 及 source refs/faculties/majors/courses/rules/offerings 子表；`CourseImportBatch` 增加 `name`、`datasetId`、版本字段，pending 批次引用拆分后的数据集。
  - 管理员导入页新增配置名称、数据集下载入口；创建 pending 时写 `storage/course_import_artifacts/`，批次列表不再展示巨大 payload。
  - 新增 `/admin/versions`：查看 active version、开启新版本、创建 checkpoint、下载 checkpoint、记录回溯请求。
  - 新增 `/admin/logs` 可读操作日志视图；用户写入、课程加入/退出、TeamUp/Follow、工单、管理员审批和版本操作会写入 `OperationLog`。
  - 新增 `/crawler` 和 `/api/crawler/*`：支持自然语言说明、admission years、programme/faculty 范围、source URL、输出模式，启动 BNBU programme handbook crawl，并提供输出 JSON 下载。
  - 新增 tracked crawler runner `scripts/bnbu-crawler/run-handbook-preview.mjs`；本地 gitignored pipeline 仍保留为实验区。
  - `middleware.ts` 增加 `CRAWLER_HOSTS`，用于线上独立 crawler 子域名；`storage/` 加入 `.gitignore`。
  - 新增 migration `20260524190000_versions_datasets_logs_crawler_storage` 并已应用到本地数据库。
- 验证：
  - `npx prisma validate` 通过。
  - `npx prisma migrate dev` 已应用最新迁移。
  - `npx prisma migrate status` 显示数据库 schema up to date。
  - `npm run lint` 通过。
  - `npx tsc --noEmit` 通过。
  - `npm run build` 通过。
  - Smoke test：`node scripts/bnbu-crawler/run-handbook-preview.mjs --cohorts=2025 --limit=1 ...` 成功生成 `storage/crawler_outputs_smoke/bnbu-2025-admission-handbook.teamaking.json`。
  - 使用 `npx tsx` 调用主程序校验器验证 smoke JSON：`ok: true`，50 courses，50 curriculum rules，0 offerings。
- 注意：
  - 自动破坏性 rollback/replay 暂不直接执行；当前实现保存并下载 checkpoint，回溯请求会记录日志，避免误删线上数据。
  - `offerings[]` 仍取决于官方真实开课/semester offerings 来源；programme handbook 输出为空 offerings 是预期状态。

### BNBU Crawler 管理员变量表

- 背景：
  - 用户希望 crawler 页面所有可交互项和变量都有一份面向非开发管理员的 Markdown 说明，避免只靠口头解释。
- 改动：
  - 新增 `docs/BNBU_CRAWLER_ADMIN_VARIABLES.md`。
  - 文档覆盖：
    - 推荐操作流程。
    - `/crawler` 页面所有输入字段：自然语言说明、target、Handbook URL、Admission years、Programme codes、Faculty codes、Academic year、Term、Limit、Output mode。
    - target 枚举、output mode 差异、派生变量、Jobs 表、Download outputs 表。
    - smoke test、全量导入、按学院导入三种常见填法。
    - failed job、empty offerings、limit 误用、admission year 与 academic year 混淆等常见错误。
    - 下载 JSON 后进入 `/admin/course-imports` 前的检查清单。
  - README 的“开发者先读”和 BNBU Course Import 段落增加该文档入口。

### Admission-Year 配置语义、Crawler Job 持久化与工单后台

- 背景：
  - 用户指出 `term` 不应被误解为课程安排分类；BNBU handbook 的核心分类应是 admission year 的四年课程安排。
  - 用户指出一次 JSON 输入就是一次课程安排配置操作，不应被解释为“拆成多个 pending 批次”。
  - 用户要求 crawler job 可自定义名称，并能在失败时看到明确原因。
  - 用户要求 Support Tickets 后台支持搜索、类型筛选和更完整的处理界面。
- 改动：
  - 新增 `CrawlerJob` Prisma model 和 migration `20260525003000_crawler_jobs`；crawler 任务现在持久化保存自定义任务名、输入范围、命令、日志、输出、失败原因、exit code 和开始/结束时间。
  - `/crawler` 页面增加 `Job name`；将 `Academic year / Term` 改为 `Activation preview year / term`，说明它只用于预览 Course Board 激活，不改变 admission-year 课程安排。
  - `/api/crawler/jobs` 改为读取数据库中的 `CrawlerJob`，开发服务器重启后仍可看到历史任务；长时间未更新的 running job 会标记为 failed 并给出原因。
  - `/admin/course-imports` 文案改为“Admission-year configuration operations / 导入队列与配置历史”；明确每个 JSON 只创建一条 pending 配置操作，拆分数据集只是为了查询、审计、编辑和回溯。
  - 导入列表的 pending 行增加直接“批准 / 拒绝”按钮；预览页把 `cohort` 面向管理员的文案替换为 `admission year`。
  - `/admin/support-tickets` 改为管理工作台：显示总数/待处理/处理中，支持搜索、类别筛选、状态筛选，列表提前展示工单类型，右侧/下方提供详情、管理员备注、用户回复和状态更新。
  - 用户工单类别增加 `course_config_error`，用于课程配置错误反馈。
  - README 和 `docs/BNBU_CRAWLER_ADMIN_VARIABLES.md` 更新 admission-year 语义、job name、Activation preview、pending/approved 历史记录解释。
- 验证：
  - `npm run typecheck` 通过。
  - `npx prisma validate` 通过。
  - `npx prisma migrate dev` 已应用 `20260525003000_crawler_jobs` 并重新生成 Prisma Client。
  - 复现全量 crawler：`node scripts/bnbu-crawler/run-handbook-preview.mjs --cohorts=2025,2024 --limit=all --semesterCode=2026-Fall ...` 当前成功生成 2025 和 2024 admission JSON，说明截图中的 failed 更可能来自旧版本、网络/PDF 拉取瞬断或开发服务器中断。
  - Smoke test：`node scripts/bnbu-crawler/run-handbook-preview.mjs --cohorts=2024 --limit=1 ...` 成功生成 `storage/crawler_outputs_smoke/bnbu-2024-admission-handbook.teamaking.json`。

### TeamUp Interest 卡片对齐

- 背景：
  - 用户指出 TeamUp Menu 中 TeamUp Interest 卡片的头像、正文、状态和操作按钮视觉对齐不统一。
- 改动：
  - 调整 `TeamUpRequestCard` 布局：头像固定为左列，正文、Profile/Post 按钮和处理按钮统一在内容列内对齐，状态标签固定在内容区右上角。
  - 该组件同时影响 `/team-up-requests` 和单个 Teamaking Post 详情里的 TeamUp Interest 列表。
- 验证：
  - `npm run typecheck` 通过。

### Public Profile 重复资料卡清理

- 背景：
  - 用户指出 public profile 页面已经处于 View Profile 场景，右下角再次展示 `ProfileCard` 和 `View Profile` 按钮是重复信息。
- 改动：
  - 将右下角 `ProfileCard` 中的年级、专业、headline、bio、output tags 和 skills 合并到顶部 profile hero。
  - 删除 public profile 页面右下角重复资料卡；Contact 改为单独整宽卡片。
- 验证：
  - `npm run typecheck` 通过。

### Matches 推荐理由标签清理

- 背景：
  - 用户指出 Teamaking Post 本身已经是校内招募队友场景，`Same school` 和 `Open to Team` 作为卡片下方推荐标签没有信息增量。
- 改动：
  - `/api/matches` 不再为 Teamaking Post 推荐结果返回 `Same school` 和 `Open to Team` 理由。
  - `MatchesPage` 对旧数据或 demo 数据做前端兜底过滤；过滤后没有推荐理由时不再渲染空标签区域。
- 验证：
  - `npm run typecheck` 通过。

### 简历解析结构化展示

- 背景：
  - 用户指出 Profile 简历解析只是把识别文本塞成一段，排版混乱、显示不完整，也没有滚动条。
- 改动：
  - `parseResumeText` 从单段摘要升级为本地规则解析：输出 `summary`、`skills`、`highlights`、`sections`、`rawText`、`lineCount`、联系方式和链接。
  - 增加中英文 section 识别：教育背景、实习/工作经历、项目经历、技能关键词、奖项/证书、语言能力。
  - 增加关键词归纳：writing、research、presentation、data analysis、figma、visual design、project management、marketing、collaboration tools 等。
  - `/profile/me` 简历展示改为结构化面板：自动摘要、联系方式、关键词、Highlights、分区内容；完整解析原文放入可展开的滚动区域。
  - 新增 `/api/profile/me/reparse-resume` 和 Profile 编辑页“重新整理当前简历”按钮；已有简历可不重新上传，直接重新生成结构化解析。
  - README 的 Profile 上传说明更新为“本地结构化解析”，为后续接云端文档解析或模型摘要保留接口。
- 验证：
  - `npm run typecheck` 通过。
  - 使用 `npx tsx` 对中文简历片段 smoke test，能产出 `education`、`skills`、`experience` sections、skills 和 rawText。

### 个人卡片标签去重

- 背景：
  - 用户指出部分个人 block 会把相同技能标签展示成两行，例如 `coding / data analysis / project management` 重复出现。
- 改动：
  - `ProfileCard` 将 `profile.outputTags` 和 `user.skills` 合并后按大小写不敏感方式去重，再统一渲染。
  - 保留 `View Profile` 等卡片操作不变，只清理重复标签显示。
- 验证：
  - `npm run typecheck` 通过。

### Profile 联系方式可复制

- 背景：
  - 用户希望 public profile 的联系方式 block 中每个联系方式之间有明确分割，并且邮箱、WeChat、LinkedIn/主页等文本型联系方式支持一键复制。
- 改动：
  - Public Profile 的 `Contact` block 改为“联系方式”，每条联系方式独立成行并使用分割线区隔。
  - 学校邮箱、WeChat、LinkedIn/主页、个人邮箱增加复制按钮；复制成功后短暂显示“已复制”。
  - WeChat QR 保持图片展示，不加入复制按钮。
- 验证：
  - `npm run typecheck` 通过。

### Proof 分区与 Matches 标签语义

- 背景：
  - 用户指出 Public Profile 的 proof 区域仍只粗分 Works/Honors，不能区分技能认证、奖项、简历和过往 paperwork；即便没有材料也应明确显示空状态。
  - 用户指出 Matches 中 `Profile ·` / `Signal ·` 标签语义混在一起，应区分课程/交付要求和个人擅长。
- 改动：
  - Profile proof 区域新增固定四类分区：过往作品 / Paperwork、简历、技能 / 职业认证、奖项 / GPA；每类都显示数量和空状态。
  - Profile 编辑页的已保存 proof 区域也使用同一套分区，置顶成果仍单独保留。
  - `TeamakingPostCard` 将 `post.strengths` 与 `contributionTypes` 合并为“课程 / 交付要求”，将用户 `outputTags` 与 skills 合并为“个人擅长”，并去掉 `Profile ·` / `Signal ·` 前缀。
  - Matches 外部推荐理由过滤改为大小写不敏感，避免旧数据里的 `Same school` / `Open to Team` 继续显示。
- 验证：
  - `npm run typecheck` 通过。

### 测试版上线硬化

- 背景：
  - 目标调整为少量 BNBU 学生可稳定测试，优先补齐登录、课程数据、Profile 上传、TeamUp、错误追踪和管理员基础维护。
- 改动：
  - 新增稳定错误码与 `ErrorEvent` 日志；API 错误响应统一返回 `error/errorCode/requestId`，后台新增 `/admin/error-events` 搜索。
  - 新增 `AuthEvent`，实现验证码同邮箱同用途 2 分钟冷却、密码登录同邮箱 1 小时 5 次失败限流；注册完成后回到登录页。
  - 管理员登录改为数据库正式管理员账号，新增 CLI 与后台维护入口；`docs/admin-credentials.local.md` 加入 `.gitignore`。
  - 封禁/暂停账号可登录到 `/account-restricted` 并提交/查看工单，其它业务 API 仍由 `requireUser` 拦截。
  - Profile 上传增加 storage provider 抽象、本地/R2/inline 模式、基础后缀/MIME/大小检查，并保存 storage/scan metadata。
  - Portfolio 可见性改为服务端严格过滤：private、same_school/public、same_course_board 分别按本人、同校已验证、共享 active Course Board 判断。
  - Course 管理增加 offering 创建/编辑与 Board 生成；course merge 迁移关联并归档源课程；checkpoint restore 改为创建新的 active version。
  - 工单新增用户侧“我的工单”；TeamUp 状态去除后台 archived 入口；后台 Major/Semester/Board 表单改为下拉/分字段输入。
  - 新增 `docs/ERROR_CODES.md`、`docs/ACCEPTANCE_CHECKLIST.md`、Vitest/Playwright 测试入口。
- 验证：
  - `npm run prisma:validate` 通过。
  - `npm run typecheck` 通过。
  - `npm run lint` 通过。
  - `npm run test` 通过（无 `TEST_DATABASE_URL` 时 DB integration 安全跳过）。
  - `npm run test:e2e` 通过。
  - `npm run build` 通过。

### 多语言与全站公告

- 背景：
  - 用户要求系统框架支持简体中文 / English，默认中文，首次打开按 IP 国家/地区判断中文区或英文区，并提供手动语言切换。
  - 用户要求管理员可向所有用户发布公告，公告在首页上方及任意页面顶部以弹窗方式出现，并能查看历史公告。
  - 用户确认腾讯云两套邮件模板已完成审核，需要纳入上线准备检查。
- 改动：
  - 新增 `lib/i18n.ts` 与 `LanguageRuntime`：通过 `teamaking_locale` cookie 和 localStorage 保存语言选择；middleware 首次访问根据 `x-vercel-ip-country` / `cf-ipcountry` 初始化语言；右上角提供手动切换。
  - 翻译策略限定在系统框架文案、导航、按钮、占位符和状态文案；输入框、文本域、代码块、pre、select option 以及 `data-no-translate` 内容不会被自动翻译。
  - 新增 `SiteAnnouncement` 和 `UserAnnouncementRead` 模型、迁移 `20260525162000_announcements_i18n`。
  - 新增 `/api/announcements`、`/api/announcements/:id/read`、`/api/admin/announcements`，支持公告列表、已读记录、管理员创建/发布/归档。
  - 新增全站 `AnnouncementCenter`：任意页面顶部显示最新公告入口，未读公告自动弹窗；用户可打开历史弹窗或进入 `/announcements` 查看历史。
  - 新增 `/admin/announcements` 管理页：支持中英文标题/正文、优先级、草稿/立即发布、发布、归档和阅读计数。
  - README、`.env.example`、`docs/ENVIRONMENT_VARIABLES.md` 更新多语言、公告、`CRAWLER_HOSTS` 和腾讯云 SES 模板审核通过后的上线配置。
- 验证：
  - `npx prisma validate` 通过。
  - `npx prisma migrate dev` 已应用 `20260525162000_announcements_i18n`。
  - `npm run typecheck` 通过。
  - `npm run lint` 通过。
  - `npm run test` 通过。
  - `npm run build` 通过。
  - `npm run test:e2e` 通过；smoke test 已兼容中文/英文标题。

### Pre-Launch Issues 清单

- 背景：
  - Vercel production build 成功后出现 npm peer dependency 和 deprecated dependency warnings。
  - 用户要求这类“不阻塞当前运行、但下次上线前需要统一调整”的问题进入固定 Markdown 清单，而不是只留在聊天记录。
- 改动：
  - 新增 `docs/PRE_LAUNCH_ISSUES.md`，记录 pre-launch issue 的状态、来源、影响判断、下次上线前动作和验证命令。
  - 将 2026-05-25 Vercel build warning 记录为 `PLI-2026-05-25-001`：`@types/node@22.10.2` 不满足 Vite 8 peer range、`eslint@8.57.1` 和若干 transitive dependencies deprecated。
  - README 的“开发者先读”和“测试与验收”新增规则：任何需要在下一次上线前调整的非阻塞 build/deploy warning 必须写入 `docs/PRE_LAUNCH_ISSUES.md`。
- 验证：
  - 文档变更，无代码行为变化；未运行代码测试。

## 2026-05-26

### 生产管理员 Bootstrap 登录

- 背景：
  - 线上管理员登录失败，原因是本地命令可能连接了本地 `.env` 数据库，而 Vercel 线上读取的是生产 `DATABASE_URL`。
  - 用户要求能够在不清空已有数据的前提下，手动定义管理员账号密码；需要重新部署也可以。
- 改动：
  - `/api/auth/admin-login` 增加 `ADMIN_BOOTSTRAP_*` 环境变量 fallback。
  - 当登录邮箱和密码匹配 `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD` 时，系统会在当前 active app version 下 upsert 管理员账号，更新密码、角色、显示名和 active 状态，并直接完成登录。
  - 兼容旧 `DEVELOPER_LOGIN_*` 变量作为 fallback，但文档标记为不推荐长期使用。
  - README、`.env.example`、`docs/ENVIRONMENT_VARIABLES.md` 同步新增生产管理员 bootstrap 操作说明。
- 数据安全：
  - 该机制只 upsert 一个管理员 `User` 和对应 `UserProfile`，不执行 seed，不删除或重建任何已有用户、课程、课程安排、导入批次、公告、上传文件或日志。
- 验证：
  - 待运行 `npm run typecheck` 和 `npm run build` 后部署。

### Crawler 现场导入与本次输出下载

- 背景：
  - 用户要求能够在网站上现场跑一次 BNBU crawler，并可选择把本次爬取结果更新到线上数据库。
  - 用户要求每次跑爬虫后都有“下载本次爬取内容”的按钮。
  - 用户希望 crawler 入口和管理员入口使用同一组账号密码，不要维护两套凭据。
- 改动：
  - Crawler 表单新增 `After crawl`：`download_only`、`create_pending`、`approve_import`。
  - `download_only` 默认不写库；`create_pending` 创建导入数据集和 pending 批次；`approve_import` 创建批次后立即批准并写入课程目录和 admission-year 课程安排规则。
  - Job 行新增“下载本次爬取内容”按钮，返回该 job 的输出 bundle；同时保留单个输出 JSON 下载链接。
  - Crawler job 完成后只把本次新增/更新的输出挂到该 job，避免输出列表混淆。
  - 生产写文件目录在 Vercel 下改用 `/tmp/teamaking`，避免 serverless 只读文件系统问题；长期审计仍以数据库 dataset rows、batch、operation log 和 checkpoint 为准。
  - `/admin-login` 和 `/api/auth/admin-login` 允许在 crawler 子域使用；新增 `SESSION_COOKIE_DOMAIN=.teamingapp.org` 文档，使 admin/crawler 子域可共享登录 cookie。
- 数据安全：
  - 直接批准导入不会清空已有用户、课程、公告或上传记录。
  - 对同 admission year 的旧 pending 批次，`approve_import` 会标记为 rejected，避免重复 pending 阻挡现场导入。
- 验证：
  - 待运行 `npm run typecheck` 和 `npm run build` 后部署。

### 社交、课程评价、资料上传与内容中心改造

- 背景：
  - 用户要求 mutual follow 后形成好友列表、真实课程可评论、Profile 上传流程可编辑和站内预览、onboarding 改成遮罩式引导、邮箱推断年级锁定、帮助中心/开发者日志/联系开发者可由管理员维护。
  - 用户要求工单入口改为右下角折叠浮窗，TeamUp/好友申请在菜单显示提醒数字，管理员表格隐藏内部字段并保留搜索。
- 改动：
  - 新增 `CourseReviewComment` 与 `ContentDocument` 模型和 migration `20260526030000_social_content_reviews`；`UserProfile` 增加 onboarding tour dismissal 与管理员学业信息覆盖字段。
  - 新增 `/api/friends`、课程评论/回复/删除接口、`/api/notifications/summary`、`/api/content` 和 `/api/admin/content` CRUD。
  - `/onboarding` 改为遮罩式 step tour；学校邮箱 local-part 第二位数字会推断 `entryYear = 2020 + x`、`entryTerm = Fall` 和当前 `grade`，普通用户在 Profile 端只读，管理员可在 User Management 覆盖。
  - 新增 `/friends`、`/help`、`/developer-log`、`/contact-developer`、`/admin/content` 页面；联系开发者默认文档基于 260506 简历摘要，并固定展示 WeChat `Oboretastellar` 和邮箱 `wojiaonzj2005@163.com`。
  - 课程详情页新增课程评价区；Course Board 标题可进入课程详情；评论支持顶层分页、多级回复和软删除。
  - Profile 上传证明的贡献说明、结果/复盘前端可空；已上传 PortfolioItem 可视觉化编辑；技能认证和职业认证合并展示；简历作为独立模块靠后；图片/PDF/文本/Markdown/Office 文件通过浮窗站内预览。
  - 全站新增右下角工单浮窗；Navbar/Sidebar 对 TeamUp Interest 和 Follow Request pending 数显示红点数字。
  - 管理员通用表格隐藏 `appVersionId`，`id` 放靠后；User Management 首列提供“查看 Profile”，并保留字段搜索。
- 验证：
  - `npm run prisma:validate` 通过。
  - `npm run prisma:generate` 通过。
  - `npm run typecheck` 通过。
  - `npm run lint` 通过。
  - `npm run test` 通过（3 files passed，6 tests passed，1 skipped）。
  - `npm run build` 通过。

### Course Import 批准失败修复

- 背景：
  - 线上管理员后台批准 course import 时出现 `INTERNAL_SERVER_ERROR`，请求 ID 为 `63f98f4b-5e8f-4426-a74c-5b86e9a5793e`。
  - 已通过线上 `/admin/error-events` 查询到该错误事件：路径为 `/api/admin/course-imports/cmpll34f807demy9jdv7bspjv/approve`，但旧版本 `metadata` 为空，无法从数据库日志直接确认 Prisma code。
  - 当前本地环境没有 Vercel CLI/token，不能直接读取 Vercel production function log；本轮改动重点是让后续同类错误在 `ErrorEvent.metadata` 中留下阶段、耗时、Prisma code/meta。
- 改动：
  - `approveCourseImportBatch` 增加 `load_dataset`、`apply_import`、`build_summary`、`mark_approved`、`checkpoint` 阶段追踪，每个阶段写 `operationLog`。
  - 批准失败时会把失败阶段、阶段耗时、原始错误 name/message/code/meta 写入 `ErrorEvent.metadata`，同时把可读失败摘要写入 `CourseImportBatch.adminNote`。
  - 批准成功后不再同步创建完整 `VersionCheckpoint`；`checkpoint` 阶段改为 `skipped_manual_checkpoint`，管理员需要回溯点时在版本管理页手动创建完整快照。
  - `applyBnbuCourseImport` 的 `default_join` 只对匹配当前 academic term 的规则执行，避免 2025 admission 在 `2026-Spring` 对全部 default-join rules 做无效查询。
  - rule deactivation 范围从“同 semester 全量”收窄为“同 semester 且 admission years 与本次导入重叠”，避免导入 2025 admission 时误停用 2024 admission 规则。
  - Prisma import transaction 临时设置 `timeout: 60000`、`maxWait: 10000`。
- 验证：
  - `npm run prisma:validate` 通过。
  - `npm run typecheck` 通过。
  - `npm run test` 通过（3 files passed，6 tests passed，1 skipped）。
  - `npm run build` 通过。

### 剩余未完成任务修正版收尾

- 背景：
  - 用户确认 BNBU class schedule 只是学期时间安排，不应作为课程存在、真实开课或 CourseBoard 配置依据。
  - 本轮按每年 admission handbook 作为唯一课程配置来源，忽略 `semester_offerings` 与 `syllabus_teamwork` 管线。
- 改动：
  - Crawler API 与 `/crawler` 页面只暴露 `programme_handbook` 目标；自然语言里出现“开课/组队”等词也不会自动切到预留目标。
  - README、crawler 管理员变量表、BNBU crawler requirements 明确：`offerings[]` 对 handbook import 为空是正常状态，CourseBoard 由当前 academic term + admission year + major + `relativeTermCodes` 激活。
  - 上传解析扩展到 CSV/TSV、Excel `.xls/.xlsx`、PPTX、旧 `.ppt` 二进制文本兜底、旧 `.doc`；解析失败时保存文件并返回清楚 fallback 文本，不阻止上传。
  - 新增 `read-excel-file`、`word-extractor`、`fflate` 依赖；因 `xlsx` npm audit 存在无修复漏洞，改用 `read-excel-file` 处理 `.xlsx`。
  - `@types/node` 升级到 `22.19.19`，解决 Vite 8 peer dependency warning；Next.js / `eslint-config-next` 升级到 `16.2.6`，ESLint 升级到 `9.39.4` 并改用 flat config。
  - `npm run build` 切换为 `next build --webpack`，消除 Next 16 Turbopack NFT tracing warning；`middleware.ts` 按 Next 16 约定迁移为 `proxy.ts`。
  - 修复 Next 16 async API 兼容：`cookies()`、App Route `context.params` 和动态页面 `params` 均改为 await。
  - `npm run typecheck` 改为先执行 `next typegen`，确保 Next 16 route types 在独立 typecheck 时已生成。
  - `npm run test:e2e` 清理 `FORCE_COLOR` / `NO_COLOR` 环境变量，消除 Playwright/Node 颜色环境 warning。
  - 按线上报错复盘建议，将 crawler 脚本里的 `classificationPatterns` 顶层数组改为函数返回，规避 Node.js v25 + `pdfjs-dist` 静态解析触发形态。
  - `.env.example` 与环境变量文档补充 `TEST_DATABASE_URL`，强调 DB integration test 只能使用独立测试库。
  - `docs/PRE_LAUNCH_ISSUES.md` 将旧 Vercel dependency warnings 和 Next 16 Turbopack NFT tracing warning 均标记为 Fixed。
- 验证：
  - `npm run prisma:validate` 通过。
  - `npm run typecheck` 通过。
  - `npm run lint` 通过（0 warnings）。
  - `npm run test` 通过（3 files passed，8 passed，1 skipped）。
  - `npm run test:e2e` 通过（2 passed，0 warnings）。
  - `npm run build` 通过（0 warnings）。
  - `npm audit --omit=dev --registry=https://registry.npmjs.org --json` 通过，0 vulnerabilities。

### BNBU Crawler 2023 Admission 修复

- 背景：
  - 线上 crawler 跑 `2025,2024,2023` admission 时失败，日志显示 `ERR_MODULE_NOT_FOUND: Cannot find package 'pdfjs-dist'`。
  - 页面同时显示 2024/2025 输出，是因为失败任务回退展示了历史输出文件，不代表本次任务成功生成。
- 改动：
  - 将 `pdfjs-dist` 加入正式 dependencies，确保 Vercel serverless 运行 `scripts/bnbu-crawler/run-handbook-preview.mjs` 时能够加载 PDF parser。
  - PDF standard fonts 路径改为通过 `import.meta.resolve("pdfjs-dist/standard_fonts/")` 从实际安装包解析，避免本地/线上目录结构不同导致文本抽取为空。
  - PDF 文本抽取改为按 PDF.js items 重组行：空字符串视为换行、空白片段视为列分隔，修复新版 PDF.js 将 `course code / title / units` 拆成多个 text item 后课程行匹配不到的问题。
  - PDF.js verbosity 调整为只输出错误，隐藏不影响解析结果的字体 warning。
  - Crawler job 失败时不再用旧的历史文件作为本次 job outputs fallback，避免管理员误以为失败任务生成了部分旧 JSON。
- 验证：
  - `node scripts/bnbu-crawler/run-handbook-preview.mjs --cohorts=2025,2024,2023 --limit=1 --academicYear=2026 --term=Fall --semesterCode=2026-Fall --semesterName='2026 Fall' --outDir=/tmp/teamaking-crawler-smoke` 通过，生成 2023/2024/2025 三个文件，每个 ACCT 输出 49 门课程和 49 条规则。
  - `node scripts/bnbu-crawler/run-handbook-preview.mjs --cohorts=2023 --limit=all --academicYear=2026 --term=Fall --semesterCode=2026-Fall --semesterName='2026 Fall' --outDir=/tmp/teamaking-crawler-2023-full` 通过，2023 admission 输出 4 个 faculty、31 个 major、1060 门课程、1462 条规则、`offerings=0`。

### Crawler 输出整包误导导入修复

- 背景：
  - 用户在 course import 页面看到 `schemaVersion must be ...`、`school is required`、`offerings must contain at least one offering` 等错误。
  - 复盘后确认这是把 crawler 的“本次爬取内容”整包 `{ job, files }` 粘贴进导入框导致的；该整包不是单个 admission JSON，因此顶层没有 `schemaVersion`、`school`、`semester` 等字段。
- 改动：
  - Course import payload 解析器会识别 crawler output bundle：单文件 bundle 自动解出其中的 `payload`；多文件 bundle 返回明确中文错误，提示下载单个 `bnbu-YYYY-admission-handbook.teamaking.json`，或在 crawler 的 `After crawl` 中选择 `create_pending` / `approve_import`。
  - Crawler job 的整包下载按钮改为“下载整包备份”，单个输出按钮改为“可导入 JSON：文件名”，避免管理员把备份整包当作可导入配置。
  - 整包下载文件名增加 `outputs-backup-not-direct-import.bundle.json` 后缀，进一步提示它不是直接导入文件。
- 验证：
  - `npm run typecheck` 通过。
  - `npm run lint` 通过（0 warnings）。
  - `npm run build` 通过（0 warnings）。
  - `npm run test` 通过（3 files passed，8 passed，1 skipped）。
  - `npm run test:e2e` 通过（2 passed，0 warnings）。
  - `npm run prisma:validate` 通过。
  - `npm audit --omit=dev --registry=https://registry.npmjs.org --json` 通过，0 vulnerabilities。

### Content Documents 树状管理与阅读

- 背景：
  - 管理员内容文档页面只有表格和表单，无法直观看到帮助中心、开发者日志、联系开发者文档的父子级结构。
  - 用户侧文档也需要接近管理员侧的树状阅读体验，但不能编辑。
- 改动：
  - 新增共享的内容文档树组件，支持展开、收起、点击选择文档，并显示文档类型、slug 和后台状态。
  - `/help`、`/developer-log`、`/contact-developer` 改为左侧文档目录树、右侧 Markdown 阅读区；用户只能阅读已发布内容。
  - `/admin/content` 改为左侧文档树、右侧预览和视觉化编辑表单；支持搜索、按文档类型筛选、新建根文档、新建子文档、删除、预览 Markdown 和图片。
  - 后台父级文档从手输 ID 改为同类型文档下拉选择，降低误操作概率。
  - 后台内容页不再额外显示通用原始表格，避免和树状管理入口重复。
- 验证：
  - `npm run typecheck` 通过。
  - `npm run lint` 通过（0 warnings）。
  - `npm run build` 通过（0 warnings）。
  - `npm run test` 通过（3 files passed，8 passed，1 skipped）。
  - `npm run test:e2e` 通过（2 passed，0 warnings）。
  - `npm run prisma:validate` 通过。
  - `npm audit --omit=dev --registry=https://registry.npmjs.org --json` 通过，0 vulnerabilities。

### Content & Announcements 分区管理

- 背景：
  - 用户指出内容后台把“新建内容”和“编辑已有内容”混在一起，管理员看不清现有结构，也不方便在目录树中直接创建内容。
  - 用户要求后台内容管理分成“联系开发者 / 开发者日志 / 帮助中心 / 全站公告”几个子 tab；公告要纳入同一套内容管理入口，但保留未读弹窗提醒。
  - 用户进一步明确：新建分类文件夹和新建文档是两个独立动作，最好直接发生在文件树上。
- 改动：
  - `ContentDocument` 增加 `nodeType` 字段，区分 `folder` 和 `document`；旧内容默认作为 `document` 兼容显示。
  - `/admin/content` 改为 `Content & Announcements` 工作台：联系开发者为单页内容列表，开发者日志和帮助中心为可展开/收起的目录树，全站公告为独立公告管理 tab。
  - 文件树支持在根节点或任意文件夹上分别“新建文件夹”和“新建文档”；新建模式和编辑已有模式有独立标题、说明和表单状态。
  - 文件夹只保存结构字段，不显示 Markdown 正文和图片上传；文档继续支持 Markdown、摘要、图片、发布/隐藏和预览。
  - `/admin/announcements` 重定向到 `/admin/content`，后台导航不再暴露两个重复入口。
  - 用户侧帮助中心、开发者日志继续使用树状阅读；文件夹作为目录节点，点击文件夹只显示说明，不当正文文档阅读。
- 数据迁移：
  - 新增 `prisma/migrations/20260526043000_content_document_node_type/migration.sql`，为 `ContentDocument.nodeType` 添加默认值和索引。
- 验证：
  - `npm run prisma:validate` 通过。
  - `npm run typecheck` 通过。
  - `npm run lint` 通过（0 warnings）。
  - `npm run build` 通过（0 warnings）。
  - `npm run test` 通过（3 files passed，8 passed，1 skipped）。
  - `npm run test:e2e` 通过（2 passed）。
  - `npm audit --omit=dev --registry=https://registry.npmjs.org --json` 通过，0 vulnerabilities。

### Portfolio 文件预览入口补齐

- 背景：
  - 用户在 Profile 的 Past work / Paperwork 卡片中看到作品类型和编辑按钮，但没有明显的已上传文件预览入口。
  - 现有卡片只在 `fileUrl` 存在时显示“预览”，对仅有外部链接、解析文本、旧存储字段或缺少文件名的记录没有明确反馈。
- 改动：
  - Portfolio 卡片统一计算预览状态：`fileUrl`、`externalUrl`、`parsedText` 或 metadata 摘要任一存在，都显示“预览”按钮并打开站内 `FilePreviewModal`。
  - 没有可预览内容时显示“暂无文件预览”，并在可编辑场景提示“点击编辑可补传”，避免管理员/用户误以为按钮漏渲染。
  - 文件名缺失但存在存储字段时显示“已上传文件”，减少旧数据或迁移数据的空白状态。
- 验证：
  - `npm run typecheck` 通过。
  - `npm run lint` 通过（0 warnings）。
  - `npm run build` 通过（0 warnings）。
  - `npm run test` 通过（3 files passed，8 passed，1 skipped）。

### 简历解析实习经历完整性修复

- 背景：
  - 用户反馈 Profile 简历解析的 Highlights 中，实习经历只显示开头几行，后续项目职责和复盘内容丢失。
  - 根因是解析器先用关键词抓取前 5 条，再把 Highlights 限制到 6 条；同时 `experience/projects` section 也只保留 8 条，长实习经历容易被截断。
- 改动：
  - `experience` 和 `projects` section 的保留上限提高到 32 条，技能 section 提高到 20 条，普通 section 保留 14 条。
  - Highlights 改为优先放入 `experience/projects` 的结构化内容，再补关键词命中的行，并把上限提高到 16 条。
  - 新增单元测试覆盖多行实习经历，确认 O2O 闭环、达人合作、数据复盘、内容协作等后续行不会丢失。
- 验证：
  - `npm run test -- tests/unit/profile-assets.test.ts` 通过（6 passed）。
  - `npm run typecheck` 通过。
  - `npm run lint` 通过（0 warnings）。
  - `npm run build` 通过（0 warnings）。

### Free Elective / 手动课程加入范围修复

- 背景：
  - 用户指出课程搜索结果里部分课程只有“详情”没有“加入课程板”，这会让 free elective 被误限制在个人课程大纲内。
  - 复查后确认：搜索接口已经返回同校 active 课程，但前端只有在课程已有 CourseBoard 时才显示加入按钮；没有当前学期 CourseBoard 的课程无法手动加入。
- 改动：
  - 新增 `POST /api/courses/:courseId/join`：同校 active 课程均可手动加入；如果当前学期没有 CourseOffering/CourseBoard，会即时创建一个平台内自选 CourseBoard 并加入默认 `1001` section。
  - 搜索结果不再依赖已有 board，所有可搜索 active 课程都显示“加入课程板”。
  - 课程详情页增加“加入课程板”按钮，并明确说明自由选修/手动加入只代表 TEAMAKING 平台内自选，不代表官方选课。
  - 新建的手动 CourseOffering 使用 `sourceRefIds: ["manual_search_join"]` 标记，便于后续区分官方配置激活与学生自选创建。
- 验证：
  - `npm run typecheck` 通过。
  - `npm run lint` 通过（0 warnings）。
  - `npm run test` 通过（3 files passed，9 passed，1 skipped）。
  - `npm run build` 通过（0 warnings）。

### Profile 背景图遮罩调轻

- 背景：
  - 用户反馈主页/Profile preview 背景图的不透明遮罩太高，背景图片被过度泛白，视觉层次不明显。
- 改动：
  - Profile 编辑预览和公开 Profile 展示页的背景遮罩，从整块高不透明度纵向渐变改为左强右弱的横向渐变。
  - 左侧保留文字可读性，右侧显著降低遮罩，让背景图片主体更清楚。
- 验证：
  - `npm run lint` 通过（0 warnings）。
  - `npm run build` 通过（0 warnings）。
