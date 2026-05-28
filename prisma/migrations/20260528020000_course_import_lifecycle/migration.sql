-- Course catalog lifecycle metadata and reviewable import decisions.
ALTER TABLE "Course"
  ADD COLUMN "catalogEffectiveYear" INTEGER,
  ADD COLUMN "catalogValidThroughYear" INTEGER,
  ADD COLUMN "catalogFingerprint" TEXT;

CREATE INDEX "Course_catalogEffectiveYear_idx" ON "Course"("catalogEffectiveYear");
CREATE INDEX "Course_catalogValidThroughYear_idx" ON "Course"("catalogValidThroughYear");
CREATE INDEX "Course_catalogFingerprint_idx" ON "Course"("catalogFingerprint");

ALTER TABLE "CourseImportBatch"
  ADD COLUMN "approvalDecisions" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "CourseImportDatasetCourse"
  ADD COLUMN "description" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "sourceRefIds" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "effectiveYear" INTEGER,
  ADD COLUMN "fingerprint" TEXT;

CREATE INDEX "CourseImportDatasetCourse_effectiveYear_idx" ON "CourseImportDatasetCourse"("effectiveYear");
CREATE INDEX "CourseImportDatasetCourse_fingerprint_idx" ON "CourseImportDatasetCourse"("fingerprint");
