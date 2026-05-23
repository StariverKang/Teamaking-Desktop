import { contactSnapshot, ContactViewerContext } from "@/lib/contact";
import { demoAccounts, DemoAccountKey, demoAdminData, demoBoardById, demoPeople, demoPosts, demoRequests, demoUserForAccount, normalizeDemoAccount } from "@/lib/demo-data";

type DemoState = {
  posts: any[];
  teamUpInterests: any[];
  followRequests: any[];
  supportTickets: any[];
};

const ACTIVE_INTEREST_STATUSES = new Set(["sent", "viewed", "mutual"]);

function accountFromUserId(userId?: string | null): DemoAccountKey {
  return normalizeDemoAccount(userId?.replace("demo-user-", ""));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function initialState(): DemoState {
  const adminData = demoAdminData("support-tickets") as any;
  return {
    posts: demoPosts(),
    teamUpInterests: demoRequests(),
    followRequests: [],
    supportTickets: adminData["support-tickets"] ?? []
  };
}

function globalState() {
  const key = "__teamaking_demo_state__";
  const globalObject = globalThis as any;
  if (!globalObject[key]) globalObject[key] = initialState();
  return globalObject[key] as DemoState;
}

export function resetDemoState() {
  const key = "__teamaking_demo_state__";
  (globalThis as any)[key] = initialState();
  return snapshotDemoState();
}

export function snapshotDemoState() {
  return clone(globalState());
}

export function demoContactContext(ownerId: string, viewerId?: string | null): ContactViewerContext {
  const state = globalState();
  const isOwner = ownerId === viewerId;
  const hasSentTeamUp = state.teamUpInterests.some((interest) => interest.senderId === viewerId && interest.receiverId === ownerId && ACTIVE_INTEREST_STATUSES.has(interest.status));
  const hasMutualTeamUp = state.teamUpInterests.some((interest) => {
    const samePair =
      (interest.senderId === viewerId && interest.receiverId === ownerId) ||
      (interest.senderId === ownerId && interest.receiverId === viewerId);
    return samePair && interest.status === "mutual";
  });
  const hasMutualFollow = state.followRequests.some((request) => {
    const samePair =
      (request.senderId === viewerId && request.receiverId === ownerId) ||
      (request.senderId === ownerId && request.receiverId === viewerId);
    return samePair && request.status === "accepted";
  });

  return {
    isOwner,
    isSameSchool: true,
    hasSentTeamUp,
    hasMutualTeamUp,
    hasMutualFollow
  };
}

export function sanitizeDemoUser(user: any, viewerId?: string | null) {
  const context = demoContactContext(user.id, viewerId);
  return {
    ...user,
    contactInfo: contactSnapshot(user.contactInfo, context),
    portfolioItems: (user.portfolioItems ?? []).filter((item: any) => Boolean(context?.isOwner) || item.visibility !== "private")
  };
}

export function demoPostsForBoard(boardId?: string, viewerId?: string | null) {
  const state = globalState();
  return state.posts
    .filter((post) => !boardId || post.boardId === boardId)
    .filter((post) => post.status === "open")
    .map((post) => sanitizeDemoPost(post, viewerId));
}

export function demoPostById(postId: string, viewerId?: string | null) {
  const state = globalState();
  const post = state.posts.find((item) => item.id === postId) ?? state.posts[0];
  return sanitizeDemoPost(post, viewerId);
}

export function sanitizeDemoPost(post: any, viewerId?: string | null) {
  const user = sanitizeDemoUser(post.user, viewerId);
  return {
    ...post,
    user,
    contactInfo: contactSnapshot(post.user?.contactInfo, demoContactContext(post.userId, viewerId)),
    portfolioEvidenceCount: Array.isArray(post.portfolioItemIds) ? post.portfolioItemIds.length : 0
  };
}

export function createDemoPost(boardId: string, user: any, body: any) {
  const state = globalState();
  const board = demoBoardById(boardId);
  const newPost = {
    ...demoPosts(boardId)[0],
    id: `demo-post-${Date.now()}`,
    boardId,
    userId: user.id,
    courseOfferingId: board.courseOfferingId,
    title: body.title,
    status: "open",
    strengths: Array.isArray(body.strengths) ? body.strengths : [],
    contributionTypes: Array.isArray(body.contributionTypes) ? body.contributionTypes : [],
    expectedOutcome: body.expectedOutcome,
    portfolioItemIds: Array.isArray(body.portfolioItemIds) ? body.portfolioItemIds : [],
    visibility: body.visibility ?? "same_course_board",
    user: demoUserForAccount(accountFromUserId(user.id)),
    board
  };
  state.posts.unshift(newPost);
  return sanitizeDemoPost(newPost, user.id);
}

export function createDemoTeamUpInterest(postId: string, sender: any, body: any) {
  const state = globalState();
  const post = state.posts.find((item) => item.id === postId) ?? demoPosts()[0];
  if (post.userId === sender.id) {
    return { error: "不能给自己的 Teamaking Post 发送 TeamUp Interest。" };
  }

  const existing = state.teamUpInterests.find((interest) => interest.postId === postId && interest.senderId === sender.id && interest.status !== "deleted");
  if (existing) return { interest: sanitizeDemoInterest(existing, sender.id), existing: true };

  const senderUser = demoUserForAccount(accountFromUserId(sender.id));
  const ownerUser = demoUserForAccount(accountFromUserId(post.userId));
  const interest = {
    id: `demo-interest-${Date.now()}`,
    postId,
    senderId: sender.id,
    receiverId: post.userId,
    message: body.message,
    senderContribution: body.senderContribution,
    senderContactSnapshot: contactSnapshot(senderUser.contactInfo, { isOwner: true, isSameSchool: true }),
    receiverContactSnapshot: contactSnapshot(ownerUser.contactInfo, demoContactContext(ownerUser.id, sender.id)),
    status: "sent",
    post,
    sender: senderUser,
    receiver: ownerUser,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  state.teamUpInterests.unshift(interest);
  return { interest: sanitizeDemoInterest(interest, sender.id), existing: false };
}

export function demoReceivedTeamUpInterests(userId: string) {
  const state = globalState();
  return state.teamUpInterests
    .filter((interest) => interest.receiverId === userId && interest.status !== "deleted")
    .map((interest) => sanitizeDemoInterest(interest, userId));
}

export function demoInterestsForPost(postId: string, viewer: any) {
  const state = globalState();
  const post = state.posts.find((item) => item.id === postId) ?? state.posts[0];
  const isOwner = post.userId === viewer.id;
  const interests = state.teamUpInterests.filter((interest) => interest.postId === postId && interest.status !== "deleted");
  if (isOwner) {
    for (const interest of interests) {
      if (interest.status === "sent") {
        interest.status = "viewed";
        interest.updatedAt = new Date().toISOString();
      }
    }
  }
  return interests.map((interest) => sanitizeDemoInterest(interest, viewer.id));
}

export function updateDemoInterest(id: string, user: any, action: "mutual" | "refuse" | "withdraw" | "report") {
  const state = globalState();
  const interest = state.teamUpInterests.find((item) => item.id === id);
  if (!interest) return { error: "找不到这个 TeamUp Interest。" };
  if (action === "withdraw" && interest.senderId !== user.id) return { error: "只有发出者可以撤回。" };
  if ((action === "mutual" || action === "refuse") && interest.receiverId !== user.id) return { error: "只有 Post 发起者可以处理这个 TeamUp Interest。" };

  interest.status = action === "mutual" ? "mutual" : action === "refuse" ? "refused" : action === "withdraw" ? "withdrawn" : "reported";
  interest.updatedAt = new Date().toISOString();
  return { interest: sanitizeDemoInterest(interest, user.id) };
}

export function sanitizeDemoInterest(interest: any, viewerId?: string | null) {
  const sender = sanitizeDemoUser({ ...demoUserForAccount(accountFromUserId(interest.senderId)), portfolioItems: interest.sender?.portfolioItems ?? [] }, viewerId);
  const receiver = sanitizeDemoUser(demoUserForAccount(accountFromUserId(interest.receiverId)), viewerId);
  const post = sanitizeDemoPost(interest.post ?? demoPostById(interest.postId), viewerId);
  return {
    ...interest,
    post,
    sender,
    receiver,
    senderContactSnapshot: contactSnapshot(demoUserForAccount(accountFromUserId(interest.senderId)).contactInfo, demoContactContext(interest.senderId, viewerId)),
    receiverContactSnapshot: contactSnapshot(demoUserForAccount(accountFromUserId(interest.receiverId)).contactInfo, demoContactContext(interest.receiverId, viewerId))
  };
}

export function demoFollowInbox(userId: string) {
  return globalState().followRequests
    .filter((request) => request.receiverId === userId && request.status === "pending")
    .map((request) => sanitizeDemoFollowRequest(request, userId));
}

export function createDemoFollowRequest(sender: any, receiverId: string) {
  const state = globalState();
  if (sender.id === receiverId) return { error: "不能关注自己。" };
  const existing = state.followRequests.find((request) => request.senderId === sender.id && request.receiverId === receiverId && request.status !== "withdrawn");
  if (existing) return { request: sanitizeDemoFollowRequest(existing, sender.id), existing: true };
  const request = {
    id: `demo-follow-${Date.now()}`,
    senderId: sender.id,
    receiverId,
    status: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  state.followRequests.unshift(request);
  return { request: sanitizeDemoFollowRequest(request, sender.id), existing: false };
}

export function updateDemoFollowRequest(id: string, user: any, action: "accept" | "refuse" | "withdraw") {
  const request = globalState().followRequests.find((item) => item.id === id);
  if (!request) return { error: "找不到这个关注申请。" };
  if (action === "withdraw" && request.senderId !== user.id) return { error: "只有发出者可以撤回关注申请。" };
  if ((action === "accept" || action === "refuse") && request.receiverId !== user.id) return { error: "只有接收者可以处理关注申请。" };
  request.status = action === "accept" ? "accepted" : action === "refuse" ? "refused" : "withdrawn";
  request.updatedAt = new Date().toISOString();
  return { request: sanitizeDemoFollowRequest(request, user.id) };
}

function sanitizeDemoFollowRequest(request: any, viewerId?: string | null) {
  return {
    ...request,
    sender: sanitizeDemoUser(demoUserForAccount(accountFromUserId(request.senderId)), viewerId),
    receiver: sanitizeDemoUser(demoUserForAccount(accountFromUserId(request.receiverId)), viewerId)
  };
}

export function demoAdminResource(resource?: string) {
  const state = globalState();
  if (resource === "team-up-requests") return { "team-up-requests": state.teamUpInterests.map((interest) => sanitizeDemoInterest(interest, "demo-user-admin")) };
  if (resource === "support-tickets") return { "support-tickets": state.supportTickets };
  if (resource === "teamaking-posts") return { "teamaking-posts": state.posts.map((post) => sanitizeDemoPost(post, "demo-user-admin")) };
  if (resource === "follow-requests") return { "follow-requests": state.followRequests.map((request) => sanitizeDemoFollowRequest(request, "demo-user-admin")) };
  return demoAdminData(resource);
}

export const demoAccountEmails = Object.values(demoAccounts).map((account) => account.email);
