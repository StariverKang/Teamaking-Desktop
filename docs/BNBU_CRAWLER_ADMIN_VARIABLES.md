# BNBU Crawler Admin Variables

本文档面向管理员，解释 `/crawler` 页面上所有可交互项、变量含义、输出位置和常见操作方式。Crawler 默认只生成 cleaned JSON；如管理员明确选择 `创建待审批导入批次` 或 `直接批准并更新线上数据库`，任务完成后会把本次输出写入课程导入工作流。默认模式仍不改数据库。

## Recommended Flow

1. 在 `/crawler` 填写爬取范围。
2. 点击 `启动爬虫`。
3. 在 `Jobs` 里确认状态为 `completed`。
4. 在 `Download outputs` 下载对应 `.teamaking.json`。
5. 打开 `/admin/course-imports`，粘贴 JSON，填写本次配置名称，先 `校验 JSON`。
6. 检查 Coverage、Courses、Rules、Diff。
7. 创建 pending 批次，再由管理员批准或拒绝。

## Input Variables

| 页面字段 | API 字段 | 类型 / 格式 | 必填 | 默认值 | 示例 | 作用 | 注意事项 |
|---|---|---:|---:|---|---|---|---|
| Job name | `name` / `jobName` | 文本 | 否 | 根据 admission years 自动生成 | `2025+2024 admission handbook full crawl` | 给本次爬虫任务一个人能读懂的名称。 | 不填也能跑；系统内部仍有 `CrawlerJob.id`，但页面主要展示任务名。 |
| 自然语言说明 | `instruction` | 文本 | 否 | 一段默认说明 | `爬取 2025 和 2024 admission 的 programme handbook，输出 2026 Fall 的课程配置 JSON。` | 辅助自动识别 URL、admission years、programme codes、academic year、term、limit 和 target。 | 明确字段会覆盖自然语言推断。自然语言适合快速填写，但正式任务建议同时检查下方结构化字段。 |
| 爬取目标 | `target` | 枚举 | 是 | `programme_handbook` | `programme_handbook` | 决定运行哪类解析器。 | 目前只有 `programme_handbook` 可执行；`semester_offerings` 和 `syllabus_teamwork` 是预留入口。 |
| Handbook URL | `handbookUrl` | URL | 是 | BNBU programme handbook 页面 | `https://ar.bnbu.edu.cn/current_students/student_handbook/programme_handbook.htm` | Crawler 从这里寻找每个 admission year 的 programme handbook 页面和 PDF。 | 不要填某一个专业 PDF，除非后续解析器明确支持。当前应填 handbook index 页面。 |
| Admission years | `cohorts` | 逗号分隔年份 | 是 | `2025,2024` | `2025`、`2025,2024` | 指“哪一年入学的学生”的四年课程安排。输出文件会按 admission year 分开生成。 | 这是学生入学年份，不是当前学年，也不是开课学期。 |
| Programme codes | `programmes` / `programmeCodes` | 逗号分隔代码 | 否 | 空 | `ACCT,MCOM` | 只爬指定专业。留空表示该 admission year 下所有可识别专业。 | 代码通常来自 PDF 文件名前缀，如 `ACCT`。大小写不敏感，系统会转大写。 |
| Faculty codes | `facultyCodes` | 逗号分隔代码 | 否 | 空 | `FBM,FHSS` | 只爬指定学院/学部范围。留空表示不过滤 faculty。 | 常用：`FBM`、`FHSS`、`FST`、`SCC`、`SAIN`、`GE`、`AR`。 |
| Activation preview year | `academicYear` | 年份数字 | 是 | `2026` | `2026` | 生成 JSON 中 `semester.academicYear` 和默认 `semester.code`。 | 这是 Course Board 激活预览上下文，用于判断当前 academic term 对应哪些 admission-year rules；不代表 admission year。 |
| Activation preview term | `term` | `Spring` / `Fall` | 是 | `Spring` | `Fall` | 生成 JSON 中 `semester.term` 和默认 `semester.code`。 | 与 Activation preview year 一起形成 `2026-Fall`。课程安排本身仍按 admission year 存储。 |
| Limit | `limit` | `all` 或整数 | 是 | `all` | `all`、`1`、`5` | 限制每个 admission year 最多解析多少个 programme PDF。 | 测试时用 `1`；正式全量用 `all`。如果全量失败，可按 faculty 或 programme 分批跑。 |
| Output mode | `outputMode` | 枚举 | 是 | `download` | `download` | 决定 JSON 输出到哪里。 | 页面显示值见下表。 |
| After crawl | `databaseAction` | 枚举 | 是 | `download_only` | `download_only` | 决定爬虫完成后的数据库动作。 | `approve_import` 会直接写入线上数据库，只给确认过范围的管理员使用。 |

## Target Options

| 页面选项 | API 值 | 当前状态 | 输出内容 |
|---|---|---|---|
| Programme handbook | `programme_handbook` | 已支持 | 课程目录 `courses[]`、专业/学院、按 admission year 的 `curriculumRules[]`。通常 `offerings[]` 为空。 |
| Semester offerings | `semester_offerings` | 预留 | 未来用于真实开课表/本学期开课列表，生成 `offerings[]` 和 Course Board 激活依据。 |
| Syllabus teamwork evidence | `syllabus_teamwork` | 预留 | 未来用于 syllabus PDF/HTML，生成 teamwork requirement evidence。 |

## Output Mode

| 页面显示 | API 值 | 写入位置 | 是否进 Git | 适用场景 |
|---|---|---|---:|---|
| `download-only storage` | `download` | `storage/crawler_outputs/` | 否 | 日常测试、线上正式流程、管理员下载后手动粘贴导入。 |
| `course_imports/bnbu` | `git_import_json` | `course_imports/bnbu/` | 是，限 `*.teamaking.json` | 本地开发/测试样本、需要提交 Git 的固定导入 JSON。 |

生产或线上测试时，推荐使用 `download-only storage`，下载后立即保存到本地，再去 `/admin/course-imports` 粘贴。服务器本地文件系统不应被视为长期档案；长期审计以管理员导入后形成的 `CourseImportDataset`、artifact 和日志为准。

## After Crawl 数据库动作

| 页面选项 | API 值 | 数据库动作 | 适用场景 |
|---|---|---|---|
| 只生成并下载 JSON | `download_only` | 不创建批次，不写课程数据。Job 行会显示“下载本次爬取内容”。 | 默认安全模式、人工检查 JSON。 |
| 创建待审批导入批次 | `create_pending` | 为本次每个 admission year 输出创建 pending `CourseImportBatch` 和线上数据集。 | 管理员还想去 `/admin/course-imports` 看 Diff 后再批准。 |
| 直接批准并更新线上数据库 | `approve_import` | 创建导入批次后立即批准，写入 Course、CourseCurriculumRule 等配置数据，并创建版本 checkpoint。 | 现场确认范围无误后快速更新线上数据库。 |

`approve_import` 不会清空已有用户、课程、公告或历史日志。若同 admission year 已有旧 pending 批次，系统会把旧 pending 标记为 rejected，避免重复待审批项。

## Derived Variables

这些字段不会全部显示在页面上，但会进入 crawler 命令或输出 JSON。

| 派生字段 | 来源 | 示例 | 说明 |
|---|---|---|---|
| `semesterCode` | `academicYear` + `term` | `2026-Fall` | 写入 JSON 的 `semester.code`，用于激活预览。 |
| `semesterName` | `academicYear` + `term` | `2026 Fall` | 写入 JSON 的 `semester.name`，用于激活预览。 |
| `cohortYears` | `cohorts` | `[2025, 2024]` | 写入 JSON 顶层，用于说明这份文件覆盖哪些 admission years。 |
| `selectedProgrammeCodes` | 实际匹配到的 PDF | `["ACCT", "MCOM"]` | 写入 `crawlerMeta`，用于检查本次到底爬了哪些专业。 |
| `isCurrentCandidate` | 固定为 false | `false` | crawler 输出不会请求切换系统当前学期。 |
| `offerings` | 当前 handbook parser | `[]` | programme handbook 不是真实开课表，所以通常为空。Course Board 由 academic term + admission-year rule 匹配激活。 |

## Jobs Table

| 列名 | 含义 | 管理员应该怎么读 |
|---|---|---|
| Job | 管理员填写的 Job name；下方可能显示内部 id。 | 日常检查看任务名；报错或查日志时用内部 id 对齐。 |
| Status | `running`、`completed`、`failed`。 | 只有 `completed` 才代表本次完整成功。`failed` 需要看 Log，可能已有部分文件输出，但不应直接当全量结果使用。 |
| Admission years | 本次爬取哪几年入学学生的课程安排。 | 例如 `2025, 2024`。 |
| Activation preview | 激活预览 academic term。 | 例如 `2026-Fall`；这不是 admission year。 |
| Started | 任务启动的现实时间。 | 用于和输出文件 modified time、导入日志对齐。 |
| Result | 成功摘要或失败错误。 | 如果 failed，先看这一列，再看 Log 最后几行。 |
| Log | 解析过程日志。 | `parsed 2025 ACCT: 89 course rows` 表示已解析某个 programme；如果最后 failed，需要看最后几行错误。 |

## Download Outputs

| 列名 | 含义 | 管理员应该怎么做 |
|---|---|---|
| File | 生成的 `.teamaking.json` 文件名。 | 选择对应 admission year 的文件下载，例如 `bnbu-2025-admission-handbook.teamaking.json`。 |
| Size | 文件大小。 | 全量 handbook 通常较大；明显过小可能表示只跑了 limit 或失败后只有部分输出。 |
| Modified | 文件最后修改时间。 | 和 Job Started 对照，确认下载的是刚刚那次输出。 |
| Action | 下载按钮。 | 下载后打开或复制内容到 `/admin/course-imports`。 |

## Common Recipes

### Quick Smoke Test

| 字段 | 填法 |
|---|---|
| Admission years | `2025` |
| Programme codes | `ACCT` |
| Limit | `1` |
| Output mode | `download-only storage` |

预期：很快完成，只生成一个小 JSON。用于确认网络和 parser 正常。

### Full 2025 And 2024 Handbook Import

| 字段 | 填法 |
|---|---|
| Admission years | `2025,2024` |
| Programme codes | 留空 |
| Faculty codes | 留空 |
| Activation preview year / term | 按当前要预览激活的 academic term 填，例如 `2026` + `Fall` |
| Limit | `all` |
| Output mode | `download-only storage` |

预期：每个 admission year 生成一个文件。下载后分批导入，不建议一次混在一个 JSON。

### One Faculty Only

| 字段 | 填法 |
|---|---|
| Admission years | `2025,2024` |
| Faculty codes | `FBM` |
| Programme codes | 留空 |
| Limit | `all` |

适用于全量任务失败或只想检查某个学院。

## Common Mistakes

| 问题 | 现象 | 正确理解 / 处理 |
|---|---|---|
| 把 `Activation preview year / term` 当 admission year | 输出 Scope 看起来是 `2025,2024 · 2026-Fall`，管理员以为重复。 | `2025,2024` 是入学年份；`2026-Fall` 只用于预览这些 admission-year 规则在某个 academic term 会激活哪些 Course Board。 |
| `offerings[]` 为空 | 管理后台 warning 或 preview 显示 offerings empty。 | 对 programme handbook 来说正常。真实 offerings 需要未来 semester offerings parser。 |
| Job 显示 `failed` 但 Download outputs 有文件 | 能下载某些 JSON。 | 可能前面 admission year / programme 已写出，后续步骤失败。必须看 Log 和 Result，不要当作全量完成。 |
| `Limit = 1` 后以为数据少是 bug | 只生成一个 programme 的课程。 | `Limit` 是测试用限制。正式导入用 `all`。 |
| 选 `course_imports/bnbu` 后以为已入库 | 文件出现在 download 列表或项目目录。 | 这只是生成 JSON 文件。只有 After crawl 选择 `create_pending` 或 `approve_import` 才会进入导入工作流。 |
| Programme codes 留空后耗时很长 | Job running 很久。 | 留空表示全专业。可按 faculty 或 programme 分批。 |
| 看到随机 job id 以为任务不能命名 | 表格里仍有 `cm...` 或 `crawl...`。 | 这是内部 id，用于排查。管理员应填写并查看 `Job name`。 |
| 看到多个 approved 记录以为同一 JSON 被拆批 | 导入历史里同一 admission year 有多条记录。 | 每次 JSON 输入是一条配置操作；approved 历史表示之前批准过的操作。新的 pending 会作为替换候选，批准后写入当前 active 课程目录和配置规则。 |

## Acceptance Checklist

下载 JSON 后，管理员导入前至少检查：

- 文件名中的 admission year 是否正确。
- JSON 顶层 `schemaVersion` 是 `teamaking.bnbu_course_import.v2`。
- `cohortYears` 是否只包含当前文件对应的 admission year。
- `semester.code` 是否是本次配置上下文，例如 `2026-Fall`。
- `semester.isCurrentCandidate` 是否为 `false`。
- `curriculumRules[].audience.majorCodes` 是否对专业必修/专业选修等专业范围课程存在。
- `major_required`、`major_elective`、`concentration_required`、`concentration_elective` 不应使用 `allMajors: true`。
- `offerings[]` 为空时，要确认这是 handbook admission-year import，而不是本学期真实开课表 import。

## Ownership Boundary

Crawler 页面默认只负责“生成可审查 JSON”。如果管理员选择 `直接批准并更新线上数据库`，主系统数据库变化会在 crawler job 完成后立即发生；该动作仍会创建 `CourseImportBatch`、`CourseImportDataset`、操作日志和 version checkpoint，方便之后审计与回溯。任何课程目录、admission-year curriculum rules、Course Board 激活、默认加入、操作日志和版本 checkpoint，都以管理员导入页和管理员版本页为准。
