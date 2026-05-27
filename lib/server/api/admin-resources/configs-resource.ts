import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, optionalString, readBody } from "@/lib/http";
import { writeAudit } from "@/lib/server/services/system-service";

export async function handleAdminConfigsResource(method: string, path: string[], request: NextRequest, admin: any) {
  const resource = path[1];
  const id = path[2];

  if (method === "GET" && resource === "configs") {
    const configs = await prisma.siteConfig.findMany({ orderBy: { key: "asc" } });
    return ok({ configs });
  }

  if (method === "PATCH" && resource === "configs" && id) {
    const body = await readBody(request);
    const before = await prisma.siteConfig.findUnique({ where: { key: id } });
    const config = await prisma.siteConfig.upsert({
      where: { key: id },
      update: {
        value: body.value && typeof body.value === "object" ? (body.value as object) : { text: optionalString(body.value) ?? "" },
        updatedByUserId: admin.id
      },
      create: {
        key: id,
        value: body.value && typeof body.value === "object" ? (body.value as object) : { text: optionalString(body.value) ?? "" },
        updatedByUserId: admin.id
      }
    });
    await writeAudit(admin.id, "admin.configs.patch", "SiteConfig", id, before, config);
    return ok({ config });
  }

  return null;
}
