# TEAMAKING Beta Acceptance Checklist

目标：少量 BNBU 学生可稳定测试。

## Core Flows

- 注册验证码：同一邮箱同一用途 2 分钟冷却；注册完成后回到登录页。
- 密码登录：同一邮箱 1 小时 5 次失败后限流；不按 IP 限流。
- 受限账号：封禁/暂停账号可以登录到 `/account-restricted`，只能提交/查看工单。
- 管理员登录：使用数据库管理员账号，从管理员子域名或本地 `/admin-login` 登录。
- Profile 上传：本地测试写入 gitignored `public/uploads`；生产可切 Cloudflare R2；后缀/MIME/大小检查生效。
- Portfolio 可见性：`private` 仅本人，`same_school/public` 仅同校已验证用户，`same_course_board` 仅共享 active Course Board。
- Course data：cleaned JSON 导入能创建 Course、CourseOffering、CourseBoard；管理员可手动新增 offering。
- TeamUp：状态只使用 `sent/viewed/mutual/withdrawn/refused/closed/deleted/reported`，非法迁移被拒绝。
- 工单：用户可查看“我的工单”和管理员回复；管理员可搜索/处理工单。

## Admin Operations

- `npm run admin:create -- --email ... --password ... --role super_admin --record-local` 可创建管理员。
- `docs/admin-credentials.local.md` 被 `.gitignore` 忽略，不提交真实密码。
- `/admin/error-events` 可按 `errorCode/requestId/user/path` 查询运行错误。
- Course merge 会迁移关联并归档 source course。
- Checkpoint restore 会创建新的 active version，不做原地覆盖。

## Verification Commands

```bash
npm run prisma:validate
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run build
```

Integration tests must use `TEST_DATABASE_URL`; do not point tests at development or production data.
