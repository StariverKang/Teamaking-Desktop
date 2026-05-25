ALTER TABLE "Course"
ADD COLUMN "manualOverrideFields" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "manualNote" TEXT;

ALTER TABLE "CourseImportBatch"
ADD COLUMN "cohortYears" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "payloadHash" TEXT,
ADD COLUMN "summary" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "sourceLabel" TEXT;

CREATE INDEX "CourseImportBatch_payloadHash_idx" ON "CourseImportBatch"("payloadHash");
