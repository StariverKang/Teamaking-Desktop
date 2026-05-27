import { NextRequest } from "next/server";
import { handleApplicationApiRoute } from "@/lib/server/api/application-module";

type RouteContext = {
  params: Promise<{
    route?: string[];
  }>;
};

export const runtime = "nodejs";

async function routeOf(context: RouteContext) {
  const params = await context.params;
  return params.route ?? [];
}

async function dispatch(method: string, request: NextRequest, context: RouteContext) {
  return handleApplicationApiRoute(method, await routeOf(context), request);
}

export async function GET(request: NextRequest, context: RouteContext) {
  return dispatch("GET", request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return dispatch("POST", request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return dispatch("PATCH", request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return dispatch("DELETE", request, context);
}
