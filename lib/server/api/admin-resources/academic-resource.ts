import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertString, created, ok, optionalString, readBody, stringArray } from "@/lib/http";
import { getActiveAppVersionId } from "@/lib/app-version";
import { writeAudit } from "@/lib/server/services/system-service";

export async function handleAdminAcademicResource(method: string, path: string[], request: NextRequest, admin: any) {
  const resource = path[1];
  const id = path[2];

  if (method === "GET" && resource === "schools") {
    const appVersionId = await getActiveAppVersionId();
    const schools = await prisma.school.findMany({ where: { appVersionId }, include: { domains: true, faculties: true, majors: true }, orderBy: { createdAt: "desc" } });
    return ok({ schools });
  }

  if (method === "POST" && resource === "schools") {
    const body = await readBody(request);
    const appVersionId = await getActiveAppVersionId();
    const school = await prisma.school.create({
      data: {
        appVersionId,
        name: assertString(body.name, "name"),
        shortName: assertString(body.shortName, "shortName"),
        status: optionalString(body.status) ?? "active",
        domains: {
          create: stringArray(body.domains).map((domain) => ({ domain, status: "active" }))
        }
      },
      include: { domains: true }
    });
    await writeAudit(admin.id, "admin.schools.create", "School", school.id, null, school);
    return created({ school });
  }

  if (method === "PATCH" && resource === "schools" && id) {
    const body = await readBody(request);
    const before = await prisma.school.findUnique({ where: { id }, include: { domains: true } });
    const school = await prisma.school.update({
      where: { id },
      data: {
        name: optionalString(body.name) ?? before?.name,
        shortName: optionalString(body.shortName) ?? before?.shortName,
        status: optionalString(body.status) ?? before?.status
      },
      include: { domains: true }
    });
    await writeAudit(admin.id, "admin.schools.patch", "School", id, before, school);
    return ok({ school });
  }

  if (method === "GET" && resource === "majors") {
    const appVersionId = await getActiveAppVersionId();
    const [schools, faculties, majors, semesters] = await Promise.all([
      prisma.school.findMany({ where: { appVersionId }, orderBy: { shortName: "asc" } }),
      prisma.faculty.findMany({ where: { school: { appVersionId } }, include: { school: true }, orderBy: { name: "asc" } }),
      prisma.major.findMany({ where: { school: { appVersionId } }, include: { school: true, faculty: true }, orderBy: { name: "asc" } }),
      prisma.semester.findMany({ where: { school: { appVersionId } }, include: { school: true }, orderBy: [{ year: "desc" }, { name: "asc" }] })
    ]);
    return ok({ schools, faculties, majors, semesters });
  }

  if (method === "POST" && resource === "majors") {
    const body = await readBody(request);
    const type = optionalString(body.type) ?? "major";
    if (type === "faculty") {
      const faculty = await prisma.faculty.create({
        data: { schoolId: assertString(body.schoolId, "schoolId"), name: assertString(body.name, "name") }
      });
      await writeAudit(admin.id, "admin.faculties.create", "Faculty", faculty.id, null, faculty);
      return created({ faculty });
    }
    if (type === "semester") {
      const semester = await prisma.semester.create({
        data: {
          schoolId: assertString(body.schoolId, "schoolId"),
          name: assertString(body.name, "name"),
          year: Number(body.year),
          term: assertString(body.term, "term"),
          isCurrent: Boolean(body.isCurrent)
        }
      });
      await writeAudit(admin.id, "admin.semesters.create", "Semester", semester.id, null, semester);
      return created({ semester });
    }

    const major = await prisma.major.create({
      data: {
        schoolId: assertString(body.schoolId, "schoolId"),
        facultyId: assertString(body.facultyId, "facultyId"),
        name: assertString(body.name, "name"),
        degreeType: optionalString(body.degreeType) ?? "undergraduate"
      }
    });
    await writeAudit(admin.id, "admin.majors.create", "Major", major.id, null, major);
    return created({ major });
  }

  return null;
}
