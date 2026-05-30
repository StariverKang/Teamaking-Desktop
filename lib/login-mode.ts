export type LoginMode = "login" | "register" | "reset";

export function loginModeFromValue(value: unknown, fallback: LoginMode = "register"): LoginMode {
  return value === "login" || value === "register" || value === "reset" ? value : fallback;
}
