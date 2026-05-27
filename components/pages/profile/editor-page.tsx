"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, FileText, Plus, UserRound } from "lucide-react";
import { Card, EmptyState, LoadingState, PageShell, SkillBadge } from "@/components/app-shell";
import { ErrorBox, Field, inputClass } from "@/components/pages/page-primitives";
import { contactVisibilityOptions, defaultContactVisibility } from "@/lib/contact";
import { api, uploadProfileFile, useApi } from "@/lib/client/api";
import { majorsForFaculty, normalizeAcademicSelection, OfficialAcademicLinks } from "@/components/pages/shared/academic-parts";
import { acceptedProfileFiles, defaultEntryYear, entryTermOptions, fileFamily, isHonorItem, PaginatedGrid, PortfolioEvidenceCard, portfolioEvidenceSections, PortfolioEvidenceSection, portfolioTypeLabels, portfolioTypes, renderResumeParsedData, tagsFromText, tagsToText } from "@/components/pages/shared/portfolio-parts";

export function ProfileEditorPage() {
  const { data, error, loading } = useApi("/api/profile/me");
  const { data: onboarding } = useApi("/api/onboarding");
  const [saved, setSaved] = useState("");
  const [uploading, setUploading] = useState("");
  const [portfolioItems, setPortfolioItems] = useState<any[]>([]);
  const [workOwnershipFilter, setWorkOwnershipFilter] = useState("all");
  const [workTypeFilter, setWorkTypeFilter] = useState("all");
  const [form, setForm] = useState({
    displayName: "",
    nickname: "",
    headline: "",
    bio: "",
    grade: "Year 2",
    entryYear: defaultEntryYear,
    entryTerm: "Fall",
    facultyId: "",
    majorId: "",
    avatarUrl: "",
    backgroundImageUrl: "",
    outputTagsText: "research brief, slides, prototype",
    openToBeDiscovered: true,
    skillsText: "academic writing, research",
    resumeUrl: "",
    resumeFileName: "",
    resumeParsedData: {} as Record<string, unknown>
  });
  const [contact, setContact] = useState<any>({
    schoolEmail: "",
    wechatId: "",
    wechatQrImageUrl: "",
    linkedinUrl: "",
    personalEmail: "",
    visibilitySettings: defaultContactVisibility
  });
  const [portfolioForm, setPortfolioForm] = useState<any>({
    title: "",
    type: "portfolio",
    myRole: "",
    semesterText: "",
    contributionDescription: "",
    outcome: "",
    reflection: "",
    externalUrl: "",
    visibility: "same_school",
    isGroupWork: false,
    isPinned: false,
    fileName: "",
    fileMimeType: "",
    fileSize: 0,
    fileExtension: "",
    storageKey: "",
    fileUrl: "",
    previewKind: "link",
    parsedText: "",
    metadata: {}
  });
  const [editingPortfolioId, setEditingPortfolioId] = useState("");
  const academicLock = data?.user?.profile?.academicLock ?? onboarding?.academicLock;
  const profileFaculties = useMemo(() => onboarding?.faculties ?? [], [onboarding?.faculties]);
  const profileMajors = useMemo(() => onboarding?.majors ?? [], [onboarding?.majors]);
  const filteredProfileMajors = useMemo(() => majorsForFaculty(profileMajors, form.facultyId), [profileMajors, form.facultyId]);

  function resetPortfolioForm() {
    setEditingPortfolioId("");
    setPortfolioForm({
      title: "",
      type: "portfolio",
      myRole: "",
      semesterText: "",
      contributionDescription: "",
      outcome: "",
      reflection: "",
      externalUrl: "",
      visibility: "same_school",
      isGroupWork: false,
      isPinned: false,
      fileName: "",
      fileMimeType: "",
      fileSize: 0,
      fileExtension: "",
      storageKey: "",
      fileUrl: "",
      previewKind: "link",
      parsedText: "",
      metadata: {}
    });
  }

  useEffect(() => {
    if (data?.user) {
      const profile = data.user.profile;
      const academicSelection = normalizeAcademicSelection(
        onboarding?.faculties ?? [],
        onboarding?.majors ?? [],
        profile?.facultyId,
        profile?.majorId
      );
      setForm({
        displayName: profile?.displayName ?? "",
        nickname: profile?.nickname ?? "",
        headline: profile?.headline ?? "",
        bio: profile?.bio ?? "",
        grade: profile?.grade ?? "Year 2",
        entryYear: profile?.entryYear ?? defaultEntryYear,
        entryTerm: profile?.entryTerm ?? "Fall",
        facultyId: academicSelection.facultyId,
        majorId: academicSelection.majorId,
        avatarUrl: profile?.avatarUrl ?? "",
        backgroundImageUrl: profile?.backgroundImageUrl ?? "",
        outputTagsText: tagsToText(profile?.outputTags),
        openToBeDiscovered: profile?.openToBeDiscovered ?? true,
        skillsText: (data.user.skills ?? []).map((item: any) => item.skill.name).join(", "),
        resumeUrl: profile?.resumeUrl ?? "",
        resumeFileName: profile?.resumeFileName ?? "",
        resumeParsedData: profile?.resumeParsedData ?? {}
      });
    }
    if (data?.portfolioItems) setPortfolioItems(data.portfolioItems);
    if (data?.contactInfo) {
      setContact({
        ...data.contactInfo,
        visibilitySettings: {
          ...defaultContactVisibility,
          ...(data.contactInfo.visibilitySettings ?? {})
        }
      });
    } else if (data?.user?.email) {
      setContact((current: any) => ({ ...current, schoolEmail: data.user.email }));
    }
  }, [data, onboarding]);

  async function uploadAndApply(file: File | undefined, purpose: string, apply: (upload: any) => void) {
    if (!file) return;
    setUploading(purpose);
    setSaved("");
    try {
      const upload = await uploadProfileFile(file, purpose);
      apply(upload);
      setSaved("文件已上传，点击保存后会写入 Profile 数据。");
    } catch (err) {
      setSaved(err instanceof Error ? err.message : "上传失败。");
    } finally {
      setUploading("");
    }
  }

  async function reparseResume() {
    if (!form.resumeUrl) {
      setSaved("请先上传或填写简历 URL。");
      return;
    }
    setUploading("resume-reparse");
    setSaved("");
    try {
      const result = await api("/api/profile/me/reparse-resume", { method: "POST" });
      setForm((current) => ({
        ...current,
        resumeParsedData: result.resumeParsedData ?? current.resumeParsedData
      }));
      setSaved(result.message ?? "简历已重新整理。");
    } catch (err) {
      setSaved(err instanceof Error ? err.message : "简历重新整理失败。");
    } finally {
      setUploading("");
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaved("");
    await api("/api/profile/me", {
      method: "PATCH",
      body: JSON.stringify({
        displayName: form.displayName,
        nickname: form.nickname,
        headline: form.headline,
        bio: form.bio,
        grade: form.grade,
        entryYear: form.entryYear,
        entryTerm: form.entryTerm,
        facultyId: form.facultyId,
        majorId: form.majorId,
        avatarUrl: form.avatarUrl,
        backgroundImageUrl: form.backgroundImageUrl,
        outputTags: tagsFromText(form.outputTagsText),
        openToBeDiscovered: form.openToBeDiscovered,
        resumeUrl: form.resumeUrl,
        resumeFileName: form.resumeFileName,
        resumeParsedData: form.resumeParsedData,
        contactInfo: contact,
        skills: tagsFromText(form.skillsText)
      })
    });
    setSaved("个人资料、联系方式、头像/背景、简历解析信息已保存。");
  }

  async function createPortfolioItem(event: FormEvent) {
    event.preventDefault();
    setSaved("");
    const sameHonorTypeCount = portfolioItems.filter((item) => item.type === portfolioForm.type).length;
    const pinnedCount = portfolioItems.filter((item) => item.isPinned).length;
    if (!editingPortfolioId && isHonorItem(portfolioForm) && sameHonorTypeCount >= 3) {
      setSaved("语言成绩、GPA、奖项/认证每类最多上传 3 个。");
      return;
    }
    if (!editingPortfolioId && portfolioForm.isPinned && pinnedCount >= 3) {
      setSaved("每个用户最多置顶 3 个过往成果。");
      return;
    }
    const endpoint = editingPortfolioId ? `/api/profile/me/portfolio-items/${editingPortfolioId}` : "/api/profile/me/portfolio-items";
    const result = await api(endpoint, {
      method: editingPortfolioId ? "PATCH" : "POST",
      body: JSON.stringify({
        ...portfolioForm,
        metadata: {
          ...(portfolioForm.metadata ?? {}),
          createdFrom: "profile_editor"
        }
      })
    });
    setSaved(editingPortfolioId ? "作品/证明材料已更新。" : "作品/证明材料已保存。");
    resetPortfolioForm();
    if (result?.portfolioItem) {
      setPortfolioItems((current) =>
        editingPortfolioId
          ? current.map((item) => (item.id === result.portfolioItem.id ? result.portfolioItem : item))
          : [result.portfolioItem, ...current]
      );
    }
  }

  function editPortfolioItem(item: any) {
    setEditingPortfolioId(item.id);
    setPortfolioForm({
      title: item.title ?? "",
      type: item.type === "career_certification" || item.type === "resume" ? "skill_certification" : item.type ?? "portfolio",
      myRole: item.myRole ?? "",
      semesterText: item.semesterText ?? "",
      contributionDescription: item.contributionDescription ?? "",
      outcome: item.outcome ?? "",
      reflection: item.reflection ?? "",
      externalUrl: item.externalUrl ?? "",
      visibility: item.visibility ?? "same_school",
      isGroupWork: Boolean(item.isGroupWork),
      isPinned: Boolean(item.isPinned),
      fileName: item.fileName ?? "",
      fileMimeType: item.fileMimeType ?? "",
      fileSize: item.fileSize ?? 0,
      fileExtension: item.fileExtension ?? "",
      storageKey: item.storageKey ?? "",
      fileUrl: item.fileUrl ?? "",
      previewKind: item.previewKind ?? "link",
      parsedText: item.parsedText ?? "",
      metadata: item.metadata ?? {}
    });
    setSaved("正在编辑已有作品；修改后点击保存。");
  }

  async function deletePortfolioItem(id: string) {
    await api(`/api/profile/me/portfolio-items/${id}`, { method: "DELETE" });
    setPortfolioItems((current) => current.filter((item) => item.id !== id));
    setSaved("作品/证明材料已删除。");
  }

  return (
    <PageShell title="Proof-of-Work Profile" eyebrow="Profile" description="编辑个人展示页：联系方式、头像背景、技能标签、作品证明、GPA 截图、证书和简历解析都在这里维护。">
      {loading ? <LoadingState /> : <ErrorBox message={error} />}
      {data ? (
        <div className="grid gap-5">
          <Card className="p-0">
            <div
              className="min-h-[170px] border-b-2 border-ink bg-mist p-5"
              style={form.backgroundImageUrl ? { backgroundImage: `linear-gradient(90deg, rgba(248,246,239,.78) 0%, rgba(248,246,239,.42) 48%, rgba(248,246,239,.16) 100%), url(${form.backgroundImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
            >
              <div className="flex flex-wrap items-end gap-4">
                <div className="grid h-24 w-24 place-items-center overflow-hidden border-2 border-ink bg-chalk">
                  {form.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.avatarUrl} alt="avatar preview" className="h-full w-full object-cover" />
                  ) : (
                    <UserRound size={34} aria-hidden className="text-ink/55" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-rust">Profile preview</p>
                  <h2 className="mt-1 text-3xl font-semibold text-ink">{form.displayName || "未命名用户"}</h2>
                  <p className="mt-2 text-sm text-ink/68">{form.nickname || "可填写昵称"} · {form.headline || "可填写一句个人定位"}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {tagsFromText(form.outputTagsText).map((tag) => <SkillBadge key={tag}>{tag}</SkillBadge>)}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <form onSubmit={submit} className="grid gap-5">
            <Card>
              <h2 className="text-xl font-semibold text-ink">基础展示信息</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label="显示名称">
                  <input className={inputClass} value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} />
                </Field>
                <Field label="昵称 / 别名">
                  <input className={inputClass} value={form.nickname} onChange={(event) => setForm({ ...form, nickname: event.target.value })} placeholder="例如 Mia / slides person" />
                </Field>
                <Field label="一句话定位">
                  <input className={inputClass} value={form.headline} onChange={(event) => setForm({ ...form, headline: event.target.value })} placeholder="例如 Research and presentation collaborator" />
                </Field>
                <Field label="头像 URL / 上传后自动填入">
                  <div className="grid gap-2">
                    <input className={inputClass} value={form.avatarUrl} onChange={(event) => setForm({ ...form, avatarUrl: event.target.value })} />
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg,.webp,.gif,.svg"
                      onChange={(event) => uploadAndApply(event.target.files?.[0], "avatar", (upload) => setForm((current) => ({ ...current, avatarUrl: upload.fileUrl })))}
                    />
                  </div>
                </Field>
                <Field label="主页背景 URL / 上传后自动填入">
                  <div className="grid gap-2">
                    <input className={inputClass} value={form.backgroundImageUrl} onChange={(event) => setForm({ ...form, backgroundImageUrl: event.target.value })} />
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg,.webp,.gif,.svg"
                      onChange={(event) => uploadAndApply(event.target.files?.[0], "background", (upload) => setForm((current) => ({ ...current, backgroundImageUrl: upload.fileUrl })))}
                    />
                  </div>
                </Field>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-5">
                <Field label="年级" help={academicLock?.locked ? "根据学校邮箱自动推断，普通用户不可手动修改；特殊情况请提交工单。" : undefined}>
                  <input className={inputClass} value={form.grade} readOnly={Boolean(academicLock?.locked)} onChange={(event) => setForm({ ...form, grade: event.target.value })} />
                </Field>
                <Field label="入学年份">
                  <input className={inputClass} type="number" value={form.entryYear} readOnly={Boolean(academicLock?.locked)} onChange={(event) => setForm({ ...form, entryYear: Number(event.target.value) })} />
                </Field>
                <Field label="入学学期">
                  <select className={inputClass} value={form.entryTerm} disabled={Boolean(academicLock?.locked)} onChange={(event) => setForm({ ...form, entryTerm: event.target.value })}>
                    {entryTermOptions.map((term) => <option key={term}>{term}</option>)}
                  </select>
                </Field>
                <Field label="Faculty">
                  <select
                    className={inputClass}
                    value={form.facultyId}
                    onChange={(event) => setForm({ ...form, ...normalizeAcademicSelection(profileFaculties, profileMajors, event.target.value, null) })}
                  >
                    {profileFaculties.map((faculty: any) => <option key={faculty.id} value={faculty.id}>{faculty.name}</option>)}
                  </select>
                </Field>
                <Field label="Major">
                  <select className={inputClass} value={form.majorId} onChange={(event) => setForm({ ...form, majorId: event.target.value })} disabled={filteredProfileMajors.length === 0}>
                    {filteredProfileMajors.length === 0 ? <option value="">请先选择 Faculty</option> : null}
                    {filteredProfileMajors.map((major: any) => <option key={major.id} value={major.id}>{major.name}</option>)}
                  </select>
                </Field>
              </div>
              <div className="mt-4">
                <OfficialAcademicLinks links={data.officialLinks} compact />
              </div>
              <div className="mt-4 grid gap-4">
                <Field label="个人简介">
                  <textarea className={inputClass} rows={4} value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} />
                </Field>
                <Field label="技能标签，用英文逗号分隔" help="例如 academic writing, PPT design, data analysis">
                  <input className={inputClass} value={form.skillsText} onChange={(event) => setForm({ ...form, skillsText: event.target.value })} />
                </Field>
                <Field label="擅长产出领域 Tag，用英文逗号分隔" help="例如 research brief, slides, prototype, interview notes">
                  <input className={inputClass} value={form.outputTagsText} onChange={(event) => setForm({ ...form, outputTagsText: event.target.value })} />
                </Field>
              </div>
            </Card>

            <Card>
              <h2 className="text-xl font-semibold text-ink">联系方式与可见性</h2>
              <p className="mt-2 text-sm leading-6 text-ink/62">学校邮箱来自登录邮箱，默认展示为身份凭证，不允许前端编辑；微信、二维码、LinkedIn、个人邮箱都可以选择性填写。</p>
              <div className="mt-4 grid gap-3">
                <Field label="学校邮箱（只读，默认展示）">
                  <input className={`${inputClass} bg-ink/5`} value={contact.schoolEmail || data.user.email} readOnly />
                </Field>
                {[
                  ["wechatId", "WeChat ID"],
                  ["wechatQrImageUrl", "WeChat QR 图片 URL"],
                  ["linkedinUrl", "LinkedIn / 个人主页"],
                  ["personalEmail", "个人邮箱"]
                ].map(([key, label]) => (
                  <div key={key} className="grid gap-3 border border-ink/25 bg-paper p-3 md:grid-cols-[1fr_220px]">
                    <Field label={label}>
                      <div className="grid gap-2">
                        <input className={inputClass} value={contact[key] ?? ""} onChange={(event) => setContact({ ...contact, [key]: event.target.value })} />
                        {key === "wechatQrImageUrl" ? (
                          <input
                            type="file"
                            accept=".png,.jpg,.jpeg,.webp,.gif"
                            onChange={(event) => uploadAndApply(event.target.files?.[0], "contact_qr", (upload) => setContact((current: any) => ({ ...current, wechatQrImageUrl: upload.fileUrl })))}
                          />
                        ) : null}
                      </div>
                    </Field>
                    <Field label="可见范围">
                      <select
                        className={inputClass}
                        value={contact.visibilitySettings?.[key] ?? defaultContactVisibility[key as keyof typeof defaultContactVisibility]}
                        onChange={(event) => setContact({ ...contact, visibilitySettings: { ...contact.visibilitySettings, [key]: event.target.value } })}
                      >
                        {contactVisibilityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </Field>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <h2 className="text-xl font-semibold text-ink">简历上传与解析</h2>
              <p className="mt-2 text-sm leading-6 text-ink/62">当前本地解析支持 txt / md / 代码、PDF、Word、PPT、Excel/CSV 等文本提取；旧 Office、加密文件或扫描件解析失败时会保存文件并显示原因。</p>
              <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr]">
                <Field label="简历 URL">
                  <input className={inputClass} value={form.resumeUrl} onChange={(event) => setForm({ ...form, resumeUrl: event.target.value })} />
                </Field>
                <Field label="上传简历">
                  <input
                    type="file"
                    accept={acceptedProfileFiles}
                    onChange={(event) =>
                      uploadAndApply(event.target.files?.[0], "resume", (upload) =>
                        setForm((current) => ({
                          ...current,
                          resumeUrl: upload.fileUrl,
                          resumeFileName: upload.fileName,
                          resumeParsedData: upload.resumeParsedData ?? {}
                        }))
                      )
                    }
                  />
                </Field>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="focus-ring inline-flex items-center gap-2 rounded-sm border border-ink/30 px-3 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={!form.resumeUrl || uploading === "resume-reparse"}
                  onClick={reparseResume}
                >
                  <FileText size={16} aria-hidden />
                  {uploading === "resume-reparse" ? "正在整理..." : "重新整理当前简历"}
                </button>
                <p className="text-sm leading-6 text-ink/56">已有简历也可以直接重新解析，生成摘要、分区和关键词。</p>
              </div>
              {renderResumeParsedData(form.resumeParsedData, form.resumeFileName)}
            </Card>

            <label className="flex items-center gap-2 text-sm font-semibold text-ink">
              <input type="checkbox" checked={form.openToBeDiscovered} onChange={(event) => setForm({ ...form, openToBeDiscovered: event.target.checked })} />
              允许同校用户在 discovery 中看到我
            </label>
            <button type="submit" className="focus-ring inline-flex w-fit items-center gap-2 rounded-sm bg-ink px-4 py-2 font-semibold text-paper">
              <Check size={16} aria-hidden />
              保存 Profile 与联系方式
            </button>
          </form>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-ink">{editingPortfolioId ? "编辑作品 / 证明材料" : "新增作品 / 证明材料"}</h2>
              {editingPortfolioId ? (
                <button type="button" onClick={resetPortfolioForm} className="border border-ink/30 px-3 py-2 text-sm font-semibold">
                  取消编辑
                </button>
              ) : null}
            </div>
            <p className="mt-2 text-sm leading-6 text-ink/62">兼容 md、Word、表格、PDF、PPT、图像、音频、设计稿、代码等主流文件后缀；GPA 截图、获奖证书、技能/职业认证也作为证明材料管理。</p>
            <form onSubmit={createPortfolioItem} className="mt-4 grid gap-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="标题">
                  <input className={inputClass} value={portfolioForm.title} onChange={(event) => setPortfolioForm({ ...portfolioForm, title: event.target.value })} />
                </Field>
                <Field label="类型">
                  <select className={inputClass} value={portfolioForm.type} onChange={(event) => setPortfolioForm({ ...portfolioForm, type: event.target.value })}>
                    {portfolioTypes.map((type) => <option key={type} value={type}>{portfolioTypeLabels[type]}</option>)}
                  </select>
                </Field>
                <Field label="可见范围">
                  <select className={inputClass} value={portfolioForm.visibility} onChange={(event) => setPortfolioForm({ ...portfolioForm, visibility: event.target.value })}>
                    <option value="private">仅自己</option>
                    <option value="same_school">同校可见</option>
                    <option value="same_course_board">同课程板可见</option>
                    <option value="public">公开</option>
                  </select>
                </Field>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="我的角色">
                  <input className={inputClass} value={portfolioForm.myRole} onChange={(event) => setPortfolioForm({ ...portfolioForm, myRole: event.target.value })} />
                </Field>
                <Field label="学期 / 时间">
                  <input className={inputClass} value={portfolioForm.semesterText} onChange={(event) => setPortfolioForm({ ...portfolioForm, semesterText: event.target.value })} />
                </Field>
                <Field label="外部链接（可选）">
                  <input className={inputClass} value={portfolioForm.externalUrl} onChange={(event) => setPortfolioForm({ ...portfolioForm, externalUrl: event.target.value })} />
                </Field>
              </div>
              <Field label="上传文件">
                <input
                  type="file"
                  accept={acceptedProfileFiles}
                  onChange={(event) =>
                    uploadAndApply(event.target.files?.[0], portfolioForm.type, (upload) =>
                      setPortfolioForm((current: any) => ({
                        ...current,
                        ...upload,
                        title: current.title || upload.fileName,
                        metadata: { ...(current.metadata ?? {}), resumeParsedData: upload.resumeParsedData }
                      }))
                    )
                  }
                />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="贡献说明">
                  <textarea className={inputClass} rows={4} value={portfolioForm.contributionDescription} onChange={(event) => setPortfolioForm({ ...portfolioForm, contributionDescription: event.target.value })} />
                </Field>
                <Field label="结果 / 复盘">
                  <textarea className={inputClass} rows={4} value={`${portfolioForm.outcome}${portfolioForm.outcome && portfolioForm.reflection ? "\n" : ""}${portfolioForm.reflection}`} onChange={(event) => {
                    const [outcome = "", ...rest] = event.target.value.split("\n");
                    setPortfolioForm({ ...portfolioForm, outcome, reflection: rest.join("\n") });
                  }} />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                <input type="checkbox" checked={portfolioForm.isGroupWork} onChange={(event) => setPortfolioForm({ ...portfolioForm, isGroupWork: event.target.checked })} />
                这是小组作品
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                <input type="checkbox" checked={portfolioForm.isPinned} onChange={(event) => setPortfolioForm({ ...portfolioForm, isPinned: event.target.checked })} />
                置顶展示（最多 3 个）
              </label>
              {portfolioForm.fileName ? <PortfolioEvidenceCard item={portfolioForm} /> : null}
              <button className="focus-ring inline-flex w-fit items-center gap-2 rounded-sm bg-rust px-4 py-2 font-semibold text-paper">
                <Plus size={16} aria-hidden />
                {editingPortfolioId ? "更新作品 / 证明" : "保存作品 / 证明"}
              </button>
            </form>
          </Card>

          <Card>
            <h2 className="text-xl font-semibold text-ink">已保存的作品与证明</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {["all", "individual", "group"].map((value) => (
                <button key={value} type="button" onClick={() => setWorkOwnershipFilter(value)} className={`border px-3 py-2 text-sm font-semibold ${workOwnershipFilter === value ? "border-ink bg-ink text-paper" : "border-ink/30 bg-paper"}`}>
                  {value === "all" ? "全部" : value === "individual" ? "个人作品" : "小组成果"}
                </button>
              ))}
              {["all", "slides", "report", "code", "design", "other"].map((value) => (
                <button key={value} type="button" onClick={() => setWorkTypeFilter(value)} className={`border px-3 py-2 text-sm font-semibold ${workTypeFilter === value ? "border-rust bg-rust text-paper" : "border-ink/30 bg-paper"}`}>
                  {value === "all" ? "全部类型" : value}
                </button>
              ))}
            </div>
            {(() => {
              const pinned = portfolioItems.filter((item) => item.isPinned).slice(0, 3);
              const filteredPaperwork = portfolioItems.filter((item) => {
                const ownershipOk = workOwnershipFilter === "all" || (workOwnershipFilter === "group" ? item.isGroupWork : !item.isGroupWork);
                const typeOk = workTypeFilter === "all" || fileFamily(item) === workTypeFilter;
                return portfolioEvidenceSections[0].matches(item) && ownershipOk && typeOk;
              });
              return (
                <div className="mt-5 grid gap-6">
                  <section>
                    <h3 className="mb-3 text-lg font-semibold text-ink">置顶成果</h3>
                    {pinned.length > 0 ? <PaginatedGrid items={pinned} pageSize={3} render={(item) => <PortfolioEvidenceCard key={item.id} item={item} editable onDelete={deletePortfolioItem} onEdit={editPortfolioItem} />} /> : <EmptyState title="还没有置顶成果" body="勾选置顶展示后，会优先显示最多三个作品。" />}
                  </section>
                  <PortfolioEvidenceSection section={portfolioEvidenceSections[0]} items={filteredPaperwork} editable onDelete={deletePortfolioItem} onEdit={editPortfolioItem} />
                  {portfolioEvidenceSections.slice(1).map((section) => (
                    <PortfolioEvidenceSection key={section.key} section={section} items={portfolioItems.filter(section.matches)} editable onDelete={deletePortfolioItem} onEdit={editPortfolioItem} />
                  ))}
                </div>
              );
            })()}
          </Card>

          {uploading ? <p className="text-sm font-medium text-rust">正在上传：{uploading}</p> : null}
          {saved ? <p className="border border-ink/20 bg-paper px-3 py-2 text-sm font-medium text-forest">{saved}</p> : null}
        </div>
      ) : null}
    </PageShell>
  );
}
