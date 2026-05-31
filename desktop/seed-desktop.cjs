const { pbkdf2Sync, randomBytes } = require("node:crypto");
const path = require("node:path");

if (!process.env.DATABASE_URL) {
  const dataDir = process.env.TEAMAKING_DATA_DIR || path.join(process.cwd(), ".desktop-data");
  process.env.DATABASE_URL = `file:${path.join(dataDir, "teamaking.db").replace(/\\/g, "/")}`;
}

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function hashPassword(password) {
  const iterations = 210000;
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("hex");
  return `pbkdf2_sha256$${iterations}$${salt}$${hash}`;
}

async function upsertBoardForOffering(courseCode, offering, title) {
  const existing = await prisma.courseBoard.findFirst({
    where: { courseOfferingId: offering.id }
  });
  if (existing) return existing;
  return prisma.courseBoard.create({
    data: {
      courseOfferingId: offering.id,
      title: `${courseCode} ${title}`,
      rules: "Course People 是 TEAMAKING Desktop 内的本机协作名单，不代表官方选课名单。"
    }
  });
}

async function main() {
  const appVersion = await prisma.appVersion.upsert({
    where: { id: "legacy" },
    update: { status: "active" },
    create: {
      id: "legacy",
      name: "TEAMAKING Desktop Local Workspace",
      phase: "desktop",
      status: "active"
    }
  });

  const school = await prisma.school.upsert({
    where: { appVersionId_shortName: { appVersionId: appVersion.id, shortName: "LOCAL" } },
    update: { name: "Local Workspace", status: "active" },
    create: {
      appVersionId: appVersion.id,
      name: "Local Workspace",
      shortName: "LOCAL",
      status: "active"
    }
  });

  for (const domain of ["local.teamaking", "mail.bnbu.edu.cn"]) {
    await prisma.schoolEmailDomain.upsert({
      where: { schoolId_domain: { schoolId: school.id, domain } },
      update: { status: "active" },
      create: { schoolId: school.id, domain, status: "active" }
    });
  }

  const faculty = await prisma.faculty.upsert({
    where: { schoolId_name: { schoolId: school.id, name: "Local Faculty" } },
    update: {},
    create: { schoolId: school.id, name: "Local Faculty" }
  });

  const major = await prisma.major.upsert({
    where: { schoolId_name: { schoolId: school.id, name: "Local Programme" } },
    update: { facultyId: faculty.id },
    create: {
      schoolId: school.id,
      facultyId: faculty.id,
      code: "LOCAL",
      name: "Local Programme",
      degreeType: "undergraduate"
    }
  });

  const semester = await prisma.semester.upsert({
    where: { schoolId_code: { schoolId: school.id, code: "2026-Fall" } },
    update: { name: "2026 Fall", year: 2026, term: "Fall", isCurrent: true },
    create: {
      schoolId: school.id,
      code: "2026-Fall",
      name: "2026 Fall",
      year: 2026,
      term: "Fall",
      isCurrent: true
    }
  });

  const courses = [
    ["LOCAL1001", "Team Project Studio", "本机示例课程：用于体验 Course Board、Teamaking Post 和 TeamUp Interest。"],
    ["LOCAL2001", "Portfolio Communication", "本机示例课程：用于整理作品、简历摘要和协作证据。"],
    ["LOCAL3001", "Course Import Workshop", "本机示例课程：用于测试课程导入与培养方案规则。"]
  ];

  for (const [code, title, description] of courses) {
    const course = await prisma.course.upsert({
      where: { schoolId_code: { schoolId: school.id, code } },
      update: { title, description, status: "active" },
      create: {
        schoolId: school.id,
        code,
        title,
        description,
        courseType: "coursework",
        status: "active",
        source: "desktop_seed"
      }
    });
    await prisma.courseMajorMapping.upsert({
      where: { courseId_majorId_recommendedGrade: { courseId: course.id, majorId: major.id, recommendedGrade: "Year 1" } },
      update: { isRequired: false, isDefaultRecommended: true },
      create: {
        courseId: course.id,
        majorId: major.id,
        recommendedGrade: "Year 1",
        isRequired: false,
        isDefaultRecommended: true
      }
    });

    let offering = await prisma.courseOffering.findFirst({
      where: { courseId: course.id, semesterId: semester.id, section: "A" }
    });
    if (!offering) {
      offering = await prisma.courseOffering.create({
        data: {
          courseId: course.id,
          semesterId: semester.id,
          teacherName: "TEAMAKING Desktop",
          section: "A",
          status: "active"
        }
      });
    }
    await upsertBoardForOffering(code, offering, title);
  }

  const adminEmail = process.env.ADMIN_BOOTSTRAP_EMAIL || "local.admin@teamaking.desktop";
  const adminPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD || "teamaking-local-admin";
  const admin = await prisma.user.upsert({
    where: { appVersionId_email: { appVersionId: appVersion.id, email: adminEmail } },
    update: {
      schoolId: school.id,
      role: "super_admin",
      passwordHash: hashPassword(adminPassword),
      isEmailVerified: true,
      onboardingCompleted: true,
      status: "active"
    },
    create: {
      appVersionId: appVersion.id,
      email: adminEmail,
      schoolId: school.id,
      role: "super_admin",
      passwordHash: hashPassword(adminPassword),
      isEmailVerified: true,
      onboardingCompleted: true,
      status: "active"
    }
  });

  await prisma.userProfile.upsert({
    where: { userId: admin.id },
    update: { displayName: "TEAMAKING Local Admin" },
    create: { userId: admin.id, displayName: "TEAMAKING Local Admin" }
  });

  await prisma.contactInfo.upsert({
    where: { userId: admin.id },
    update: { schoolEmail: adminEmail },
    create: {
      userId: admin.id,
      schoolEmail: adminEmail,
      visibilitySettings: {
        schoolEmail: "same_school",
        wechatId: "mutual",
        linkedinUrl: "public",
        personalEmail: "mutual"
      }
    }
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
