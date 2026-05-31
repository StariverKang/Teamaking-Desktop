"use client";

import { useState } from "react";
import { Check, Copy, UserRound } from "lucide-react";
import { Card, LoadingState, PageShell, SkillBadge } from "@/components/app-shell";
import { useFeedback } from "@/components/feedback-provider";
import { ErrorBox, InlineFeedback } from "@/components/pages/page-primitives";
import { api, useApi } from "@/lib/client/api";
import { PaginatedGrid, PortfolioEvidenceCard, portfolioEvidenceSections, PortfolioEvidenceSection, uniqueTextList } from "@/components/pages/shared/portfolio-parts";

export function PublicProfilePage({ userId }: { userId: string }) {
  const { notifySuccess, runWithFeedback } = useFeedback();
  const { data, error, loading } = useApi(`/api/profile/${userId}`);
  const [followFeedback, setFollowFeedback] = useState<{ message: string; tone: "success" | "error" | "info" } | null>(null);
  const [copiedContact, setCopiedContact] = useState("");
  const profile = data?.user?.profile;
  const contact = data?.contactInfo ?? data?.user?.contactInfo ?? {};
  const profileTags = uniqueTextList([
    ...(Array.isArray(profile?.outputTags) ? profile.outputTags : []),
    ...((data?.user?.skills ?? []).map((item: any) => item.skill?.name ?? item.name).filter(Boolean))
  ]);

  async function copyContactValue(key: string, value: string) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopiedContact(key);
    notifySuccess("已复制。");
    window.setTimeout(() => setCopiedContact((current) => (current === key ? "" : current)), 1600);
  }

  function ContactRow({ itemKey, label, value }: { itemKey: string; label: string; value?: string | null }) {
    if (!value) return null;
    return (
      <div className="flex flex-wrap items-start justify-between gap-3 py-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/48">{label}</p>
          <p className="mt-1 break-all text-sm leading-6 text-ink/78">{value}</p>
        </div>
        <button
          type="button"
          className="focus-ring inline-flex shrink-0 items-center gap-2 rounded-sm border border-ink/25 px-3 py-1.5 text-xs font-semibold text-ink"
          onClick={() => copyContactValue(itemKey, value)}
        >
          {copiedContact === itemKey ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
          {copiedContact === itemKey ? "已复制" : "复制"}
        </button>
      </div>
    );
  }

  async function follow() {
    setFollowFeedback(null);
    try {
      const result = await runWithFeedback(
        () => api(`/api/profile/${userId}/follow-request`, { method: "POST" }),
        { success: (result: any) => result?.existing ? "关注申请已存在。" : "关注申请已发送。" }
      );
      setFollowFeedback({ message: result.existing ? "关注申请已存在。" : "关注申请已发送。", tone: "success" });
    } catch (error) {
      setFollowFeedback({ message: error instanceof Error ? error.message : "关注申请发送失败，请稍后再试。", tone: "error" });
    }
  }

  return (
    <PageShell title={profile?.displayName ?? "用户 Profile"} eyebrow="Proof-of-Work Profile" description="同校已验证用户可以查看对方允许展示的基础资料、联系方式和作品证明。" descriptionCopyKey="profilePublic.page.description">
      {loading ? <LoadingState /> : <ErrorBox message={error} />}
      {data?.user ? (
        <div className="grid gap-5">
          <Card>
            <div
              className="min-h-[180px] border-2 border-ink bg-mist p-5"
              style={profile?.backgroundImageUrl ? { backgroundImage: `linear-gradient(90deg, rgba(248,246,239,.78) 0%, rgba(248,246,239,.42) 48%, rgba(248,246,239,.16) 100%), url(${profile.backgroundImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
            >
              <div className="flex flex-wrap items-end gap-4">
                <div className="grid h-24 w-24 place-items-center overflow-hidden border-2 border-ink bg-chalk">
                  {profile?.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.avatarUrl} alt={profile.displayName} className="h-full w-full object-cover" />
                  ) : (
                    <UserRound size={34} aria-hidden />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-rust">{profile?.nickname || data.user.email}</p>
                  <h2 className="mt-1 text-3xl font-semibold text-ink">{profile?.displayName}</h2>
                  <p className="mt-2 text-sm text-ink/68">{profile?.grade ?? "未填写年级"} · {profile?.major?.name ?? "未填写专业"}</p>
                  {profile?.headline ? <p className="mt-1 text-sm text-ink/68">{profile.headline}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {profileTags.map((tag: string) => <SkillBadge key={tag}>{tag}</SkillBadge>)}
                  </div>
                </div>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-ink/68">{profile?.bio}</p>
            <button type="button" onClick={follow} className="focus-ring mt-4 rounded-sm bg-rust px-4 py-2 text-sm font-semibold text-paper">
              申请关注
            </button>
            <div className="mt-2">
              <InlineFeedback message={followFeedback?.message} tone={followFeedback?.tone} />
            </div>
          </Card>
          <Card>
            <h2 className="text-xl font-semibold text-ink">联系方式</h2>
            <div className="mt-4 divide-y divide-ink/12 border-y border-ink/12">
              <ContactRow itemKey="schoolEmail" label="学校邮箱" value={contact.schoolEmail ?? data.user.email} />
              <ContactRow itemKey="wechatId" label="WeChat" value={contact.wechatId} />
              <ContactRow itemKey="linkedinUrl" label="LinkedIn / 主页" value={contact.linkedinUrl} />
              <ContactRow itemKey="personalEmail" label="个人邮箱" value={contact.personalEmail} />
              {contact.wechatQrImageUrl ? (
                <div className="py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink/48">WeChat QR</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={contact.wechatQrImageUrl} alt="WeChat QR" className="mt-3 h-32 w-32 border border-ink/30 object-cover" />
                </div>
              ) : null}
            </div>
          </Card>
          <Card>
            <h2 className="text-xl font-semibold text-ink">Portfolio evidence</h2>
            {(() => {
              const portfolioItems = data.portfolioItems ?? [];
              const pinned = portfolioItems.filter((item: any) => item.isPinned).slice(0, 3);
              return (
                <div className="mt-4 grid gap-6">
                  {pinned.length > 0 ? (
                    <section>
                      <h3 className="mb-3 text-lg font-semibold text-ink">Pinned Work</h3>
                      <PaginatedGrid items={pinned} pageSize={3} render={(item) => <PortfolioEvidenceCard key={item.id} item={item} />} />
                    </section>
                  ) : null}
                  {portfolioEvidenceSections.map((section) => (
                    <PortfolioEvidenceSection key={section.key} section={section} items={portfolioItems.filter(section.matches)} />
                  ))}
                </div>
              );
            })()}
          </Card>
        </div>
      ) : null}
    </PageShell>
  );
}
