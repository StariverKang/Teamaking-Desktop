# TEAMAKING Interaction Terms

任何开发者、产品协作者或接手的 agent，在改交互前必须先读本文件。这里固定 TEAMAKING 项目里的专用称呼，避免把 post、request、quest、inbox 混用。

## Core Terms

### Teamaking Post

公开的 Open to Team 组队 signal。它属于某个 Course Board，由一个学生发布，表达“我愿意围绕这门课寻找协作伙伴”。

Teamaking Post 不是团队、不是申请表、不是队长招募帖。它显示课程、需求说明、发起者基础信息、发起者 Profile 入口、任务标签和 Team Up 入口。

### TeamUp Interest

某个学生对一条 Teamaking Post 发出的互动记录。它表示“我对你的这条 signal 感兴趣，并说明我能贡献什么”。

TeamUp Interest 不是公开组队帖本身，也不应该被叫成 Teamaking Post。它只围绕一条 Teamaking Post 存在。

### TeamUp Menu

学生查看“别人发给我发布的 Teamaking Posts 的 TeamUp Interests”的地方。当前路径沿用 `/team-up-requests`，但产品含义是 TeamUp Menu。

TeamUp Menu 不显示 Sent 列表。发出者通过具体 Teamaking Post 详情或未来的个人活动记录查看自己的互动状态。

### Inbox

用户之间关注/好友申请的收件箱。Inbox 不显示 TeamUp Interests。

Inbox 只处理 Follow Request：谁申请关注我、我是否接受或拒绝。

### Follow Request

用户 A 向用户 B 发出的关注申请。B 接受后，双方进入 mutual follow，可用于解锁 `mutual_follow` 联系方式可见性。

Follow Request 不是 TeamUp Interest，也不和课程绑定。

## Status Vocabulary

### TeamUp Interest Status

- `sent`：发出者已对 Teamaking Post 发送 TeamUp Interest，Post 发起者还没查看。
- `viewed`：Post 发起者已在 TeamUp Menu 或 Post 详情查看该 interest。
- `mutual`：Post 发起者点击“我也感兴趣”，双方可以继续平台外沟通。
- `withdrawn`：发出者撤回自己的 TeamUp Interest。
- `refused`：Post 发起者拒绝该 interest。
- `closed`：相关 Teamaking Post 完成后，active interests 被关闭。
- `deleted`：相关 Teamaking Post 完成后被删除/隐藏，interest 也不再出现在普通列表。
- `reported`：任一方出于安全原因举报。

不要使用 `accepted`、`rejected` 或 `contacted`。

### Follow Request Status

- `pending`：等待接收者处理。
- `accepted`：接收者接受，双方成为 mutual follow。
- `refused`：接收者拒绝。
- `withdrawn`：发出者撤回。

## Contact Visibility

联系方式权限由 Contact Info 统一配置，Teamaking Post 创建时不再单独选择展示哪些联系方式。

- `private`：任何人不可见。
- `public`：公开展示；MVP 中实际含义是同校已验证用户可见。
- `after_teamup_sent`：查看者向该用户的特定 Teamaking Post 发送 TeamUp Interest 后可见。
- `mutual_teamup`：双方围绕 TeamUp Interest 达成 mutual 后可见。
- `mutual_follow`：双方成为 mutual follow 后可见。

服务端必须在 API 返回前过滤联系方式，不能只靠前端隐藏。

## Portfolio Terms

### Work

过往成果里的作品类内容，例如个人作品、小组成果、PPT、报告、代码、设计稿。

### Honor

语言成绩、GPA、奖项、技能认证、职业认证等证明类内容。Honor 不和 Work 混在同一个展示列表里。

### Pinned Work

用户选择置顶展示的作品成果。每个用户最多置顶 3 个。

## Naming Rules

- 说 “Open to Team signal” 或 “Teamaking Post” 时，只指公开组队 signal。
- 说 “TeamUp Interest” 时，只指某人对某条 Teamaking Post 发出的互动。
- 说 “Inbox” 时，只指 Follow Request 收件箱。
- 不要把 TeamUp Interest 叫作公开 quest。
- 如果用户说 quest，必须根据上下文确认是 Teamaking Post 还是 TeamUp Interest。
