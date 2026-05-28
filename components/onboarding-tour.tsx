"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";

import { api, useApi } from "@/lib/client/api";
import { defaultOnboardingGuide, OnboardingGuide, OnboardingGuideStep, onboardingGuideFromConfig } from "@/lib/onboarding-guide";

const tourStorageKey = "teamaking.onboardingTour.v1";
const tourEventName = "teamaking:onboarding-tour-start";

type TourState = {
  active: boolean;
  stepIndex: number;
  manual?: boolean;
};

type TargetFrame = {
  rect: DOMRect;
  missing: boolean;
};

function readStoredTourState(): TourState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(tourStorageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TourState;
    if (typeof parsed?.stepIndex !== "number") return null;
    return { active: Boolean(parsed.active), stepIndex: Math.max(0, parsed.stepIndex), manual: Boolean(parsed.manual) };
  } catch {
    return null;
  }
}

function writeStoredTourState(state: TourState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(tourStorageKey, JSON.stringify(state));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function firstStepRoute(guide?: OnboardingGuide) {
  return guide?.steps[0]?.route ?? defaultOnboardingGuide.steps[0].route;
}

function routeStepIndex(guide: OnboardingGuide, pathname: string | null) {
  const index = guide.steps.findIndex((step) => step.route === pathname);
  return index >= 0 ? index : 0;
}

function popoverStyle(step: OnboardingGuideStep, frame: TargetFrame) {
  if (typeof window === "undefined") return {};
  if (window.innerWidth < 768) {
    return { bottom: 0, left: 0, right: 0, width: "100%" };
  }

  const width = 360;
  const gap = 14;
  const estimatedHeight = frame.missing ? 210 : 240;
  const rect = frame.rect;
  let top = rect.bottom + gap;
  let left = rect.left;

  if (step.placement === "right") {
    top = rect.top;
    left = rect.right + gap;
  } else if (step.placement === "left") {
    top = rect.top;
    left = rect.left - width - gap;
  } else if (step.placement === "top") {
    top = rect.top - estimatedHeight - gap;
    left = rect.left;
  }

  return {
    top: clamp(top, 16, Math.max(16, window.innerHeight - estimatedHeight - 16)),
    left: clamp(left, 16, Math.max(16, window.innerWidth - width - 16)),
    width
  };
}

export function requestOnboardingTourStart(stepIndex = 0) {
  if (typeof window === "undefined") return;
  const state = { active: true, stepIndex, manual: true };
  writeStoredTourState(state);
  window.dispatchEvent(new CustomEvent(tourEventName, { detail: state }));
}

export function OnboardingTourRestartButton({
  className,
  label = "重看新手引导"
}: {
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function restart() {
    setBusy(true);
    await api("/api/onboarding/tour-reset", { method: "POST" }).catch(() => null);
    requestOnboardingTourStart(0);
    router.push(firstStepRoute());
    setBusy(false);
  }

  return (
    <button type="button" className={className} onClick={restart} disabled={busy}>
      {busy ? "正在打开..." : label}
    </button>
  );
}

export function OnboardingTour() {
  const pathname = usePathname();
  const router = useRouter();
  const canLoad =
    Boolean(pathname) &&
    !pathname?.startsWith("/admin") &&
    !pathname?.startsWith("/crawler") &&
    !pathname?.startsWith("/login") &&
    !pathname?.startsWith("/admin-login");
  const { data: auth } = useApi(canLoad ? "/api/auth/me" : null, [canLoad, pathname]);
  const { data } = useApi(canLoad && auth?.user ? "/api/onboarding" : null, [canLoad, auth?.user?.id, pathname]);
  const guide = useMemo(() => onboardingGuideFromConfig(data?.guide), [data?.guide]);
  const dismissed = Boolean(data?.user?.profile?.onboardingTourDismissedAt);
  const [tourState, setTourState] = useState<TourState | null>(null);
  const [frame, setFrame] = useState<TargetFrame | null>(null);
  const [locallyDismissed, setLocallyDismissed] = useState(false);
  const stepIndex = clamp(tourState?.stepIndex ?? 0, 0, Math.max(0, guide.steps.length - 1));
  const step = guide.steps[stepIndex];

  const setAndStoreTourState = useCallback((state: TourState) => {
    writeStoredTourState(state);
    setTourState(state);
  }, []);

  const dismissTour = useCallback(async () => {
    setLocallyDismissed(true);
    setAndStoreTourState({ active: false, stepIndex });
    setFrame(null);
    await api("/api/onboarding/tour-dismiss", { method: "POST" }).catch(() => null);
  }, [setAndStoreTourState, stepIndex]);

  useEffect(() => {
    setTourState(readStoredTourState() ?? { active: false, stepIndex: 0 });
    const listener = (event: Event) => {
      const detail = event instanceof CustomEvent ? event.detail : null;
      const nextIndex = typeof detail?.stepIndex === "number" ? detail.stepIndex : 0;
      setLocallyDismissed(false);
      setTourState({ active: true, stepIndex: nextIndex, manual: true });
    };
    window.addEventListener(tourEventName, listener);
    return () => window.removeEventListener(tourEventName, listener);
  }, []);

  useEffect(() => {
    if (!data?.user || dismissed || locallyDismissed || tourState === null || tourState.active) return;
    if (!guide.steps.some((candidate) => candidate.route === pathname)) return;
    const startIndex = data.user.onboardingCompleted ? routeStepIndex(guide, pathname) : 0;
    setAndStoreTourState({ active: true, stepIndex: startIndex });
  }, [data?.user, dismissed, guide, locallyDismissed, pathname, setAndStoreTourState, tourState]);

  useEffect(() => {
    if (!tourState?.active || !step) return;
    if (pathname !== step.route) {
      router.push(step.route);
    }
  }, [pathname, router, step, tourState?.active]);

  useEffect(() => {
    if (!tourState?.active || !step || pathname !== step.route) {
      setFrame(null);
      return;
    }

    let cancelled = false;
    const measure = (shouldScroll = false) => {
      if (cancelled) return;
      let target: Element | null = null;
      try {
        target = document.querySelector(step.targetSelector);
      } catch {
        target = null;
      }
      const missing = !target;
      target = target ?? document.querySelector("[data-onboarding-fallback]") ?? document.querySelector("main");
      if (!target) return;
      if (shouldScroll) target.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
      window.setTimeout(() => {
        if (!cancelled && target) {
          const rect = (target as Element).getBoundingClientRect();
          setFrame({ rect, missing });
        }
      }, 180);
    };

    measure(true);
    const retryTimer = window.setTimeout(() => measure(true), 650);
    const lateRetryTimer = window.setTimeout(() => measure(false), 1400);
    const measureWithoutScroll = () => measure(false);
    window.addEventListener("resize", measureWithoutScroll);
    window.addEventListener("scroll", measureWithoutScroll, true);
    return () => {
      cancelled = true;
      window.clearTimeout(retryTimer);
      window.clearTimeout(lateRetryTimer);
      window.removeEventListener("resize", measureWithoutScroll);
      window.removeEventListener("scroll", measureWithoutScroll, true);
    };
  }, [pathname, step, tourState?.active]);

  if (!tourState?.active || !step || pathname !== step.route || !frame) return null;

  const isFirst = stepIndex <= 0;
  const isLast = stepIndex >= guide.steps.length - 1;
  const highlight = frame.missing
    ? null
    : {
        top: frame.rect.top - 6,
        left: frame.rect.left - 6,
        width: frame.rect.width + 12,
        height: frame.rect.height + 12
      };

  function goTo(nextIndex: number) {
    const clampedIndex = clamp(nextIndex, 0, guide.steps.length - 1);
    setAndStoreTourState({ active: true, stepIndex: clampedIndex, manual: tourState?.manual });
  }

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div className="absolute inset-0 bg-ink/20" />
      {highlight ? <div className="fixed rounded-sm border-2 border-coral bg-coral/10 shadow-hard" style={highlight} /> : null}
      <section
        className="pointer-events-auto fixed border-2 border-ink bg-paper p-4 shadow-hard md:max-w-[360px]"
        style={popoverStyle(step, frame)}
        aria-live="polite"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-coral">
            Step {stepIndex + 1} / {guide.steps.length}
          </p>
          <button type="button" onClick={dismissTour} className="border border-ink/30 p-1" aria-label="关闭新手引导">
            <X size={14} aria-hidden />
          </button>
        </div>
        <h2 className="mt-2 text-lg font-semibold text-ink">{step.title}</h2>
        <p className="mt-2 text-sm leading-6 text-ink/70">{step.body}</p>
        {frame.missing ? <p className="mt-2 text-xs leading-5 text-rust">目标控件暂时不可见，你仍然可以继续下一步。</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={dismissTour} className="border border-ink/30 px-3 py-2 text-sm font-semibold">
            跳过
          </button>
          <button
            type="button"
            disabled={isFirst}
            onClick={() => goTo(stepIndex - 1)}
            className="border border-ink/30 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
          >
            上一步
          </button>
          {isLast ? (
            <button type="button" onClick={dismissTour} className="bg-coral px-3 py-2 text-sm font-semibold text-paper">
              完成
            </button>
          ) : (
            <button type="button" onClick={() => goTo(stepIndex + 1)} className="bg-ink px-3 py-2 text-sm font-semibold text-paper">
              下一步
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
