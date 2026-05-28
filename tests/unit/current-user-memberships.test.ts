import { describe, expect, it } from "vitest";
import { publicUser } from "@/lib/server/services/user-service";

describe("current user Course Board memberships", () => {
  it("exposes only participation memberships triggered by posts or TeamUp", () => {
    const user = {
      id: "user-1",
      email: "student@mail.bnbu.edu.cn",
      role: "verified_user",
      status: "active",
      suspendedUntil: null,
      isEmailVerified: true,
      onboardingCompleted: true,
      school: null,
      profile: null,
      contactInfo: null,
      skills: [],
      memberships: [
        { id: "manual-membership", status: "active", source: "manual" },
        { id: "auto-membership", status: "active", source: "auto_major_required" },
        { id: "post-membership", status: "active", source: "teamaking_post" },
        { id: "teamup-membership", status: "active", source: "team_up" },
        { id: "left-teamup-membership", status: "left", source: "team_up" }
      ]
    };

    const result = publicUser(user, undefined, { includeMemberships: true }) as any;

    expect(result.memberships.map((membership: any) => membership.id)).toEqual([
      "post-membership",
      "teamup-membership"
    ]);
  });
});
