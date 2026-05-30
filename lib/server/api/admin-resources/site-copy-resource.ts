import { NextRequest } from "next/server";
import { ApiError, ok, readBody } from "@/lib/http";
import {
  discardSiteCopyDraft,
  getAdminSiteCopyPayload,
  patchSiteCopyDraft,
  publishSiteCopyDraft,
  siteCopyChangesFromBody
} from "@/lib/server/services/site-copy-service";

export async function handleAdminSiteCopyResource(method: string, path: string[], request: NextRequest, admin: any) {
  const resource = path[1];
  const action = path[2];
  if (resource !== "site-copy") return null;

  if (method === "GET" && !action) {
    return ok(await getAdminSiteCopyPayload());
  }

  if (method === "PATCH" && action === "draft") {
    const body = await readBody(request);
    return ok({ ...(await patchSiteCopyDraft(admin, siteCopyChangesFromBody(body))), message: "界面文案草稿已保存。" });
  }

  if (method === "POST" && action === "publish") {
    return ok({ ...(await publishSiteCopyDraft(admin)), message: "界面文案草稿已发布。" });
  }

  if (method === "POST" && action === "discard") {
    return ok({ ...(await discardSiteCopyDraft(admin)), message: "界面文案草稿已丢弃。" });
  }

  throw new ApiError(404, "找不到界面文案管理接口。");
}
