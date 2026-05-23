export const strengths = [
  "academic writing",
  "research",
  "PPT design",
  "presentation",
  "data analysis",
  "coding",
  "project management",
  "visual design"
];

export const contributionTypes = [
  "literature review",
  "theory framework",
  "writing",
  "editing",
  "slides",
  "presenting",
  "data cleaning",
  "coding",
  "design"
];

export const activeTeamUpInterestStatuses = ["sent", "viewed", "mutual"] as const;
export const teamUpInterestStatuses = ["sent", "viewed", "mutual", "withdrawn", "refused", "closed", "deleted", "reported"] as const;

export const allowedRequestTransitions: Record<string, string[]> = {
  sent: ["viewed", "withdrawn", "refused", "reported"],
  viewed: ["mutual", "withdrawn", "refused", "reported"],
  mutual: ["closed", "reported"],
  withdrawn: [],
  refused: [],
  closed: ["deleted"],
  deleted: [],
  reported: []
};

export const followRequestStatuses = ["pending", "accepted", "refused", "withdrawn"] as const;
