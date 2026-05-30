import { NextRequest } from "next/server";
import { createApiContext } from "@/lib/server/api-context";
import { createApiModuleRegistry } from "@/lib/server/api-module-registry";
import { apiModuleRegistry } from "@/lib/server/services/api-registry";
import { ensureSystemIsActive, persistErrorEvent } from "@/lib/server/services/system-service";
import { handleAdmin, handleDemoAdmin } from "@/lib/server/api/admin-resources-module";
import { handleAuth, handleDemo, handleOnboarding } from "@/lib/server/api/auth-module";
import { handleAnnouncements, handleContent, handleSupportTickets } from "@/lib/server/api/content-module";
import { handleSiteCopy } from "@/lib/server/api/site-copy-module";
import { handleBoards, handleCourseCommentReplies, handleCourses } from "@/lib/server/api/courses-module";
import { handleContactInfo, handleProfile, handleUploads } from "@/lib/server/api/profile-module";
import { handleFollowRequests, handleFriends, handleMatches, handleNotifications, handleTeamakingPosts, handleTeamUpInterests, handleTeamUpRequests } from "@/lib/server/api/social-module";
import { ApiError, handleApi } from "@/lib/http";

const applicationApiModuleRegistry = createApiModuleRegistry([
  { name: "auth", matches: (context) => context.path[0] === "auth", handler: (context) => handleAuth(context.method, context.path, context.request) },
  { name: "demo", matches: (context) => context.path[0] === "demo", handler: (context) => handleDemo(context.method, context.path, context.request) },
  { name: "onboarding", matches: (context) => context.path[0] === "onboarding", handler: (context) => handleOnboarding(context.method, context.path, context.request) },
  { name: "profile", matches: (context) => context.path[0] === "profile", handler: (context) => handleProfile(context.method, context.path, context.request) },
  { name: "contact-info/me", matches: (context) => context.path[0] === "contact-info" && context.path[1] === "me", handler: (context) => handleContactInfo(context.method, context.request) },
  { name: "friends", matches: (context) => context.path[0] === "friends", handler: (context) => handleFriends(context.method, context.request) },
  { name: "notifications/summary", matches: (context) => context.path[0] === "notifications" && context.path[1] === "summary", handler: (context) => handleNotifications(context.method) },
  { name: "content", matches: (context) => context.path[0] === "content", handler: (context) => handleContent(context.method, context.request) },
  { name: "site-copy", matches: (context) => context.path[0] === "site-copy", handler: (context) => handleSiteCopy(context.method) },
  { name: "courses", matches: (context) => context.path[0] === "courses", handler: (context) => handleCourses(context.method, context.path, context.request) },
  { name: "course-comments", matches: (context) => context.path[0] === "course-comments", handler: (context) => handleCourseCommentReplies(context.method, context.path, context.request) },
  { name: "boards", matches: (context) => context.path[0] === "boards", handler: (context) => handleBoards(context.method, context.path, context.request) },
  { name: "teamaking-posts", matches: (context) => context.path[0] === "teamaking-posts", handler: (context) => handleTeamakingPosts(context.method, context.path, context.request) },
  { name: "team-up-interests", matches: (context) => context.path[0] === "team-up-interests", handler: (context) => handleTeamUpInterests(context.method, context.path) },
  { name: "team-up-requests", matches: (context) => context.path[0] === "team-up-requests", handler: (context) => handleTeamUpRequests(context.method, context.path, context.request) },
  { name: "follow-requests", matches: (context) => context.path[0] === "follow-requests", handler: (context) => handleFollowRequests(context.method, context.path) },
  { name: "support-tickets", matches: (context) => context.path[0] === "support-tickets", handler: (context) => handleSupportTickets(context.method, context.request) },
  { name: "announcements", matches: (context) => context.path[0] === "announcements", handler: (context) => handleAnnouncements(context.method, context.path) },
  { name: "uploads", matches: (context) => context.path[0] === "uploads", handler: (context) => handleUploads(context.method, context.request) },
  { name: "matches", matches: (context) => context.path[0] === "matches" && context.method === "GET", handler: (context) => handleMatches(context.request) },
  {
    name: "admin",
    matches: (context) => context.path[0] === "admin",
    handler: async (context) => (await handleDemoAdmin(context)) ?? handleAdmin(context.method, context.path, context.request)
  }
]);

async function dispatch(method: string, path: string[], request: NextRequest) {
  const root = path[0];
  const apiContext = createApiContext({ method, path, request });

  await ensureSystemIsActive(root);

  const moduleHandler = apiModuleRegistry.resolve(apiContext) ?? applicationApiModuleRegistry.resolve(apiContext);
  if (moduleHandler) return moduleHandler(apiContext);

  throw new ApiError(404, "找不到这个 API 路径。");
}

export async function handleApplicationApiRoute(method: string, path: string[], request: NextRequest) {
  return handleApi(() => dispatch(method, path, request), { request, onError: (error) => persistErrorEvent(request, error) });
}
