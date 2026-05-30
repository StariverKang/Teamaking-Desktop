"use client";

import { useState } from "react";

import { Search } from "lucide-react";
import {
  Card,
  EmptyState,
  LoadingState,
  PageShell,
  SkillBadge,
  StatusPill
} from "@/components/app-shell";
import { ProfileCard, TeamakingPostCard, TeamUpRequestCard } from "@/components/cards";
import { ErrorBox, inputClass } from "@/components/pages/page-primitives";
import { CopyTarget, useCopyText } from "@/components/site-copy-runtime";

import { api, useApi } from "@/lib/client/api";
import { visibleMatchReasonTags } from "@/components/pages/shared/academic-parts";

export function TeamUpRequestsPage() {
  const [refresh, setRefresh] = useState(0);
  const { data: received } = useApi("/api/team-up-interests/received", [refresh]);

  async function actOnInterest(id: string, action: "mutual" | "refuse") {
    await api(`/api/team-up-interests/${id}/${action}`, { method: "POST" });
    setRefresh((value) => value + 1);
  }

  return (
    <PageShell title="TeamUp Menu" eyebrow="TeamUp Interests" description="这里只显示发给你发布的 Teamaking Posts 的 TeamUp Interest 提醒；查看详情会把 sent 自动推进为 viewed。" titleCopyKey="teamup.page.title" descriptionCopyKey="teamup.page.description">
      <div className="grid gap-6">
        <section>
          <h2 className="mb-3 text-xl font-semibold text-ink">Received TeamUp Interests</h2>
          <div className="grid gap-4">
            {(received?.interests ?? []).map((request: any) => (
              <TeamUpRequestCard
                key={request.id}
                request={request}
                actions={
                  <>
                    <button type="button" onClick={() => actOnInterest(request.id, "mutual")} className="focus-ring rounded-sm bg-moss px-3 py-2 text-sm font-semibold text-white">
                      我也感兴趣
                    </button>
                    <button type="button" onClick={() => actOnInterest(request.id, "refuse")} className="focus-ring rounded-sm border border-ink/40 px-3 py-2 text-sm font-semibold">
                      Refuse
                    </button>
                  </>
                }
              />
            ))}
            {(received?.interests ?? []).length === 0 ? <EmptyState title="还没有 TeamUp Interest" body="其他同学对你发布的 Teamaking Post 发起 TeamUp 后，会显示在这里。" /> : null}
          </div>
        </section>
      </div>
    </PageShell>
  );
}

export function InboxPage() {
  const [refresh, setRefresh] = useState(0);
  const { data, error, loading } = useApi("/api/follow-requests/inbox", [refresh]);

  async function act(id: string, action: "accept" | "refuse" | "withdraw") {
    await api(`/api/follow-requests/${id}/${action}`, { method: "POST" });
    setRefresh((value) => value + 1);
  }

  return (
    <PageShell title="Inbox" eyebrow="Follow Requests" description="Inbox 只处理用户之间的关注/好友申请，不显示 TeamUp Interest。" titleCopyKey="inbox.page.title">
      {loading ? <LoadingState /> : <ErrorBox message={error} />}
      <div className="grid gap-4">
        {(data?.requests ?? []).map((request: any) => (
          <Card key={request.id}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <ProfileCard user={request.sender} />
              <StatusPill status={request.status} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => act(request.id, "accept")} className="focus-ring rounded-sm bg-moss px-3 py-2 text-sm font-semibold text-white">
                Accept Follow
              </button>
              <button type="button" onClick={() => act(request.id, "refuse")} className="focus-ring rounded-sm border border-ink/40 px-3 py-2 text-sm font-semibold">
                Refuse
              </button>
            </div>
          </Card>
        ))}
        {(data?.requests ?? []).length === 0 ? <EmptyState title="没有关注申请" body="其他用户申请关注你时，会出现在这里。" /> : null}
      </div>
    </PageShell>
  );
}

export function FriendsPage() {
  const [query, setQuery] = useState("");
  const { data, error, loading } = useApi(`/api/friends?query=${encodeURIComponent(query)}`, [query]);
  const friends = data?.friends ?? [];
  const searchPlaceholder = useCopyText("friends.search.placeholder", "搜索姓名、邮箱、专业、年级");

  return (
    <PageShell title="Friends" eyebrow="Mutual Follow" description="双方关注申请 accepted 后，会在这里成为好友；可搜索姓名、邮箱、专业或年级。" titleCopyKey="friends.page.title">
      <Card>
        <div className="flex items-center gap-2">
          <Search size={16} aria-hidden className="text-ink/45" />
          <CopyTarget copyKey="friends.search.placeholder" className="flex-1"><input className={inputClass} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={searchPlaceholder} /></CopyTarget>
        </div>
      </Card>
      {loading ? <LoadingState /> : <ErrorBox message={error} />}
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {friends.map((friend: any) => <ProfileCard key={friend.id} user={friend} />)}
        {!loading && friends.length === 0 ? <EmptyState title="还没有好友" body="当关注申请被对方接受后，双方会出现在彼此好友列表里。" /> : null}
      </div>
    </PageShell>
  );
}

export function MatchesPage() {
  const [usersPage, setUsersPage] = useState(1);
  const usersPageSize = 8;
  const { data, error, loading } = useApi(`/api/matches?usersPage=${usersPage}&usersPageSize=${usersPageSize}`, [usersPage, usersPageSize]);
  const hiddenPostReasons = new Set(["same school", "open to team", "同校可发现"]);
  const visiblePostReasons = (reasons: string[] = []) => reasons.filter((reason) => !hiddenPostReasons.has(String(reason).trim().toLowerCase()));
  const usersPagination = data?.usersPagination ?? { page: usersPage, pageSize: usersPageSize, total: 0, totalPages: 1 };

  return (
    <PageShell title="Matches" eyebrow="Discovery" description="优先推荐同一课程记录、二度/三度好友网络；同专业和同校开放展示只作为补充排序，不再显示为标签。" titleCopyKey="matches.page.title" descriptionCopyKey="matches.page.description">
      {loading ? <LoadingState /> : <ErrorBox message={error} />}
      <div className="grid gap-6">
        <section data-onboarding-target="teamup-entry">
          <h2 className="mb-3 text-xl font-semibold text-ink">Relevant Teamaking Posts</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {(data?.posts ?? []).map((post: any) => (
              <div key={post.id} className="grid gap-2">
                <TeamakingPostCard post={post} />
                {visiblePostReasons(post.reasons ?? []).length ? (
                  <div className="flex flex-wrap gap-2">
                    {visiblePostReasons(post.reasons ?? []).map((reason: string) => (
                      <SkillBadge key={reason}>{reason}</SkillBadge>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
        <section>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-xl font-semibold text-ink">Relevant Users</h2>
              <p className="mt-1 text-xs leading-5 text-ink/56">排序依据：同一课程记录优先，其次二度/三度好友网络和同专业，再用同校开放展示补充。</p>
            </div>
            <p className="text-xs text-ink/52">
              {usersPagination.total} users · page {usersPagination.page} / {usersPagination.totalPages}
            </p>
          </div>
          {(data?.users ?? []).length ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                {(data?.users ?? []).map((item: any) => (
                  <div key={item.user.id} className="grid gap-2">
                    <ProfileCard user={item.user} />
                    {visibleMatchReasonTags(item.reasons ?? []).length ? (
                      <div className="flex flex-wrap gap-2">
                        {visibleMatchReasonTags(item.reasons ?? []).map((reason) => (
                          <SkillBadge key={reason}>{reason}</SkillBadge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
              {usersPagination.totalPages > 1 ? (
                <div data-testid="matches-users-pagination" className="pagination-safe-zone mt-4 flex flex-wrap items-center justify-between gap-3 border border-ink/18 bg-paper/70 px-3 py-2 text-xs">
                  <span className="text-ink/56">
                    Showing {(usersPagination.page - 1) * usersPagination.pageSize + 1}
                    {"-"}
                    {Math.min(usersPagination.page * usersPagination.pageSize, usersPagination.total)} of {usersPagination.total}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={usersPagination.page <= 1}
                      onClick={() => setUsersPage((page) => Math.max(1, page - 1))}
                      className="border border-ink/30 px-3 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      disabled={usersPagination.page >= usersPagination.totalPages}
                      onClick={() => setUsersPage((page) => Math.min(usersPagination.totalPages, page + 1))}
                      className="border border-ink/30 px-3 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          ) : !loading ? (
            <EmptyState title="暂时没有相关用户" body="发布课程 Post、发送 TeamUp、完善专业信息，或等待更多同学开放 Profile 后，这里会优先显示同课和同专业的人。" />
          ) : null}
        </section>
      </div>
    </PageShell>
  );
}
