import { describe, expect, it } from "vitest";
import {
  createFeedbackToast,
  feedbackReducer,
  feedbackDurationForTone,
  shouldNotifyReadError,
  type FeedbackState
} from "@/lib/client/feedback";

describe("feedback helpers", () => {
  it("keeps the newest three toasts and dismisses by id", () => {
    const state = ["one", "two", "three", "four"].reduce<FeedbackState>(
      (current, id, index) => feedbackReducer(current, {
        type: "add",
        toast: createFeedbackToast({ id, tone: index === 0 ? "error" : "success", message: id, now: index })
      }),
      { toasts: [] }
    );

    expect(state.toasts.map((toast) => toast.id)).toEqual(["four", "three", "two"]);
    expect(feedbackReducer(state, { type: "dismiss", id: "three" }).toasts.map((toast) => toast.id)).toEqual(["four", "two"]);
  });

  it("uses longer duration for errors", () => {
    expect(feedbackDurationForTone("success")).toBe(4000);
    expect(feedbackDurationForTone("info")).toBe(4000);
    expect(feedbackDurationForTone("error")).toBe(6000);
  });

  it("dedupes repeated read errors within the cooldown window", () => {
    const seen = new Map<string, number>();
    expect(shouldNotifyReadError(seen, "/api/example", "failed", 1000)).toBe(true);
    expect(shouldNotifyReadError(seen, "/api/example", "failed", 20_000)).toBe(false);
    expect(shouldNotifyReadError(seen, "/api/example", "failed", 32_000)).toBe(true);
    expect(shouldNotifyReadError(seen, "/api/other", "failed", 33_000)).toBe(true);
  });
});
