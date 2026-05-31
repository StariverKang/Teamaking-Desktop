"use client";

export type FeedbackTone = "success" | "error" | "info";

export type FeedbackToast = {
  id: string;
  tone: FeedbackTone;
  message: string;
  createdAt: number;
  durationMs: number;
};

export type FeedbackState = {
  toasts: FeedbackToast[];
};

export type FeedbackAction =
  | { type: "add"; toast: FeedbackToast }
  | { type: "dismiss"; id: string }
  | { type: "clear" };

export const maxFeedbackToasts = 3;
export const feedbackReadErrorCooldownMs = 30_000;

export function feedbackReducer(state: FeedbackState, action: FeedbackAction): FeedbackState {
  if (action.type === "clear") return { toasts: [] };
  if (action.type === "dismiss") {
    return { toasts: state.toasts.filter((toast) => toast.id !== action.id) };
  }
  return { toasts: [action.toast, ...state.toasts.filter((toast) => toast.id !== action.toast.id)].slice(0, maxFeedbackToasts) };
}

export function feedbackDurationForTone(tone: FeedbackTone) {
  return tone === "error" ? 6000 : 4000;
}

export function createFeedbackToast(input: {
  id?: string;
  tone: FeedbackTone;
  message: string;
  now?: number;
  durationMs?: number;
}) {
  const now = input.now ?? Date.now();
  return {
    id: input.id ?? `${now}-${Math.random().toString(36).slice(2, 9)}`,
    tone: input.tone,
    message: input.message,
    createdAt: now,
    durationMs: input.durationMs ?? feedbackDurationForTone(input.tone)
  };
}

export function readErrorKey(scope: string, message: string) {
  return `${scope}::${message}`;
}

export function shouldNotifyReadError(
  lastSeen: Map<string, number>,
  scope: string,
  message: string,
  now = Date.now()
) {
  const key = readErrorKey(scope, message);
  const previous = lastSeen.get(key);
  if (previous !== undefined && now - previous < feedbackReadErrorCooldownMs) return false;
  lastSeen.set(key, now);
  return true;
}
