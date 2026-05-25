export type Locale = "zh" | "en";

export const localeCookieName = "teamaking_locale";

export function normalizeLocale(value?: string | null): Locale | null {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (normalized.startsWith("zh")) return "zh";
  if (normalized.startsWith("en")) return "en";
  return null;
}

export function localeFromCountry(country?: string | null): Locale {
  const code = (country ?? "").toUpperCase();
  if (!code) return "zh";
  return ["CN", "HK", "MO", "TW"].includes(code) ? "zh" : "en";
}

export const translationPairs = [
  ["Dashboard", "仪表盘"],
  ["Courses", "课程"],
  ["Course Boards", "课程板"],
  ["Matches", "匹配"],
  ["Support", "支持"],
  ["Support Tickets", "工单"],
  ["TeamUp Menu", "组队菜单"],
  ["Inbox", "收件箱"],
  ["Proof-of-Work Profile", "作品证明 Profile"],
  ["Contact Info", "联系方式"],
  ["Announcements", "公告"],
  ["Admin Home", "管理员首页"],
  ["Admin Panel", "管理后台"],
  ["Student App", "学生端"],
  ["Users", "用户"],
  ["Schools", "学校"],
  ["Majors", "专业"],
  ["Course Imports", "课程导入"],
  ["Versions", "版本"],
  ["Course Submissions", "课程提交"],
  ["Boards", "课程板"],
  ["Posts", "帖子"],
  ["Requests", "请求"],
  ["Metrics", "指标"],
  ["Configs", "配置"],
  ["Logs", "日志"],
  ["Error Events", "错误事件"],
  ["Admin Users", "管理员账号"],
  ["Crawler", "爬虫"],
  ["Login / Register", "登录 / 注册"],
  ["登录 / 注册", "Login / Register"],
  ["语言", "Language"],
  ["中文", "Chinese"],
  ["English", "英文"],
  ["Loading", "加载中"],
  ["Save", "保存"],
  ["Submit", "提交"],
  ["Cancel", "取消"],
  ["Create", "创建"],
  ["Edit", "编辑"],
  ["Delete", "删除"],
  ["Search", "搜索"],
  ["Refresh", "刷新"],
  ["Copy", "复制"],
  ["Copied", "已复制"],
  ["Read", "已读"],
  ["Mark as read", "标记为已读"],
  ["Publish", "发布"],
  ["Archive", "归档"],
  ["Draft", "草稿"],
  ["Published", "已发布"],
  ["Archived", "已归档"],
  ["Title", "标题"],
  ["Body", "正文"],
  ["Status", "状态"],
  ["Created", "创建时间"],
  ["Updated", "更新时间"],
  ["Published At", "发布时间"],
  ["Action", "操作"],
  ["History", "历史记录"],
  ["Latest announcements", "最新公告"],
  ["Announcement history", "公告历史"],
  ["No announcements yet.", "暂无公告。"],
  ["No published announcements.", "暂无已发布公告。"],
  ["System announcement", "系统公告"],
  ["管理员公告", "Admin announcement"],
  ["发布公告", "Publish announcement"],
  ["公告历史", "Announcement history"],
  ["最新公告", "Latest announcements"],
  ["暂无公告。", "No announcements yet."],
  ["暂无已发布公告。", "No published announcements."],
  ["联系方式", "Contact"],
  ["学校邮箱", "School email"],
  ["个人邮箱", "Personal email"],
  ["个人擅长", "Personal strengths"],
  ["课程 / 交付要求", "Course / Deliverable needs"],
  ["过往作品 / Paperwork", "Past work / Paperwork"],
  ["简历", "Resume"],
  ["技能 / 职业认证", "Skill / Career certifications"],
  ["奖项 / GPA", "Awards / GPA"],
  ["还没有公开过往作品", "No public past work yet"],
  ["还没有公开简历", "No public resume yet"],
  ["还没有公开技能认证", "No public skill certifications yet"],
  ["还没有公开奖项或成绩证明", "No public awards or grade evidence yet"],
  ["查看详情", "View details"],
  ["View Profile", "查看 Profile"],
  ["Team Up", "组队"],
  ["课程详情", "Course details"],
  ["进入 Course Board", "Enter Course Board"],
  ["申请关注", "Request follow"],
  ["保存 Profile 与联系方式", "Save profile and contact info"],
  ["重新整理当前简历", "Reformat current resume"],
  ["正在整理...", "Formatting..."],
  ["复制", "Copy"],
  ["已复制", "Copied"],
  ["全部", "All"],
  ["全部类型", "All types"],
  ["个人作品", "Individual work"],
  ["小组成果", "Group work"],
  ["置顶成果", "Pinned work"],
  ["已保存的作品与证明", "Saved work and evidence"],
  ["作品证明", "Evidence"],
  ["标题", "Title"],
  ["正文", "Body"],
  ["状态", "Status"],
  ["发布时间", "Published at"],
  ["创建时间", "Created"],
  ["更新时间", "Updated"],
  ["操作", "Action"],
  ["草稿", "Draft"],
  ["已发布", "Published"],
  ["已归档", "Archived"],
  ["发布", "Publish"],
  ["归档", "Archive"],
  ["保存", "Save"],
  ["创建", "Create"],
  ["刷新", "Refresh"]
] as const;

export const zhToEn = Object.fromEntries(translationPairs.map(([en, zh]) => [zh, en])) as Record<string, string>;
export const enToZh = Object.fromEntries(translationPairs.map(([en, zh]) => [en, zh])) as Record<string, string>;

export function translateStaticText(text: string, locale: Locale) {
  const trimmed = text.trim();
  if (!trimmed) return text;
  const leading = text.match(/^\s*/)?.[0] ?? "";
  const trailing = text.match(/\s*$/)?.[0] ?? "";
  const translated = locale === "en" ? zhToEn[trimmed] ?? trimmed : enToZh[trimmed] ?? trimmed;
  return `${leading}${translated}${trailing}`;
}
