import { describe, expect, it } from "vitest";
import { loginModeFromValue } from "@/lib/login-mode";

describe("login mode routing", () => {
  it("defaults public login entry to email registration", () => {
    expect(loginModeFromValue(undefined)).toBe("register");
    expect(loginModeFromValue("login")).toBe("login");
    expect(loginModeFromValue("reset")).toBe("reset");
    expect(loginModeFromValue("unknown")).toBe("register");
  });
});
