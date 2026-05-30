import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/http";
import {
  changedSiteCopyKeys,
  mergeSiteCopyValues,
  normalizeSiteCopyValues,
  siteCopyDefaultValues,
  siteCopyEntries,
  siteCopyEntryMap,
  type SiteCopyValue,
  type SiteCopyValues
} from "@/lib/site-copy";
import { writeAudit } from "@/lib/server/services/system-service";

export const siteCopyDraftKey = "site_ui_copy_draft";
export const siteCopyPublishedKey = "site_ui_copy_published";

function siteCopyConfigValue(values: SiteCopyValues) {
  return {
    values,
    schemaVersion: "teamaking.site-ui-copy.v1"
  };
}

async function loadConfigValues(key: string) {
  const row = await prisma.siteConfig.findUnique({ where: { key } });
  return {
    row,
    values: normalizeSiteCopyValues(row?.value)
  };
}

function assertValidPatchValue(key: string, value: unknown) {
  const entry = siteCopyEntryMap.get(key);
  if (!entry) throw new ApiError(400, `未知界面文案字段：${key}`);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(400, `界面文案字段 ${key} 必须包含 zh/en 文本。`);
  }
  const next: SiteCopyValue = {};
  for (const locale of ["zh", "en"] as const) {
    const raw = (value as Record<string, unknown>)[locale];
    if (raw === undefined || raw === null) continue;
    if (typeof raw !== "string") throw new ApiError(400, `${key}.${locale} 必须是文本。`);
    const text = raw.trim();
    if (text.length > entry.maxLength) {
      throw new ApiError(400, `${key}.${locale} 不能超过 ${entry.maxLength} 个字符。`);
    }
    if (text) next[locale] = text;
  }
  return next;
}

export function siteCopyChangesFromBody(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiError(400, "缺少 changes 对象。");
  const rawChanges = (value as Record<string, unknown>).changes;
  if (!rawChanges || typeof rawChanges !== "object" || Array.isArray(rawChanges)) throw new ApiError(400, "缺少 changes 对象。");
  const changes: Record<string, SiteCopyValue> = {};
  for (const [key, rawValue] of Object.entries(rawChanges as Record<string, unknown>)) {
    changes[key] = assertValidPatchValue(key, rawValue);
  }
  return changes;
}

export async function getPublicSiteCopyPayload() {
  const published = await loadConfigValues(siteCopyPublishedKey);
  return {
    published: published.values,
    values: mergeSiteCopyValues(siteCopyDefaultValues, published.values),
    updatedAt: published.row?.updatedAt ?? null
  };
}

export async function getAdminSiteCopyPayload() {
  const [published, draft] = await Promise.all([
    loadConfigValues(siteCopyPublishedKey),
    loadConfigValues(siteCopyDraftKey)
  ]);
  const draftBase = draft.row ? draft.values : published.values;
  const mergedPublished = mergeSiteCopyValues(siteCopyDefaultValues, published.values);
  const mergedDraft = mergeSiteCopyValues(siteCopyDefaultValues, draftBase);
  return {
    entries: siteCopyEntries,
    published: published.values,
    draft: draftBase,
    values: mergedDraft,
    publishedValues: mergedPublished,
    hasDraft: Boolean(draft.row),
    changedKeys: changedSiteCopyKeys(mergedPublished, mergedDraft),
    updatedAt: draft.row?.updatedAt ?? published.row?.updatedAt ?? null,
    publishedAt: published.row?.updatedAt ?? null
  };
}

export async function patchSiteCopyDraft(admin: any, changes: Record<string, SiteCopyValue>) {
  const [published, draft] = await Promise.all([
    loadConfigValues(siteCopyPublishedKey),
    loadConfigValues(siteCopyDraftKey)
  ]);
  const before = draft.row;
  const nextDraft = {
    ...(draft.row ? draft.values : published.values)
  };

  for (const [key, value] of Object.entries(changes)) {
    if (!value.zh && !value.en) delete nextDraft[key];
    else nextDraft[key] = value;
  }

  const config = await prisma.siteConfig.upsert({
    where: { key: siteCopyDraftKey },
    update: {
      value: siteCopyConfigValue(nextDraft),
      updatedByUserId: admin.id
    },
    create: {
      key: siteCopyDraftKey,
      value: siteCopyConfigValue(nextDraft),
      updatedByUserId: admin.id
    }
  });

  await writeAudit(admin.id, "admin.site_copy.draft.patch", "SiteConfig", siteCopyDraftKey, before, config);
  return getAdminSiteCopyPayload();
}

export async function publishSiteCopyDraft(admin: any) {
  const [published, draft] = await Promise.all([
    loadConfigValues(siteCopyPublishedKey),
    loadConfigValues(siteCopyDraftKey)
  ]);
  const nextValues = draft.row ? draft.values : published.values;
  const before = published.row;
  const config = await prisma.siteConfig.upsert({
    where: { key: siteCopyPublishedKey },
    update: {
      value: siteCopyConfigValue(nextValues),
      updatedByUserId: admin.id
    },
    create: {
      key: siteCopyPublishedKey,
      value: siteCopyConfigValue(nextValues),
      updatedByUserId: admin.id
    }
  });
  await prisma.siteConfig.deleteMany({ where: { key: siteCopyDraftKey } });
  await writeAudit(admin.id, "admin.site_copy.publish", "SiteConfig", siteCopyPublishedKey, before, config);
  return getAdminSiteCopyPayload();
}

export async function discardSiteCopyDraft(admin: any) {
  const before = await prisma.siteConfig.findUnique({ where: { key: siteCopyDraftKey } });
  await prisma.siteConfig.deleteMany({ where: { key: siteCopyDraftKey } });
  await writeAudit(admin.id, "admin.site_copy.discard", "SiteConfig", siteCopyDraftKey, before, null);
  return getAdminSiteCopyPayload();
}
