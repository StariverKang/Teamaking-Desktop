import { describe, expect, it } from "vitest";
import { discoveryPostsWhere } from "@/lib/server/api/social/matches-resource";

describe("social discovery visibility", () => {
  it("excludes the current user's own Teamaking Posts from discovery results", () => {
    expect(discoveryPostsWhere({ id: "user-self", schoolId: "school-1" }, ["board-1"])).toMatchObject({
      status: "open",
      userId: { not: "user-self" },
      OR: [
        { boardId: { in: ["board-1"] } },
        { visibility: "same_school", user: { schoolId: "school-1" } }
      ]
    });
  });
});
