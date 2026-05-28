import { contactSnapshot, defaultContactVisibility } from "@/lib/contact";

export const DEMO_SESSION_PREFIX = "demo:";

export type DemoAccountKey = "media" | "cs" | "admin";

export const demoAccounts: Record<
  DemoAccountKey,
  {
    email: string;
    role: string;
    displayName: string;
    grade: string;
    entryYear: number;
    entryTerm: string;
    faculty: string;
    major: string;
    bio: string;
    redirectPath: string;
  }
> = {
  media: {
    email: "media.student@mail.bnbu.edu.cn",
    role: "profile_completed_user",
    displayName: "Mia Chen",
    grade: "Year 2",
    entryYear: 2025,
    entryTerm: "Fall",
    faculty: "Faculty of Humanities and Social Sciences",
    major: "Media and Communication Studies Programme",
    bio: "演示账号：擅长研究、学术写作和 slides 结构。",
    redirectPath: "/dashboard"
  },
  cs: {
    email: "cs.student@mail.bnbu.edu.cn",
    role: "profile_completed_user",
    displayName: "Leo Wang",
    grade: "Year 1",
    entryYear: 2025,
    entryTerm: "Fall",
    faculty: "Faculty of Science and Technology",
    major: "Computer Science and Technology Programme",
    bio: "演示账号：擅长 coding、数据处理和 demo 搭建。",
    redirectPath: "/dashboard"
  },
  admin: {
    email: "business.admin@mail.bnbu.edu.cn",
    role: "school_admin",
    displayName: "Ava Li",
    grade: "Year 2",
    entryYear: 2025,
    entryTerm: "Fall",
    faculty: "Faculty of Business and Management",
    major: "Marketing Management Programme",
    bio: "演示管理员账号：用于验收无代码后台。",
    redirectPath: "/admin"
  }
};

export function isDemoAccessEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.ENABLE_DEMO_ACCESS === "true";
}

export function normalizeDemoAccount(account?: string | null): DemoAccountKey {
  if (account === "cs" || account === "admin") return account;
  return "media";
}

export function isDemoUser(user: any) {
  return typeof user?.id === "string" && user.id.startsWith("demo-user-");
}

const school = {
  id: "demo-school-bnbu",
  name: "Beijing Normal-Hong Kong Baptist University",
  shortName: "BNBU",
  status: "active"
};

const faculties = [
  { id: "demo-faculty-hss", schoolId: school.id, name: "Faculty of Humanities and Social Sciences", school },
  { id: "demo-faculty-fst", schoolId: school.id, name: "Faculty of Science and Technology", school },
  { id: "demo-faculty-fbm", schoolId: school.id, name: "Faculty of Business and Management", school }
];

const majors = [
  { id: "demo-major-media", schoolId: school.id, facultyId: faculties[0].id, name: "Media and Communication Studies Programme", degreeType: "undergraduate", school, faculty: faculties[0] },
  { id: "demo-major-cs", schoolId: school.id, facultyId: faculties[1].id, name: "Computer Science and Technology Programme", degreeType: "undergraduate", school, faculty: faculties[1] },
  { id: "demo-major-marketing", schoolId: school.id, facultyId: faculties[2].id, name: "Marketing Management Programme", degreeType: "undergraduate", school, faculty: faculties[2] }
];

const semester = {
  id: "demo-semester-2026-fall",
  schoolId: school.id,
  name: "2026 Fall",
  year: 2026,
  term: "Fall",
  isCurrent: true,
  school
};

const skillsByAccount: Record<DemoAccountKey, string[]> = {
  media: ["academic writing", "research", "presentation"],
  cs: ["coding", "data analysis", "prototype"],
  admin: ["admin operations", "course coordination", "moderation"]
};

export function demoUserForAccount(account?: string | null) {
  const key = normalizeDemoAccount(account);
  const selected = demoAccounts[key];
  const major = majors.find((item) => item.name === selected.major) ?? majors[0];
  const faculty = faculties.find((item) => item.name === selected.faculty) ?? faculties[0];
  const contactInfo = {
    id: `demo-contact-${key}`,
    userId: `demo-user-${key}`,
    schoolEmail: selected.email,
    wechatId: `${key}_teamaking_demo`,
    wechatQrImageUrl: "",
    linkedinUrl: `https://www.linkedin.com/in/teamaking-${key}`,
    personalEmail: `${key}.demo@example.com`,
    visibilitySettings: defaultContactVisibility
  };

  return {
    id: `demo-user-${key}`,
    email: selected.email,
    role: selected.role,
    isEmailVerified: true,
    onboardingCompleted: true,
    schoolId: school.id,
    school,
    profile: {
      id: `demo-profile-${key}`,
      userId: `demo-user-${key}`,
      displayName: selected.displayName,
      nickname: key === "media" ? "Mia / slides person" : key === "cs" ? "Leo builds demos" : "Ava Admin",
      avatarUrl: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(selected.displayName)}`,
      backgroundImageUrl: "",
      headline: key === "cs" ? "Prototype builder for course projects" : key === "admin" ? "School admin demo account" : "Research and presentation collaborator",
      bio: selected.bio,
      grade: selected.grade,
      entryYear: selected.entryYear,
      entryTerm: selected.entryTerm,
      facultyId: faculty.id,
      majorId: major.id,
      outputTags: key === "cs" ? ["prototype", "code demo", "data cleaning"] : ["research brief", "slides", "presentation"],
      resumeUrl: `/uploads/demo/${key}-resume.md`,
      resumeFileName: `${selected.displayName} Resume.md`,
      resumeParsedData: {
        parser: "demo",
        skills: skillsByAccount[key],
        summary: "本地演示简历解析摘要。真实上传时会由 /api/uploads 返回解析结果。"
      },
      openToBeDiscovered: true,
      visibilitySettings: { profile: "same_school", portfolio: "same_school" },
      faculty,
      major
    },
    contactInfo,
    skills: skillsByAccount[key].map((name, index) => ({
      id: `demo-user-skill-${key}-${index}`,
      userId: `demo-user-${key}`,
      skillId: `demo-skill-${name}`,
      level: "intermediate",
      evidenceNote: "本地视觉演示数据",
      skill: { id: `demo-skill-${name}`, name, category: "demo" }
    }))
  };
}

function makeCourse(code: string, title: string, description: string, teacherName: string, major = majors[0]) {
  const id = `demo-course-${code.toLowerCase()}`;
  const offeringId = `demo-offering-${code.toLowerCase()}`;
  const boardId = `demo-board-${code.toLowerCase()}`;

  return {
    id,
    schoolId: school.id,
    school,
    code,
    title,
    description,
    courseType: "coursework",
    source: "demo",
    status: "active",
    offerings: [
      {
        id: offeringId,
        courseId: id,
        semesterId: semester.id,
        teacherName,
        section: "Demo Section",
        semester,
        boards: [
          {
            id: boardId,
            courseOfferingId: offeringId,
            title: `${code} ${title}`,
            rules: "本地演示 Course Board：加入只代表平台内自选，不代表官方选课。",
            status: "active"
          }
        ]
      }
    ],
    mappings: [
      {
        id: `demo-mapping-${code.toLowerCase()}`,
        courseId: id,
        majorId: major.id,
        recommendedGrade: "Year 2",
        isRequired: code.startsWith("COM"),
        major
      }
    ]
  };
}

export const demoCourses = [
  makeCourse("COM3003", "Media Ethics", "讨论平台、新闻、创作者责任和研究伦理。", "Dr. Demo Chen", majors[0]),
  makeCourse("COM2005", "Digital Storytelling", "以作品证明叙事、剪辑、视觉结构和受众分析能力。", "Prof. Narrative Li", majors[0]),
  makeCourse("CST1001", "Introduction to Programming", "面向协作项目的编程基础、调试和小型原型。", "Dr. Stack Wang", majors[1]),
  makeCourse("BUS2002", "Marketing Principles", "市场分析、用户洞察和商业展示训练。", "Dr. Market Zhou", majors[2])
];

export function demoCourseById(courseId?: string) {
  return demoCourses.find((course) => course.id === courseId) ?? demoCourses[0];
}

export function demoOnboardingOptions() {
  return { faculties, majors, semesters: [semester] };
}

export function demoBoardById(boardId?: string) {
  const course =
    demoCourses.find((item) => item.offerings?.[0]?.boards?.[0]?.id === boardId) ??
    demoCourses.find((item) => item.code === "COM3003") ??
    demoCourses[0];
  const offering = course.offerings[0];
  const board = offering.boards[0];

  return {
    ...board,
    memberships: [
      { id: "demo-membership-media", userId: "demo-user-media", boardId: board.id, joinedAt: new Date().toISOString() },
      { id: "demo-membership-cs", userId: "demo-user-cs", boardId: board.id, joinedAt: new Date().toISOString() }
    ],
    courseOffering: {
      ...offering,
      course
    }
  };
}

export function demoPortfolioItems(account?: string | null) {
  const key = normalizeDemoAccount(account);
  const course = key === "cs" ? demoCourses[2] : demoCourses[0];

  return [
    {
      id: `demo-portfolio-${key}-1`,
      userId: `demo-user-${key}`,
      title: key === "cs" ? "Interactive schedule prototype" : "Media ethics case deck",
      type: key === "cs" ? "code" : "slides",
      contributionDescription: key === "cs" ? "负责前端原型、状态流和测试数据。" : "负责案例研究、结构梳理和展示稿。",
      myRole: key === "cs" ? "Prototype developer" : "Research and deck structure",
      semesterText: "2026 Fall",
      isGroupWork: true,
      fileName: key === "cs" ? "prototype-notes.md" : "media-ethics-deck.pdf",
      fileMimeType: key === "cs" ? "text/markdown" : "application/pdf",
      fileSize: key === "cs" ? 2048 : 524288,
      fileExtension: key === "cs" ? "md" : "pdf",
      storageKey: `/uploads/demo/${key}-portfolio.${key === "cs" ? "md" : "pdf"}`,
      fileUrl: `/uploads/demo/${key}-portfolio.${key === "cs" ? "md" : "pdf"}`,
      previewKind: key === "cs" ? "markdown" : "pdf",
      externalUrl: "https://example.com/teamaking-demo",
      outcome: key === "cs" ? "Reusable prototype pattern" : "A-range presentation deck",
      reflection: "作品条目用于证明实际贡献，而不是只写一句擅长什么。",
      metadata: { source: "demo", category: "portfolio" },
      visibility: "same_school",
      relatedCourseId: course.id,
      relatedCourse: course
    },
    {
      id: `demo-proof-${key}-gpa`,
      userId: `demo-user-${key}`,
      title: "GPA screenshot proof",
      type: "gpa_screenshot",
      contributionDescription: "可选上传的 GPA 截图证明，用户自己决定是否展示。",
      myRole: "Owner",
      semesterText: "2026 Fall",
      isGroupWork: false,
      fileName: "gpa-screenshot.png",
      fileMimeType: "image/png",
      fileSize: 184320,
      fileExtension: "png",
      storageKey: `/uploads/demo/${key}-gpa.png`,
      fileUrl: `/uploads/demo/${key}-gpa.png`,
      previewKind: "image",
      metadata: { sensitive: true, category: "gpa" },
      visibility: "private",
      relatedCourseId: null,
      relatedCourse: null
    },
    {
      id: `demo-proof-${key}-cert`,
      userId: `demo-user-${key}`,
      title: key === "cs" ? "Python certificate" : "Academic writing award",
      type: key === "cs" ? "skill_certification" : "award_certificate",
      contributionDescription: "证书或获奖材料可以作为技能标签的外部证明。",
      myRole: "Owner",
      semesterText: "2026",
      isGroupWork: false,
      fileName: key === "cs" ? "python-certificate.pdf" : "writing-award.pdf",
      fileMimeType: "application/pdf",
      fileSize: 260000,
      fileExtension: "pdf",
      storageKey: `/uploads/demo/${key}-certificate.pdf`,
      fileUrl: `/uploads/demo/${key}-certificate.pdf`,
      previewKind: "pdf",
      metadata: { issuer: key === "cs" ? "Demo Coding Institute" : "Demo Academic Office" },
      visibility: "same_school",
      relatedCourseId: null,
      relatedCourse: null
    }
  ];
}

export function demoPosts(boardId?: string) {
  const board = demoBoardById(boardId);
  return [
    {
      id: "demo-post-media",
      boardId: board.id,
      userId: "demo-user-media",
      courseOfferingId: board.courseOfferingId,
      title: "Looking for a teammate for a research-heavy presentation",
      status: "open",
      strengths: ["research", "academic writing", "presentation"],
      contributionTypes: ["research", "slides", "writing"],
      expectedOutcome: "希望找到能一起做资料整理、案例分析和课堂展示的同伴。",
      portfolioItemIds: ["demo-portfolio-media-1"],
      portfolioEvidenceCount: 1,
      showWechatId: true,
      showWechatQr: false,
      showLinkedin: true,
      showPersonalEmail: false,
      visibility: "same_course_board",
      user: { ...demoUserForAccount("media"), portfolioItems: demoPortfolioItems("media") },
      board
    },
    {
      id: "demo-post-cs",
      boardId: board.id,
      userId: "demo-user-cs",
      courseOfferingId: board.courseOfferingId,
      title: "Can build a small data/prototype part for the project",
      status: "open",
      strengths: ["coding", "prototype", "data analysis"],
      contributionTypes: ["coding", "demo", "data"],
      expectedOutcome: "如果项目需要小工具、数据整理或互动 demo，我可以负责技术部分。",
      portfolioItemIds: ["demo-portfolio-cs-1"],
      portfolioEvidenceCount: 1,
      showWechatId: true,
      showWechatQr: false,
      showLinkedin: true,
      showPersonalEmail: true,
      visibility: "same_school",
      user: { ...demoUserForAccount("cs"), portfolioItems: demoPortfolioItems("cs") },
      board
    }
  ].map((post) => ({
    ...post,
    contactInfo: contactSnapshot(post.user.contactInfo, { isSameSchool: true })
  }));
}

export function demoPeople(boardId?: string) {
  return [
    { id: "demo-membership-media", boardId: demoBoardById(boardId).id, userId: "demo-user-media", joinedAt: new Date().toISOString(), user: demoUserForAccount("media") },
    { id: "demo-membership-cs", boardId: demoBoardById(boardId).id, userId: "demo-user-cs", joinedAt: new Date().toISOString(), user: demoUserForAccount("cs") }
  ];
}

export function demoRequests() {
  const post = demoPosts()[0];
  return [
    {
      id: "demo-request-1",
      postId: post.id,
      senderId: "demo-user-cs",
      receiverId: "demo-user-media",
      message: "我可以负责互动 demo 和数据整理，想一起做这个 presentation。",
      senderContribution: "prototype, coding, data analysis",
      senderContactSnapshot: contactSnapshot(demoUserForAccount("cs").contactInfo),
      receiverContactSnapshot: contactSnapshot(demoUserForAccount("media").contactInfo, { isSameSchool: true, hasSentTeamUp: true }),
      status: "sent",
      post,
      sender: demoUserForAccount("cs"),
      receiver: demoUserForAccount("media")
    }
  ];
}

export function demoAdminData(resource?: string) {
  const users = [demoUserForAccount("media"), demoUserForAccount("cs"), demoUserForAccount("admin")];
  const tickets = [
    {
      id: "demo-ticket-1",
      email: "media.student@mail.bnbu.edu.cn",
      category: "missing_course",
      title: "缺失课程：COM4010 Documentary Practice",
      description: "希望管理员确认 2026 Fall 是否需要加入这门课。",
      relatedUrl: "/courses",
      status: "open",
      adminNote: "",
      submittedBy: users[0]
    },
    {
      id: "demo-ticket-2",
      email: "cs.student@mail.bnbu.edu.cn",
      category: "bug",
      title: "Course Board 搜索建议显示慢",
      description: "输入 CST 时建议栏需要更快出现。",
      relatedUrl: "/courses",
      status: "in_progress",
      adminNote: "本地演示数据"
    }
  ];

  const data: Record<string, unknown> = {
    users,
    schools: [{ ...school, domains: [{ id: "demo-domain-bnbu", schoolId: school.id, domain: "mail.bnbu.edu.cn", status: "active" }], faculties, majors }],
    majors: { faculties, majors, semesters: [semester] },
    courses: demoCourses,
    boards: demoCourses.map((course) => demoBoardById(course.offerings[0].boards[0].id)),
    "teamaking-posts": demoPosts(),
    "team-up-requests": demoRequests(),
    "support-tickets": tickets,
    "course-submissions": { submissions: [] },
    configs: [
      { key: "developer_contact", value: { text: "请在管理后台填写开发者联系方式" } },
      { key: "course_board_rules", value: { text: "Course Board 只代表平台内自选加入，不代表官方选课。" } }
    ],
    logs: [
      { id: "demo-log-1", action: "demo.admin.view", targetType: "SupportTicket", targetId: "demo-ticket-1", adminUser: users[2], createdAt: new Date().toISOString() }
    ],
    "ai-resume": {
      config: {
        enabled: true,
        provider: "openai",
        model: "gpt-4.1-mini",
        apiKeySource: "missing",
        inputLimit: 14000,
        apiKeySet: false,
        apiKeyPreview: ""
      },
      logs: [
        {
          id: "demo-resume-ai-log-1",
          createdAt: new Date().toISOString(),
          actor: users[0],
          trigger: "resume_upload",
          provider: "local-fallback",
          model: "rule-compression",
          analysisStatus: "fallback",
          summaryTitle: "内容运营与增长协作型候选人",
          highlightCount: 3,
          inputChars: 1280,
          durationMs: 32,
          analysisResult: {
            summaryTitle: "内容运营与增长协作型候选人",
            summaryBody: "围绕课程项目、内容推广和数据复盘形成可见协作证据。",
            highlights: [
              { title: "内容推广执行", evidence: "将活动亮点整理为可发布物料，并跟踪传播反馈。", category: "增长 / 内容运营", keywords: ["content marketing"] }
            ]
          }
        }
      ]
    }
  };

  const value = data[resource ?? ""] ?? data.users;
  return typeof value === "object" && !Array.isArray(value) ? value : { [resource ?? "items"]: value };
}
