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
