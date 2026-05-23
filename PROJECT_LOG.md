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
