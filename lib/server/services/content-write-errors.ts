import { ApiError } from "@/lib/http";
import { ERROR_CODES } from "@/lib/error-codes";

export function contentWriteApiError(error: unknown) {
  const code = prismaCode(error);
  if (code === "P2002") {
    return new ApiError(409, "这个内容 slug 已经存在。请换一个 slug，或在左侧选择已有内容后更新。");
  }
  if (code === "P2003") {
    return new ApiError(400, "父级文件夹不存在或不属于当前内容类型。请先创建父级文件夹，再创建子文档。");
  }
  if (code === "P2021" || code === "P2022") {
    return new ApiError(
      500,
      "内容文档表结构和当前代码不一致。请在部署环境执行 npm run prisma:migrate:deploy 后重试。",
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      { prismaCode: code }
    );
  }
  return null;
}

function prismaCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return "";
  return String((error as { code?: unknown }).code ?? "");
}
