import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";import { ApiError, assertString, ok, optionalString, readBody } from "@/lib/http";
import { writeAudit } from "@/lib/server/services/system-service";

export async function handleAdminCourseSubmissionsResource(method: string, path: string[], request: NextRequest, admin: any) {
  const resource = path[1];
  const id = path[2];
  const action = path[3];

  if (method === "GET" && resource === "course-submissions") {
    const submissions = await prisma.userSubmittedCourse.findMany({
      include: { submittedBy: { include: { profile: true } }, school: true },
      orderBy: { createdAt: "desc" }
    });
    return ok({ submissions });
  }

  if (method === "POST" && resource === "course-submissions" && id && ["approve", "reject", "merge"].includes(action ?? "")) {
    const submission = await prisma.userSubmittedCourse.findUnique({ where: { id } });
    if (!submission) throw new ApiError(404, "找不到课程提交记录。");

    if (action === "reject") {
      const body = await readBody(request);
      const updated = await prisma.userSubmittedCourse.update({
        where: { id },
        data: { status: "rejected", adminNote: optionalString(body.adminNote) }
      });
      await writeAudit(admin.id, "admin.course_submissions.reject", "UserSubmittedCourse", id, submission, updated);
      return ok({ submission: updated });
    }

    if (action === "merge") {
      const body = await readBody(request);
      const updated = await prisma.userSubmittedCourse.update({
        where: { id },
        data: {
          status: "merged",
          matchedCourseId: assertString(body.matchedCourseId, "matchedCourseId"),
          adminNote: optionalString(body.adminNote)
        }
      });
      await writeAudit(admin.id, "admin.course_submissions.merge", "UserSubmittedCourse", id, submission, updated);
      return ok({ submission: updated });
    }

    const currentSemester = await prisma.semester.findFirst({ where: { schoolId: submission.schoolId, isCurrent: true } });
    const course = await prisma.course.upsert({
      where: { schoolId_code: { schoolId: submission.schoolId, code: submission.code } },
      update: { title: submission.title, status: "active" },
      create: {
        schoolId: submission.schoolId,
        code: submission.code,
        title: submission.title,
        source: "user_submission"
      }
    });

    if (currentSemester) {
      const offering = await prisma.courseOffering.create({
        data: {
          courseId: course.id,
          semesterId: currentSemester.id,
          teacherName: submission.teacherName,
          section: "User Submitted"
        }
      });
      await prisma.courseBoard.create({
        data: {
          courseOfferingId: offering.id,
          title: `${submission.code} ${submission.title}`
        }
      });
    }

    const updated = await prisma.userSubmittedCourse.update({
      where: { id },
      data: { status: "approved", matchedCourseId: course.id }
    });
    await writeAudit(admin.id, "admin.course_submissions.approve", "UserSubmittedCourse", id, submission, updated);
    return ok({ submission: updated, course });
  }

  return null;
}
