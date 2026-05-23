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
```

- `NEXT_PUBLIC_APP_URL`：公开主站域名。
- `ADMIN_HOSTS`：允许访问 `/admin`、`/admin-login`、`/api/admin/*` 和 `/api/auth/developer-login` 的管理员域名。主系统不展示 Admin 入口。

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

```env
DEVELOPER_LOGIN_EMAIL="管理员登录邮箱"
DEVELOPER_LOGIN_PASSWORD="管理员登录密码"
DEVELOPER_LOGIN_ROLE="school_admin"
DEVELOPER_LOGIN_DISPLAY_NAME="TEAMAKING Admin"
```

说明：

- 管理员入口：`https://admin.teamingapp.org/admin-login`
- `DEVELOPER_LOGIN_EMAIL` 不一定必须是可收邮件地址，但建议使用可追溯的真实管理邮箱。
- `DEVELOPER_LOGIN_PASSWORD` 是生产敏感值，只放 Vercel，不写入 Git。
- 角色可用值包括 `school_admin` 和 `super_admin`；目前推荐 `school_admin`。

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
- 模板审核通过后才能正式发信；审核中时线上发信可能失败。

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

## 上传存储

```env
UPLOAD_STORAGE_MODE=""
```

线上 Vercel 环境会自动把 4MB 内上传文件以内联 data URL 方式保存到数据库字段，方便测试账号重复登录后继续查看头像、背景、简历和作品链接。

本地如需强制模拟线上内联存储：

```env
UPLOAD_STORAGE_MODE="inline"
```

正式长期版本建议接入对象存储，并继续沿用 `fileUrl`、`storageKey`、`fileName`、`fileMimeType`、`fileSize`、`fileExtension`、`previewKind` 等字段。

## 上线前检查清单

1. Vercel 中 `NEXT_PUBLIC_APP_URL=https://teamingapp.org`。
2. Vercel 中 `ADMIN_HOSTS=admin.teamingapp.org`。
3. Vercel 中 `ENABLE_DEMO_ACCESS=false`。
4. Vercel 中 `EMAIL_DEBUG_CODE_RESPONSE=false`。
5. 管理员登录变量已配置。
6. 腾讯云 SES SecretId/SecretKey 已配置。
7. 腾讯云 SES 发信地址和模板 ID 已配置。
8. 腾讯云模板审核通过。
9. Neon production migration 已执行。
10. Vercel 已 Redeploy。
