export type OnboardingGuidePlacement = "top" | "right" | "bottom" | "left";

export type OnboardingGuideStep = {
  id: string;
  route: string;
  targetSelector: string;
  placement: OnboardingGuidePlacement;
  title: string;
  body: string;
};

export type OnboardingGuide = {
  version: string;
  steps: OnboardingGuideStep[];
};

export type OnboardingGuideValidation = {
  ok: boolean;
  guide: OnboardingGuide;
  errors: string[];
};

const allowedPlacements = new Set<OnboardingGuidePlacement>(["top", "right", "bottom", "left"]);

export const defaultOnboardingGuide: OnboardingGuide = {
  version: "2026-05-cross-page",
  steps: [
    {
      id: "academic-form",
      route: "/onboarding",
      targetSelector: '[data-onboarding-target="academic-form"]',
      placement: "right",
      title: "先确认基础学业信息",
      body: "显示名、Faculty、Major、入学年份和年级会影响课程推荐和同校可见性；这里不是官方选课系统。"
    },
    {
      id: "dashboard-overview",
      route: "/dashboard",
      targetSelector: '[data-onboarding-target="dashboard-profile-health"]',
      placement: "bottom",
      title: "Dashboard 是你的状态总览",
      body: "这里集中显示 Profile 完整度、课程板、推荐课程和 TeamUp 提醒。之后不知道从哪里开始，就先回 Dashboard。"
    },
    {
      id: "profile-proof-of-work",
      route: "/profile/me",
      targetSelector: '[data-onboarding-target="profile-proof-of-work"]',
      placement: "bottom",
      title: "补上 Proof-of-Work Profile",
      body: "写清 headline、技能标签和作品证明。别人看到的不是空白简历，而是你真正能贡献什么。"
    },
    {
      id: "contact-visibility",
      route: "/contact-info",
      targetSelector: '[data-onboarding-target="contact-visibility"]',
      placement: "left",
      title: "设置联系方式和可见性",
      body: "TEAMAKING 只做轻量连接，后续沟通可以转到 WeChat 等渠道；每个联系方式都能单独设置可见范围。"
    },
    {
      id: "courses-search",
      route: "/courses",
      targetSelector: '[data-onboarding-target="courses-search"]',
      placement: "bottom",
      title: "搜索并打开 Course Board",
      body: "打开 Course Board 只是浏览；只有发布 Teamaking Post，或对该课程下的 Post 发送 TeamUp Interest 后，才算参与这门课的 Course Board。"
    },
    {
      id: "teamup-entry",
      route: "/matches",
      targetSelector: '[data-onboarding-target="teamup-entry"]',
      placement: "bottom",
      title: "用 Matches 和 TeamUp 找人",
      body: "Matches 会优先参考同课记录、好友网络和公开资料。看到合适的人或帖子，可以发送轻量 TeamUp Interest。"
    },
    {
      id: "support-ticket",
      route: "/support",
      targetSelector: '[data-onboarding-target="support-ticket"]',
      placement: "left",
      title: "遇到问题提交可处理的工单",
      body: "请写清页面链接、截图或报错、课程代码、专业和入学年份。信息越完整，管理员越容易定位。"
    }
  ]
};

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validRoute(value: string) {
  return value.startsWith("/") && !value.startsWith("//") && !value.includes("://");
}

function sanitizeStep(step: unknown, index: number, errors: string[]): OnboardingGuideStep | null {
  if (!isPlainObject(step)) {
    errors.push(`steps[${index}] must be an object.`);
    return null;
  }

  const route = textValue(step.route);
  const targetSelector = textValue(step.targetSelector);
  const title = textValue(step.title);
  const body = textValue(step.body);
  const placement = textValue(step.placement) as OnboardingGuidePlacement;

  if (!validRoute(route)) errors.push(`steps[${index}].route must be an app-relative path.`);
  if (!targetSelector) errors.push(`steps[${index}].targetSelector is required.`);
  if (!title) errors.push(`steps[${index}].title is required.`);
  if (!body) errors.push(`steps[${index}].body is required.`);

  if (!validRoute(route) || !targetSelector || !title || !body) return null;

  return {
    id: textValue(step.id) || `step-${index + 1}`,
    route,
    targetSelector,
    placement: allowedPlacements.has(placement) ? placement : "bottom",
    title,
    body
  };
}

export function validateOnboardingGuideConfig(value: unknown): OnboardingGuideValidation {
  const errors: string[] = [];
  if (!isPlainObject(value)) {
    return { ok: false, guide: defaultOnboardingGuide, errors: ["onboarding_guide must be a JSON object."] };
  }

  if (!Array.isArray(value.steps)) {
    return { ok: false, guide: defaultOnboardingGuide, errors: ["onboarding_guide.steps must be an array."] };
  }

  const steps = value.steps
    .map((step, index) => sanitizeStep(step, index, errors))
    .filter((step): step is OnboardingGuideStep => Boolean(step));

  if (steps.length === 0) {
    errors.push("onboarding_guide.steps must contain at least one valid step.");
    return { ok: false, guide: defaultOnboardingGuide, errors };
  }

  return {
    ok: errors.length === 0,
    guide: {
      version: textValue(value.version) || defaultOnboardingGuide.version,
      steps
    },
    errors
  };
}

export function onboardingGuideFromConfig(value: unknown): OnboardingGuide {
  const validation = validateOnboardingGuideConfig(value);
  return validation.ok ? validation.guide : defaultOnboardingGuide;
}
