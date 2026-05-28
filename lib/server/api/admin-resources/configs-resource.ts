import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, ok, optionalString, readBody } from "@/lib/http";
import { writeAudit } from "@/lib/server/services/system-service";
import { validateOnboardingGuideConfig } from "@/lib/onboarding-guide";

function configValueFromBody(id: string, value: unknown) {
  if (id === "onboarding_guide") {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    const validation = validateOnboardingGuideConfig(parsed);
    if (!validation.ok) {
      throw new ApiError(400, `onboarding_guide 配置无效：${validation.errors.join(" ")}`, undefined, { errors: validation.errors });
    }
    return validation.guide;
  }

  return value && typeof value === "object" ? (value as object) : { text: optionalString(value) ?? "" };
}

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
    let value: object;
    try {
      value = configValueFromBody(id, body.value);
    } catch (error) {
      if (error instanceof SyntaxError) throw new ApiError(400, "onboarding_guide 必须是合法 JSON。");
      throw error;
    }
    const config = await prisma.siteConfig.upsert({
      where: { key: id },
      update: {
        value,
        updatedByUserId: admin.id
      },
      create: {
        key: id,
        value,
        updatedByUserId: admin.id
      }
    });
    await writeAudit(admin.id, "admin.configs.patch", "SiteConfig", id, before, config);
    return ok({ config });
  }

  return null;
}
