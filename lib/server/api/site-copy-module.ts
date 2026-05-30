import { ApiError, ok } from "@/lib/http";
import { getPublicSiteCopyPayload } from "@/lib/server/services/site-copy-service";

export async function handleSiteCopy(method: string) {
  if (method !== "GET") throw new ApiError(405, "界面文案接口不支持当前请求方式。");
  return ok(await getPublicSiteCopyPayload());
}
