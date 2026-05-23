import { PrismaClient } from "@prisma/client";
import { contactSnapshot, defaultContactVisibility } from "../lib/contact";

const prisma = new PrismaClient();

async function resetDatabase() {
  await prisma.adminAuditLog.deleteMany();
  await prisma.supportTicket.deleteMany();
  await prisma.endorsement.deleteMany();
  await prisma.teamUpRequest.deleteMany();
  await prisma.teamakingPost.deleteMany();
  await prisma.courseBoardMembership.deleteMany();
  await prisma.portfolioItem.deleteMany();
  await prisma.userSkill.deleteMany();
  await prisma.skill.deleteMany();
  await prisma.contactInfo.deleteMany();
  await prisma.userProfile.deleteMany();
  await prisma.emailVerification.deleteMany();
  await prisma.userSubmittedCourse.deleteMany();
  await prisma.courseMajorMapping.deleteMany();
  await prisma.courseBoard.deleteMany();
  await prisma.courseOffering.deleteMany();
  await prisma.course.deleteMany();
  await prisma.semester.deleteMany();
  await prisma.major.deleteMany();
  await prisma.faculty.deleteMany();
  await prisma.schoolEmailDomain.deleteMany();
  await prisma.siteConfig.deleteMany();
  await prisma.user.deleteMany();
  await prisma.school.deleteMany();
}

async function main() {
  await resetDatabase();

  const school = await prisma.school.create({
    data: {
      name: "BNBU",
      shortName: "BNBU",
      status: "active",
      domains: {
        create: {
          domain: "mail.bnbu.edu.cn",
          status: "active"
        }
      }
    }
  });

  const facultyNames = [
    "Faculty of Humanities and Social Sciences",
    "Faculty of Business and Management",
    "Faculty of Science and Technology"
  ];

  const faculties = Object.fromEntries(
    await Promise.all(
      facultyNames.map(async (name) => {
        const faculty = await prisma.faculty.create({
          data: { schoolId: school.id, name }
        });
        return [name, faculty];
      })
    )
  );

  const majors = {
    media: await prisma.major.create({
      data: {
        schoolId: school.id,
        facultyId: faculties["Faculty of Humanities and Social Sciences"].id,
        name: "Media and Communication",
        degreeType: "undergraduate"
      }
    }),
    translation: await prisma.major.create({
      data: {
        schoolId: school.id,
        facultyId: faculties["Faculty of Humanities and Social Sciences"].id,
        name: "Applied Translation",
        degreeType: "undergraduate"
      }
    }),
    cs: await prisma.major.create({
      data: {
        schoolId: school.id,
        facultyId: faculties["Faculty of Science and Technology"].id,
        name: "Computer Science",
        degreeType: "undergraduate"
      }
    }),
    finance: await prisma.major.create({
      data: {
        schoolId: school.id,
        facultyId: faculties["Faculty of Business and Management"].id,
        name: "Finance",
        degreeType: "undergraduate"
      }
    }),
    marketing: await prisma.major.create({
      data: {
        schoolId: school.id,
        facultyId: faculties["Faculty of Business and Management"].id,
        name: "Marketing",
        degreeType: "undergraduate"
      }
    })
  };

  const semester = await prisma.semester.create({
    data: {
      schoolId: school.id,
      name: "2026 Fall",
      year: 2026,
      term: "Fall",
      isCurrent: true
    }
  });

  const courseSeed = [
    ["COM3003", "Media Ethics", "讨论媒体责任、公共表达和平台治理的课程。"],
    ["COM2001", "Communication Theory", "理解传播理论、研究框架和媒介现象。"],
    ["EAP1020", "English for Academic Purposes", "训练学术写作、展示和资料整合能力。"],
    ["CST1001", "Introduction to Programming", "编程基础、问题拆解和项目协作入门。"],
    ["BUS2002", "Marketing Principles", "市场分析、用户洞察和品牌传播基础。"]
  ] as const;

  const courses: Record<string, any> = {};
  const boards: Record<string, any> = {};
  const offerings: Record<string, any> = {};

  for (const [code, title, description] of courseSeed) {
    const course = await prisma.course.create({
      data: {
        schoolId: school.id,
        code,
        title,
        description,
        courseType: "coursework",
        status: "active",
        source: "seed"
      }
    });

    const offering = await prisma.courseOffering.create({
      data: {
        courseId: course.id,
        semesterId: semester.id,
        teacherName: code.startsWith("COM") ? "Dr. Chan" : code.startsWith("CST") ? "Dr. Lee" : "Dr. Wong",
        section: "A",
        status: "active"
      }
    });

    const board = await prisma.courseBoard.create({
      data: {
        courseOfferingId: offering.id,
        title: `${code} ${title}`,
        rules: "请清楚表达你能贡献的部分。Course People 是 TEAMAKING 平台内自选加入名单，不代表官方选课名单。"
      }
    });

    courses[code] = course;
    offerings[code] = offering;
    boards[code] = board;
  }

  await prisma.courseMajorMapping.createMany({
    data: [
      { courseId: courses.COM2001.id, majorId: majors.media.id, recommendedGrade: "Year 2", isRequired: true, isDefaultRecommended: true },
      { courseId: courses.COM3003.id, majorId: majors.media.id, recommendedGrade: "Year 2", isRequired: true, isDefaultRecommended: true },
      { courseId: courses.CST1001.id, majorId: majors.cs.id, recommendedGrade: "Year 1", isRequired: true, isDefaultRecommended: true },
      { courseId: courses.BUS2002.id, majorId: majors.finance.id, recommendedGrade: "Year 2", isRequired: true, isDefaultRecommended: true },
      { courseId: courses.BUS2002.id, majorId: majors.marketing.id, recommendedGrade: "Year 2", isRequired: true, isDefaultRecommended: true }
    ]
  });

  const skillNames = [
    ["academic writing", "communication"],
    ["research", "communication"],
    ["PPT design", "presentation"],
    ["presentation", "presentation"],
    ["data analysis", "analytics"],
    ["coding", "engineering"],
    ["project management", "collaboration"],
    ["visual design", "design"]
  ] as const;

  const skills = Object.fromEntries(
    await Promise.all(
      skillNames.map(async ([name, category]) => {
        const skill = await prisma.skill.create({ data: { name, category } });
        return [name, skill];
      })
    )
  );

  async function createDemoUser(input: {
    email: string;
    role: string;
    displayName: string;
    bio: string;
    grade: string;
    facultyId: string;
    majorId: string;
    wechatId: string;
    skillNames: string[];
  }) {
    const user = await prisma.user.create({
      data: {
        email: input.email,
        schoolId: school.id,
        role: input.role,
        isEmailVerified: true,
        onboardingCompleted: true
      }
    });

    await prisma.userProfile.create({
      data: {
        userId: user.id,
        displayName: input.displayName,
        nickname: input.displayName.split(" ")[0],
        avatarUrl: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(input.displayName)}`,
        headline: `${input.grade} · ${input.skillNames.slice(0, 2).join(" / ")}`,
        bio: input.bio,
        grade: input.grade,
        facultyId: input.facultyId,
        majorId: input.majorId,
        outputTags: input.skillNames,
        resumeUrl: `https://example.com/${input.displayName.toLowerCase().replaceAll(" ", "-")}-resume.pdf`,
        resumeFileName: `${input.displayName} Resume.pdf`,
        resumeParsedData: {
          parser: "seed-placeholder",
          skills: input.skillNames,
          summary: "Seed 中的简历解析占位数据；本地上传时由 /api/uploads 返回解析结果。"
        },
        openToBeDiscovered: true,
        visibilitySettings: {
          profile: "same_school",
          portfolio: "same_school"
        }
      }
    });

    await prisma.contactInfo.create({
      data: {
        userId: user.id,
        schoolEmail: input.email,
        wechatId: input.wechatId,
        wechatQrImageUrl: "https://placehold.co/320x320?text=WeChat+QR",
        linkedinUrl: `https://www.linkedin.com/in/${input.displayName.toLowerCase().replaceAll(" ", "-")}`,
        personalEmail: input.email.replace("@mail.bnbu.edu.cn", "@example.com"),
        visibilitySettings: defaultContactVisibility
      }
    });

    for (const skillName of input.skillNames) {
      await prisma.userSkill.create({
        data: {
          userId: user.id,
          skillId: skills[skillName].id,
          level: "intermediate",
          evidenceNote: "来自 seed 的演示技能"
        }
      });
    }

    return user;
  }

  const mediaUser = await createDemoUser({
    email: "media.student@mail.bnbu.edu.cn",
    role: "profile_completed_user",
    displayName: "Mia Chen",
    bio: "Media and Communication Year 2。擅长找资料、搭论文论证框架和做清晰的 slides。",
    grade: "Year 2",
    facultyId: faculties["Faculty of Humanities and Social Sciences"].id,
    majorId: majors.media.id,
    wechatId: "mia_teamaking",
    skillNames: ["academic writing", "research", "PPT design"]
  });

  const csUser = await createDemoUser({
    email: "cs.student@mail.bnbu.edu.cn",
    role: "profile_completed_user",
    displayName: "Leo Wang",
    bio: "Computer Science Year 1。喜欢把复杂任务拆成可运行的小模块，也愿意补数据处理和 demo。",
    grade: "Year 1",
    facultyId: faculties["Faculty of Science and Technology"].id,
    majorId: majors.cs.id,
    wechatId: "leo_codes",
    skillNames: ["coding", "data analysis", "project management"]
  });

  const businessUser = await createDemoUser({
    email: "business.admin@mail.bnbu.edu.cn",
    role: "school_admin",
    displayName: "Ava Li",
    bio: "Marketing student and school admin demo account。关注用户洞察、展示结构和协作节奏。",
    grade: "Year 2",
    facultyId: faculties["Faculty of Business and Management"].id,
    majorId: majors.marketing.id,
    wechatId: "ava_market",
    skillNames: ["presentation", "visual design", "project management"]
  });

  await prisma.portfolioItem.createMany({
    data: [
      {
        userId: mediaUser.id,
        title: "COM2001 Theory Brief",
        type: "report",
        relatedCourseId: courses.COM2001.id,
        semesterText: "2026 Spring",
        myRole: "Argument builder",
        contributionDescription: "整理三篇理论文献并把核心概念转化为小组报告结构。",
        isGroupWork: true,
        fileName: "COM2001-theory-brief.md",
        fileMimeType: "text/markdown",
        fileSize: 4096,
        fileExtension: "md",
        storageKey: "/uploads/seed/COM2001-theory-brief.md",
        fileUrl: "/uploads/seed/COM2001-theory-brief.md",
        externalUrl: "https://example.com/media-brief",
        previewKind: "markdown",
        outcome: "A- report",
        reflection: "清楚的论证路径比堆材料更重要。",
        metadata: { category: "coursework", source: "seed" },
        visibility: "same_school"
      },
      {
        userId: csUser.id,
        title: "CST1001 Data Cleaning Demo",
        type: "code",
        relatedCourseId: courses.CST1001.id,
        semesterText: "2026 Fall",
        myRole: "Developer",
        contributionDescription: "写了一个小脚本清洗 CSV，并输出可视化摘要。",
        isGroupWork: false,
        fileName: "data-cleaning-demo.py",
        fileMimeType: "text/x-python",
        fileSize: 8192,
        fileExtension: "py",
        storageKey: "/uploads/seed/data-cleaning-demo.py",
        fileUrl: "/uploads/seed/data-cleaning-demo.py",
        externalUrl: "https://github.com/example/teamaking-demo",
        previewKind: "text",
        outcome: "Reusable script",
        reflection: "小工具能明显降低团队沟通成本。",
        metadata: { category: "code", source: "seed" },
        visibility: "same_school"
      },
      {
        userId: businessUser.id,
        title: "BUS2002 Campaign Deck",
        type: "slides",
        relatedCourseId: courses.BUS2002.id,
        semesterText: "2026 Fall",
        myRole: "Presenter",
        contributionDescription: "负责用户画像、品牌定位和最终 presentation。",
        isGroupWork: true,
        fileName: "BUS2002-campaign-deck.pdf",
        fileMimeType: "application/pdf",
        fileSize: 524288,
        fileExtension: "pdf",
        storageKey: "/uploads/seed/BUS2002-campaign-deck.pdf",
        fileUrl: "/uploads/seed/BUS2002-campaign-deck.pdf",
        externalUrl: "https://example.com/campaign-deck",
        previewKind: "pdf",
        outcome: "High distinction presentation",
        reflection: "好的 slides 应该帮助观众快速做判断。",
        metadata: { category: "slides", source: "seed" },
        visibility: "same_school"
      },
      {
        userId: mediaUser.id,
        title: "GPA screenshot",
        type: "gpa_screenshot",
        semesterText: "2026 Fall",
        myRole: "Owner",
        contributionDescription: "GPA 截图证明。默认 private，用户可自行决定是否展示。",
        isGroupWork: false,
        fileName: "gpa-screenshot.png",
        fileMimeType: "image/png",
        fileSize: 160000,
        fileExtension: "png",
        storageKey: "/uploads/seed/gpa-screenshot.png",
        fileUrl: "/uploads/seed/gpa-screenshot.png",
        previewKind: "image",
        metadata: { category: "gpa", sensitive: true },
        visibility: "private"
      },
      {
        userId: csUser.id,
        title: "Python skill certificate",
        type: "skill_certification",
        semesterText: "2026",
        myRole: "Owner",
        contributionDescription: "职业/技能认证证明，用于支撑技能标签。",
        isGroupWork: false,
        fileName: "python-certificate.pdf",
        fileMimeType: "application/pdf",
        fileSize: 220000,
        fileExtension: "pdf",
        storageKey: "/uploads/seed/python-certificate.pdf",
        fileUrl: "/uploads/seed/python-certificate.pdf",
        previewKind: "pdf",
        metadata: { issuer: "Demo Certification Center" },
        visibility: "same_school"
      }
    ]
  });

  await prisma.courseBoardMembership.createMany({
    data: [
      { userId: mediaUser.id, boardId: boards.COM3003.id },
      { userId: mediaUser.id, boardId: boards.COM2001.id },
      { userId: csUser.id, boardId: boards.CST1001.id },
      { userId: csUser.id, boardId: boards.COM3003.id },
      { userId: businessUser.id, boardId: boards.BUS2002.id },
      { userId: businessUser.id, boardId: boards.COM3003.id }
    ]
  });

  const mediaPortfolio = await prisma.portfolioItem.findFirstOrThrow({ where: { userId: mediaUser.id } });
  const csPortfolio = await prisma.portfolioItem.findFirstOrThrow({ where: { userId: csUser.id } });
  const businessPortfolio = await prisma.portfolioItem.findFirstOrThrow({ where: { userId: businessUser.id } });

  const mediaPost = await prisma.teamakingPost.create({
    data: {
      boardId: boards.COM3003.id,
      userId: mediaUser.id,
      courseOfferingId: offerings.COM3003.id,
      title: "Open to Team for COM3003",
      strengths: ["academic writing", "research", "PPT design"],
      contributionTypes: ["literature review", "writing", "slides"],
      expectedOutcome: "A polished report with strong argumentation and clean slides.",
      portfolioItemIds: [mediaPortfolio.id],
      showWechatId: true,
      showWechatQr: false,
      showLinkedin: true,
      showPersonalEmail: false,
      visibility: "same_course_board"
    }
  });

  const csPost = await prisma.teamakingPost.create({
    data: {
      boardId: boards.CST1001.id,
      userId: csUser.id,
      courseOfferingId: offerings.CST1001.id,
      title: "Open to Team for CST1001 demo work",
      strengths: ["coding", "data analysis", "project management"],
      contributionTypes: ["coding", "data cleaning", "presenting"],
      expectedOutcome: "A working demo with clean code and a short presentation.",
      portfolioItemIds: [csPortfolio.id],
      showWechatId: true,
      showWechatQr: false,
      showLinkedin: false,
      showPersonalEmail: false,
      visibility: "same_school"
    }
  });

  const businessPost = await prisma.teamakingPost.create({
    data: {
      boardId: boards.BUS2002.id,
      userId: businessUser.id,
      courseOfferingId: offerings.BUS2002.id,
      title: "Open to Team for BUS2002 campaign",
      strengths: ["presentation", "visual design", "project management"],
      contributionTypes: ["slides", "presenting", "design"],
      expectedOutcome: "A persuasive campaign pitch with strong user insight.",
      portfolioItemIds: [businessPortfolio.id],
      showWechatId: true,
      showWechatQr: true,
      showLinkedin: true,
      showPersonalEmail: false,
      visibility: "same_school"
    }
  });

  const mediaContact = await prisma.contactInfo.findUniqueOrThrow({ where: { userId: mediaUser.id } });
  const csContact = await prisma.contactInfo.findUniqueOrThrow({ where: { userId: csUser.id } });
  const businessContact = await prisma.contactInfo.findUniqueOrThrow({ where: { userId: businessUser.id } });

  await prisma.teamUpRequest.createMany({
    data: [
      {
        postId: mediaPost.id,
        senderId: csUser.id,
        receiverId: mediaUser.id,
        message: "我可以负责数据整理和简单网页 demo，想一起把 COM3003 的案例做得更有证据。",
        senderContribution: "coding, data cleaning, demo building",
        senderContactSnapshot: contactSnapshot(csContact),
        receiverContactSnapshot: contactSnapshot(mediaContact, { isSameSchool: true, hasSentTeamUp: true }),
        status: "sent"
      },
      {
        postId: mediaPost.id,
        senderId: businessUser.id,
        receiverId: mediaUser.id,
        message: "我擅长 presentation 和结构化 slides，可以帮你把论证讲得更清楚。",
        senderContribution: "slides, presenting, project management",
        senderContactSnapshot: contactSnapshot(businessContact),
        receiverContactSnapshot: contactSnapshot(mediaContact, { isSameSchool: true, hasSentTeamUp: true }),
        status: "viewed"
      },
      {
        postId: csPost.id,
        senderId: mediaUser.id,
        receiverId: csUser.id,
        message: "我能补充写作和展示结构，你负责技术 demo，我们可以互补。",
        senderContribution: "academic writing, literature review, slides",
        senderContactSnapshot: contactSnapshot(mediaContact),
        receiverContactSnapshot: contactSnapshot(csContact, { isSameSchool: true, hasSentTeamUp: true }),
        status: "mutual"
      },
      {
        postId: businessPost.id,
        senderId: mediaUser.id,
        receiverId: businessUser.id,
        message: "这条请求用于演示 reported 管理流程。",
        senderContribution: "writing",
        senderContactSnapshot: contactSnapshot(mediaContact),
        receiverContactSnapshot: contactSnapshot(businessContact, { isSameSchool: true, hasSentTeamUp: true }),
        status: "reported"
      }
    ]
  });

  await prisma.userSubmittedCourse.create({
    data: {
      submittedByUserId: mediaUser.id,
      schoolId: school.id,
      code: "COM3999",
      title: "Special Topics in Digital Culture",
      teacherName: "Dr. Demo",
      semesterText: "2026 Fall",
      status: "pending"
    }
  });

  await prisma.supportTicket.createMany({
    data: [
      {
        submittedByUserId: mediaUser.id,
        email: mediaUser.email,
        category: "missing_course",
        title: "希望添加 COM3999 Digital Culture",
        description: "演示工单：课程搜索不到 COM3999，后续请管理员私下确认是否需要建立课程板。",
        relatedUrl: "/courses",
        status: "open"
      },
      {
        submittedByUserId: csUser.id,
        email: csUser.email,
        category: "bug",
        title: "Course Board 页面移动端间距过大",
        description: "演示工单：用于验收管理员无代码处理流程。",
        relatedUrl: "/boards/demo",
        status: "in_progress",
        adminNote: "等待下一轮 UI 调整时一起处理。"
      }
    ]
  });

  await prisma.siteConfig.createMany({
    data: [
      {
        key: "landing_page",
        value: {
          headline: "TEAMAKING",
          tagline: "Your work speaks before you team up.",
          subtitleZh: "让认真做事的人，先被看见。"
        },
        updatedByUserId: businessUser.id
      },
      {
        key: "onboarding_guide",
        value: {
          steps: ["完成 Profile", "加入 Course Board", "发布 Open to Team", "通过 WeChat 继续沟通"]
        },
        updatedByUserId: businessUser.id
      },
      {
        key: "course_board_rules",
        value: {
          rule: "Course People 是平台内自选加入名单，不代表官方选课名单。"
        },
        updatedByUserId: businessUser.id
      },
      {
        key: "developer_contact",
        value: {
          name: "TEAMAKING developer",
          email: "请在管理后台填写开发者邮箱",
          note: "bug、报错、缺失课程、后台问题都可以通过 /support 提交工单。"
        },
        updatedByUserId: businessUser.id
      },
      {
        key: "system_status",
        value: {
          status: "active",
          message: ""
        },
        updatedByUserId: businessUser.id
      }
    ]
  });

  await prisma.adminAuditLog.create({
    data: {
      adminUserId: businessUser.id,
      action: "seed.initialize",
      targetType: "Database",
      targetId: "local",
      afterValue: {
        school: "BNBU",
        users: ["media.student@mail.bnbu.edu.cn", "cs.student@mail.bnbu.edu.cn", "business.admin@mail.bnbu.edu.cn"],
        note: "TEAMAKING MVP seed data"
      }
    }
  });

  console.log("TEAMAKING seed data created.");
  console.log("Demo accounts:");
  console.log("- media.student@mail.bnbu.edu.cn");
  console.log("- cs.student@mail.bnbu.edu.cn");
  console.log("- business.admin@mail.bnbu.edu.cn");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
