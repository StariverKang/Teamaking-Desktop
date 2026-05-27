import { getActiveAppVersionId } from "@/lib/app-version";
import { prisma } from "@/lib/prisma";
import { toJson } from "@/lib/server/json-utils";

export async function versionSnapshotChunks(appVersionId: string) {
  const [users, schools, importBatches, datasets, operationLogs, auditLogs, errorEvents, supportTickets, posts, teamUps, follows, configs] = await Promise.all([
    prisma.user.findMany({
      where: { appVersionId },
      include: {
        profile: true,
        contactInfo: true,
        skills: true,
        memberships: true,
        submittedCourses: true,
        portfolioItems: true
      },
      orderBy: { createdAt: "asc" }
    }),
    prisma.school.findMany({
      where: { appVersionId },
      include: {
        domains: true,
        faculties: true,
        majors: true,
        semesters: true,
        courses: {
          include: {
            mappings: true,
            curriculumRules: true,
            offerings: {
              include: {
                syllabusMetadata: true,
                boards: { include: { sections: true } }
              }
            }
          }
        },
        importBatches: true
      },
      orderBy: { createdAt: "asc" }
    }),
    prisma.courseImportBatch.findMany({ where: { appVersionId }, orderBy: { createdAt: "asc" } }),
    prisma.courseImportDataset.findMany({
      where: { appVersionId },
      include: { sourceRefs: true, faculties: true, majors: true, courses: true, rules: true, offerings: true },
      orderBy: { createdAt: "asc" }
    }),
    prisma.operationLog.findMany({ where: { appVersionId }, orderBy: { createdAt: "asc" }, take: 5000 }),
    prisma.adminAuditLog.findMany({ where: { appVersionId }, orderBy: { createdAt: "asc" }, take: 5000 }),
    prisma.errorEvent.findMany({ where: { appVersionId }, orderBy: { createdAt: "asc" }, take: 5000 }),
    prisma.supportTicket.findMany({ where: { submittedBy: { appVersionId } }, orderBy: { createdAt: "asc" } }),
    prisma.teamakingPost.findMany({ where: { user: { appVersionId } }, orderBy: { createdAt: "asc" } }),
    prisma.teamUpRequest.findMany({ where: { sender: { appVersionId } }, orderBy: { createdAt: "asc" } }),
    prisma.followRequest.findMany({ where: { sender: { appVersionId } }, orderBy: { createdAt: "asc" } }),
    prisma.siteConfig.findMany({ orderBy: { key: "asc" } })
  ]);
  return [
    { name: "users", data: users },
    { name: "schools_and_course_catalog", data: schools },
    { name: "course_import_batches", data: importBatches },
    { name: "course_import_datasets", data: datasets },
    { name: "teamaking_posts", data: posts },
    { name: "team_up_requests", data: teamUps },
    { name: "follow_requests", data: follows },
    { name: "support_tickets", data: supportTickets },
    { name: "site_configs", data: configs },
    { name: "operation_logs", data: operationLogs },
    { name: "admin_audit_logs", data: auditLogs },
    { name: "error_events", data: errorEvents }
  ];
}

export async function createVersionCheckpoint(input: {
  appVersionId?: string;
  label: string;
  kind?: string;
  reason?: string;
  triggeredByUserId?: string;
}) {
  const appVersionId = input.appVersionId ?? (await getActiveAppVersionId());
  const chunks = await versionSnapshotChunks(appVersionId);
  return prisma.versionCheckpoint.create({
    data: {
      appVersionId,
      label: input.label,
      kind: input.kind ?? "operation",
      reason: input.reason,
      triggeredByUserId: input.triggeredByUserId,
      summary: toJson(Object.fromEntries(chunks.map((chunk) => [chunk.name, Array.isArray(chunk.data) ? chunk.data.length : 0]))),
      chunks: {
        create: chunks.map((chunk) => ({
          name: chunk.name,
          rowCount: Array.isArray(chunk.data) ? chunk.data.length : 0,
          data: toJson(chunk.data)
        }))
      }
    },
    include: { chunks: true }
  });
}
