import { getActiveAppVersion } from "@/lib/app-version";
import { operationLog } from "@/lib/server/audit";
import { assertString, optionalString } from "@/lib/http";

import { prisma } from "@/lib/prisma";
import { toJson } from "@/lib/server/json-utils";
import { createVersionCheckpoint } from "@/lib/server/admin/versions/checkpoint-service";

export function summarizeVersion(version: any) {
  const counts = version._count ?? {};
  return {
    id: version.id,
    name: version.name,
    phase: version.phase,
    status: version.status,
    notes: version.notes,
    startedAt: version.startedAt,
    endedAt: version.endedAt,
    createdAt: version.createdAt,
    updatedAt: version.updatedAt,
    counts: {
      users: counts.users ?? 0,
      schools: counts.schools ?? 0,
      importBatches: counts.importBatches ?? 0,
      importDatasets: counts.importDatasets ?? 0,
      checkpoints: counts.checkpoints ?? 0,
      operationLogs: counts.operationLogs ?? 0
    }
  };
}

export async function createAppVersionFromAdminRequest(body: Record<string, unknown>, admin: any) {
  const active = await getActiveAppVersion();
  const finalCheckpoint = await createVersionCheckpoint({
    appVersionId: active.id,
    label: `Final state of ${active.name}`,
    kind: "version_close",
    reason: optionalString(body.reason) ?? "Admin opened a new software/test version",
    triggeredByUserId: admin.id
  });

  await prisma.appVersion.update({
    where: { id: active.id },
    data: {
      status: "closed",
      endedAt: new Date(),
      finalCheckpointId: finalCheckpoint.id
    }
  });

  const version = await prisma.appVersion.create({
    data: {
      name: assertString(body.name, "name"),
      phase: optionalString(body.phase) ?? "testing",
      status: "active",
      notes: optionalString(body.notes),
      createdByUserId: admin.id
    }
  });

  const activeSchools = await prisma.school.findMany({
    where: { appVersionId: active.id },
    include: { domains: true }
  });
  const schoolIdMap = new Map<string, string>();
  for (const sourceSchool of activeSchools) {
    const school = await prisma.school.create({
      data: {
        appVersionId: version.id,
        name: sourceSchool.name,
        shortName: sourceSchool.shortName,
        status: sourceSchool.status,
        domains: {
          create: sourceSchool.domains.map((domain) => ({ domain: domain.domain, status: domain.status }))
        }
      }
    });
    schoolIdMap.set(sourceSchool.id, school.id);
  }

  const adminUsers = await prisma.user.findMany({
    where: {
      appVersionId: active.id,
      role: { in: ["school_admin", "super_admin"] }
    },
    include: { profile: true, contactInfo: true }
  });
  for (const sourceUser of adminUsers) {
    const user = await prisma.user.create({
      data: {
        appVersionId: version.id,
        email: sourceUser.email,
        schoolId: sourceUser.schoolId ? schoolIdMap.get(sourceUser.schoolId) ?? null : null,
        role: sourceUser.role,
        passwordHash: sourceUser.passwordHash,
        status: "active",
        isEmailVerified: sourceUser.isEmailVerified,
        onboardingCompleted: false
      }
    });
    if (sourceUser.profile) {
      await prisma.userProfile.create({
        data: {
          userId: user.id,
          displayName: sourceUser.profile.displayName,
          nickname: sourceUser.profile.nickname,
          avatarUrl: sourceUser.profile.avatarUrl,
          backgroundImageUrl: sourceUser.profile.backgroundImageUrl,
          headline: sourceUser.profile.headline,
          bio: sourceUser.profile.bio,
          outputTags: toJson(sourceUser.profile.outputTags ?? []),
          visibilitySettings: toJson(sourceUser.profile.visibilitySettings ?? {}),
          openToBeDiscovered: false
        }
      });
    }
    if (sourceUser.contactInfo) {
      await prisma.contactInfo.create({
        data: {
          userId: user.id,
          schoolEmail: user.email,
          visibilitySettings: toJson(sourceUser.contactInfo.visibilitySettings ?? {})
        }
      });
    }
  }

  await operationLog({
    appVersionId: version.id,
    actorUserId: adminUsers.find((row) => row.email === admin.email)?.id ?? null,
    actorRole: admin.role,
    action: "admin.versions.open",
    targetType: "AppVersion",
    targetId: version.id,
    summary: { previousVersionId: active.id, finalCheckpointId: finalCheckpoint.id }
  });

  return { version, finalCheckpoint, copiedAdmins: adminUsers.length, copiedSchools: activeSchools.length };
}
