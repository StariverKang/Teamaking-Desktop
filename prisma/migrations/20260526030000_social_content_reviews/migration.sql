-- Social graph, course reviews, guided onboarding, and editable content documents.

ALTER TABLE "UserProfile"
ADD COLUMN "onboardingTourDismissedAt" TIMESTAMP(3),
ADD COLUMN "academicOverrideReason" TEXT,
ADD COLUMN "academicOverrideByUserId" TEXT,
ADD COLUMN "academicOverrideAt" TIMESTAMP(3);

CREATE TABLE "CourseReviewComment" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "parentId" TEXT,
  "body" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "deletedAt" TIMESTAMP(3),
  "deletedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CourseReviewComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContentDocument" (
  "id" TEXT NOT NULL,
  "appVersionId" TEXT NOT NULL DEFAULT 'legacy',
  "kind" TEXT NOT NULL,
  "parentId" TEXT,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "bodyMarkdown" TEXT NOT NULL DEFAULT '',
  "imageUrls" JSONB NOT NULL DEFAULT '[]',
  "status" TEXT NOT NULL DEFAULT 'draft',
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "publishedAt" TIMESTAMP(3),
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContentDocument_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CourseReviewComment"
ADD CONSTRAINT "CourseReviewComment_courseId_fkey"
FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CourseReviewComment"
ADD CONSTRAINT "CourseReviewComment_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CourseReviewComment"
ADD CONSTRAINT "CourseReviewComment_parentId_fkey"
FOREIGN KEY ("parentId") REFERENCES "CourseReviewComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContentDocument"
ADD CONSTRAINT "ContentDocument_appVersionId_fkey"
FOREIGN KEY ("appVersionId") REFERENCES "AppVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContentDocument"
ADD CONSTRAINT "ContentDocument_parentId_fkey"
FOREIGN KEY ("parentId") REFERENCES "ContentDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "CourseReviewComment_courseId_parentId_createdAt_idx" ON "CourseReviewComment"("courseId", "parentId", "createdAt");
CREATE INDEX "CourseReviewComment_userId_createdAt_idx" ON "CourseReviewComment"("userId", "createdAt");
CREATE INDEX "CourseReviewComment_status_idx" ON "CourseReviewComment"("status");

CREATE UNIQUE INDEX "ContentDocument_appVersionId_kind_slug_key" ON "ContentDocument"("appVersionId", "kind", "slug");
CREATE INDEX "ContentDocument_appVersionId_kind_status_idx" ON "ContentDocument"("appVersionId", "kind", "status");
CREATE INDEX "ContentDocument_parentId_idx" ON "ContentDocument"("parentId");
CREATE INDEX "ContentDocument_displayOrder_idx" ON "ContentDocument"("displayOrder");
