import { describe, expect, it, vi } from "vitest";
import {
  activeCourseBoardParticipationWhere,
  preferredParticipationSource,
  visibleCourseBoardMemberships
} from "@/lib/course-board-participation";
import { ensureCourseBoardParticipation } from "@/lib/server/services/course-service";

describe("Course Board participation semantics", () => {
  it("treats only post and TeamUp memberships as active participation", () => {
    expect(activeCourseBoardParticipationWhere({ userId: "user-1" })).toEqual({
      userId: "user-1",
      status: "active",
      source: { in: ["teamaking_post", "team_up"] }
    });
    expect(visibleCourseBoardMemberships([
      { id: "manual", status: "active", source: "manual" },
      { id: "post", status: "active", source: "teamaking_post" },
      { id: "teamup", status: "active", source: "team_up" },
      { id: "left", status: "left", source: "team_up" }
    ]).map((membership: any) => membership.id)).toEqual(["post", "teamup"]);
  });

  it("keeps post participation stronger than a later TeamUp action", async () => {
    const tx = {
      courseBoardSection: {
        findUnique: vi.fn().mockResolvedValue({ id: "section-1001", code: "1001" })
      },
      courseBoardMembership: {
        findUnique: vi.fn().mockResolvedValue({ id: "membership-1", source: "teamaking_post" }),
        upsert: vi.fn().mockResolvedValue({ id: "membership-1", source: "teamaking_post" })
      }
    };

    await ensureCourseBoardParticipation(tx, {
      userId: "user-1",
      boardId: "board-1",
      source: "team_up"
    });

    expect(preferredParticipationSource("teamaking_post", "team_up")).toBe("teamaking_post");
    expect(tx.courseBoardMembership.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({
        source: "teamaking_post",
        sectionCode: "1001",
        status: "active"
      })
    }));
  });
});
