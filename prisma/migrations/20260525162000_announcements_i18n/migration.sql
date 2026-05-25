-- Add bilingual site announcements and user read tracking.

CREATE TABLE "SiteAnnouncement" (
  "id" TEXT NOT NULL,
  "appVersionId" TEXT NOT NULL DEFAULT 'legacy',
  "titleZh" TEXT NOT NULL,
  "titleEn" TEXT,
  "bodyZh" TEXT NOT NULL,
  "bodyEn" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "audience" TEXT NOT NULL DEFAULT 'all',
  "priority" INTEGER NOT NULL DEFAULT 0,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "publishedByUserId" TEXT,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SiteAnnouncement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserAnnouncementRead" (
  "id" TEXT NOT NULL,
  "announcementId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dismissedAt" TIMESTAMP(3),

  CONSTRAINT "UserAnnouncementRead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SiteAnnouncement_appVersionId_status_publishedAt_idx"
  ON "SiteAnnouncement"("appVersionId", "status", "publishedAt");
CREATE INDEX "SiteAnnouncement_audience_idx" ON "SiteAnnouncement"("audience");
CREATE UNIQUE INDEX "UserAnnouncementRead_announcementId_userId_key"
  ON "UserAnnouncementRead"("announcementId", "userId");
CREATE INDEX "UserAnnouncementRead_userId_readAt_idx" ON "UserAnnouncementRead"("userId", "readAt");

ALTER TABLE "SiteAnnouncement"
  ADD CONSTRAINT "SiteAnnouncement_appVersionId_fkey"
  FOREIGN KEY ("appVersionId") REFERENCES "AppVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SiteAnnouncement"
  ADD CONSTRAINT "SiteAnnouncement_publishedByUserId_fkey"
  FOREIGN KEY ("publishedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UserAnnouncementRead"
  ADD CONSTRAINT "UserAnnouncementRead_announcementId_fkey"
  FOREIGN KEY ("announcementId") REFERENCES "SiteAnnouncement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserAnnouncementRead"
  ADD CONSTRAINT "UserAnnouncementRead_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
