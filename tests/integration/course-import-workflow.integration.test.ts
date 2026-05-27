import { describe, expect, it } from "vitest";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const canUseTestDatabase = Boolean(
  testDatabaseUrl
  && /(?:test|localhost|127\.0\.0\.1|0\.0\.0\.0)/i.test(testDatabaseUrl)
  && !/(?:production|prod|vercel|neon\.tech)/i.test(testDatabaseUrl)
);

function minimalBnbuPayload(runId: string) {
  return {
    schemaVersion: "teamaking.bnbu_course_import.v2",
    generatedAt: "2026-05-27T00:00:00.000Z",
    importMode: "cohort_programme_handbook",
    cohortYears: [2026],
    school: {
      shortName: "BNBU",
      name: "Beijing Normal-Hong Kong Baptist University",
      emailDomain: "mail.bnbu.edu.cn"
    },
    semester: {
      code: "2026-Fall",
      name: "2026 Fall",
      academicYear: 2026,
      term: "Fall",
      isCurrentCandidate: true
    },
    sourceRefs: [
      {
        id: `handbook-${runId}-ai`,
        title: "Artificial Intelligence Programme Handbook 2026 Admission",
        url: "https://ar.bnbu.edu.cn/current_students/student_handbook/programme_handbook.htm",
        sourceType: "curriculum_pdf"
      }
    ],
    faculties: [{ code: "FST", name: "Faculty of Science and Technology" }],
    majors: [{ code: "AI", name: "Artificial Intelligence Programme", facultyCode: "FST" }],
    courses: [
      {
        code: "AI1003",
        title: "Python Programming",
        credits: 3,
        ownerUnit: { type: "faculty", code: "FST", name: "Faculty of Science and Technology" },
        categoryTags: ["Major Required Courses"],
        sourceRefIds: [`handbook-${runId}-ai`]
      }
    ],
    offerings: [],
    curriculumRules: [
      {
        id: `rule-${runId}-ai1003-y1s1`,
        courseCode: "AI1003",
        semesterCode: "2026-Fall",
        classification: "major_required",
        classificationLabel: "Major Required Courses",
        studentAction: "default_join",
        relativeTermCodes: ["Y1S1"],
        audience: { cohortYears: [2026], entryTerm: "Fall", majorCodes: ["AI"] },
        sourceRefIds: [`handbook-${runId}-ai`]
      }
    ]
  };
}

describe.skipIf(!canUseTestDatabase)("course import workflow DB contracts", () => {
  it("creates pending imports, approves handbook rules, protects memberships, and restores checkpoints", async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    const runId = `it-${Date.now()}`;
    const { prisma } = await import("@/lib/prisma");
    const { createCourseImportWorkflow } = await import("@/lib/server/course-import/workflow");
    const { createAdminVersionsModule } = await import("@/lib/server/admin/versions-module");

    await prisma.appVersion.updateMany({ where: { status: "active" }, data: { status: "paused", endedAt: new Date() } });
    const appVersion = await prisma.appVersion.create({
      data: { name: `Integration ${runId}`, phase: "testing", status: "active" }
    });
    const school = await prisma.school.create({
      data: { appVersionId: appVersion.id, shortName: "BNBU", name: "Beijing Normal-Hong Kong Baptist University" }
    });
    await prisma.schoolEmailDomain.create({ data: { schoolId: school.id, domain: "mail.bnbu.edu.cn" } });
    const faculty = await prisma.faculty.create({ data: { schoolId: school.id, code: "FST", name: "Faculty of Science and Technology" } });
    const major = await prisma.major.create({ data: { schoolId: school.id, facultyId: faculty.id, code: "AI", name: "Artificial Intelligence Programme" } });
    const semester = await prisma.semester.create({ data: { schoolId: school.id, code: "2026-Fall", name: "2026 Fall", year: 2026, term: "Fall", isCurrent: false } });
    const seededCourse = await prisma.course.create({ data: { schoolId: school.id, code: "AI1003", title: "Seed AI", source: "test_seed" } });
    const seededOffering = await prisma.courseOffering.create({ data: { courseId: seededCourse.id, semesterId: semester.id, section: "Programme Plan" } });
    const seededBoard = await prisma.courseBoard.create({ data: { courseOfferingId: seededOffering.id, title: "Seed AI Board" } });

    const userData = (email: string, entryYear: number) => ({
      appVersionId: appVersion.id,
      schoolId: school.id,
      email,
      role: "verified_user",
      isEmailVerified: true,
      onboardingCompleted: true,
      profile: {
        create: {
          displayName: email.split("@")[0],
          facultyId: faculty.id,
          majorId: major.id,
          entryYear,
          entryTerm: "Fall",
          grade: String(entryYear)
        }
      }
    });
    const [admin, autoUser, manualUser, optedOutUser, oldUser] = await Promise.all([
      prisma.user.create({
        data: {
          appVersionId: appVersion.id,
          schoolId: school.id,
          email: `admin-${runId}@mail.bnbu.edu.cn`,
          role: "super_admin",
          isEmailVerified: true,
          onboardingCompleted: false
        }
      }),
      prisma.user.create({ data: userData(`auto-${runId}@mail.bnbu.edu.cn`, 2026) }),
      prisma.user.create({ data: userData(`manual-${runId}@mail.bnbu.edu.cn`, 2026) }),
      prisma.user.create({ data: userData(`opted-${runId}@mail.bnbu.edu.cn`, 2026) }),
      prisma.user.create({ data: userData(`old-${runId}@mail.bnbu.edu.cn`, 2025) })
    ]);
    await prisma.courseBoardMembership.create({ data: { userId: manualUser.id, boardId: seededBoard.id, source: "manual", status: "active" } });
    await prisma.courseBoardMembership.create({ data: { userId: optedOutUser.id, boardId: seededBoard.id, source: "auto_major_required", status: "opted_out" } });

    const workflow = createCourseImportWorkflow();
    const payload = minimalBnbuPayload(runId);
    const created = await workflow.createBatchFromPayload({ payload, name: `Integration ${runId}`, admin });
    expect(created.batch).toMatchObject({ status: "pending", schemaVersion: "teamaking.bnbu_course_import.v2" });

    const approved = await workflow.approveBatch(created.batch.id, admin);
    expect(approved.importBatch).toMatchObject({ status: "approved", approvedByUserId: admin.id });
    expect(approved.result).toMatchObject({
      rulesInAcademicTermContext: 1,
      activatedBoards: [expect.objectContaining({ courseCode: "AI1003" })],
      autoJoinResults: [expect.objectContaining({ matchedUsers: 3, membershipsCreated: 1 })]
    });

    const [approvedSchool, approvedFaculty, approvedMajor, approvedCourse, approvedRule, programmeOffering, board] = await Promise.all([
      prisma.school.findUnique({ where: { appVersionId_shortName: { appVersionId: appVersion.id, shortName: "BNBU" } } }),
      prisma.faculty.findUnique({ where: { schoolId_code: { schoolId: school.id, code: "FST" } } }),
      prisma.major.findUnique({ where: { schoolId_code: { schoolId: school.id, code: "AI" } } }),
      prisma.course.findUnique({ where: { schoolId_code: { schoolId: school.id, code: "AI1003" } } }),
      prisma.courseCurriculumRule.findFirst({ where: { externalId: `rule-${runId}-ai1003-y1s1` } }),
      prisma.courseOffering.findFirst({ where: { courseId: seededCourse.id, semesterId: semester.id, section: "Programme Plan" } }),
      prisma.courseBoard.findFirst({ where: { courseOfferingId: seededOffering.id } })
    ]);
    expect(approvedSchool?.name).toContain("Beijing Normal");
    expect(approvedFaculty?.name).toContain("Science");
    expect(approvedMajor?.name).toContain("Artificial Intelligence");
    expect(approvedCourse).toMatchObject({ title: "Python Programming", source: "bnbu_import" });
    expect(approvedRule).toMatchObject({ classification: "major_required", studentAction: "default_join", status: "active" });
    expect(programmeOffering).toMatchObject({ section: "Programme Plan", status: "active" });
    expect(board).toMatchObject({ status: "active" });

    await expect(prisma.courseBoardMembership.findUnique({ where: { userId_boardId: { userId: autoUser.id, boardId: seededBoard.id } } }))
      .resolves.toMatchObject({ source: "auto_major_required", status: "active", originRuleId: approvedRule?.id });
    await expect(prisma.courseBoardMembership.findUnique({ where: { userId_boardId: { userId: manualUser.id, boardId: seededBoard.id } } }))
      .resolves.toMatchObject({ source: "manual", status: "active" });
    await expect(prisma.courseBoardMembership.findUnique({ where: { userId_boardId: { userId: optedOutUser.id, boardId: seededBoard.id } } }))
      .resolves.toMatchObject({ source: "auto_major_required", status: "opted_out" });
    await expect(prisma.courseBoardMembership.findUnique({ where: { userId_boardId: { userId: oldUser.id, boardId: seededBoard.id } } }))
      .resolves.toBeNull();

    const versions = createAdminVersionsModule();
    const context = (method: string, path: string[], body: Record<string, unknown> = {}) => ({
      method,
      path,
      request: { url: "http://localhost/api/admin/versions" } as any,
      body: async () => body,
      requireUser: async () => admin,
      requireAdmin: async () => admin,
      activeAppVersionId: async () => appVersion.id
    });
    const checkpointResponse = await versions(context("POST", ["admin", "versions", "checkpoints"], { label: `Checkpoint ${runId}`, reason: "integration" }));
    const checkpointJson = await checkpointResponse.json();
    expect(checkpointJson.checkpoint).toMatchObject({ label: `Checkpoint ${runId}`, kind: "manual" });
    expect(checkpointJson.checkpoint.chunks.length).toBeGreaterThan(0);

    const downloadResponse = await versions(context("GET", ["admin", "versions", "checkpoints", checkpointJson.checkpoint.id, "download"]));
    expect(downloadResponse.status).toBe(200);
    await expect(downloadResponse.json()).resolves.toMatchObject({ id: checkpointJson.checkpoint.id, chunks: expect.any(Array) });

    const restoreResponse = await versions(context("POST", ["admin", "versions", "checkpoints", checkpointJson.checkpoint.id, "restore-as-new-version"]));
    const restoreJson = await restoreResponse.json();
    expect(restoreJson.version).toMatchObject({ status: "active", notes: expect.stringContaining(checkpointJson.checkpoint.id) });
    expect(restoreJson.version.id).not.toBe(appVersion.id);
    expect(restoreJson.mappedCounts).toMatchObject({ schools: expect.any(Number), courses: expect.any(Number), users: expect.any(Number) });
  }, 120000);
});

describe.skipIf(canUseTestDatabase)("course import workflow DB contracts", () => {
  it("requires TEST_DATABASE_URL to be present and obviously isolated", () => {
    expect(canUseTestDatabase).toBe(false);
  });
});
