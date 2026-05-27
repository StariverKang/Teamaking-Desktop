import { NextRequest, NextResponse } from "next/server";
import { getActiveAppVersionId } from "@/lib/app-version";
import { readBody } from "@/lib/http";
import { requireAdmin, requireUser } from "@/lib/session";

export type ApiContext = {
  method: string;
  path: string[];
  request: NextRequest;
  body: () => Promise<Record<string, unknown>>;
  requireUser: () => Promise<any>;
  requireAdmin: () => Promise<any>;
  activeAppVersionId: () => Promise<string>;
};

export type ApiModuleHandler = (context: ApiContext) => Promise<NextResponse>;

export function createApiContext(input: Pick<ApiContext, "method" | "path" | "request">): ApiContext {
  let bodyPromise: Promise<Record<string, unknown>> | null = null;
  let userPromise: Promise<any> | null = null;
  let adminPromise: Promise<any> | null = null;
  let appVersionIdPromise: Promise<string> | null = null;

  return {
    ...input,
    body: () => {
      bodyPromise ??= readBody(input.request);
      return bodyPromise;
    },
    requireUser: () => {
      userPromise ??= requireUser();
      return userPromise;
    },
    requireAdmin: () => {
      adminPromise ??= requireAdmin();
      return adminPromise;
    },
    activeAppVersionId: () => {
      appVersionIdPromise ??= getActiveAppVersionId();
      return appVersionIdPromise;
    }
  };
}
