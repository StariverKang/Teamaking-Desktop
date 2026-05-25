# TEAMAKING Environment Variables

本文件记录 TEAMAKING 的特殊环境变量、推荐取值和填写位置。不要把真实数据库密码、腾讯云 SecretKey、管理员密码写入本文档或提交到 Git。

## 填写位置

- 本地开发：项目根目录 `.env`
- Vercel 生产/预览：Vercel Project -> `Environment Variables`
- 数据库迁移命令：临时在终端命令前设置 `DATABASE_URL="..."`

Vercel 中环境变量修改后，必须到 `Deployments` 对最新 production deployment 执行 `Redeploy`，新值才会进入线上运行环境。

## 当前生产域名

```env
NEXT_PUBLIC_APP_URL="https://teamingapp.org"
ADMIN_HOSTS="admin.teamingapp.org"
CRAWLER_HOSTS="crawler.teamingapp.org"
SESSION_COOKIE_DOMAIN=".teamingapp.org"
```

- `NEXT_PUBLIC_APP_URL`：公开主站域名。
- `ADMIN_HOSTS`：允许访问 `/admin`、`/admin-login`、`/api/admin/*` 和 `/api/auth/admin-login` 的管理员域名。主系统不展示 Admin 入口。
- `CRAWLER_HOSTS`：允许访问 `/crawler` 和 `/api/crawler/*` 的爬虫子域名。主站和管理员域名之外会返回 404。
- `SESSION_COOKIE_DOMAIN`：可选。生产建议填 `.teamingapp.org`，让 `admin.teamingapp.org` 和 `crawler.teamingapp.org` 共用同一次管理员登录；本地 localhost 不要设置。
- 多语言不需要额外环境变量。首次访问时 middleware 会根据 `x-vercel-ip-country` 或 `cf-ipcountry` 设置 `teamaking_locale` cookie；用户可在页面右上角手动切换。

## 数据库

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DB?sslmode=require"
```

生产数据存储在 Neon PostgreSQL。

- Vercel 运行时可以使用 Neon 给 Vercel 配置的连接字符串。
- Prisma migration 必须使用 Neon direct connection，不使用 connection pooling。
- 判断 direct connection：Neon `Connection pooling` 开关关闭，主机名通常不包含 `pooler`。

生产迁移命令：

```bash
DATABASE_URL="Neon direct connection string" npx prisma migrate deploy
```

不要在生产环境运行：

```bash
npm run seed
```

## 登录与演示开关

```env
ENABLE_DEMO_ACCESS="false"
EMAIL_DEBUG_CODE_RESPONSE="false"
```

- `ENABLE_DEMO_ACCESS=false`：生产环境关闭 `/demo-access` 绕过邮箱验证入口。
- `EMAIL_DEBUG_CODE_RESPONSE=false`：生产环境不把验证码返回给前端。

本地调试时，如果没有配置腾讯云 SES，可以临时设：

```env
EMAIL_DEBUG_CODE_RESPONSE="true"
```

## 管理员登录

管理员入口：`https://admin.teamingapp.org/admin-login`。

管理员账号最终存储在数据库 `User` 表中。生产环境推荐通过 Vercel 环境变量手动定义一个 bootstrap 管理员：

```env
ADMIN_BOOTSTRAP_EMAIL="admin@mail.bnbu.edu.cn"
ADMIN_BOOTSTRAP_PASSWORD="change-this-password"
ADMIN_BOOTSTRAP_ROLE="super_admin"
ADMIN_BOOTSTRAP_DISPLAY_NAME="TEAMAKING Admin"
```

设置后必须 Redeploy。之后用 `ADMIN_BOOTSTRAP_EMAIL` 和 `ADMIN_BOOTSTRAP_PASSWORD` 登录 `/admin-login` 时，系统会自动在当前生产数据库中 upsert 这个管理员账号：

- 如果账号不存在：创建管理员。
- 如果账号已存在：更新密码、角色、显示名和 active 状态。
- 不会清空数据库，不会删除已有用户、课程、课程安排、导入批次、公告或上传记录。

`ADMIN_BOOTSTRAP_ROLE` 可选值：`course_moderator`、`school_admin`、`super_admin`。上线维护建议使用 `super_admin`。

旧的 `DEVELOPER_LOGIN_*` 环境变量仍作为兼容 fallback，但不推荐继续作为长期管理员密码管理方式。登录成功后，管理员账号仍会写入数据库，后续可在后台 `Admin Users` 页面维护。

爬虫入口不使用另一组账号密码。`crawler.teamingapp.org` 允许访问 `/admin-login` 和 `/api/auth/admin-login`，使用同一套 `ADMIN_BOOTSTRAP_*` 或数据库管理员账号登录。若设置 `SESSION_COOKIE_DOMAIN=.teamingapp.org`，管理员和爬虫子域可以共享登录 cookie。

也可以通过命令创建或重置账号：

```bash
npm run admin:create -- --email maintainer@example.com --password "change-this-password" --role super_admin --record-local
npm run admin:reset-password -- --email maintainer@example.com --password "new-password" --record-local
npm run admin:list
```

`--record-local` 会写入 `docs/admin-credentials.local.md`，该文件被 `.gitignore` 忽略，不提交 Git。生产真实密码不要写入 README、日志或 issue。

## 腾讯云 SES

当前腾讯云 SES 地域为中国香港：

```env
TENCENTCLOUD_SES_REGION="ap-hongkong"
```

发信地址：

```env
TENCENTCLOUD_SES_FROM_EMAIL="Developer_Teamaking <verify@notify.teamingapp.org>"
```

如果腾讯云控制台中的发件人别名发生变化，应同步修改 `TENCENTCLOUD_SES_FROM_EMAIL` 中尖括号前的名称。

模板 ID：

```env
TENCENTCLOUD_SES_REGISTER_TEMPLATE_ID="179674"
TENCENTCLOUD_SES_RESET_TEMPLATE_ID="179675"
```

- `179674`：`TEAMAKING 注册验证码`
- `179675`：`TEAMAKING 找回密码验证码`
- 这两套模板已经完成审核，可以用于正式发信。上线前仍必须确认 Vercel 中的模板 ID 与腾讯云控制台一致。

腾讯云 API 密钥：

```env
TENCENTCLOUD_SECRET_ID="腾讯云 SecretId"
TENCENTCLOUD_SECRET_KEY="腾讯云 SecretKey"
```

这两个是敏感值，只填写在 Vercel 或本地 `.env`，不要提交。

可选回复邮箱：

```env
TENCENTCLOUD_SES_REPLY_TO_EMAIL="联系邮箱"
```

## 腾讯云 SES DNS 记录

发信域名：`notify.teamingapp.org`

Cloudflare DNS 记录：

```text
MX    notify                    mxbiz1.qq.com                 priority 10
TXT   notify                    v=spf1 include:qcloudmail.com ~all
TXT   qcloud._domainkey.notify  v=DKIM1; k=rsa; p=...          使用腾讯云完整 DKIM 值
TXT   _dmarc.notify             v=DMARC1; p=none
```

Cloudflare 中这些记录应为 DNS only，不使用代理。DKIM 值必须完整复制，不要换行或漏字符。

上线前邮件实测：

1. Vercel 生产环境设置 `EMAIL_DEBUG_CODE_RESPONSE=false`。
2. Vercel 生产环境设置 `TENCENTCLOUD_SECRET_ID` / `TENCENTCLOUD_SECRET_KEY`。
3. Vercel 生产环境设置 `TENCENTCLOUD_SES_FROM_EMAIL`，发件邮箱必须是腾讯云 SES 已验证地址。
4. Vercel 生产环境设置 `TENCENTCLOUD_SES_REGISTER_TEMPLATE_ID=179674`。
5. Vercel 生产环境设置 `TENCENTCLOUD_SES_RESET_TEMPLATE_ID=179675`。
6. Redeploy 后，用真实学校邮箱测试注册验证码和找回密码验证码。

## 上传存储

```env
UPLOAD_STORAGE_MODE=""
R2_ACCOUNT_ID=""
R2_BUCKET=""
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
R2_PUBLIC_BASE_URL=""
```

默认本地测试写入 gitignored `public/uploads`。生产建议设置 `UPLOAD_STORAGE_MODE=r2` 并配置 Cloudflare R2；`R2_PUBLIC_BASE_URL` 可填自定义公开域名或 R2 public bucket base URL。

本地如需强制模拟线上内联存储：

```env
UPLOAD_STORAGE_MODE="inline"
```

接口会继续沿用 `fileUrl`、`storageKey`、`storageMode`、`storageProvider`、`objectKey`、`fileName`、`fileMimeType`、`fileSize`、`fileExtension`、`previewKind`、`scanStatus` 等字段。

## 上线前检查清单

1. Vercel 中 `NEXT_PUBLIC_APP_URL=https://teamingapp.org`。
2. Vercel 中 `ADMIN_HOSTS=admin.teamingapp.org`。
3. 如启用线上爬虫入口，Vercel 中 `CRAWLER_HOSTS=crawler.teamingapp.org`。
4. 如需管理员/爬虫子域共享登录，Vercel 中 `SESSION_COOKIE_DOMAIN=.teamingapp.org`。
5. Vercel 中 `ENABLE_DEMO_ACCESS=false`。
6. Vercel 中 `EMAIL_DEBUG_CODE_RESPONSE=false`。
7. 管理员正式账号已在数据库创建或重置，或已配置 `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD` 并完成一次管理员登录同步。
8. 腾讯云 SES SecretId/SecretKey 已配置。
9. 腾讯云 SES 发信地址和模板 ID 已配置。
10. 腾讯云两套模板已审核通过，并完成注册/找回密码发信实测。
11. Neon production migration 已执行。
12. Vercel 已 Redeploy。
13. `/admin/announcements` 可发布公告，主站任意页面顶部显示公告弹窗，`/announcements` 可查看历史。
