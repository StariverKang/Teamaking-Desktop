"use client";

import { createContext, useCallback, useContext, useMemo, useReducer, useRef } from "react";
import { X } from "lucide-react";
import clsx from "clsx";

import {
  createFeedbackToast,
  feedbackReducer,
  shouldNotifyReadError,
  type FeedbackTone
} from "@/lib/client/feedback";

type NotifyOptions = {
  durationMs?: number;
};

type RunFeedbackConfig<T> = {
  success: string | ((result: T) => string);
  error?: string | ((error: unknown) => string);
  tone?: FeedbackTone;
};

type FeedbackContextValue = {
  notifySuccess: (message: string, options?: NotifyOptions) => void;
  notifyError: (message: string, options?: NotifyOptions) => void;
  notifyInfo: (message: string, options?: NotifyOptions) => void;
  notifyReadErrorOnce: (scope: string, message: string) => void;
  runWithFeedback: <T>(action: () => Promise<T>, config: RunFeedbackConfig<T>) => Promise<T>;
};

const noop = () => undefined;
const defaultFeedback: FeedbackContextValue = {
  notifySuccess: noop,
  notifyError: noop,
  notifyInfo: noop,
  notifyReadErrorOnce: noop,
  runWithFeedback: async (action) => action()
};

const FeedbackContext = createContext<FeedbackContextValue>(defaultFeedback);

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(feedbackReducer, { toasts: [] });
  const readErrorSeen = useRef(new Map<string, number>());

  const notify = useCallback((tone: FeedbackTone, message: string, options?: NotifyOptions) => {
    const normalized = message.trim();
    if (!normalized) return;
    const toast = createFeedbackToast({ tone, message: normalized, durationMs: options?.durationMs });
    dispatch({ type: "add", toast });
    window.setTimeout(() => dispatch({ type: "dismiss", id: toast.id }), toast.durationMs);
  }, []);

  const value = useMemo<FeedbackContextValue>(() => ({
    notifySuccess: (message, options) => notify("success", message, options),
    notifyError: (message, options) => notify("error", message, options),
    notifyInfo: (message, options) => notify("info", message, options),
    notifyReadErrorOnce: (scope, message) => {
      if (shouldNotifyReadError(readErrorSeen.current, scope, message)) notify("error", message);
    },
    runWithFeedback: async (action, config) => {
      try {
        const result = await action();
        const message = typeof config.success === "function" ? config.success(result) : config.success;
        notify(config.tone ?? "success", message);
        return result;
      } catch (error) {
        const message = config.error
          ? typeof config.error === "function" ? config.error(error) : config.error
          : error instanceof Error ? error.message : "操作失败，请稍后再试。";
        notify("error", message);
        throw error;
      }
    }
  }), [notify]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 left-4 z-[70] grid w-[min(420px,calc(100vw-2rem))] gap-2" aria-live="polite" aria-atomic="false">
        {state.toasts.map((toast) => (
          <div
            key={toast.id}
            data-testid="feedback-toast"
            role={toast.tone === "error" ? "alert" : "status"}
            className={clsx(
              "pointer-events-auto feedback-toast flex items-start justify-between gap-3 border px-4 py-3 text-sm font-semibold shadow-soft",
              toast.tone === "success" && "border-forest/35 bg-chalk text-forest",
              toast.tone === "error" && "border-coral/45 bg-chalk text-coral",
              toast.tone === "info" && "border-ink/25 bg-chalk text-ink"
            )}
          >
            <span className="min-w-0 leading-6">{toast.message}</span>
            <button
              type="button"
              onClick={() => dispatch({ type: "dismiss", id: toast.id })}
              className="focus-ring -mr-1 mt-0.5 grid h-6 w-6 shrink-0 place-items-center border border-current/20"
              aria-label="关闭反馈"
            >
              <X size={14} aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  return useContext(FeedbackContext);
}
