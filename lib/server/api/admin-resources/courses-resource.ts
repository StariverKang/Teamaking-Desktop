import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, assertString, created, ok, optionalString, readBody, stringArray } from "@/lib/http";
import { ERROR_CODES } from "@/lib/error-codes";import { getActiveSchool } from "@/lib/app-version";
import { courseInclude, serializeAdminCourse, mergeCourses } from "@/lib/server/services/course-service";
import { toJson, writeAudit } from "@/lib/server/services/system-service";
import { textValues, numberValue, parseCommaText, parseJsonObject } from "@/lib/server/services/json-service";

export async function handleAdminCoursesResource(method: string, path: string[], request: NextRequest, admin: any) {
  const resource = path[1];
  const id = path[2];
  const action = path[3];

  if (method === "GET" && resource === "courses") {
    const url = new URL(request.url);
    const query = optionalString(url.searchParams.get("query")) ?? "";
    const requestedStatus = optionalString(url.searchParams.get("status")) ?? "all";
    const requestedSource = optionalString(url.searchParams.get("source")) ?? "all";
    const requestedTag = optionalString(url.searchParams.get("tag")) ?? "";
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(10, Number(url.searchParams.get("pageSize") ?? 25) || 25));
    const school = await getActiveSchool("BNBU");
    const where: any = {
      ...(school ? { schoolId: school.id } : {}),
      ...(requestedStatus !== "all" ? { status: requestedStatus } : {}),
      ...(requestedSource !== "all" ? { source: requestedSource } : {}),
      ...(query
        ? {
            OR: [
              { code: { contains: query, mode: "insensitive" } },
              { title: { contains: query, mode: "insensitive" } },
              { description: { contains: query, mode: "insensitive" } }
            ]
          }
        : {})
    };
    const [allMatching, semesters] = await Promise.all([
    prisma.course.findMany({
      where,
      include: {
        ...courseInclude,
        curriculumRules: {
          where: { status: "active" },
          include: { semester: true },
          orderBy: { updatedAt: "desc" },
          take: 200
        },
        _count: { select: { curriculumRules: true, offerings: true } }
      },
      orderBy: { code: "asc" }
    }),
    prisma.semester.findMany({
      where: school ? { schoolId: school.id } : {},
      orderBy: [{ year: "desc" }, { term: "asc" }]
    })
    ]);
    const tag = requestedTag.trim().toLowerCase();
    const filtered = tag
      ? allMatching.filter((course) => textValues(course.categoryTags).some((item) => item.toLowerCase().includes(tag)))
      : allMatching;
    const total = filtered.length;
    const courses = filtered.slice((page - 1) * pageSize, page * pageSize).map(serializeAdminCourse);
    const sources = [...new Set(allMatching.map((course) => course.source).filter(Boolean))].sort();
    const tags = [...new Set(allMatching.flatMap((course) => textValues(course.categoryTags)))].sort();
    return ok({ courses, semesters, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) }, filters: { sources, tags } });
  }

  if (method === "POST" && resource === "courses") {
    const body = await readBody(request);
    const schoolId = optionalString(body.schoolId) ?? (await getActiveSchool("BNBU"))?.id;
    if (!schoolId) throw new ApiError(400, "找不到 BNBU 学校记录，无法新增课程。");
    const code = assertString(body.code, "code").trim().toUpperCase();
    const existing = await prisma.course.findUnique({ where: { schoolId_code: { schoolId, code } } });
    if (existing) throw new ApiError(409, `${code} 已存在；同一学校下课程代码必须唯一。`);
    const course = await prisma.course.create({
      data: {
        schoolId,
        code,
        title: assertString(body.title, "title"),
        description: optionalString(body.description) ?? "",
        credits: numberValue(body.credits),
        ownerUnit: toJson(parseJsonObject(body.ownerUnit)),
        categoryTags: parseCommaText(body.categoryTags),
        courseType: optionalString(body.courseType) ?? "coursework",
        status: optionalString(body.status) ?? "active",
        source: "admin",
        manualOverrideFields: ["title", "description", "credits", "ownerUnit", "categoryTags", "courseType", "status"],
        manualNote: optionalString(body.manualNote)
      }
    });
    const semesterId = optionalString(body.semesterId);
    const offering = semesterId
      ? await prisma.courseOffering.create({
          data: {
            courseId: course.id,
            semesterId,
            teacherName: optionalString(body.teacherName),
            section: optionalString(body.section)
          }
        })
      : null;
    const board =
      offering && body.createBoard !== false
        ? await prisma.courseBoard.create({
            data: {
              courseOfferingId: offering.id,
              title: optionalString(body.boardTitle) ?? `${course.code} ${course.title}`,
              rules: optionalString(body.boardRules) ?? undefined
            }
          })
        : null;
    await writeAudit(admin.id, "admin.courses.create", "Course", course.id, null, { course, offering, board });
    return created({ course: serializeAdminCourse({ ...course, curriculumRules: [], offerings: [], mappings: [], _count: { curriculumRules: 0, offerings: 0 } }), offering, board });
  }

  if (method === "PATCH" && resource === "courses" && id) {
    const body = await readBody(request);
    const before = await prisma.course.findUnique({ where: { id } });
    if (!before) throw new ApiError(404, "找不到这门课程。");
    const editableFields = ["code", "title", "description", "credits", "ownerUnit", "categoryTags", "courseType", "status"];
    const changedFields = editableFields.filter((field) => Object.prototype.hasOwnProperty.call(body, field));
    const overrideFields = [...new Set([...textValues(before.manualOverrideFields), ...changedFields.filter((field) => field !== "code")])];
    const nextCode = optionalString(body.code)?.trim().toUpperCase();
    if (nextCode && nextCode !== before.code) {
      const duplicate = await prisma.course.findUnique({ where: { schoolId_code: { schoolId: before.schoolId, code: nextCode } } });
      if (duplicate) throw new ApiError(409, `${nextCode} 已存在；同一学校下课程代码必须唯一。`);
    }
    const course = await prisma.course.update({
      where: { id },
      data: {
        code: nextCode ?? before.code,
        title: optionalString(body.title) ?? before.title,
        description: optionalString(body.description) ?? before.description,
        credits: Object.prototype.hasOwnProperty.call(body, "credits") ? numberValue(body.credits) : before.credits,
        ownerUnit: Object.prototype.hasOwnProperty.call(body, "ownerUnit") ? toJson(parseJsonObject(body.ownerUnit)) : before.ownerUnit,
        categoryTags: Object.prototype.hasOwnProperty.call(body, "categoryTags") ? parseCommaText(body.categoryTags) : textValues(before.categoryTags),
        courseType: optionalString(body.courseType) ?? before.courseType,
        status: optionalString(body.status) ?? before.status,
        manualOverrideFields: overrideFields,
        manualNote: optionalString(body.manualNote) ?? before.manualNote
      },
      include: {
        ...courseInclude,
        curriculumRules: { where: { status: "active" }, include: { semester: true }, orderBy: { updatedAt: "desc" }, take: 200 },
        _count: { select: { curriculumRules: true, offerings: true } }
      }
    });
    await writeAudit(admin.id, "admin.courses.patch", "Course", id, before, course);
    return ok({ course: serializeAdminCourse(course) });
  }

  if (method === "POST" && resource === "courses" && id && action === "offerings") {
    const body = await readBody(request);
    const course = await prisma.course.findUnique({ where: { id } });
    if (!course) throw new ApiError(404, "找不到这门课程。");
    const semesterId = assertString(body.semesterId, "semesterId");
    const semester = await prisma.semester.findUnique({ where: { id: semesterId } });
    if (!semester || semester.schoolId !== course.schoolId) {
      throw new ApiError(400, "开课学期和课程不属于同一学校。", ERROR_CODES.COURSE_OFFERING_INVALID, { courseId: id, semesterId });
    }
    const existing = await prisma.courseOffering.findFirst({
      where: {
        courseId: course.id,
        semesterId,
        section: optionalString(body.section) ?? null
      }
    });
    const offering = existing
      ? await prisma.courseOffering.update({
          where: { id: existing.id },
          data: {
            teacherName: optionalString(body.teacherName) ?? existing.teacherName,
            status: optionalString(body.status) ?? existing.status,
            sourceRefIds: Array.isArray(body.sourceRefIds) ? stringArray(body.sourceRefIds) : toJson(existing.sourceRefIds ?? [])
          },
          include: { course: true, semester: true, boards: true }
        })
      : await prisma.courseOffering.create({
          data: {
            courseId: course.id,
            semesterId,
            teacherName: optionalString(body.teacherName),
            section: optionalString(body.section),
            status: optionalString(body.status) ?? "active",
            sourceRefIds: Array.isArray(body.sourceRefIds) ? stringArray(body.sourceRefIds) : []
          },
          include: { course: true, semester: true, boards: true }
        });
    let board = null;
    if (body.createBoard !== false) {
      board = await prisma.courseBoard.findFirst({ where: { courseOfferingId: offering.id, status: "active" } });
      if (!board) {
        board = await prisma.courseBoard.create({
          data: {
            courseOfferingId: offering.id,
            title: optionalString(body.boardTitle) ?? `${course.code} ${course.title}`,
            rules: optionalString(body.boardRules) ?? undefined,
            status: "active"
          }
        });
      }
    }
    await writeAudit(admin.id, "admin.course_offerings.create", "CourseOffering", offering.id, null, { offering, board });
    return created({ offering, board, reused: Boolean(existing) });
  }

  if (method === "PATCH" && resource === "course-offerings" && id) {
    const body = await readBody(request);
    const before = await prisma.courseOffering.findUnique({ where: { id }, include: { course: true, semester: true, boards: true } });
    if (!before) throw new ApiError(404, "找不到这个开课配置。");
    const semesterId = optionalString(body.semesterId);
    if (semesterId) {
      const semester = await prisma.semester.findUnique({ where: { id: semesterId } });
      if (!semester || semester.schoolId !== before.course.schoolId) {
        throw new ApiError(400, "开课学期和课程不属于同一学校。", ERROR_CODES.COURSE_OFFERING_INVALID, { offeringId: id, semesterId });
      }
    }
    const offering = await prisma.courseOffering.update({
      where: { id },
      data: {
        semesterId: semesterId ?? before.semesterId,
        teacherName: optionalString(body.teacherName) ?? before.teacherName,
        section: Object.prototype.hasOwnProperty.call(body, "section") ? optionalString(body.section) ?? null : before.section,
        status: optionalString(body.status) ?? before.status,
        sourceRefIds: Array.isArray(body.sourceRefIds) ? stringArray(body.sourceRefIds) : toJson(before.sourceRefIds ?? [])
      },
      include: { course: true, semester: true, boards: true }
    });
    await writeAudit(admin.id, "admin.course_offerings.patch", "CourseOffering", id, before, offering);
    return ok({ offering });
  }

  if (method === "POST" && resource === "courses" && id && action === "merge") {
    const body = await readBody(request);
    const result = await mergeCourses(id, assertString(body.targetCourseId, "targetCourseId"), admin.id, optionalString(body.adminNote));
    return ok({ result, message: `课程已合并：${result.source.code} -> ${result.target.code}` });
  }

  return null;
}
