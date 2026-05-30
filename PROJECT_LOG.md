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
  - `npm run test` 通过（3 files passed，9 passed，1 skipped）。
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

### Seed 测试数据清理工具与本地清理

- 背景：
  - 用户反馈旧测试专业分类、假用户、假 Teamaking Post 和假课程仍出现在界面中，需要清理。
  - 截图中的旧短名专业主要来自早期 `prisma/seed.ts`：`Media and Communication`、`Computer Science`、`Marketing`、`Applied Translation`、`Finance`。
- 改动：
  - 新增 `npm run data:cleanup-demo` 维护脚本，默认 dry-run，只列出将清理的 seed/demo 数据。
  - 只有加 `-- --execute` 才会删除；远程数据库还必须额外加 `--allow-remote`，防止误删生产数据。
  - 脚本目标包括早期 seed 用户、seed 课程、旧无 code 专业、测试 Teamaking Post、测试 TeamUp 请求、测试工单和 COM3999 测试课程提交。
- 本地执行结果：
  - 删除 TeamUp 请求 4 条、测试工单 2 条、测试课程提交 1 条、Teamaking Post 3 条、CourseBoard membership 6 条、PortfolioItem 5 条、CourseMajorMapping 5 条、CourseOffering 5 条、Course 5 条、User 3 条、Major 5 条。
  - 清理后 dry-run 结果为空，旧短名专业查询结果为空。
- 验证：
  - `npm run lint` 通过（0 warnings）。
  - `npm run typecheck` 通过。

### 全站研究档案风格 UI 与课程入口修复

- 背景：
  - 用户希望全站视觉从 MVP 线框感升级为 New York Times / Are.na / Read.cv / Obsidian 方向：米白背景、细线框、衬线标题、无衬线正文、信息密度高、研究档案卡片、轻 hover、避免圆润可爱。
  - 同时课程推荐页没有按用户 admission year + major + 当前相对学期推荐课程，且 Course Board 缺少“我的课程”视图。
- 改动：
  - 重写全局设计 token：米白纸面背景、微弱网格/动态噪点、细边框、低阴影、全局 `bg-white` 收敛为米白，`border-2` 收敛为细线框。
  - 调整全局字体栈：标题偏文楷/衬线气质，正文偏 IBM Plex / Geist / HarmonyOS Sans / 思源黑体，减少 Inter 默认感。
  - 优化 `Navbar`、`PageShell`、`Sidebar`、移动端底部导航、`Card`、`CourseCard`、`ProfileCard`、Teamaking Post 卡片，使其更像模块化研究档案和信号面板。
  - 首页/登录前入口右侧说明框从占位式课程流程示例改为面向用户的简短功能介绍：展示个人成果、按 A/A-/B+/过等目标成绩寻找组员、围绕课程内容讨论与评价。
  - `/api/courses/recommended` 不再要求 handbook 课程必须有 offering；按当前 academic term、学生 admission year、专业和 `relativeTermCodes` 匹配 `CourseCurriculumRule`。
  - 新增 `/api/courses/my`，课程页新增 `Recommended / 我的课程 / Search / Free elective` tabs；已加入课程不因 Profile 专业变化自动移除，但疑似非本专业专业课会显示轻提示。
  - Profile 编辑页、课程页、课程详情页新增官方查询入口：BNBU 专业介绍、AR programme handbook、MIS 真实选课/课表。
- 验证：
  - `npm run typecheck` 通过。
  - `npm run lint` 通过（0 warnings）。
  - `npm run test` 通过（3 files passed，9 passed，1 skipped）。
  - `npm run build` 通过（0 warnings）。
  - Playwright 截图检查 `/`、`/courses`、`/admin/content` 桌面端和 `/courses` 移动端，确认页面非空、结构可见、移动端导航可横向滚动。

### 推荐课程卡片加入入口修复

- 背景：
  - 用户反馈推荐课程列表中部分课程只有“Course details”，没有“Enter Course Board / 加入课程板”入口。
  - 根因是 `CourseCard` 只在课程已经有现成 CourseBoard 时显示进入按钮；但后端已经支持同校 active 课程按需创建并加入 CourseBoard。
- 改动：
  - `CourseCard` 增加可选 `onJoin` 回调；没有现成 board 但页面提供加入能力时，显示“加入课程板”按钮。
  - 课程页推荐列表向 `CourseCard` 传入现有 `joinFirstBoard`，因此 handbook 推荐课程即使还没有 board，也能点击后创建/加入。
- 验证：
  - `npm run typecheck` 通过。
  - `npm run lint` 通过（0 warnings）。
  - `npm run build` 通过（0 warnings）。

### Course Board 标题代码与课程名拆行

- 背景：
  - 用户反馈 Course Board 页面顶部标题把课程代码和长课程名放在同一行，视觉上过于拥挤。
- 改动：
  - `PageShell` 增加课程型标题识别：匹配 `ENG1013 Foundations...` 这类 `课程代码 + 课程名` 格式时，自动把课程代码作为较小的信号标签显示在上一行，课程名独立显示为主标题。
  - 该逻辑复用于 Course Board 和课程详情页，其他普通页面标题不受影响。
- 验证：
  - `npm run typecheck` 通过。
  - `npm run lint` 通过（0 warnings）。
  - `npm run build` 通过（0 warnings）。

### AR Programme Handbook 精确 PDF 定位修复

- 背景：
  - 用户反馈 AR programme handbook 索引进入每个 admission handbook 页面后，页面内实际都有每个 programme 的 PDF 下载链接，但 TEAMAKING 的官方四年课程安排入口仍提示“未定位到当前专业的精确 handbook PDF”。
  - 根因是后端只查 `CourseImportDatasetSourceRef.externalId` 的单一精确模式；当线上数据来自批次 payload、dataset source refs 尚未同步、或用户专业 code/name 与 PDF code 有差异时，会直接退回索引页。
- 改动：
  - `officialAcademicLinksForUser()` 增加三层解析：匹配用户当前 admission/专业课程规则里的 `sourceRefIds`、扫描已批准/待审批导入批次 payload 和 dataset source refs、最后实时读取 AR 索引页与对应 admission handbook 页面中的 programme PDF 链接。
  - 增加按 `entryYear + majorCode + majorName` 的短期缓存，避免每次打开页面都请求 AR 官网。
  - 链接匹配同时参考 programme code、programme name 关键词、PDF URL、规则 sourceRefId，不再只依赖单一 externalId。
  - 未命中时提示语改为“暂未从已导入数据或 AR 页面定位到精确 PDF”，减少误导。
- 验证：
  - `curl` 确认 AR 索引页包含 2025/2024/2023 admission 子页面，子页面 HTML 包含各 programme PDF 链接。
  - `npm run typecheck` 通过。
  - `npm run lint` 通过（0 warnings）。
  - `npm run build` 通过（0 warnings）。

### BNBU 专业介绍入口定位到专业层

- 背景：
  - 用户反馈“BNBU 专业介绍”入口只跳到 BNBU 学院/学校索引，不能直接进入用户当前专业的官方 programme 页面。
- 改动：
  - `officialAcademicLinksForUser()` 增加 programme introduction 解析。
  - 按用户 Profile 的 faculty code 优先读取对应学院/学校官网首页，再用 major code 和 major name 匹配具体 programme 链接；找不到才退回 BNBU faculties and schools 总入口。
  - 增加 1 小时缓存，避免频繁请求 BNBU 学院官网。
- 抽样确认：
  - FHSS + Media and Communication 命中 `http://fhss.bnbu.edu.cn/mcom_en`。
  - FST + Computer Science and Technology 命中 `http://fst.bnbu.edu.cn/cst_en`。
  - FBM + Accounting 命中 `http://fbm.bnbu.edu.cn/acct_en`。
  - SCC + Cinema and Television 命中 `http://scc.bnbu.edu.cn/ctv_en`。
- 验证：
  - `npm run typecheck` 通过。
  - `npm run lint` 通过（0 warnings）。
  - `npm run build` 通过（0 warnings）。

### 课程搜索分页修复

- 背景：
  - 用户反馈课程搜索结果无法翻页；例如搜索 `Introduction` 时只能看到前几条课程，无法继续查看后续匹配项。
  - 根因是 `/api/courses/search` 只返回固定前 50 条，前端又只渲染前 8 条，没有分页状态和翻页控件。
- 改动：
  - `/api/courses/search` 支持 `page` 和 `pageSize`，返回 `pagination: { page, pageSize, total, totalPages }`。
  - 课程页 `Search / Free elective` tab 增加结果总数、当前页、上一页/下一页按钮。
  - 搜索词变化时自动回到第一页，避免旧页码造成空结果。
- 验证：
  - `npm run typecheck` 通过。
  - `npm run lint` 通过（0 warnings）。
  - `npm run build` 通过（0 warnings）。

### Matches 相关用户推荐与分页

- 背景：
  - 用户询问 Matches 页面 `Relevant Users` 的显示逻辑；旧逻辑只按同专业和同校开放展示粗略排列，没有把“上过同一门课程”作为优先信号，也没有分页。
- 改动：
  - `/api/matches` 增加 `usersPage/usersPageSize` 查询参数，并返回 `usersPagination`。
  - 相关用户排序改为：同一课程 CourseBoard 记录优先，其次二度/三度好友网络和同专业，再用同校开放展示兜底；同一个用户命中多个信号时合并理由并累加分数。
  - Matches 页面显示推荐依据、总数、页码、上一页/下一页，空状态文案说明如何产生更多推荐。
- 验证：
  - `npm run typecheck` 通过。
  - `npm run lint` 通过（0 warnings）。
  - `npm run build` 通过（0 warnings）。

### 管理员软清空当前课程组队状态

- 背景：
  - 用户要求管理员后台增加“清空目前所有课程组队状态”，但必须保留好友关系、加入过的课程记录、发送过的 Teamaking Post 和 TeamUp Interest 记录。
- 改动：
  - 新增 `/admin/maintenance` 页面和 `/api/admin/maintenance` 接口。
  - 高风险操作需要输入 `CLEAR_TEAMING_STATE` 才能执行。
  - 执行后只做软清空：active `CourseBoardMembership` 改为 `history` 并写入 `leftAt`；open/paused `TeamakingPost` 改为 `closed`；sent/viewed/mutual `TeamUpRequest` 改为 `closed`。
  - accepted `FollowRequest` 不变，好友关系保留。
  - 用户手动离开课程板从删除 membership 改成 `left` 状态，保留加入过的课程记录。
  - Matches 现在会把 `active/history/left` 课程记录作为“上过同一门课程”的推荐依据，同时加入二度/三度好友网络信号。
- 验证：
  - `npm run typecheck` 通过。
  - `npm run lint` 通过（0 warnings）。
  - `npm run test` 通过（3 files passed，9 passed，1 skipped）。
  - `npm run build` 通过（0 warnings）。

### Profile 专业下拉废弃专业名修复

- 背景：
  - 用户反馈 Profile 的 `Major` 下拉仍出现 `Media and Communication` 这类已废弃短名，并且专业选项过多，没有先按 Faculty 收窄。
  - 数据库检查显示当前 active BNBU 版本只剩 32 个 handbook 正式专业；旧短名主要来自前端 demo fallback 与 seed 数据，Profile 编辑页也存在 `onboarding.majors` 全量渲染问题。
- 改动：
  - `ProfileEditorPage` 的 Major 下拉改为按当前 Faculty 过滤；切换 Faculty 时自动选择该 Faculty 下的第一个 Major，避免保留跨学院或已废弃 majorId。
  - `OnboardingPage` 使用同一套 Faculty/Major 规范化逻辑，初始化时也会校验当前 Major 是否属于当前 Faculty。
  - `lib/demo-data.ts` 与 `prisma/seed.ts` 中旧短名专业改为官方 handbook 名称，并在 seed 中补充正式 major code。
- 验证：
  - `rg` 确认运行时代码中不再直接生成旧短名专业。
  - `npm run typecheck` 通过。
  - `npm run lint` 通过（0 warnings）。

### 管理员后台表格横向滚动修复

- 背景：
  - 用户反馈管理员端多列表格在桌面宽度不足时没有清晰的左右滚动条，导致页面被表格撑得很长、右侧内容溢出。
  - 根因是后台页面中的 Card/grid 子项默认 `min-width:auto`，表格即使包了 `overflow-x-auto` 也可能继续撑宽父级。
- 改动：
  - `PageShell` 为管理员页面增加 `admin-page` 标记。
  - `Card` 默认增加 `min-w-0`，允许表格所在卡片在 grid 中收缩。
  - 全局 CSS 针对 `.admin-page` 下直接包裹 table 的 `overflow-x-auto/overflow-auto` 容器统一启用横向滚动、稳定滚动条和横向 overscroll 限制。
  - 后台表格统一使用 `width: max-content; min-width: 100%`，保证列多时在表格内部横向滚动，而不是撑宽整页。
- 验证：
  - `npm run typecheck` 通过。
  - `npm run lint` 通过（0 warnings）。
  - `npm run build` 通过（0 warnings）。

### 管理员查看用户 Profile 权限修复

- 背景：
  - 用户反馈从管理员端查看/编辑用户数据时进入 Profile 页面会触发 `API_FORBIDDEN`，提示仅允许同校已验证用户互相查看资料。
  - 根因是 `/api/profile/:userId` 复用了学生端同校可见性规则，没有把后台管理员角色作为审计/管理场景放行。
- 改动：
  - 管理员角色查看他人 Profile 时跳过同校限制。
  - 联系方式可见性上下文增加 `isAdmin`，管理员查看用户资料时可看到完整联系方式。
  - 作品证明列表同样对管理员完整返回，避免页面能打开但关键管理数据被普通用户规则过滤。
- 验证：
  - `npm run typecheck` 通过。
  - `npm run lint` 通过（0 warnings）。
  - `npm run build` 通过（0 warnings）。

### Course Management 编辑入口交互修复

- 背景：
  - 用户反馈管理员端 Course Management 列表里的 `Edit` 看起来无法编辑。
  - 根因是按钮只更新了内部选中课程，实际编辑表单在页面更下方，点击后没有明显反馈，也会默认把第一页第一门课程设为编辑对象，交互语义不清楚。
- 改动：
  - Course Management 不再默认选中第一页第一门课程。
  - 点击课程行 `Edit` 后显示“正在编辑”提示，并自动滚动到视觉化编辑表单。
  - 课程列表下方增加当前编辑课程提示和“跳到编辑表单”按钮，避免管理员误以为按钮无效。
- 验证：
  - `npm run typecheck` 通过。
  - `npm run lint` 通过（0 warnings）。
  - `npm run build` 通过（0 warnings）。

## 2026-05-27

### 架构拆分第一轮：API Context、Crawler、Course Import、客户端 API

- 背景：
  - 项目功能面已经成型，但 API route、client pages、crawler/import/admin 逻辑集中在少数超大文件里，后续维护容易反复绕远路。
- 改动：
  - 新增 `lib/server/api-context.ts`，让 `app/api/[...route]/route.ts` 通过统一 `ApiContext` 分发，为后续按领域拆成 `ApiModuleHandler` 铺接口。
  - 新增 `lib/server/course-import/payload.ts`，把 course import 的 direct payload / crawler bundle 解析与错误语义沉到独立 Module。
  - 将原 `lib/bnbu-course-import.ts` 的 BNBU import 校验/分类/默认加入规则实现迁到 `lib/server/course-import/bnbu-course-import.ts`；原文件保留兼容 re-export，现有调用路径不变。
  - 新增 `lib/server/crawler/io.ts`，集中 crawler 自然语言输入解析、标准化、job 默认命名、输出差异判断和 job-scoped 输出目录。
  - crawler 的 download 输出改为写入 `storage/crawler_outputs/<jobId>/`，成功/失败任务只从本 job 目录收集输出，避免历史 JSON 被误算成本次结果；`git_import_json` 兼容旧目录行为。
  - 新增 `lib/client/api.ts`，统一客户端 `api()`、`useApi()`、Profile 文件上传错误显示。
  - `/crawler` 页面改为导入 `components/pages/crawler-portal-page.tsx`，不再把 crawler portal 放在 `components/client-pages.tsx` 大集合里。
  - 修复 crawler 自然语言解析边角：`Fall` 不再误判为 `all`，URL 路径里的 `2051` 不再误识别为 admission year。
- 验证：
  - 新增 `tests/unit/course-import-payload.test.ts` 和 `tests/unit/crawler-io.test.ts`。
  - `npm run prisma:validate` 通过。
  - `npm run typecheck` 通过。
  - `npm run lint` 通过。
  - `npm run test` 通过（6 files passed，22 passed，1 skipped）。
  - `npm run build` 通过。
  - build trace 实测包含 `pdfjs-dist/package.json`、`pdfjs-dist/legacy/build/pdf.mjs` 和 `scripts/bnbu-crawler/run-handbook-preview.mjs`。
  - `npm run test:e2e` 通过（5 passed）。
  - crawler 本地 smoke 通过：`2023 limit=1` 输出 49 courses / 49 rules / 0 offerings。

### 架构拆分第二轮：Crawler/Course Import Module 与前端入口拆分

- 背景：
  - 继续按“功能等价优先”补强第一轮拆分，把 crawler 和 admin course-import 主入口从巨型 API route 下沉到领域 Module，并给 crawler 部署依赖与输出隔离补自动化保护。
- 改动：
  - 新增 `lib/server/crawler/module.ts`、`runtime.ts`、`errors.ts` 和 `lib/server/storage/json-files.ts`，集中 crawler options/jobs/outputs/download、job lifecycle、输出 bundle、runtime readiness、stderr 摘要和安全 JSON 下载。
  - 新增 `lib/server/course-import/admin-module.ts`，迁出 admin course-import validate/list/create/approve/reject/dataset download handler；`route.ts` 只负责装配 adapter 和 dispatch。
  - `ApiContext` 增加 `body()`、`requireUser()`、`requireAdmin()`、`activeAppVersionId()` 懒加载能力，减少领域 handler 反复传递 request/admin/app version。
  - crawler download 模式只读取本 job 的 `storage/crawler_outputs/<jobId>/`，输出记录带可选 `jobId`；`git_import_json` 保持兼容 `course_imports/bnbu`。
  - `next.config.mjs` 的 build trace 包含 `scripts/bnbu-crawler` 与 `pdfjs-dist` legacy build/package assets，并新增单测守住这条部署约束。
  - `app/**/page.tsx` 改为导入 `components/pages/*` 页面模块；admin 各资源页改为独立 workbench wrapper；抽出页面 primitives 复用 `ErrorBox`、`Field`、`inputClass`、`formatFileSize`。
- 验证：
  - 新增/补强 `tests/unit/crawler-io.test.ts`、`tests/unit/course-import-payload.test.ts`、`tests/unit/crawler-build-trace.test.ts`。
  - `npm run prisma:validate` 通过。
  - `npm run typecheck` 通过。
  - `npm run lint` 通过。
  - `npm run test` 通过（7 files passed，28 passed，1 skipped）。
  - `npm run build` 通过。
  - build trace 实测包含 `pdfjs-dist/package.json`、`pdfjs-dist/legacy/build/pdf.mjs` 和 `scripts/bnbu-crawler/run-handbook-preview.mjs`。
  - `npm run test:e2e` 通过（5 passed）。
  - crawler 本地 smoke 通过：`2023 limit=1` 输出 49 courses / 49 rules / 0 offerings，输出文件位于独立 `/tmp/teamaking-second-round-crawler-smoke-*` 目录。

### 架构拆分第三轮：Full completion API/Page 拆分与真实 Crawler Import 验收

- 背景：
  - 用户明确本轮不是 Launch cleanup，而是继续拆完 legacy API 和前端页面大文件：catch-all route 与兼容页面 barrel 不再承载业务实现，真实 crawler/import/effect check 是 done 条件。
- 改动：
  - `app/api/[...route]/route.ts` 缩到 Next.js thin entry，只负责解析 route params 并调用 `handleApplicationApiRoute`。
  - 新增/整理 `lib/server/api/*-module.ts`：auth/profile/content/courses/social/admin resources 分域承接剩余业务 handler；`application-module.ts` 通过 `ApiModuleRegistry` 分发，保留系统暂停检查、demo admin 入口、专门 module registry 与真正 404 fallback。
  - `lib/server/admin/versions-module.ts` 完整承接 versions list/checkpoint/download/restore-as-new-version，并修复 checkpoint download、restore-as-new-version 被宽泛分支提前拦截的问题。
  - 前端 `components/client-pages.tsx` 变为兼容空壳，`components/pages/client-page-implementations.tsx` 只做兼容 re-export；页面实现按 auth/student/profile/content/course-board/social/admin/crawler/shared 拆入小模块，`app/**` 和 `components/pages/**` 不再从兼容 barrel 导入。
  - architecture guard 扩展到 route、client-pages、client-page-implementations 和兼容 barrel import 禁止项，防止业务实现回流。
  - `next.config.mjs` 的 crawler tracing 从 `pdfjs-dist` 扩展到 `pdf-parse` dist 与其 nested `pdfjs-dist` assets，单测覆盖该 serverless 依赖边界。
  - README、BNBU crawler requirements、crawler admin variables 同步真实目录结构、CourseImportWorkflow 唯一入口、真实数据验收路径和 PDF parser tracing 要求。
- 验证：
  - `npm run prisma:validate` 通过。
  - `npm run typecheck` 通过。
  - `npm run lint` 通过（0 errors，0 warnings）。
  - `npm run test` 通过（11 files passed，38 passed，2 skipped）。
  - 临时 `TEST_DATABASE_URL` 集成测试通过（2 files passed，2 passed，2 skipped），验证 pending/approve、默认加入、manual membership 不覆盖、opt-out 保留、versions checkpoint download/restore-as-new-version。
  - `npm run build` 通过。
  - `npm run test:e2e` 通过（5 passed）。
  - 真实 crawler smoke：`2023 limit=1` 从 BNBU programme handbook 总入口解析 ACCT，输出 49 courses / 49 curriculum rules / 0 offerings，未出现 PDF parser 缺包。
  - 真实 crawler import/effect check：用该 2023 ACCT JSON 在临时数据库走 `CourseImportWorkflow` create pending / approve；批准后查到 BNBU school、FBM faculty、ACCT major、ACCT2003 course、curriculum rule 和 2026-Fall Programme Plan board，结果激活 10 个 board、生成 10 组 default-join 处理。
  - 真实 multi-cohort smoke：`2025,2024,2023 limit=1` 通过，分别输出 ACCT JSON；2025 输出 49 courses / 49 rules，2024 输出 49 courses / 49 rules，2023 输出 49 courses / 49 rules，未复现 `pdfjs-dist` / `pdf-parse` serverless tracing 缺包问题。
- 剩余风险：
  - 真实全量 crawler 仍可能受 BNBU 官网网络/PDF 文件临时变化影响；上线操作应保留分 cohort/faculty/programme 分批跑和下载单个 JSON 人工复核的路径。

### Dirty 状态收尾：兼容 Barrel 收口与 700 行守卫

- 背景：
  - 第三轮拆分后 dirty 状态里仍有少量兼容层和 4 个接近/超过 700 行的业务/UI 文件，需要把 legacy kitchen-sink 依赖彻底收口。
- 改动：
  - `lib/server/api/support.ts` 保留为短兼容 re-export；所有 `lib/server/**` 内部调用改为直接导入 `lib/server/services/*` 具体 service。
  - `lib/server/api/courses-module.ts` 拆为 `courses/boards-resource.ts`、`courses/comments-resource.ts`、`courses/courses-resource.ts`。
  - `lib/server/api/social-module.ts` 拆为 `social/friends-resource.ts`、`social/posts-resource.ts`、`social/team-up-resource.ts`、`social/follow-resource.ts`、`social/matches-resource.ts`。
  - `components/pages/shared-page-parts.tsx` 拆为 `shared/academic-parts.tsx`、`shared/content-parts.tsx`、`shared/portfolio-parts.tsx`、`shared/data-preview.tsx`，调用方改为导入具体 shared 模块。
  - `components/pages/profile-pages.tsx` 拆为 `profile/editor-page.tsx` 和 `profile/public-profile-page.tsx`，`app/profile/**` 改为直接导入具体页面模块。
  - `tests/unit/architecture-guard.test.ts` 扩展到 `lib/server/api/**` 和 `components/pages/**` 700 行上限，并禁止内部代码继续导入 `support.ts`、`shared-page-parts.tsx`、`profile-pages.tsx` 等兼容 barrel。
  - `next-env.d.ts` 恢复到项目期望的 `.next/types/routes.d.ts` 引用，去掉本地 `.next/dev/types` 生成噪音。
- 验证：
  - `npm run test -- tests/unit/architecture-guard.test.ts` 通过（7 passed）。
  - `npm run typecheck` 通过。
  - `npm run lint` 通过。
  - `npm run prisma:validate` 通过。
  - `npm run test` 通过（11 files passed，41 passed，2 skipped）。
  - `npm run build` 通过。
  - `npm run test:e2e` 通过（5 passed）。
  - 真实 crawler smoke：`2023 limit=1` 输出 49 courses / 49 rules / 0 offerings。
  - 真实 multi-cohort smoke：`2025,2024,2023 limit=1` 通过；2025、2024、2023 均输出 49 courses / 49 rules / 0 offerings。
  - 当前 shell 未设置 `TEST_DATABASE_URL`；本轮无法重新执行真实临时 DB create pending / approve，integration 文件按设计通过隔离库检查并跳过 DB 写入用例。

### 五类上线前收口与验收清单

- 背景：
  - 用户要求把提交前收口、真实 DB 集成验收、线上 crawler 原始问题复测、生产配置服务、手动上线验收五类事项集中收口，并在完成后只本地 commit、不 push。
- 本地可完成项：
  - dirty diff 复核确认 `next-env.d.ts`、Prisma schema 和 lockfile 没有提交噪音。
  - 兼容 barrel、700 行上限、crawler tracing、CourseImportWorkflow 单一入口等结构性守卫均纳入自动化测试。
  - 本地 automated acceptance 继续以 prisma/typecheck/lint/unit/integration/build/e2e/crawler smoke 为准。
- 外部上线前阻塞项：
  - 当前 shell 和 `.env` 均未设置 `TEST_DATABASE_URL`，不能安全重跑真实 DB create pending / approve effect check。
  - Vercel serverless `/var/task` crawler 需要随本 commit 重新部署后在 deployed admin/crawler UI 复测，确认不再出现 `pdfjs-dist` / `pdf-parse` 缺包。
  - Vercel/Neon/Tencent SES/admin bootstrap/DNS/生产手动流仍需按 `docs/ENVIRONMENT_VARIABLES.md` 和 `docs/ACCEPTANCE_CHECKLIST.md` 做生产验收。
- 记录：
  - 上述 3 项已进入 `docs/PRE_LAUNCH_ISSUES.md` 的 `Open` 区，均不阻塞本地 commit，但标记为下次 production launch 前必须完成。
- 本轮最终验证：
  - `npm run prisma:validate` 通过。
  - `npm run typecheck` 通过。
  - `npm run lint` 通过。
  - `npm run test` 通过（11 files passed，41 passed，2 skipped）。
  - `npm run build` 通过。
  - `npm run test:e2e` 通过（5 passed）。
  - `npm run test -- tests/integration/course-import-workflow.integration.test.ts` 通过（1 passed，1 skipped；skip 原因是未设置 `TEST_DATABASE_URL`）。
  - crawler smoke 通过：`2023 limit=1` 输出 49 courses / 49 rules / 0 offerings。
  - multi-cohort crawler smoke 通过：`2025,2024,2023 limit=1` 均输出 49 courses / 49 rules / 0 offerings。

### BNBU Course Catalog 通识目录合并（补记）

- 背景：
  - 5 月 27 日下午 README 已更新 course catalog 语义，但 PROJECT_LOG 当时漏记，需要补上从上次日志编辑后的 crawler/catalog 改动。
  - 旧的 `course_catalog` 更像 Course Descriptions 单一来源，无法覆盖 University Core 和 General Education 这类学校级通识课程目录。
- 改动：
  - 新增 `scripts/bnbu-crawler/common-curriculum-catalog.mjs`，把 University Core 与 General Education PDF 解析为 course catalog 行，只补 `courses[]` 和 source refs，不生成 admission-year curriculum rules。
  - `run-course-catalog.mjs` 合并 Course Descriptions、University Core、General Education 三类来源，输出统一的 `bnbu-course-catalog.teamaking.json`。
  - 新增 `scripts/bnbu-crawler/pdfjs-runtime.mjs`，集中 PDF.js 运行时与标准字体路径解析，供 handbook/catalog 解析复用。
  - Crawler UI/API 文案从 `Course descriptions` 调整为 `Course catalog`，并明确它是学校级课程总表，不替代 programme handbook 的 CourseBoard 规则。
  - `next.config.mjs` 与 crawler build trace test 补充 common curriculum parser / PDF runtime 的 serverless tracing 约束。
  - README、`docs/BNBU_COURSE_CRAWLER_REQUIREMENTS.md`、`docs/BNBU_CRAWLER_ADMIN_VARIABLES.md` 已同步 course catalog 与 programme handbook 的边界。
- 验证：
  - 新增 `tests/unit/common-curriculum-catalog.test.ts` 覆盖 cohort PDF 选择、University Core / GE 课程解析，以及不生成 rules 的边界。
  - 新增/更新 crawler tracing 单测，避免 Vercel serverless 漏带 PDF runtime 或 common curriculum parser。

## 2026-05-28

### Help Center 草稿、Markdown 导入与阅读器收口

- 背景：
  - 帮助中心不能只做通用 FAQ，需要贴合 TEAMAKING 现有产品面、内容发布模型和管理员 `Content & Announcements` 工作流。
  - 公开帮助页此前可能停留在 fallback / unavailable 状态；文章推荐也容易重复推荐同一批文档。
- 改动：
  - 以 `storage/help-center-drafts/` 作为本地帮助文档草稿源，整理 `00-manifest.md`、`01-getting-started` 到 `06-faq-and-glossary`、`99-archive` 的目录结构和 frontmatter 约定。
  - 管理员 Markdown 导入流程支持文件夹优先创建、frontmatter 解析、same-slug 更新、重复 slug / 缺失 parent 的可读错误提示。
  - `content-markdown.ts` 和 `components/pages/shared/content-parts.tsx` 补强 breadcrumb、文章目录、锚点跳转、正文排版、支持/联系入口和 related article 推荐。
  - related article 现在按 slug/id/title 去重并限制数量，避免同一推荐在文章底部重复出现。
  - 本地帮助草稿 `01-*` 到 `06-*` 已调整为 published 方向；`00-manifest.md` 与 `99-archive` 继续保留为草稿/归档。
- 验证：
  - `npm run test -- tests/unit/content-markdown.test.ts` 通过。
  - 浏览器检查 `/help` 已能看到 32 个帮助中心节点和真实文档内容。

### 公开内容首屏与首页 CTA 修复

- 背景：
  - 未登录用户不应该从首页直接进入真实 Course Board 详情；用户指出首页左侧第三个按钮应跳到“联系开发者”。
  - 联系开发者、帮助中心、开发者日志属于公开说明内容，不应因为未登录而不可见。
- 改动：
  - 首页第三个 CTA 从 `/courses` 改为 `/contact-developer`，按钮文案改为“联系开发者”。
  - `/help`、`/developer-log`、`/contact-developer` 改为服务端先调用 `getPublicContentPayload()` 获取公开首屏数据，再由客户端 API 刷新。
  - `handleContent` 复用 `getPublicContentPayload()`，公开 API 只返回 `published` 的 `ContentDocument`，数据库不可用或缺少发布内容时提供可读 fallback。
  - `ContentDocumentsPage` 与 `ContactDeveloperPage` 支持 `initialData`，公开页面统一隐藏内部侧栏。
  - 本地数据库已同步 32 个帮助中心节点，并将 `developer_contact` 公开内容发布用于首屏验收。
- 验证：
  - 浏览器检查首页“联系开发者”链接指向 `/contact-developer`，旧的“先看看 Course Boards” CTA 不再出现。
  - 浏览器检查 `/contact-developer` 首屏可见 WeChat/Email，`/help` 可见真实帮助文档树。
  - `npm run test:e2e -- --project=chromium --grep "public entry"` 通过。

### 登出后自动恢复账号修复

- 背景：
  - 用户反馈点击登出后，一旦刷新、静置、交互或进入 Course Board，会自动回到账号内。
  - 排查方向锁定为旧 host-only session cookie 与新 `SESSION_COOKIE_DOMAIN` shared-domain cookie 可以并存，登出只清掉其中一个 scope 时，浏览器后续请求仍可能带回另一个 session。
- 改动：
  - `clearSessionCookie()` 改为手动追加过期 `Set-Cookie`：始终清 host-only `teamaking_session`，配置 `SESSION_COOKIE_DOMAIN` 时同时清 domain-scoped cookie。
  - 删除 cookie 的 header 不再强制带 `Secure`，让本地 HTTP 和历史非 secure cookie 也能被过期。
  - 新增 `tests/unit/session-cookie.test.ts`，覆盖 host-only 以及 host-only + shared-domain 两种清除场景。
- 验证：
  - `npm run test -- tests/unit/session-cookie.test.ts` 通过。
  - 使用 `teamaking.lvh.me` 的 Playwright HTTP cookie harness 复现：登出前 `/api/auth/me` 有用户，登出后无用户且不剩 session cookie。
  - 当前综合验证中，`npm run test -- tests/unit/content-module.test.ts tests/unit/content-markdown.test.ts tests/unit/session-cookie.test.ts` 通过（3 files，9 tests）。

### 顶部账号入口与 TeamUp 可见性补记

- 背景：
  - 登录态顶部入口此前仍像固定登录/注册按钮，用户需要真实头像、Profile 和登出菜单。
  - TeamUp Interest 发送者/发布者视角容易混在一起，可能把自己发出的 interest 放进 received/inbox 或在发布者面板暴露错误操作。
- 改动：
  - Navbar 通过 `/api/auth/me` 读取当前账号，展示头像/Profile 入口和登出动作。
  - 新增 `/api/auth/logout`，配合 session cookie 清理让顶栏登出成为真实退出，不只是前端状态切换。
  - TeamUp received/inbox 过滤当前用户自己发出的 interest；Teamaking Post 详情只向帖子发布者展示收到的 TeamUp Interest，发送者侧保留撤回边界。
- 验证：
  - 相关行为已在前序浏览器流和本轮 logout/public-entry 验收中复核；本轮进一步用 session-cookie 单测锁住登出 cookie scope。

### 文档补齐

- 背景：
  - README 和 PROJECT_LOG 在最近几轮没有同步跟上，违反项目自己的“做完要更新日志”规则。
- 改动：
  - README 补充公开内容页面、首页未登录 CTA、`POST /api/auth/logout`、logout cookie scope、线上公开内容/登出验收项。
  - PROJECT_LOG 补记 5 月 27 日 BNBU course catalog common curriculum merge，并记录 5 月 28 日帮助中心、公开内容、CTA、登出修复和账号入口边界。
- 验证：
  - `git diff --check` 用于确认本次文档补齐没有 trailing whitespace 或 patch 格式问题。

### Course Board 参与定义修复

- 背景：
  - 用户指出 Dashboard 的 “My current Course Boards” 不清楚什么才算加入，而且在课程下发了 Post 后也没有显示为加入。
  - 旧模型把“打开/手动加入课程板”和“真正参与协作”混在一起；同时 `/api/auth/me` 返回的当前用户对象没有携带 membership，导致 Dashboard 即使后端有记录也显示空。
- 产品定义：
  - 打开 Course Board、查看课程详情、浏览推荐课程都不算加入。
  - 只有在某个 Course Board 下发布 Teamaking Post，或对该 Course Board 下的 Post 发送 TeamUp Interest，才算参与这个 Course Board。
  - Dashboard 的 My current Course Boards、Course People、同课推荐和 same-course-board 可见性只认 `source=teamaking_post` 与 `source=team_up` 的 active membership。
- 改动：
  - 新增 `lib/course-board-participation.ts`，集中定义参与来源、过滤条件和 source 优先级。
  - `/api/auth/me` 的当前用户序列化支持返回过滤后的 memberships，修复 Dashboard 当前课程板为空的问题。
  - 创建 Teamaking Post 时不再要求先加入课程板；API 会在同一个 transaction 中创建/更新 `teamaking_post` membership。
  - 发送 TeamUp Interest 时会创建/更新 `team_up` membership；旧的已存在 interest 也会补齐参与记录。
  - Course People、`/api/courses/my`、Matches 同课推荐、same-course-board portfolio 可见性均改为只使用参与 membership。
  - 课程列表、课程详情、Course Board 页文案从“加入课程板”改成“打开/浏览课程板”，并在创建 Post / TeamUp 处解释参与规则。
  - README 和 onboarding guide 同步新的 Course Board 参与定义。
- 验证：
  - 先新增失败用例 `tests/unit/current-user-memberships.test.ts`，复现当前用户不返回 membership 的问题。
  - `npm run test -- tests/unit/current-user-memberships.test.ts tests/unit/course-board-participation.test.ts tests/unit/social-discovery-visibility.test.ts tests/unit/onboarding-api.test.ts tests/unit/onboarding-guide.test.ts` 通过（5 files，10 tests）。
  - `npm run lint` 通过。
  - `npm run typecheck` 通过；`git diff --check` 通过。

### AI 简历摘要与 Highlights 改进

- 背景：
  - 用户反馈 Profile 的 Auto Summary 只是拼接简历前文，Highlights 又几乎把完整简历经历搬出来，缺少归纳、关键词提炼和真正的个人高光。
- 改动：
  - 新增 OpenAI Responses API 简历分析服务，输出 `resume-ai-v1` 结构化 JSON；`OPENAI_API_KEY` 启用，`OPENAI_RESUME_MODEL` 可覆盖默认 `gpt-4.1-mini`。
  - 新增 `/admin/ai-resume`：`super_admin` 可配置启用状态、OpenAI API key、模型和输入长度限制；后台配置优先于环境变量，并且 API key 只脱敏展示。
  - `resumeParsedData` 保持 JSON 字段兼容，新增 `analysis` 和 `manualAnalysis`；展示优先级为手动修改、AI 分析、本地 fallback。
  - 上传简历和“重新 AI 整理当前简历”会调用 AI；缺少 API key 或调用失败时生成本地压缩 fallback，不阻断上传保存。
  - 每次简历整理写入 `profile.resume.ai_analysis` OperationLog，记录触发来源、模型、状态、摘要标题、Highlights 结果和耗时；不记录原始简历文本或 API key。
  - Profile 编辑页首次打开旧解析数据会自动触发一次 AI 整理，失败后用 sessionStorage 做 24 小时 cooldown。
  - Auto Summary 与 Highlights 改为强调色展示，Highlights 收敛到最多 8 条卡片，并提供手动编辑、删除、新增和恢复 AI 版本。
- 验证：
  - 新增 `tests/unit/resume-analysis.test.ts`，覆盖长中文简历压缩、关键词不凭空出现、手动优先和旧数据 AI 检测。
  - 新增/扩展 `tests/unit/resume-ai-service.test.ts`，mock OpenAI SDK 覆盖无 key fallback、structured output 成功、后台配置覆盖环境变量、OpenAI 失败 fallback 和调用日志脱敏。
  - 新增 `tests/unit/admin-ai-resume-api.test.ts`，覆盖后台配置读取脱敏、日志序列化、非 `super_admin` 禁止改配置、审计不记录 raw key。
  - 新增 `tests/unit/profile-resume-api.test.ts`，覆盖上传简历走 AI parser、重新整理日志不写原始简历。
  - 新增 `tests/unit/resume-render.test.ts`，覆盖强调色摘要/高光展示和手动编辑入口。
  - 当前已通过 `npm run test -- tests/unit/resume-ai-service.test.ts tests/unit/admin-ai-resume-api.test.ts tests/unit/profile-resume-api.test.ts tests/unit/resume-analysis.test.ts tests/unit/resume-render.test.ts tests/unit/profile-assets.test.ts`、`npm run lint`、`npm run typecheck` 和 `git diff --check`。
  - 浏览器 smoke 检查 `/profile/me`：简历区域出现强调色 Auto Summary、Highlights、重新 AI 整理按钮，以及手动微调/恢复 AI 入口。
  - Playwright smoke 检查 `/admin/ai-resume`：AI Resume Analysis 页面、OpenAI 配置状态、API Key 状态、模型和调用日志表可见。

## 2026-05-29

### AI 简历高光缺失字段与展示细化

- 改动：
  - `lib/resume-analysis.ts` 去掉 fallback 中的“未明确”字样，缺失字段改为“待补充”，`evidence` 统一按 `职位/公司/动作/结果` 结构展示。
  - `lib/server/services/resume-ai-service.ts` 的输入指引同步更新为：缺失要素可留空或写“待补充”，避免模型输出“未明确”。
  - `components/pages/shared/portfolio-parts.tsx` 隐藏用户侧 `parser` 字段展示，改为“解析结果已生成”。
  - 新增/更新 `tests/unit/resume-analysis.test.ts`：新增断言防止 fallback/highlight 中出现“未明确”。
  - 更新 `tests/unit/resume-ai-service.test.ts`：补充 prompt 文本检查，确保不包含“未明确”。
- 验证：
  - `npm run test -- tests/unit/resume-analysis.test.ts tests/unit/resume-ai-service.test.ts` 通过（2 files，9 tests）。

### AI 爬虫补齐/检验链路接入

- 改动：
  - `scripts/bnbu-crawler/ai-catalog-assistant.mjs` 修复 `applyCrawlerAiAssist(params)` 丢弃入参的问题，让 `mode/model/apiKey/payload` 真正生效。
  - 修复 AI 补齐后的 `invalidCount` 计算：补齐后按合并后的 payload 重算，不再沿用补齐前缺失数。
  - Course catalog 和 programme handbook runner 在写入 JSON 前接入 AI assist，并把 `crawlerMeta.aiAssist` 写入输出文件。
  - `/api/crawler/jobs` 启动时把 AI mode、model、timeout、strict mode 传给 runner，API key 只走子进程环境变量，不写入 command。
  - 新增 `/admin/ai-crawler` 配置页和 API resource，用于配置 crawler AI、查看 `crawler.ai_analyze` 调用日志。
  - `/crawler` 表单新增 AI assist 模式选择：关闭、只检验、补齐、严格补齐并阻断失败结果。
- 验证：
  - `npm run test -- tests/unit/crawler-ai-assistant.test.ts tests/unit/crawler-io.test.ts tests/unit/resume-analysis.test.ts tests/unit/resume-ai-service.test.ts` 通过（4 files，20 tests）。
  - `npm run lint` 通过。
  - `npm run build` 通过，生产路由包含 `/admin/ai-crawler`。
  - 本地生产服务器 smoke：`/crawler` 能显示 AI assist 选项，`/admin/ai-crawler` 能挂载并显示 crawler AI 日志区域；未启动真实爬虫任务。

### Admin Editable Interface Copy

- 背景：
  - 用户要求管理员不仅能控制后台，还能以管理员身份进入用户端页面，直接编辑标题、小标题、功能说明、使用引导、输入框提示等短界面字段。
  - 用户进一步明确：这不是大段用户文本或文档正文 CMS；Help Center、Developer Log、Contact Developer 的文档编辑继续使用既有 `/admin/content`。
- 产品边界：
  - Interface Copy 只覆盖框架级短字段：页面 eyebrow/title/description、section heading、card 标题/说明、tab/button label、字段 label/help text、placeholder、empty state、onboarding tour 文案、support widget 提示和官方参考区固定包装文案。
  - 用户生成内容、课程数据、官方 URL、帖子、Profile 正文、工单正文、admin workbench 自身文案和公开内容文档正文不进入这套系统。
- 改动：
  - 新增 `lib/site-copy.ts` typed registry，集中定义 key、route、group、kind、默认 `zh/en` 文案、最大长度、fallback 和 diff helper。
  - 使用现有 `SiteConfig` 存储，不新增 Prisma migration：草稿为 `site_ui_copy_draft`，发布版本为 `site_ui_copy_published`。
  - 新增公开 `GET /api/site-copy`，只返回 published-over-default 值；新增管理员接口 `GET /api/admin/site-copy`、`PATCH /api/admin/site-copy/draft`、`POST /api/admin/site-copy/publish`、`POST /api/admin/site-copy/discard`。
  - 新增 `components/site-copy-runtime.tsx`，在 root layout 注入 copy runtime；普通用户只读发布值，管理员编辑模式读取 draft-over-published-over-default。
  - 学生/公开路由上为管理员显示浮动“编辑界面文案”工具条；可点选被标记字段打开侧边编辑器，保存草稿后需要发布才影响普通用户。
  - 新增 `/admin/site-copy` 页面和 admin nav `Interface Copy`，支持搜索字段、只看改动、逐字段草稿编辑、发布和丢弃。
  - 第一批接入 `/`、`/login`、`/demo-access`、`/onboarding`、`/dashboard`、`/courses`、课程详情、Course Board、TeamUp/social、Profile 编辑/公开页、Contact Info、Support、Announcements 和 onboarding tour。
  - 官方参考卡片只接入固定包装文案和稳定 label；URL、programme、handbook、MIS 等数据片段继续由课程/import/reference 服务控制。
  - 修复两个验收时发现的交互边缘：`CopyTarget` 非编辑模式保留布局 class；onboarding tour 不再把 `/admin/site-copy` 等后台页面重定向回学生端步骤。
- 验证：
  - 新增 `tests/unit/site-copy.test.ts` 覆盖 registry defaults、locale fallback、draft/published merge、normalize 和 changed keys。
  - 新增 `tests/unit/site-copy-api.test.ts` 覆盖公开接口不泄露草稿、草稿保存、非法 key 拒绝、发布清草稿和 audit logging。
  - 新增 `tests/e2e/site-copy.spec.ts`：管理员在 `/courses` 编辑搜索 placeholder 草稿，确认普通用户看不到草稿，发布后普通用户可见。
  - 已通过 `npm run prisma:validate`、`npm run typecheck`、`npm run lint`、`npm run test`、`npm run build`、`npm run test:e2e -- --project=chromium tests/e2e/site-copy.spec.ts`。
  - in-app browser 验收：`/admin/site-copy` 能显示字段列表且不被 onboarding tour 跳走；管理员在 `/courses` 能看到工具条和搜索 placeholder。
  - 本地 dev DB 仍有既有 schema drift：课程接口查询 `Course.catalogEffectiveYear` 时可能报 `P2022`；这不是 Interface Copy 改动引入，e2e 已 mock 课程数据验证文案链路。
