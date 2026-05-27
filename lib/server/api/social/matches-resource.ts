import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/http";
import { requireUser } from "@/lib/session";
import { demoPeople, demoPosts, isDemoUser } from "@/lib/demo-data";
import { profileInclude, userInclude, publicUser } from "@/lib/server/services/user-service";
import { enrichPost } from "@/lib/server/services/social-service";

export async function handleMatches(request: NextRequest) {
  const url = new URL(request.url);
  const usersPage = Math.max(1, Number.parseInt(url.searchParams.get("usersPage") ?? "1", 10) || 1);
  const usersPageSize = Math.min(24, Math.max(4, Number.parseInt(url.searchParams.get("usersPageSize") ?? "8", 10) || 8));
  const paginateUsers = (items: any[]) => {
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / usersPageSize));
    const page = Math.min(usersPage, totalPages);
    const start = (page - 1) * usersPageSize;
    return {
      page,
      total,
      totalPages,
      items: items.slice(start, start + usersPageSize)
    };
  };

  const user = await requireUser();
  if (isDemoUser(user)) {
    const demoUsers = demoPeople().map((membership, index) => ({
      user: publicUser(membership.user),
      score: index === 0 ? 95 : 50,
      reasons: index === 0 ? ["同一课程记录"] : []
    }));
    const pagedDemoUsers = paginateUsers(demoUsers);
    return ok({
      posts: demoPosts().map((post, index) => ({
        ...post,
        score: index === 0 ? 90 : 62,
        reasons: index === 0 ? ["Joined the same course board"] : ["Cross-major collaboration"]
      })),
      users: pagedDemoUsers.items,
      usersPagination: {
        page: pagedDemoUsers.page,
        pageSize: usersPageSize,
        total: pagedDemoUsers.total,
        totalPages: pagedDemoUsers.totalPages
      }
    });
  }

  const courseHistoryStatuses = ["active", "history", "left"];
  const memberships = await prisma.courseBoardMembership.findMany({
    where: { userId: user.id, status: { in: courseHistoryStatuses } },
    include: { board: { include: { courseOffering: { include: { course: true } } } } }
  });
  const boardIds = [...new Set(memberships.filter((membership) => membership.status === "active").map((membership) => membership.boardId))];
  const courseIds = [
    ...new Set(memberships.map((membership) => membership.board.courseOffering.courseId).filter(Boolean))
  ];

  const posts = await prisma.teamakingPost.findMany({
    where: {
      status: "open",
      OR: [
        { boardId: { in: boardIds } },
        { visibility: "same_school", user: { schoolId: user.schoolId ?? "" } }
      ]
    },
    include: {
      board: { include: { courseOffering: { include: { course: true } } } },
      user: { include: { profile: { include: profileInclude }, contactInfo: true, skills: { include: { skill: true } } } }
    },
    orderBy: { createdAt: "desc" },
    take: 20
  });

  const candidateMap = new Map<
    string,
    {
      user: any;
      score: number;
      reasons: string[];
      reasonSet: Set<string>;
      sharedCourses: Set<string>;
    }
  >();

  const addCandidate = (matchedUser: any, score: number, reason?: string, sharedCourseCode?: string) => {
    if (!matchedUser || matchedUser.id === user.id) return;
    const existing = candidateMap.get(matchedUser.id) ?? {
      user: matchedUser,
      score: 0,
      reasons: [],
      reasonSet: new Set<string>(),
      sharedCourses: new Set<string>()
    };
    existing.score += score;
    if (reason && !existing.reasonSet.has(reason)) {
      existing.reasonSet.add(reason);
      existing.reasons.push(reason);
    }
    if (sharedCourseCode) existing.sharedCourses.add(sharedCourseCode);
    candidateMap.set(matchedUser.id, existing);
  };

  if (courseIds.length) {
    const sameCourseMemberships = await prisma.courseBoardMembership.findMany({
      where: {
        status: { in: courseHistoryStatuses },
        userId: { not: user.id },
        board: { courseOffering: { courseId: { in: courseIds } } },
        user: {
          schoolId: user.schoolId ?? "",
          profile: { openToBeDiscovered: true }
        }
      },
      include: {
        user: { include: userInclude },
        board: { include: { courseOffering: { include: { course: true } } } }
      },
      take: 80
    });

    for (const membership of sameCourseMemberships) {
      const courseCode = membership.board.courseOffering.course.code;
      addCandidate(membership.user, 80, "同一课程记录", courseCode);
    }
  }

  const acceptedFollows = await prisma.followRequest.findMany({
    where: {
      status: "accepted",
      OR: [
        { sender: { schoolId: user.schoolId ?? "" } },
        { receiver: { schoolId: user.schoolId ?? "" } }
      ]
    },
    select: { senderId: true, receiverId: true }
  });
  const friendGraph = new Map<string, Set<string>>();
  const connectFriends = (a: string, b: string) => {
    if (!friendGraph.has(a)) friendGraph.set(a, new Set());
    if (!friendGraph.has(b)) friendGraph.set(b, new Set());
    friendGraph.get(a)?.add(b);
    friendGraph.get(b)?.add(a);
  };
  for (const follow of acceptedFollows) {
    connectFriends(follow.senderId, follow.receiverId);
  }
  const networkDistances = new Map<string, number>();
  let frontier = new Set<string>([user.id]);
  const visited = new Set<string>([user.id]);
  for (let degree = 1; degree <= 3; degree += 1) {
    const next = new Set<string>();
    for (const currentUserId of frontier) {
      for (const friendId of friendGraph.get(currentUserId) ?? []) {
        if (visited.has(friendId)) continue;
        visited.add(friendId);
        networkDistances.set(friendId, degree);
        next.add(friendId);
      }
    }
    frontier = next;
  }
  const networkCandidateIds = [...networkDistances.entries()]
    .filter(([, degree]) => degree === 2 || degree === 3)
    .map(([id]) => id);
  if (networkCandidateIds.length) {
    const networkUsers = await prisma.user.findMany({
      where: {
        id: { in: networkCandidateIds },
        schoolId: user.schoolId,
        profile: { openToBeDiscovered: true }
      },
      include: userInclude
    });
    for (const matchedUser of networkUsers) {
      const degree = networkDistances.get(matchedUser.id);
      addCandidate(matchedUser, degree === 2 ? 34 : 20, degree === 2 ? "二度" : "三度");
    }
  }

  const sameMajorUsers = user.profile?.majorId
    ? await prisma.user.findMany({
        where: {
          schoolId: user.schoolId,
          id: { not: user.id },
          profile: { majorId: user.profile.majorId, openToBeDiscovered: true }
        },
        include: userInclude,
        take: 40
      })
    : [];

  for (const matchedUser of sameMajorUsers) {
    addCandidate(matchedUser, 45);
  }

  const crossMajorUsers = await prisma.user.findMany({
    where: {
      schoolId: user.schoolId,
      id: { not: user.id },
      profile: {
        openToBeDiscovered: true,
        ...(user.profile?.majorId ? { majorId: { not: user.profile.majorId } } : {})
      }
    },
    include: userInclude,
    take: 40
  });

  for (const matchedUser of crossMajorUsers) {
    addCandidate(matchedUser, 12);
  }

  const sortedUsers = Array.from(candidateMap.values())
    .map((candidate) => ({
      user: publicUser(candidate.user),
      score: candidate.score + Math.min(candidate.sharedCourses.size * 5, 20),
      reasons: candidate.reasons
    }))
    .sort((a, b) => b.score - a.score || (a.user.profile?.displayName ?? a.user.email ?? "").localeCompare(b.user.profile?.displayName ?? b.user.email ?? ""));
  const pagedUsers = paginateUsers(sortedUsers);

  return ok({
    posts: posts.map((post) => ({
      ...enrichPost(post),
      score: boardIds.includes(post.boardId) ? 90 : 60,
      reasons: [
        ...(boardIds.includes(post.boardId) ? ["Joined the same course board"] : []),
        ...(post.user.profile?.majorId === user.profile?.majorId ? ["Same major"] : [])
      ]
    })),
    users: pagedUsers.items,
    usersPagination: {
      page: pagedUsers.page,
      pageSize: usersPageSize,
      total: pagedUsers.total,
      totalPages: pagedUsers.totalPages
    }
  });
}
