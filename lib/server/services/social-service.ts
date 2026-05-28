
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/session";
import { contactSnapshot } from "@/lib/contact";
import { courseBoardParticipationSources } from "@/lib/course-board-participation";

import { listFromJson, publicUser } from "@/lib/server/services/user-service";

export function enrichPost(post: any) {
  const portfolioIds = listFromJson(post.portfolioItemIds);

  return {
    ...post,
    portfolioEvidenceCount: portfolioIds.length,
    contactInfo: post.user?.contactInfo ? contactSnapshot(post.user.contactInfo, { isSameSchool: true }) : {}
  };
}

export async function shareActiveBoard(ownerId: string, viewerId: string) {
  const membership = await prisma.courseBoardMembership.findFirst({
    where: {
      userId: ownerId,
      status: "active",
      source: { in: [...courseBoardParticipationSources] },
      board: {
        status: "active",
        memberships: {
          some: {
            userId: viewerId,
            status: "active",
            source: { in: [...courseBoardParticipationSources] }
          }
        }
      }
    },
    select: { id: true }
  });
  return Boolean(membership);
}

export async function publicPortfolioItems(items: any[] = [], owner: any, viewer: any) {
  if (!owner?.id || !viewer?.id) return [];
  if (owner.id === viewer.id) return items;
  if (isAdminRole(viewer.role)) return items;

  const isVerifiedSameSchool = Boolean(owner.schoolId && viewer.schoolId && owner.schoolId === viewer.schoolId && viewer.isEmailVerified);
  const needsSharedBoard = items.some((item) => item.visibility === "same_course_board");
  const hasSharedBoard = needsSharedBoard ? await shareActiveBoard(owner.id, viewer.id) : false;

  return items.filter((item) => {
    if (item.visibility === "private") return false;
    if (item.visibility === "same_course_board") return hasSharedBoard;
    if (item.visibility === "same_school" || item.visibility === "public") return isVerifiedSameSchool;
    return false;
  });
}

export async function contactContextForViewer(ownerId: string, viewer: any, postId?: string) {
  if (ownerId === viewer.id) return { isOwner: true, isSameSchool: true };
  if (isAdminRole(viewer.role)) return { isAdmin: true, isSameSchool: true };

  const [sentInterest, mutualInterest, mutualFollow] = await Promise.all([
    prisma.teamUpRequest.findFirst({
      where: {
        senderId: viewer.id,
        receiverId: ownerId,
        status: { in: ["sent", "viewed", "mutual"] },
        ...(postId ? { postId } : {})
      }
    }),
    prisma.teamUpRequest.findFirst({
      where: {
        status: "mutual",
        OR: [
          { senderId: viewer.id, receiverId: ownerId },
          { senderId: ownerId, receiverId: viewer.id }
        ]
      }
    }),
    prisma.followRequest.findFirst({
      where: {
        status: "accepted",
        OR: [
          { senderId: viewer.id, receiverId: ownerId },
          { senderId: ownerId, receiverId: viewer.id }
        ]
      }
    })
  ]);

  return {
    isOwner: false,
    isSameSchool: true,
    hasSentTeamUp: Boolean(sentInterest),
    hasMutualTeamUp: Boolean(mutualInterest),
    hasMutualFollow: Boolean(mutualFollow)
  };
}

export async function publicUserForViewer(user: any, viewer: any, postId?: string) {
  const context = await contactContextForViewer(user.id, viewer, postId);
  return {
    ...publicUser(user, context),
    portfolioItems: await publicPortfolioItems(user.portfolioItems ?? [], user, viewer)
  };
}

export async function enrichPostForViewer(post: any, viewer: any) {
  const portfolioIds = listFromJson(post.portfolioItemIds);
  const context = await contactContextForViewer(post.userId, viewer, post.id);
  return {
    ...post,
    user: {
      ...post.user,
      contactInfo: post.user?.contactInfo ? contactSnapshot(post.user.contactInfo, context) : null,
      portfolioItems: await publicPortfolioItems(post.user?.portfolioItems ?? [], post.user, viewer)
    },
    portfolioEvidenceCount: portfolioIds.length,
    contactInfo: post.user?.contactInfo ? contactSnapshot(post.user.contactInfo, context) : {}
  };
}
