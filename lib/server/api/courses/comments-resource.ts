import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, assertString, created, ok, readBody } from "@/lib/http";
import { isAdminRole, requireUser } from "@/lib/session";
import { isDemoUser } from "@/lib/demo-data";
import { userInclude, publicUser } from "@/lib/server/services/user-service";
import { serializeCourseReviewComment, assertSameSchool } from "@/lib/server/services/course-service";
import { operationLog } from "@/lib/server/services/system-service";

export async function handleCourseCommentReplies(method: string, path: string[], request: NextRequest) {
  const user = await requireUser();
  const commentId = path[1];
  const action = path[2];
  if (!commentId) throw new ApiError(404, "缺少评论编号。");

  const parent = await prisma.courseReviewComment.findUnique({
    where: { id: commentId },
    include: { course: true }
  });
  if (!parent) throw new ApiError(404, "找不到这条评论。");
  if (!isDemoUser(user)) assertSameSchool(user, parent.course.schoolId);

  if (method === "POST" && action === "replies") {
    const body = await readBody(request);
    const text = assertString(body.body, "body").trim();
    if (!text) throw new ApiError(400, "回复内容不能为空。");
    if (text.length > 2000) throw new ApiError(400, "回复内容不能超过 2000 字。");
    if (isDemoUser(user)) {
      return created({
        comment: {
          id: `demo-reply-${Date.now()}`,
          courseId: parent.courseId,
          parentId: parent.id,
          userId: user.id,
          body: text,
          status: "active",
          user: publicUser(user),
          replies: [],
          createdAt: new Date()
        }
      });
    }
    const reply = await prisma.courseReviewComment.create({
      data: {
        courseId: parent.courseId,
        parentId: parent.id,
        userId: user.id,
        body: text
      },
      include: { user: { include: userInclude } }
    });
    await operationLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: "course_review.reply.create",
      targetType: "CourseReviewComment",
      targetId: reply.id,
      method,
      path: request.nextUrl.pathname,
      summary: { courseId: parent.courseId, parentId: parent.id }
    });
    return created({ comment: serializeCourseReviewComment(reply, new Map()) });
  }

  if (method === "DELETE" && !action) {
    const canDelete = parent.userId === user.id || isAdminRole(user.role);
    if (!canDelete) throw new ApiError(403, "只有评论者本人或管理员可以删除评论。");
    if (isDemoUser(user)) return ok({ message: "本地视觉演示模式已模拟删除课程评论。" });
    const deleted = await prisma.courseReviewComment.update({
      where: { id: commentId },
      data: {
        status: "deleted",
        deletedAt: new Date(),
        deletedByUserId: user.id
      }
    });
    await operationLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: "course_review.comment.delete",
      targetType: "CourseReviewComment",
      targetId: commentId,
      method,
      path: request.nextUrl.pathname,
      summary: { courseId: parent.courseId }
    });
    return ok({ comment: deleted, message: "评论已删除，楼层结构已保留。" });
  }

  throw new ApiError(404, "找不到课程评论接口。");
}
