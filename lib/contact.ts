type VisibilitySettings = Record<string, string | undefined>;

type ContactLike = {
  schoolEmail: string;
  wechatId?: string | null;
  wechatQrImageUrl?: string | null;
  linkedinUrl?: string | null;
  personalEmail?: string | null;
  visibilitySettings?: unknown;
};

export type ContactViewerContext = {
  isOwner?: boolean;
  isSameSchool?: boolean;
  hasSentTeamUp?: boolean;
  hasMutualTeamUp?: boolean;
  hasMutualFollow?: boolean;
} | null;

export const defaultContactVisibility = {
  schoolEmail: "public",
  wechatId: "after_teamup_sent",
  wechatQrImageUrl: "after_teamup_sent",
  linkedinUrl: "public",
  personalEmail: "private"
};

function settingsOf(contact: ContactLike): VisibilitySettings {
  if (contact.visibilitySettings && typeof contact.visibilitySettings === "object") {
    return contact.visibilitySettings as VisibilitySettings;
  }

  return {};
}

export function normalizeContactVisibility(value?: string) {
  if (value === "same_course_board" || value === "same_school" || value === "shown_on_teamaking_post") return "public";
  if (value === "after_teamup_sent" || value === "mutual_teamup" || value === "mutual_follow" || value === "private" || value === "public") return value;
  return undefined;
}

function canShow(field: keyof typeof defaultContactVisibility, contact: ContactLike, context: ContactViewerContext) {
  if (context?.isOwner) return true;
  const settings = settingsOf(contact);
  const visibility = normalizeContactVisibility(settings[field]) ?? defaultContactVisibility[field];

  if (visibility === "private") return false;
  if (visibility === "public") return context?.isSameSchool !== false;
  if (visibility === "after_teamup_sent") return Boolean(context?.hasSentTeamUp);
  if (visibility === "mutual_teamup") return Boolean(context?.hasMutualTeamUp);
  if (visibility === "mutual_follow") return Boolean(context?.hasMutualFollow);

  return false;
}

export function contactSnapshot(contact: ContactLike | null | undefined, context: ContactViewerContext = { isSameSchool: true }) {
  if (!contact) return {};

  return {
    schoolEmail: canShow("schoolEmail", contact, context) ? contact.schoolEmail : null,
    wechatId: canShow("wechatId", contact, context) ? contact.wechatId : null,
    wechatQrImageUrl: canShow("wechatQrImageUrl", contact, context) ? contact.wechatQrImageUrl : null,
    linkedinUrl: canShow("linkedinUrl", contact, context) ? contact.linkedinUrl : null,
    personalEmail: canShow("personalEmail", contact, context) ? contact.personalEmail : null
  };
}

export const contactVisibilityOptions = [
  { value: "private", label: "仅自己可见" },
  { value: "public", label: "公开展示（同校已验证用户）" },
  { value: "after_teamup_sent", label: "发送 TeamUp Interest 后可见" },
  { value: "mutual_teamup", label: "TeamUp mutual 后可见" },
  { value: "mutual_follow", label: "相互关注后可见" }
];
