import Link from "next/link";
import { ArrowRight, Handshake, UserRound } from "lucide-react";
import { Card, CourseIcon, SkillBadge, StatusPill, UserIcon } from "@/components/app-shell";

function uniqueTags(values: unknown[], limit?: number) {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const value of values) {
    const tag = String(value ?? "").trim();
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (limit && tags.length >= limit) break;
  }
  return tags;
}

export function CourseCard({ course, onJoin }: { course: any; onJoin?: (course: any) => void | Promise<void> }) {
  const offering = course.offerings?.[0];
  const board = offering?.boards?.[0];

  return (
    <Card>
      <div className="flex items-start gap-3">
        <CourseIcon />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-coral">{course.code}</p>
          <h3 className="mt-1 font-serif text-lg font-semibold text-ink">{course.title}</h3>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink/62">{course.description || "这门课还没有详细说明。"}</p>
          {course.recommendation ? <p className="mt-3 text-xs font-medium text-moss">{course.recommendation.reason}</p> : null}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-ink/12 pt-3">
        <Link href={`/courses/${course.id}`} className="focus-ring inline-flex items-center gap-2 border border-ink/25 px-3 py-2 text-sm font-semibold hover:bg-mist/60">
          课程详情
          <ArrowRight size={15} aria-hidden />
        </Link>
        {board ? (
          <Link href={`/boards/${board.id}`} className="focus-ring inline-flex items-center gap-2 border border-ink bg-ink px-3 py-2 text-sm font-semibold text-white">
            进入 Course Board
            <ArrowRight size={15} aria-hidden />
          </Link>
        ) : onJoin ? (
          <button
            type="button"
            onClick={() => onJoin(course)}
            className="focus-ring inline-flex items-center gap-2 border border-ink bg-ink px-3 py-2 text-sm font-semibold text-paper"
          >
            打开 Course Board
            <ArrowRight size={15} aria-hidden />
          </button>
        ) : null}
      </div>
    </Card>
  );
}

export function ProfileCard({ user }: { user: any }) {
  const profile = user?.profile;
  const profileTags = uniqueTags([
    ...(Array.isArray(profile?.outputTags) ? profile.outputTags : []),
    ...((user?.skills ?? []).map((item: any) => item.skill?.name ?? item.name))
  ], 8);

  return (
    <Card>
      <div className="flex items-start gap-3">
        {profile?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatarUrl} alt={profile?.displayName ?? "avatar"} className="h-10 w-10 border border-ink object-cover" />
        ) : (
          <UserIcon />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-serif text-lg font-semibold text-ink">{profile?.displayName ?? user?.email ?? "未命名用户"}</h3>
          {profile?.nickname || profile?.headline ? <p className="mt-1 text-sm font-medium text-rust">{profile?.nickname ?? profile?.headline}</p> : null}
          <p className="mt-1 text-sm text-ink/62">
            {profile?.grade ?? "未填写年级"} · {profile?.major?.name ?? "未填写专业"}
          </p>
          {profile?.headline ? <p className="mt-2 text-sm text-ink/68">{profile.headline}</p> : null}
          <p className="mt-3 line-clamp-3 text-sm leading-6 text-ink/68">{profile?.bio || "还没有填写个人介绍。"}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {profileTags.map((tag) => <SkillBadge key={tag}>{tag}</SkillBadge>)}
          </div>
        </div>
      </div>
      <Link href={`/profile/${user.id}`} className="focus-ring mt-5 inline-flex items-center gap-2 border border-ink/25 px-3 py-2 text-sm font-semibold hover:bg-mist/60">
        <UserRound size={15} aria-hidden />
        View Profile
      </Link>
    </Card>
  );
}

export function TeamakingPostCard({ post }: { post: any }) {
  const profile = post.user?.profile;
  const course = post.board?.courseOffering?.course;
  const personalTags = uniqueTags([
    ...(Array.isArray(profile?.outputTags) ? profile.outputTags : []),
    ...((post.user?.skills ?? []).map((item: any) => item.skill?.name ?? item.name))
  ], 8);
  const courseTags = uniqueTags([
    ...(Array.isArray(post.strengths) ? post.strengths : []),
    ...(Array.isArray(post.contributionTypes) ? post.contributionTypes : [])
  ], 10);

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-coral">Open to Team · {course?.code} {course?.title ? `· ${course.title}` : ""}</p>
          <h3 className="mt-1 font-serif text-xl font-semibold text-ink">{post.title}</h3>
          <p className="mt-2 text-sm text-ink/62">
            {profile?.displayName ?? post.user?.email} · {profile?.grade ?? "未填写年级"} · {profile?.major?.name ?? "未填写专业"}
          </p>
          {profile?.bio ? <p className="mt-3 line-clamp-3 text-sm leading-6 text-ink/68">{profile.bio}</p> : null}
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-ink/72">{post.expectedOutcome}</p>
      <div className="mt-4 grid gap-3 border-y border-ink/12 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/48">课程 / 交付要求</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {courseTags.length ? courseTags.map((item) => (
              <span key={`course-${item}`} className="border border-ink/25 px-2.5 py-1 text-xs font-medium text-ink/68">
                {item}
              </span>
            )) : <span className="text-xs text-ink/45">暂无课程要求标签</span>}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/48">个人擅长</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {personalTags.length ? personalTags.map((item) => (
              <span key={`profile-${item}`} className="border border-moss/40 bg-moss/10 px-2.5 py-1 text-xs font-medium text-moss">
                {item}
              </span>
            )) : <span className="text-xs text-ink/45">暂无个人标签</span>}
          </div>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-ink/58">Proof-of-Work evidence: {post.portfolioEvidenceCount ?? 0}</p>
        <div className="flex gap-2">
          <Link href={`/profile/${post.userId}`} className="focus-ring rounded-sm border border-ink/40 px-3 py-2 text-sm font-semibold">
            View Profile
          </Link>
          <Link href={`/teamaking-posts/${post.id}`} className="focus-ring inline-flex items-center gap-2 rounded-sm border border-ink bg-rust px-3 py-2 text-sm font-semibold text-paper">
            <Handshake size={15} aria-hidden />
            Team Up
          </Link>
        </div>
      </div>
    </Card>
  );
}

export function TeamUpRequestCard({ request, actions }: { request: any; actions?: React.ReactNode }) {
  const course = request.post?.board?.courseOffering?.course;
  const sender = request.sender;
  const profile = sender?.profile;

  return (
    <Card>
      <div className="flex items-start gap-4">
        <Link href={`/profile/${sender?.id ?? request.senderId}`} className="shrink-0">
          {profile?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatarUrl} alt={profile?.displayName ?? "avatar"} className="h-12 w-12 border border-ink object-cover" />
          ) : (
            <UserIcon />
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-coral">{course?.code ?? "Course"} {course?.title ? `· ${course.title}` : ""} · TeamUp Interest</p>
              <h3 className="mt-1 text-lg font-semibold text-ink">{request.post?.title ?? "Open to Team"}</h3>
              <p className="mt-1 text-sm text-ink/62">
                {profile?.displayName ?? sender?.email ?? "发送者"} · {profile?.grade ?? "未填写年级"} · {profile?.major?.name ?? "未填写专业"}
              </p>
            </div>
            <div className="shrink-0 pt-1">
              <StatusPill status={request.status} />
            </div>
          </div>
          {profile?.bio ? <p className="mt-2 line-clamp-3 text-sm leading-6 text-ink/68">{profile.bio}</p> : null}
          <p className="mt-2 text-sm leading-6 text-ink/68">{request.message}</p>
          <p className="mt-2 text-sm text-ink/58">可贡献：{request.senderContribution}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={`/profile/${sender?.id ?? request.senderId}`} className="focus-ring rounded-sm border border-ink/40 px-3 py-2 text-sm font-semibold">
              View Profile
            </Link>
            <Link href={`/teamaking-posts/${request.postId}`} className="focus-ring rounded-sm border border-ink bg-rust px-3 py-2 text-sm font-semibold text-paper">
              Open Post
            </Link>
          </div>
          {actions ? <div className="mt-5 flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      </div>
    </Card>
  );
}
