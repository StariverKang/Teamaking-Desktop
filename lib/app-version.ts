import { prisma } from "@/lib/prisma";

export const LEGACY_APP_VERSION_ID = "legacy";

export async function getActiveAppVersion() {
  const active = await prisma.appVersion.findFirst({
    where: { status: "active" },
    orderBy: { startedAt: "desc" }
  });
  if (active) return active;

  return prisma.appVersion.upsert({
    where: { id: LEGACY_APP_VERSION_ID },
    update: { status: "active" },
    create: {
      id: LEGACY_APP_VERSION_ID,
      name: "Legacy Initial Version",
      phase: "testing",
      status: "active"
    }
  });
}

export async function getActiveAppVersionId() {
  return (await getActiveAppVersion()).id;
}

export async function getActiveSchool(shortName: string) {
  const appVersionId = await getActiveAppVersionId();
  return prisma.school.findUnique({
    where: { appVersionId_shortName: { appVersionId, shortName } }
  });
}
