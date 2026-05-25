-- Support BNBU import v2 relative-term curriculum matching.

ALTER TABLE "UserProfile"
ADD COLUMN "entryYear" INTEGER,
ADD COLUMN "entryTerm" TEXT;

ALTER TABLE "CourseCurriculumRule"
ADD COLUMN "relativeTermCodes" JSONB NOT NULL DEFAULT '[]';

CREATE INDEX "UserProfile_entryYear_entryTerm_idx" ON "UserProfile"("entryYear", "entryTerm");
