# BNBU Course Pipeline

BNBU 课程数据采集与清洗管道，产出 TEAMAKING 可导入的 cleaned JSON。

## 工作流

```
BNBU 学术注册处页面 (ar.bnbu.edu.cn)
        ↓
   fetch_handbook_page.py  → 提取 PDF 链接
        ↓
   download_pdfs.py        → 下载 32 个专业培养方案 PDF
        ↓
   extract_pdf_tables.py   → PDF 表格提取 → JSONL
        ↓
   parse_courses.py        → JSONL → 结构化课程数据
        ↓
   build_clean_json.py     → 组装 cleaned JSON
        ↓
   validate.py             → 自校验
        ↓
   data/clean/*.teamaking.json → 管理员通过 /admin/course-imports 导入
```

## 快速开始

```bash
# 安装依赖
pip install -r requirements.txt

# 完整流程：爬取 → 下载 → 提取 → 清洗 → 验证
python run.py --semester 2025-Fall

# 分步执行
python run.py crawl --semester 2025-Fall      # 爬取+下载
python run.py extract --semester 2025-Fall     # PDF → JSONL
python run.py clean --semester 2025-Fall       # JSONL → cleaned JSON
python run.py validate --semester 2025-Fall    # 验证 cleaned JSON

# 强制重新下载（跳过已存在文件检查）
python run.py crawl --semester 2025-Fall --force-download
```

## 目录结构

```
bnbu_course_pipeline/
├── run.py                          # CLI 入口，支持子命令
├── requirements.txt                # Python 依赖
├── README.md                       # 本文件
│
├── crawler/                        # 爬虫模块
│   ├── fetch_handbook_page.py      # 请求 BNBU 学术注册处页面，提取 PDF 链接
│   ├── download_pdfs.py            # 并发下载 PDF，记录 SHA256 和元数据
│   └── extract_pdf_tables.py       # 用 pdfplumber 提取 PDF 表格 → JSONL
│
├── cleaner/                        # 清洗模块
│   ├── normalize.py                # 文本规范化（去脚注、全角转半角、代码统一大写）
│   ├── parse_courses.py            # 从 JSONL 解析结构化课程数据并去重
│   ├── build_clean_json.py         # 组装 teamaking.bnbu_course_import.v1 格式 JSON
│   └── validate.py                 # 自校验（对标 TEAMAKING 的 validateBnbuCourseImportPayload）
│
├── config/                         # 配置文件
│   ├── faculties.yml               # 院系 code 映射（FBM, SCC, FHSS, FST）
│   ├── majors.yml                  # 32 个专业 code + 中英文名 + facultyCode
│   └── classification_map.yml      # PDF 分类标题 → TEAMAKING enum 映射
│
└── data/                           # 数据输出（git-ignored）
    ├── raw/                        # JSONL + manifest
    │   ├── 2025-Fall.jsonl
    │   └── 2025-Fall_manifest.json
    ├── raw_files/                  # 下载的 PDF 文件
    │   ├── MCOM_2025.pdf
    │   ├── CST_2025.pdf
    │   └── ...
    └── clean/                      # 最终 cleaned JSON
        └── bnbu-2025-fall.teamaking.json
```

## PDF 表格格式

BNBU 所有专业的培养方案 PDF 使用统一的表格格式：

```
| Course Code | Course Title | Year One          | Year Two          | Year Three    | Year Four     |
|             |              | Sem1 | Winter | Sem2 | Sem1 | Sem2 | Summer | Sem1 | Sem2 | Sem1 | Sem2 |
```

- 每行一门课程，学分值放在对应学期的列中
- 分类标题行：`I. Major Required Courses (57 Units)` 等
- 课程代码格式：大写字母 3-5 位 + 4 位数字（如 COMP1023、UCLC1003）
- 脚注标记：①②③④⑤⑥⑦⑧⑨⑩* 等，清洗时去除
- 部分 PDF 有独立的 "ME Course List" 页面（3 列格式：Code | Title | Units）

## 配置文件说明

### faculties.yml

```yaml
FBM:
  name: Faculty of Business and Management
  name_cn: 商管学院
  aliases: [Faculty of Business and Management, FBM, 商管学院]
```

当前 4 个学院：FBM（商管）、SCC（文化创意）、FHSS（人文社科）、FST（理工科技）。

### majors.yml

```yaml
MCOM:
  name: Media and Communication
  name_cn: 媒体与传播学
  facultyCode: FHSS
  degreeType: undergraduate
  pdf_filename_hint: MCOM
```

`pdf_filename_hint` 用于匹配 PDF 文件名中的专业代码。当前 32 个专业。

### classification_map.yml

```yaml
- pattern: "Major Required"
  classification: major_required
  studentAction: default_join
```

映射 PDF 中的分类标题到 TEAMAKING enum。`studentAction` 决定学生端行为：
- `default_join`：匹配学生自动加入 Course Board
- `searchable_add`：学生搜索后手动加入

## 清洗逻辑

### 课程分类 → studentAction 映射

| classification | studentAction | 说明 |
|---|---|---|
| major_required | default_join | 专业必修，自动加入 |
| university_core | default_join | 大学核心课，自动加入 |
| faculty_required | default_join | 院系必修 |
| concentration_required | default_join | 方向必修 |
| major_elective | searchable_add | 专业选修，搜索后加入 |
| free_elective | searchable_add | 自由选修 |
| general_education | searchable_add | 通识教育 |

### 去重规则

- 同一课程代码（如 UCLC1003）出现在多个专业 → 生成一条 course，多条 curriculumRule
- 每条 curriculumRule 携带独立的 audience（majorCodes, grades）
- 去重键：`(school.shortName, course.code)`

### audience 生成

- 从 PDF 所属专业推断 `majorCodes`
- 从课程所在行推断 `grades`（Year 1/2/3/4）
- 大学核心课等跨专业课程：每个专业各生成一条规则

## 导入 TEAMAKING

### 方式 1：通过管理后台 UI

1. 启动 TEAMAKING 开发服务器：`npm run dev`
2. 用管理员账号登录 `http://localhost:3000/admin-login`
3. 进入 `/admin/course-imports`
4. 粘贴 `data/clean/bnbu-2025-fall.teamaking.json` 的内容
5. 点击"校验 JSON"确认无误
6. 创建待审批批次
7. 检查 source、counts、warnings
8. 批准导入

### 方式 2：通过 API

```bash
# 校验
curl -X POST http://localhost:3000/api/admin/course-imports/validate \
  -H "Content-Type: application/json" \
  -d @data/clean/bnbu-2025-fall.teamaking.json

# 创建批次
curl -X POST http://localhost:3000/api/admin/course-imports \
  -H "Content-Type: application/json" \
  -d @data/clean/bnbu-2025-fall.teamaking.json

# 批准（替换 {id} 为实际批次 ID）
curl -X POST http://localhost:3000/api/admin/course-imports/{id}/approve \
  -H "Content-Type: application/json"
```

## 维护指南

### 更新到新学期

1. 等待 BNBU 学术注册处发布新学期培养方案
2. 检查 `https://ar.bnbu.edu.cn/info/1020/2927.htm` 页面是否更新
3. 运行 `python run.py --semester 2026-Fall`（替换为实际学期）
4. 如有新专业，更新 `config/majors.yml`
5. 如有新分类，更新 `config/classification_map.yml`
6. 导入新 JSON 后，TEAMAKING 会自动将旧学期规则标记为 inactive

### 新增专业

1. 在 `config/majors.yml` 添加专业条目
2. 确保 `pdf_filename_hint` 与 PDF 文件名中的代码匹配
3. 如属于新学院，在 `config/faculties.yml` 添加

### 调试 PDF 解析

```python
import sys
sys.path.insert(0, '/path/to/bnbu_course_pipeline')
from crawler.extract_pdf_tables import extract_courses_from_pdf

courses = extract_courses_from_pdf('data/raw_files/XXX_2025.pdf', 'url')
for c in courses:
    print(f"{c['course_code']} | {c['course_title']} | {c['credits']} | {c['classification']}")
```

### 已知限制

- PDF 中的 GE（通识教育）和 Free Elective 通用要求行（只有学分没有课程代码）不会生成课程记录
- syllabus.teamworkRequirement 默认为 "unknown"（PDF 中不含此信息）
- Math Plus 变体页面的课程会被提取，可能与标准版本重复
- 部分 PDF 的脚注标记可能残留，需人工复核

## 依赖

- Python 3.10+
- requests：HTTP 请求
- beautifulsoup4：HTML 解析
- pdfplumber：PDF 表格提取
- pyyaml：配置文件解析

## 输出格式

输出的 cleaned JSON 符合 `teamaking.bnbu_course_import.v1` schema，包含：

- `schemaVersion`：固定为 `teamaking.bnbu_course_import.v1`
- `school`：BNBU 学校信息
- `semester`：学期信息
- `sourceRefs`：来源证据索引（每个 PDF 一条，含 rawIds 关联 JSONL）
- `faculties`：院系列表
- `majors`：专业列表
- `courses`：课程列表（去重后）
- `offerings`：开课实例
- `curriculumRules`：课程规则（含 audience 和 studentAction）

### Rule ID 格式

```
{semesterCode}-{courseCode}-{audienceCode}-{grade}-{classification}
```

示例：
- `2025-Fall-COMM2003-MCOM-Y2-major-required`
- `2025-Fall-UCLC1003-ACCT-Y1-university-core`
- `2025-Fall-ACCT2003-ACCT-Y1-bba-core`

classification 在 Rule ID 中使用连字符（`major-required`），在字段值中使用下划线（`major_required`）。

## 已知 section header 模式

PDF 中的分类标题行及其映射：

| PDF 标题 | TEAMAKING classification |
|---|---|
| `I. Major Required Courses (XX Units)` | major_required |
| `I. BBA (Hons) Core Courses (XX Units)` | bba_core |
| `II. Major Elective Courses (XX Units)` | major_elective |
| `ME Course List of XXX` (页面标题) | major_elective |
| `III. University Core Courses (XX Units)` | university_core |
| `IV. General Education Courses (XX Units)` | general_education |
| `V. Free Elective Courses (XX Units)` | free_elective |
| `II. Concentration Required Courses (XX Units)` | concentration_required |
| `III. Concentration Elective Courses (XX Units)` | concentration_elective |

如遇到新的 section header，更新 `crawler/extract_pdf_tables.py` 的 `SECTION_PATTERNS` 列表。
