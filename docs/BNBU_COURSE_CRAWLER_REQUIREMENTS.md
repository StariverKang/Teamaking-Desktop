# BNBU Course Crawler And Cleaning Requirements

本文档用于指导 BNBU 课程数据采集与处理程序。Crawler 可以作为独立子域名/本地端口运行，但它仍与主 TEAMAKING 系统解耦：crawler 负责采集、保留原始证据、清洗结构化数据，并最终输出 TEAMAKING 可导入的业务 JSON；主系统只通过 `CourseImportWorkflow` 审批 cleaned JSON 入库。管理员可以手动粘贴，也可以让 crawler job 在完成后创建 pending 批次或直接批准。

当前产品边界：BNBU 课程配置以每年 admission programme handbook 为准。BNBU class schedule 只是学期时间安排，不作为课程存在、真实开课或 CourseBoard 配置依据；`semester_offerings` 与 `syllabus_teamwork` 不属于当前必要管线。Handbook import 可以保持 `offerings[]` 为空，系统会通过当前 academic term、学生 admission year、major 和 `relativeTermCodes` 激活 CourseBoard。

目标工作流：

```text
Crawler / 独立爬虫端口
↓
JSONL（原始采集）
↓
Python 清洗
↓
JSON（业务结构）
↓
Frontend/API
```

最终 JSON 会由 `CourseImportWorkflow` 校验、创建待审批批次，并在批准后写入正式数据库。安全默认流程仍是：线上 crawler 生成文件后下载单个 `.teamaking.json`，再到 TEAMAKING `/admin/course-imports` 粘贴、命名、校验和人工批准；若管理员在 crawler 页面明确选择 `create_pending` 或 `approve_import`，crawler module 会把本次真实输出交给同一个 workflow，不走另一套导入逻辑。

## 1. 总体目标

爬虫和清洗程序必须产出“某一学校、某一学期”的课程配置快照。这个快照不仅包含课程名称和课程代码，还必须包含课程归属、课程类别、适用学生范围、开课学期、syllabus 中的组队需求，以及足够的来源证据。

核心业务场景：

- 一门课是 MCOM 大二上学期必修课：MCOM Year 2 学生默认加入对应 Course Board。
- 同一门课也是其他专业自由选修课：其他专业学生不会默认加入，但可以搜索课程代码或名称后手动加入。
- 学生退出默认加入的 Course Board 后，系统保留 opt-out，下一次同一规则导入不能把学生重新加回。
- 旧学期课程板进入历史课程，新学期课程板按新配置展示。

## 2. 工作流节点

### 2.1 Crawler

Crawler 只负责采集公开页面和文件，不在爬虫阶段直接做业务决策。它应该尽量完整、可复现地保存官网证据。

需要采集的来源类型：

- 专业 curriculum / programme structure 页面。
- Faculty / School 下的课程结构页面。
- Academic Registry 公布的 University Core、GE、course registration、add/drop 相关文件。
- 每门课公开 syllabus、PDF、HTML 或下载文件。
- 课程表、semester arrangement、study plan、credit arrangement 文件。

每次采集必须记录：

- URL。
- 页面标题。
- 页面类型。
- 抓取时间。
- HTTP 状态码。
- content type。
- 原始 HTML 或文件路径/hash。
- 页面正文纯文本。
- 表格抽取结果。
- 链接抽取结果。

Crawler 不应该直接删除模糊数据。遇到识别不确定的课程类别、专业名、学期名、PDF 表格，应保留原始证据，并在后续清洗阶段标记 `confidence: "low"` 或 `classification: "unknown"`。

### 2.2 JSONL Raw Capture

Crawler 输出 JSONL。每一行代表一个原始采集单元，不要求直接符合业务结构。

推荐 raw JSONL schema：

```json
{
  "rawId": "raw-2026fall-mcom-curriculum-001",
  "retrievedAt": "2026-05-24T10:30:00+08:00",
  "url": "https://example.bnbu.edu.cn/mcom/curriculum.htm",
  "sourceType": "curriculum_page",
  "httpStatus": 200,
  "contentType": "text/html",
  "title": "Curriculum",
  "facultyHint": "Faculty of Humanities and Social Sciences",
  "majorHint": "Media and Communication",
  "semesterHint": "2026 Fall",
  "rawText": "plain text extracted from html or pdf",
  "tables": [
    {
      "caption": "Major Required Courses",
      "headers": ["Course Code", "Course Title", "Credits", "Year", "Semester"],
      "rows": [
        ["COMM2003", "Example Course", "3", "Year 2", "Fall"]
      ]
    }
  ],
  "links": [
    {
      "text": "Syllabus",
      "href": "https://example.bnbu.edu.cn/course/COMM2003.pdf"
    }
  ],
  "file": {
    "path": "raw_files/COMM2003.pdf",
    "sha256": "..."
  },
  "crawlerMeta": {
    "parser": "playwright-html-v1",
    "notes": []
  }
}
```

Required raw fields:

- `rawId`
- `retrievedAt`
- `url`
- `sourceType`
- `httpStatus`
- `contentType`
- `title`
- `rawText`
- `tables`
- `links`

Allowed `sourceType` values:

- `curriculum_page`
- `curriculum_pdf`
- `programme_structure`
- `semester_arrangement`
- `course_schedule`
- `syllabus_html`
- `syllabus_pdf`
- `academic_registry_pdf`
- `general_education_page`
- `university_core_page`
- `unknown`

### 2.3 Python Cleaning

Python 清洗程序负责把 JSONL 转成 TEAMAKING cleaned JSON。清洗程序必须是 deterministic：同一批 raw JSONL 输入，应输出相同 JSON。

清洗程序需要实现：

- 来源去重：同一 URL 或同一文件 hash 不重复生成 `sourceRefs`。
- 文本规范化：清理空白、全角标点、PDF 换行、表格错位。
- 课程代码识别：提取如 `COMM2003`、`MATH1013` 等课程代码，保留原始大小写但建议最终统一大写。
- 课程名称识别：从表格列、标题、syllabus header 中抽取英文课程名。
- 学分识别：把 `"3 credits"`、`"3"`、`"3.0"` 统一为 number。
- Faculty/Major 识别：把官网名称映射到稳定 code。
- 年级/学期识别：把 handbook 中的 `Year 2 Semester 1`, `Y2S1` 等统一为相对学期 `relativeTermCodes: ["Y2S1"]`。Handbook 文件名中的公元年份只代表 cohort/source version，不代表真实开课学期。
- 课程分类映射：把官网原始 label 映射到 TEAMAKING enum，并保留 `classificationLabel`。
- audience 生成：根据专业、院系、年级、cohort、concentration 生成适用人群。
- studentAction 生成：根据 classification 决定默认加入、可搜索添加或仅推荐。
- syllabus 组队需求识别：判断课程是否有 group project / team assignment / presentation team / peer evaluation 等。
- 置信度计算：明确来源、表格结构清晰为 `high`；推断得到为 `medium`；文本模糊或人工待审为 `low`。

清洗程序不得臆造课程。无法确认的内容必须：

- 使用 `unknown` 分类或 `confidence: "low"`。
- 把原始 label 放入 `classificationLabel`。
- 把证据来源写入 `sourceRefIds`。

### 2.4 Cleaned JSON

最终给 TEAMAKING 的文件必须是一个 JSON object，不是 JSONL。新数据建议使用 v2，v1 仍兼容：

```json
{
  "schemaVersion": "teamaking.bnbu_course_import.v2",
  "generatedAt": "2026-05-24T10:30:00+08:00",
  "school": {
    "shortName": "BNBU",
    "name": "Beijing Normal-Hong Kong Baptist University",
    "emailDomain": "mail.bnbu.edu.cn"
  },
  "semester": {
    "code": "2026-Fall",
    "name": "2026 Fall",
    "academicYear": 2026,
    "term": "Fall",
    "isCurrentCandidate": false
  },
  "sourceRefs": [],
  "faculties": [],
  "majors": [],
  "courses": [],
  "offerings": [],
  "curriculumRules": []
}
```

TEAMAKING 当前只接受 `school.shortName = "BNBU"`。

v2 语义：

- `curriculumRules[]` 可以来自 handbook/programme structure，并用 `relativeTermCodes` 表示学生相对学期。
- Programme Handbook 应按 admission year 分文件输出，例如 2025 admission 和 2024 admission 分别生成独立 cleaned JSON，便于分批导入与 coverage 检查。
- `offerings[]` 可以为空；cohort handbook import 通过当前 academic term、cohort year、major 和 `relativeTermCodes` 激活 Course Board。
- 若未来提供真实 course timetable/course-list，`offerings[]` 必须来自该类来源，不能只引用 `curriculum_pdf` 或 `programme_structure`。
- 只有最终 cleaned JSON 可提交到 Git；本地 crawler/cleaner 代码、raw 文件、缓存和登录态不提交。

### 2.5 Frontend/API Import

管理员流程：

1. 打开 `/admin/course-imports`。
2. 粘贴 cleaned JSON。
3. 点击“校验 JSON”。
4. 校验通过后创建待审批批次。
5. 管理员人工检查 source、counts、warnings。
6. 批准导入或拒绝。

Crawler 完成后的 `After crawl` 动作使用同一个 workflow：`download_only` 不改数据库，`create_pending` 只创建待审批批次，`approve_import` 创建后立即批准。任何路径都必须保留 `CourseImportBatch`、`CourseImportDataset` 和操作日志。

API：

- `POST /api/admin/course-imports/validate`
- `GET /api/admin/course-imports`
- `POST /api/admin/course-imports`
- `POST /api/admin/course-imports/:id/approve`
- `POST /api/admin/course-imports/:id/reject`

批准导入后，TEAMAKING 会写入：

- `School`
- `SchoolEmailDomain`
- `Faculty`
- `Major`
- `Semester`
- `Course`
- `CourseOffering`
- `CourseBoard`
- `CourseImportBatch`
- `CourseCurriculumRule`
- `CourseSyllabusMetadata`
- `CourseBoardMembership`（仅 `default_join` 规则自动生成）

## 3. Cleaned JSON 字段规范

### 3.1 sourceRefs

`sourceRefs` 是所有结构化字段的证据索引。后续所有 course、offering、rule、syllabus 都应引用它。

```json
{
  "id": "mcom-curriculum-2026",
  "title": "MCOM Curriculum",
  "url": "https://...",
  "sourceType": "curriculum_page",
  "retrievedAt": "2026-05-24T10:30:00+08:00",
  "publishedAt": "2026-05-01",
  "rawIds": ["raw-2026fall-mcom-curriculum-001"],
  "sha256": "optional-file-or-text-hash"
}
```

Required:

- `id`
- `title`
- `url`
- `sourceType`
- `retrievedAt`

How to crawl/parse:

- `title`: HTML `<title>`, PDF metadata, or nearest page heading.
- `url`: final URL after redirects.
- `sourceType`: from crawler classification.
- `rawIds`: connect cleaned source to raw JSONL lines.

### 3.2 faculties

Faculties map BNBU organizational units to stable codes.

```json
{
  "code": "FHSS",
  "name": "Faculty of Humanities and Social Sciences",
  "aliases": ["FHSS"]
}
```

Required:

- `code`
- `name`

Recommended stable codes:

- `FHSS`
- `FBM`
- `FST`
- `SCC`
- `SAIN`
- `GE`
- `AR`

How to crawl/parse:

- Use page section, URL path, breadcrumb, faculty header, or programme page ownership.
- If a course is owned by a university-wide unit, use `GE` or `AR` as `ownerUnit.code` instead of forcing it into a major.

### 3.3 majors

Majors identify the programme selected by users in onboarding.

```json
{
  "code": "MCOM",
  "name": "Media and Communication",
  "facultyCode": "FHSS",
  "degreeType": "undergraduate",
  "aliases": ["Communication Studies", "Media"]
}
```

Required:

- `code`
- `name`
- `facultyCode`
- `degreeType`

Allowed `degreeType`:

- `undergraduate`
- `postgraduate`
- `minor`
- `certificate`

How to crawl/parse:

- Use official programme short names where available.
- If no official short code is visible, generate a deterministic code from programme name and keep aliases.
- `facultyCode` must reference an item in `faculties`.

### 3.4 courses

Courses are school-level canonical course records. A course can appear in multiple semesters and multiple curriculum rules.

```json
{
  "code": "COMM2003",
  "title": "Example Course",
  "credits": 3,
  "ownerUnit": {
    "type": "faculty",
    "code": "FHSS",
    "name": "Faculty of Humanities and Social Sciences"
  },
  "categoryTags": ["Major Required Courses", "Group Project"],
  "description": "Short factual description if available.",
  "sourceRefIds": ["mcom-curriculum-2026"]
}
```

Required:

- `code`
- `title`

Optional but strongly recommended:

- `credits`
- `ownerUnit`
- `categoryTags`
- `description`
- `sourceRefIds`

How to crawl/parse:

- `code`: parse from curriculum tables, syllabus title, course schedule, or PDF body.
- `title`: parse from same row as code; fallback to syllabus heading.
- `credits`: parse numeric value from curriculum credit columns.
- `ownerUnit`: infer from programme/faculty page or syllabus owner.
- `categoryTags`: preserve official raw labels for admin inspection.
- `description`: keep short summary only; do not copy long syllabus text.

Deduplication:

- Unique key is `(school.shortName, course.code)`.
- If the same course appears under multiple categories, create one `courses[]` item and multiple `curriculumRules[]`.

### 3.5 offerings

Offerings represent a course being active in a semester.

```json
{
  "courseCode": "COMM2003",
  "semesterCode": "2026-Fall",
  "teacherNames": ["Dr. Example"],
  "sections": ["A"],
  "status": "active",
  "sourceRefIds": ["semester-arrangement-2026fall"],
  "syllabus": {
    "teamworkRequirement": "required",
    "teamworkSummary": "Syllabus mentions a required group project and group presentation.",
    "evidenceSourceRefIds": ["comm2003-syllabus-2026fall"],
    "confidence": "high"
  }
}
```

Required:

- `courseCode`
- `semesterCode`

Optional:

- `teacherNames`
- `sections`
- `status`
- `sourceRefIds`
- `syllabus`

Allowed `status`:

- `active`
- `cancelled`
- `tentative`
- `unknown`

Allowed `syllabus.teamworkRequirement`:

- `required`
- `optional`
- `none`
- `unknown`

How to crawl/parse:

- `courseCode`: must match `courses[].code`.
- `semesterCode`: must equal top-level `semester.code`.
- `teacherNames`: parse from timetable, syllabus, or course schedule if public.
- `sections`: if no public section exists, use `["Default"]`.
- `teamworkRequirement`: detect terms such as group project, team assignment, group presentation, peer evaluation, teamwork, group report.
- `teamworkSummary`: write a short factual summary, not a full copied syllabus passage.

### 3.6 curriculumRules

Curriculum rules are the most important part of the import. They tell TEAMAKING which students should see or join which Course Board.

```json
{
  "id": "2026-Fall-COMM2003-MCOM-Y2-major-required",
  "courseCode": "COMM2003",
  "semesterCode": "2026-Fall",
  "classification": "major_required",
  "classificationLabel": "Major Required Courses",
  "audience": {
    "majorCodes": ["MCOM"],
    "facultyCodes": [],
    "grades": ["Year 2"],
    "cohortYears": [2025],
    "concentrationCodes": [],
    "allMajors": false
  },
  "studentAction": "default_join",
  "ownerUnit": {
    "type": "faculty",
    "code": "FHSS",
    "name": "Faculty of Humanities and Social Sciences"
  },
  "sourceRefIds": ["mcom-curriculum-2026"],
  "confidence": "high"
}
```

Required:

- `id`
- `courseCode`
- `semesterCode`
- `classification`
- `audience`
- `studentAction`

Optional but strongly recommended:

- `classificationLabel`
- `ownerUnit`
- `sourceRefIds`
- `confidence`

Rule ID convention:

```text
{semesterCode}-{courseCode}-{audienceCode}-{gradeOrAll}-{classification}
```

Examples:

- `2026-Fall-COMM2003-MCOM-Y2-major-required`
- `2026-Fall-COMM2003-ALL-all-free-elective`
- `2026-Fall-UCLC1001-ALL-Y1-university-core-english`

Allowed `classification`:

- `major_required`
- `major_elective`
- `bba_core`
- `faculty_required`
- `college_core`
- `common_core`
- `required_core`
- `elective_core`
- `concentration_required`
- `concentration_elective`
- `university_core`
- `university_core_chinese`
- `university_core_english`
- `university_core_ai_literacy`
- `university_core_ppe`
- `university_core_military_training`
- `university_core_wpex`
- `university_core_healthy_lifestyle`
- `general_education`
- `ge_level_1_foundational`
- `ge_level_2_interdisciplinary_thematic`
- `ge_level_3_capstone`
- `free_elective`
- `supporting_course`
- `interdisciplinary_course`
- `final_year_project`
- `internship`
- `unknown`

Allowed `studentAction`:

- `default_join`
- `searchable_add`
- `recommend_only`
- `hidden`

Default mapping:

- `default_join`: `major_required`, `bba_core`, `faculty_required`, `college_core`, `common_core`, `required_core`, `concentration_required`, all `university_core_*`, `final_year_project`, `internship`.
- `searchable_add`: `major_elective`, `concentration_elective`, `elective_core`, `general_education`, all `ge_level_*`, `free_elective`, `supporting_course`, `interdisciplinary_course`.
- `unknown`: use `recommend_only` or `hidden` unless a human reviewer confirms the rule.

Audience rules:

- `majorCodes`: match users whose onboarding major code is in the list.
- `facultyCodes`: match users whose onboarding faculty code is in the list.
- `relativeTermCodes`: preferred in v2; match derived student terms such as `Y1S1`, `Y2S2` from `entryYear` + `entryTerm` + current semester.
- `grades`: legacy fallback matching `Year 1`, `Year 2`, `Year 3`, `Year 4`.
- `cohortYears`: preserve official cohort targeting; current TEAMAKING stores it in rule JSON for review.
- `concentrationCodes`: preserve concentration targeting; current TEAMAKING stores it in rule JSON for review.
- `allMajors: true`: applies to all onboarded students in BNBU, still optionally limited by `grades`.

`major_required`, `major_elective`, `concentration_required`, and `concentration_elective` must include `majorCodes` and must not use `allMajors: true`.

Important modeling rule:

If the same course has more than one role, create multiple rules. Do not merge them into one ambiguous rule.

Example:

```json
[
  {
    "id": "2026-Fall-COMM2003-MCOM-Y2-major-required",
    "courseCode": "COMM2003",
    "semesterCode": "2026-Fall",
    "classification": "major_required",
    "classificationLabel": "Major Required Courses",
    "audience": {
      "majorCodes": ["MCOM"],
      "facultyCodes": [],
      "grades": [],
      "relativeTermCodes": ["Y2S1"],
      "cohortYears": [],
      "concentrationCodes": [],
      "allMajors": false
    },
    "studentAction": "default_join",
    "sourceRefIds": ["mcom-curriculum-2026"],
    "confidence": "high"
  },
  {
    "id": "2026-Fall-COMM2003-ALL-all-free-elective",
    "courseCode": "COMM2003",
    "semesterCode": "2026-Fall",
    "classification": "free_elective",
    "classificationLabel": "Free Elective Courses",
    "audience": {
      "majorCodes": [],
      "facultyCodes": [],
      "grades": [],
      "cohortYears": [],
      "concentrationCodes": [],
      "allMajors": true
    },
    "studentAction": "searchable_add",
    "sourceRefIds": ["free-elective-list-2026"],
    "confidence": "medium"
  }
]
```

## 4. Formal Database Field Mapping

The cleaned JSON must contain enough data to populate these database models.

### School

Database fields:

- `name`
- `shortName`
- `status`

JSON source:

- `school.name`
- `school.shortName`

Required value:

- `shortName = "BNBU"`

### SchoolEmailDomain

Database fields:

- `domain`
- `status`

JSON source:

- `school.emailDomain`

Required value:

- `mail.bnbu.edu.cn`

### Faculty

Database fields:

- `schoolId`
- `code`
- `name`

JSON source:

- `faculties[].code`
- `faculties[].name`

### Major

Database fields:

- `schoolId`
- `facultyId`
- `code`
- `name`
- `degreeType`

JSON source:

- `majors[].code`
- `majors[].name`
- `majors[].facultyCode`
- `majors[].degreeType`

### Semester

Database fields:

- `schoolId`
- `code`
- `name`
- `year`
- `term`
- `isCurrent`

JSON source:

- `semester.code`
- `semester.name`
- `semester.academicYear`
- `semester.term`
- `semester.isCurrentCandidate`

### Course

Database fields:

- `schoolId`
- `code`
- `title`
- `description`
- `credits`
- `ownerUnit`
- `categoryTags`
- `sourceRefIds`
- `courseType`
- `status`
- `source`

JSON source:

- `courses[].code`
- `courses[].title`
- `courses[].description`
- `courses[].credits`
- `courses[].ownerUnit`
- `courses[].categoryTags`
- `courses[].sourceRefIds`

TEAMAKING sets:

- `courseType = "coursework"`
- `status = "active"`
- `source = "bnbu_import"`

### CourseOffering

Database fields:

- `courseId`
- `semesterId`
- `teacherName`
- `section`
- `sourceRefIds`
- `status`

JSON source:

- `offerings[].courseCode`
- `offerings[].semesterCode`
- `offerings[].teacherNames`
- `offerings[].sections`
- `offerings[].sourceRefIds`
- `offerings[].status`

TEAMAKING creates one offering per section. If no section exists, cleaning should emit `sections: ["Default"]`.

### CourseBoard

Database fields:

- `courseOfferingId`
- `title`
- `status`
- `rules`

JSON source:

- Indirectly from `offerings[]` and `courses[]`.

TEAMAKING sets:

- `title = "{course.code} {course.title}"`
- `status = "active"`
- default board rules text.

### CourseCurriculumRule

Database fields:

- `importBatchId`
- `externalId`
- `courseId`
- `semesterId`
- `classification`
- `classificationLabel`
- `studentAction`
- `audience`
- `ownerUnit`
- `sourceRefIds`
- `confidence`
- `status`
- `raw`

JSON source:

- `curriculumRules[].id`
- `curriculumRules[].courseCode`
- `curriculumRules[].semesterCode`
- `curriculumRules[].classification`
- `curriculumRules[].classificationLabel`
- `curriculumRules[].studentAction`
- `curriculumRules[].audience`
- `curriculumRules[].ownerUnit`
- `curriculumRules[].sourceRefIds`
- `curriculumRules[].confidence`
- full original rule as `raw`

### CourseSyllabusMetadata

Database fields:

- `courseOfferingId`
- `teamworkRequirement`
- `teamworkSummary`
- `evidenceSourceRefIds`
- `confidence`
- `raw`

JSON source:

- `offerings[].syllabus.teamworkRequirement`
- `offerings[].syllabus.teamworkSummary`
- `offerings[].syllabus.evidenceSourceRefIds`
- `offerings[].syllabus.confidence`
- full original syllabus object as `raw`

### CourseImportBatch

Database fields:

- `schoolId`
- `schemaVersion`
- `semesterCode`
- `status`
- `payload`
- `validationSummary`

JSON source:

- full cleaned JSON.

TEAMAKING sets approval/rejection fields during admin workflow.

### CourseBoardMembership

Crawler does not output memberships. TEAMAKING generates them during approval for `curriculumRules[].studentAction = "default_join"`.

Generated fields:

- `userId`
- `boardId`
- `source`
- `status`
- `originRuleId`
- `joinedAt`

`source` is derived from classification:

- `major_required` -> `auto_major_required`
- `faculty_required` or `college_core` -> `auto_faculty_required`
- `university_core_*` -> `auto_university_core`
- `concentration_required` -> `auto_concentration_required`
- `bba_core`, `common_core`, `required_core` -> `auto_core_required`
- `final_year_project` -> `auto_final_year_project`
- `internship` -> `auto_internship`

## 5. Cleaning 卡点

### 5.1 One Course, Multiple Categories

Do not choose only one category. A course may be required for one major and elective/free elective for others. Keep one `courses[]` item and multiple `curriculumRules[]`.

### 5.2 Curriculum Table Ambiguity

Some pages may show tables without explicit semester or year. Cleaning should:

- Use page heading, section title, surrounding text, or PDF filename.
- If still unknown, leave `grades: []`, use `confidence: "low"`, and preserve source.

### 5.3 Programme Names And Codes

BNBU pages may use long names, abbreviations, old names, or school-specific names. Cleaning must maintain an alias map. The final JSON should use stable `majors[].code`; raw names go into `aliases` or source evidence.

### 5.4 Course Code Formatting

Normalize course codes:

- Trim spaces.
- Uppercase letters.
- Remove accidental spaces inside codes.
- Preserve official hyphen only if it is part of the real code.

### 5.5 Credits

Credits may appear as `3`, `3.0`, `3 credits`, or in a Chinese/English table. Output a number. If not public or not parseable, omit `credits`.

### 5.6 Syllabus Teamwork Detection

`teamworkRequirement` should be:

- `required`: assessment explicitly requires group/team work.
- `optional`: syllabus says group work may occur or is optional.
- `none`: syllabus clearly describes only individual work.
- `unknown`: no syllabus, inaccessible file, or ambiguous language.

Signals for `required`:

- group project
- team project
- group presentation
- group report
- peer evaluation
- teamwork assessment
- team-based assignment

### 5.7 Source Traceability

Every nontrivial cleaned item should reference at least one `sourceRefId`. If a rule cannot be traced to a source, it should not be `confidence: "high"`.

### 5.8 Full Snapshot Semantics

The import should be treated as a semester snapshot. If a previously active rule for the same semester is absent from a newly approved import, TEAMAKING may mark the old rule inactive. The crawler must therefore include all known active rules for the semester, not just changed rows.

### 5.9 Copyright And Long Text

Do not copy full syllabus bodies into cleaned JSON. Store URL, source id, hash, and short factual summaries. Keep raw files in the crawler archive outside TEAMAKING if needed.

## 6. Validation Requirements

The Python cleaning program should run its own validation before submitting JSON to TEAMAKING.

Must fail:

- `schemaVersion` is not `teamaking.bnbu_course_import.v1` or `teamaking.bnbu_course_import.v2`.
- `school.shortName` is not `BNBU`.
- Missing `semester.code`, `semester.name`, `semester.academicYear`, or `semester.term`.
- Empty `faculties`.
- Empty `courses`.
- Empty `offerings` for v1; v2 may warn instead when importing handbook-only curriculum data.
- v2 offering has no `sourceRefIds`.
- v2 offering is sourced only from handbook/curriculum sources.
- Historical semester has `isCurrentCandidate: true`.
- Programme-scoped classifications use `allMajors: true` or omit `majorCodes`.
- Duplicate source ids, faculty codes, major codes, course codes, or rule ids.
- Major references unknown faculty.
- Offering references unknown course.
- Rule references unknown course, major, or faculty.
- Unknown `classification`, `studentAction`, `confidence`, or `teamworkRequirement`.

Should warn:

- Empty `sourceRefs`.
- Empty `majors`.
- Empty `curriculumRules`.
- Rule has no `majorCodes`, no `facultyCodes`, and `allMajors` is not true.
- Course or rule references a source id missing from `sourceRefs`.
- Important field was inferred from weak text.

## 7. Acceptance Criteria

A crawler/cleaning implementation is acceptable when:

- It can run from a clean machine with documented commands.
- It keeps raw/source evidence outside TEAMAKING or in job-scoped crawler storage before cleaning.
- It writes one cleaned JSON file per target admission year or course catalog target.
- The cleaned JSON passes `POST /api/admin/course-imports/validate`.
- The cleaned JSON can go through workflow create pending / approve and produce database rows for at least one programme, course, curriculum rule, and visible Course Board.
- At least one real required-course scenario generates `studentAction: "default_join"`.
- At least one elective/free-elective scenario generates `studentAction: "searchable_add"`.
- A course with multiple roles is represented by multiple `curriculumRules`.
- Syllabus teamwork evidence is represented without copying full syllabus text.
- Every course/rule has traceable source references.
- Re-running the same raw input produces the same cleaned JSON.

上线前真实 smoke 不可用 mock 替代：用 BNBU programme handbook 总入口跑 `2023 limit=1`，下载单个 JSON 后走 workflow create pending / approve，并查库确认一个 programme、一个 course、一个 curriculum rule 和一个 Programme Plan board。随后再跑 `2025,2024,2023 limit=1` 小样本，确认 PDF 解析和 serverless tracing 不再出现 `pdfjs-dist` 或 `pdf-parse` 缺包。Vercel/Next 部署必须把 `scripts/bnbu-crawler`、顶层 `pdfjs-dist` assets，以及 `pdf-parse` 自带 dist/nested `pdfjs-dist` assets 保留在 `outputFileTracingIncludes`。

## 8. Suggested Python Package Structure

```text
bnbu_course_pipeline/
  crawler/
    crawl_programmes.py
    crawl_syllabi.py
    extract_html.py
    extract_pdf.py
  cleaner/
    normalize_text.py
    parse_courses.py
    parse_curriculum_rules.py
    parse_syllabus.py
    build_clean_json.py
    validate_clean_json.py
  config/
    faculty_aliases.yml
    major_aliases.yml
    classification_map.yml
    source_urls.yml
  data/
    raw/
      2026-Fall.jsonl
    raw_files/
    clean/
      bnbu-2026-fall.teamaking.json
```

## 9. Example Minimal Cleaned JSON

```json
{
  "schemaVersion": "teamaking.bnbu_course_import.v1",
  "generatedAt": "2026-05-24T10:30:00+08:00",
  "school": {
    "shortName": "BNBU",
    "name": "Beijing Normal-Hong Kong Baptist University",
    "emailDomain": "mail.bnbu.edu.cn"
  },
  "semester": {
    "code": "2026-Fall",
    "name": "2026 Fall",
    "academicYear": 2026,
    "term": "Fall",
    "isCurrentCandidate": true
  },
  "sourceRefs": [
    {
      "id": "mcom-curriculum-2026",
      "title": "MCOM Curriculum",
      "url": "https://example.bnbu.edu.cn/mcom/curriculum.htm",
      "sourceType": "curriculum_page",
      "retrievedAt": "2026-05-24T10:30:00+08:00"
    }
  ],
  "faculties": [
    {
      "code": "FHSS",
      "name": "Faculty of Humanities and Social Sciences",
      "aliases": ["FHSS"]
    }
  ],
  "majors": [
    {
      "code": "MCOM",
      "name": "Media and Communication",
      "facultyCode": "FHSS",
      "degreeType": "undergraduate",
      "aliases": []
    }
  ],
  "courses": [
    {
      "code": "COMM2003",
      "title": "Example Course",
      "credits": 3,
      "ownerUnit": {
        "type": "faculty",
        "code": "FHSS",
        "name": "Faculty of Humanities and Social Sciences"
      },
      "categoryTags": ["Major Required Courses"],
      "description": "",
      "sourceRefIds": ["mcom-curriculum-2026"]
    }
  ],
  "offerings": [
    {
      "courseCode": "COMM2003",
      "semesterCode": "2026-Fall",
      "teacherNames": [],
      "sections": ["Default"],
      "status": "active",
      "sourceRefIds": ["mcom-curriculum-2026"],
      "syllabus": {
        "teamworkRequirement": "unknown",
        "teamworkSummary": "",
        "evidenceSourceRefIds": [],
        "confidence": "unknown"
      }
    }
  ],
  "curriculumRules": [
    {
      "id": "2026-Fall-COMM2003-MCOM-Y2-major-required",
      "courseCode": "COMM2003",
      "semesterCode": "2026-Fall",
      "classification": "major_required",
      "classificationLabel": "Major Required Courses",
      "audience": {
        "majorCodes": ["MCOM"],
        "facultyCodes": [],
        "grades": ["Year 2"],
        "cohortYears": [],
        "concentrationCodes": [],
        "allMajors": false
      },
      "studentAction": "default_join",
      "ownerUnit": {
        "type": "faculty",
        "code": "FHSS",
        "name": "Faculty of Humanities and Social Sciences"
      },
      "sourceRefIds": ["mcom-curriculum-2026"],
      "confidence": "high"
    }
  ]
}
```
