# TEAMAKING Error Codes

API 错误响应统一返回：

```json
{ "error": "用户可读错误", "errorCode": "AUTH_LOGIN_RATE_LIMIT", "requestId": "..." }
```

用户侧只需要记录 `errorCode` 和 `requestId`。管理员在 `/admin/error-events` 中按代码、请求 ID、用户或路径查询。

| Code | Type | Meaning |
| --- | --- | --- |
| `AUTH_VERIFICATION_COOLDOWN` | Auth | 同一邮箱同一用途验证码 2 分钟冷却未结束。 |
| `AUTH_VERIFICATION_INVALID` | Auth | 验证码无效、过期或已使用。 |
| `AUTH_LOGIN_INVALID_CREDENTIALS` | Auth | 邮箱或密码不正确。 |
| `AUTH_LOGIN_RATE_LIMIT` | Auth | 同一邮箱 1 小时内失败登录达到 5 次。 |
| `AUTH_ADMIN_LOGIN_REQUIRED` | Auth/Admin | 需要管理员权限或 super_admin 权限。 |
| `AUTH_ADMIN_LOGIN_INVALID` | Auth/Admin | 管理员账号或密码不正确。 |
| `AUTH_ACCOUNT_RESTRICTED` | Auth | 账号封禁或暂停，只允许工单/管理员联系通道。 |
| `COURSE_IMPORT_INVALID_JSON` | Course Import | cleaned JSON 无法解析或不是对象。 |
| `COURSE_IMPORT_DUPLICATE_PENDING` | Course Import | 同 admission year 已存在 pending 导入。 |
| `COURSE_OFFERING_INVALID` | Course | 开课配置与课程/学期关系无效。 |
| `COURSE_MERGE_INVALID` | Course | 课程合并请求无效。 |
| `CHECKPOINT_NOT_FOUND` | Version | 找不到 checkpoint。 |
| `CHECKPOINT_RESTORE_FAILED` | Version | checkpoint 恢复失败。 |
| `UPLOAD_FILE_REQUIRED` | Upload | 请求中没有文件。 |
| `UPLOAD_FILE_TOO_LARGE` | Upload | 文件超过大小限制。 |
| `UPLOAD_EXTENSION_BLOCKED` | Upload | 后缀不在白名单或属于风险扩展。 |
| `UPLOAD_MIME_MISMATCH` | Upload | MIME 和文件后缀明显不匹配。 |
| `UPLOAD_STORAGE_FAILED` | Upload | 本地/R2/inline 存储失败。 |
| `TEAMUP_INVALID_TRANSITION` | TeamUp | TeamUp 状态迁移不合法。 |
| `SUPPORT_TICKET_INVALID` | Support | 工单字段不合法。 |
| `API_BAD_REQUEST` | Generic | 请求参数错误。 |
| `API_UNAUTHORIZED` | Generic | 未登录。 |
| `API_FORBIDDEN` | Generic | 无权限。 |
| `API_NOT_FOUND` | Generic | 路径或资源不存在。 |
| `API_CONFLICT` | Generic | 数据冲突。 |
| `API_RATE_LIMITED` | Generic | 频率限制。 |
| `API_METHOD_NOT_ALLOWED` | Generic | HTTP 方法不支持。 |
| `API_SYSTEM_PAUSED` | Generic | 全站暂停开关生效。 |
| `INTERNAL_SERVER_ERROR` | Generic | 未分类服务器错误。 |
