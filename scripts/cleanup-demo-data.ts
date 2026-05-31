import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { legacyBnbuMajorReplacements, mergeLegacyBnbuMajorAliases } from "../lib/academic-options";

const prisma = new PrismaClient();

const seedEmails = [
  "media.student@mail.bnbu.edu.cn",
  "cs.student@mail.bnbu.edu.cn",
  "business.admin@mail.bnbu.edu.cn"
];

const seedCourseCodes = ["COM3003", "COM2001", "EAP1020", "CST1001", "BUS2002"];
const oldMajorNames = [...new Set(["Media and Communication", "Computer Science", "Marketing", "Applied Translation", "Finance", ...Object.keys(legacyBnbuMajorReplacements)])];
const seedPostTitles = [
  "Open to Team for COM3003",
  "Open to Team for CST1001 demo work",
  "Open to Team for BUS2002 campaign"
];

function loadDotEnvIfNeeded() {
  if (process.env.DATABASE_URL || !fs.existsSync(".env")) return;
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || match[1].startsWith("#")) continue;
    let value = match[2];
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

function databaseLabel() {
  const raw = process.env.DATABASE_URL ?? "";
  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.hostname}${url.pathname}`;
  } catch {
    return "unknown";
  }
}

function isLocalDatabase() {
  const raw = process.env.DATABASE_URL ?? "";
  try {
    const hostname = new URL(raw).hostname;
    return ["localhost", "127.0.0.1", "::1"].includes(hostname);
  } catch {
    return false;
  }
}

function argEnabled(flag: string) {
  return process.argv.includes(flag);
}

async function buildPlan() {
  const users = await prisma.user.findMany({
    where: { email: { in: seedEmails } },
    select: { id: true, email: true, profile: { select: { displayName: true } } }
  });
  const userIds = users.map((user) => user.id);

  const courseCandidates = await prisma.course.findMany({
    where: {
      OR: [
        { source: { in: ["seed", "demo"] } },
        { code: { in: seedCourseCodes }, source: { in: ["seed", "demo", "admin_seed"] } }
      ]
    },
    select: {
      id: true,
      code: true,
      title: true,
      source: true,
      curriculumRules: { select: { id: true }, take: 1 }
    }
  });
  const courses = courseCandidates.filter((course) => course.curriculumRules.length === 0);
  const courseIds = courses.map((course) => course.id);

  const posts = await prisma.teamakingPost.findMany({
    where: {
      OR: [
        { userId: { in: userIds.length ? userIds : ["__none__"] } },
        { title: { in: seedPostTitles } },
        { courseOffering: { courseId: { in: courseIds.length ? courseIds : ["__none__"] } } }
      ]
    },
    select: { id: true, title: true }
  });
  const postIds = posts.map((post) => post.id);

  const majors = await prisma.major.findMany({
    where: { code: null, name: { in: oldMajorNames } },
    select: {
      id: true,
      schoolId: true,
      name: true,
      profiles: { select: { userId: true } },
      mappings: { select: { courseId: true } }
    }
  });
  const majorIds = majors
    .filter((major) => {
      const profilesAreSeed = major.profiles.every((profile) => userIds.includes(profile.userId));
      const mappingsAreSeed = major.mappings.every((mapping) => courseIds.includes(mapping.courseId));
      return profilesAreSeed && mappingsAreSeed;
    })
    .map((major) => major.id);
  const legacyMajorAliases = await prisma.major.findMany({
    where: { name: { in: Object.keys(legacyBnbuMajorReplacements) } },
    select: {
      id: true,
      schoolId: true,
      name: true,
      code: true,
      profiles: { select: { userId: true } },
      mappings: { select: { courseId: true, recommendedGrade: true } }
    }
  });
  const canonicalMajorCodes = [...new Set(Object.values(legacyBnbuMajorReplacements).map((replacement) => replacement.code))];
  const canonicalMajors = await prisma.major.findMany({
    where: { code: { in: canonicalMajorCodes } },
    select: { id: true, schoolId: true, code: true, name: true }
  });
  const canonicalBySchoolAndCode = new Map(canonicalMajors.map((major) => [`${major.schoolId}:${major.code}`, major]));
  const mergeableLegacyMajorAliases = legacyMajorAliases.filter((major) => {
    const replacement = legacyBnbuMajorReplacements[major.name];
    const canonical = replacement ? canonicalBySchoolAndCode.get(`${major.schoolId}:${replacement.code}`) : null;
    return Boolean(canonical && canonical.id !== major.id);
  });

  const supportTickets = await prisma.supportTicket.findMany({
    where: {
      OR: [
        { email: { in: seedEmails } },
        { submittedByUserId: { in: userIds.length ? userIds : ["__none__"] } },
        { description: { contains: "演示工单" } },
        { relatedUrl: "/boards/demo" }
      ]
    },
    select: { id: true, title: true }
  });

  const submittedCourses = await prisma.userSubmittedCourse.findMany({
    where: {
      OR: [
        { submittedByUserId: { in: userIds.length ? userIds : ["__none__"] } },
        { code: "COM3999" },
        { teacherName: "Dr. Demo" }
      ]
    },
    select: { id: true, code: true, title: true }
  });

  return {
    users,
    userIds,
    courses,
    courseIds,
    posts,
    postIds,
    majors: majors.filter((major) => majorIds.includes(major.id)),
    majorIds,
    legacyMajorAliases: mergeableLegacyMajorAliases,
    supportTickets,
    submittedCourses
  };
}

async function executeCleanup(plan: Awaited<ReturnType<typeof buildPlan>>) {
  return prisma.$transaction(async (tx) => {
    const deletedTeamUpRequests = await tx.teamUpRequest.deleteMany({
      where: {
        OR: [
          { postId: { in: plan.postIds.length ? plan.postIds : ["__none__"] } },
          { senderId: { in: plan.userIds.length ? plan.userIds : ["__none__"] } },
          { receiverId: { in: plan.userIds.length ? plan.userIds : ["__none__"] } }
        ]
      }
    });
    const deletedFollowRequests = await tx.followRequest.deleteMany({
      where: {
        OR: [
          { senderId: { in: plan.userIds.length ? plan.userIds : ["__none__"] } },
          { receiverId: { in: plan.userIds.length ? plan.userIds : ["__none__"] } }
        ]
      }
    });
    const deletedSupportTickets = await tx.supportTicket.deleteMany({ where: { id: { in: plan.supportTickets.map((item) => item.id) } } });
    const deletedSubmittedCourses = await tx.userSubmittedCourse.deleteMany({ where: { id: { in: plan.submittedCourses.map((item) => item.id) } } });
    const deletedPosts = await tx.teamakingPost.deleteMany({ where: { id: { in: plan.postIds.length ? plan.postIds : ["__none__"] } } });
    const deletedMemberships = await tx.courseBoardMembership.deleteMany({
      where: {
        OR: [
          { userId: { in: plan.userIds.length ? plan.userIds : ["__none__"] } },
          { board: { courseOffering: { courseId: { in: plan.courseIds.length ? plan.courseIds : ["__none__"] } } } }
        ]
      }
    });
    const deletedPortfolios = await tx.portfolioItem.deleteMany({
      where: {
        OR: [
          { userId: { in: plan.userIds.length ? plan.userIds : ["__none__"] } },
          { metadata: { path: ["source"], equals: "seed" } } as any
        ]
      }
    });
    const detachedPortfolios = await tx.portfolioItem.updateMany({
      where: { relatedCourseId: { in: plan.courseIds.length ? plan.courseIds : ["__none__"] } },
      data: { relatedCourseId: null }
    });
    const deletedCourseMappings = await tx.courseMajorMapping.deleteMany({
      where: {
        OR: [
          { courseId: { in: plan.courseIds.length ? plan.courseIds : ["__none__"] } },
          { majorId: { in: plan.majorIds.length ? plan.majorIds : ["__none__"] } }
        ]
      }
    });
    const mergedLegacyMajorAliases = [];
    for (const schoolId of [...new Set(plan.legacyMajorAliases.map((major) => major.schoolId))]) {
      mergedLegacyMajorAliases.push(...(await mergeLegacyBnbuMajorAliases(tx, schoolId)));
    }
    const deletedCourseOfferings = await tx.courseOffering.deleteMany({ where: { courseId: { in: plan.courseIds.length ? plan.courseIds : ["__none__"] } } });
    const deletedCourses = await tx.course.deleteMany({ where: { id: { in: plan.courseIds.length ? plan.courseIds : ["__none__"] } } });
    const deletedUsers = await tx.user.deleteMany({ where: { id: { in: plan.userIds.length ? plan.userIds : ["__none__"] } } });
    const deletedMajors = await tx.major.deleteMany({ where: { id: { in: plan.majorIds.length ? plan.majorIds : ["__none__"] } } });

    return {
      deletedTeamUpRequests: deletedTeamUpRequests.count,
      deletedFollowRequests: deletedFollowRequests.count,
      deletedSupportTickets: deletedSupportTickets.count,
      deletedSubmittedCourses: deletedSubmittedCourses.count,
      deletedPosts: deletedPosts.count,
      deletedMemberships: deletedMemberships.count,
      deletedPortfolios: deletedPortfolios.count,
      detachedPortfolios: detachedPortfolios.count,
      deletedCourseMappings: deletedCourseMappings.count,
      mergedLegacyMajorAliases,
      deletedCourseOfferings: deletedCourseOfferings.count,
      deletedCourses: deletedCourses.count,
      deletedUsers: deletedUsers.count,
      deletedMajors: deletedMajors.count
    };
  }, { timeout: 60000, maxWait: 10000 });
}

async function main() {
  loadDotEnvIfNeeded();
  const execute = argEnabled("--execute");
  const allowRemote = argEnabled("--allow-remote");
  const local = isLocalDatabase();
  if (execute && !local && !allowRemote) {
    throw new Error("Refusing to delete data on a remote database without --allow-remote.");
  }

  const plan = await buildPlan();
  const summary = {
    mode: execute ? "execute" : "dry-run",
    database: databaseLabel(),
    localDatabase: local,
    users: plan.users.map((user) => `${user.email} (${user.profile?.displayName ?? "no profile"})`),
    courses: plan.courses.map((course) => `${course.code} ${course.title} [${course.source}]`),
    majors: plan.majors.map((major) => major.name),
    legacyMajorAliases: plan.legacyMajorAliases.map((major) => `${major.name} [${major.code ?? "no code"}]`),
    posts: plan.posts.map((post) => post.title),
    supportTickets: plan.supportTickets.map((ticket) => ticket.title),
    submittedCourses: plan.submittedCourses.map((course) => `${course.code} ${course.title}`)
  };
  console.log(JSON.stringify(summary, null, 2));

  if (!execute) {
    console.log("Dry run only. Add --execute to delete these records.");
    return;
  }

  const result = await executeCleanup(plan);
  console.log(JSON.stringify({ deleted: result }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
