export const courseBoardParticipationSources = ["teamaking_post", "team_up"] as const;

export type CourseBoardParticipationSource = typeof courseBoardParticipationSources[number];

const participationSourceRank: Record<CourseBoardParticipationSource, number> = {
  team_up: 1,
  teamaking_post: 2
};

export function isCourseBoardParticipationSource(source: unknown): source is CourseBoardParticipationSource {
  return typeof source === "string" && courseBoardParticipationSources.includes(source as CourseBoardParticipationSource);
}

export function preferredParticipationSource(existingSource: unknown, nextSource: CourseBoardParticipationSource) {
  if (!isCourseBoardParticipationSource(existingSource)) return nextSource;
  return participationSourceRank[existingSource] >= participationSourceRank[nextSource] ? existingSource : nextSource;
}

export function activeCourseBoardParticipationWhere(extra: Record<string, unknown> = {}) {
  return {
    ...extra,
    status: "active",
    source: { in: [...courseBoardParticipationSources] }
  };
}

export function visibleCourseBoardMemberships(memberships: unknown) {
  if (!Array.isArray(memberships)) return [];
  return memberships.filter((membership: any) =>
    membership?.status === "active" && isCourseBoardParticipationSource(membership.source)
  );
}
