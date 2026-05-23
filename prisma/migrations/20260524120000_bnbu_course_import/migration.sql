-- Add BNBU course import batches, curriculum rules, syllabus metadata, and auto-join membership state.
ALTER TABLE "Faculty"
ADD COLUMN "code" TEXT;

ALTER TABLE "Major"
ADD COLUMN "code" TEXT;

ALTER TABLE "Semester"
ADD COLUMN "code" TEXT;

ALTER TABLE "Course"
ADD COLUMN "credits" DOUBLE PRECISION,
ADD COLUMN "ownerUnit" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "categoryTags" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "sourceRefIds" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "CourseOffering"
ADD COLUMN "sourceRefIds" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "CourseBoardMembership"
ADD COLUMN "source" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN "originRuleId" TEXT,
ADD COLUMN "leftAt" TIMESTAMP(3);

CREATE TABLE "CourseImportBatch" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT,
    "schemaVersion" TEXT NOT NULL,
    "semesterCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payload" JSONB NOT NULL,
    "validationSummary" JSONB NOT NULL DEFAULT '{}',
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedByUserId" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CourseImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourseCurriculumRule" (
    "id" TEXT NOT NULL,
    "importBatchId" TEXT,
    "externalId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "classificationLabel" TEXT,
    "studentAction" TEXT NOT NULL,
    "audience" JSONB NOT NULL DEFAULT '{}',
    "ownerUnit" JSONB NOT NULL DEFAULT '{}',
    "sourceRefIds" JSONB NOT NULL DEFAULT '[]',
    "confidence" TEXT NOT NULL DEFAULT 'unknown',
    "status" TEXT NOT NULL DEFAULT 'active',
    "raw" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CourseCurriculumRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourseSyllabusMetadata" (
    "id" TEXT NOT NULL,
    "courseOfferingId" TEXT NOT NULL,
    "teamworkRequirement" TEXT NOT NULL DEFAULT 'unknown',
    "teamworkSummary" TEXT,
    "evidenceSourceRefIds" JSONB NOT NULL DEFAULT '[]',
    "confidence" TEXT NOT NULL DEFAULT 'unknown',
    "raw" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CourseSyllabusMetadata_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Faculty_schoolId_code_key" ON "Faculty"("schoolId", "code");
CREATE UNIQUE INDEX "Major_schoolId_code_key" ON "Major"("schoolId", "code");
CREATE UNIQUE INDEX "Semester_schoolId_code_key" ON "Semester"("schoolId", "code");
CREATE INDEX "CourseOffering_courseId_semesterId_idx" ON "CourseOffering"("courseId", "semesterId");
CREATE INDEX "CourseBoardMembership_status_idx" ON "CourseBoardMembership"("status");
CREATE INDEX "CourseBoardMembership_originRuleId_idx" ON "CourseBoardMembership"("originRuleId");
CREATE INDEX "CourseImportBatch_schoolId_idx" ON "CourseImportBatch"("schoolId");
CREATE INDEX "CourseImportBatch_status_idx" ON "CourseImportBatch"("status");
CREATE INDEX "CourseImportBatch_semesterCode_idx" ON "CourseImportBatch"("semesterCode");
CREATE UNIQUE INDEX "CourseCurriculumRule_semesterId_externalId_key" ON "CourseCurriculumRule"("semesterId", "externalId");
CREATE INDEX "CourseCurriculumRule_courseId_idx" ON "CourseCurriculumRule"("courseId");
CREATE INDEX "CourseCurriculumRule_classification_idx" ON "CourseCurriculumRule"("classification");
CREATE INDEX "CourseCurriculumRule_studentAction_idx" ON "CourseCurriculumRule"("studentAction");
CREATE INDEX "CourseCurriculumRule_status_idx" ON "CourseCurriculumRule"("status");
CREATE UNIQUE INDEX "CourseSyllabusMetadata_courseOfferingId_key" ON "CourseSyllabusMetadata"("courseOfferingId");
CREATE INDEX "CourseSyllabusMetadata_teamworkRequirement_idx" ON "CourseSyllabusMetadata"("teamworkRequirement");

ALTER TABLE "CourseImportBatch" ADD CONSTRAINT "CourseImportBatch_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CourseCurriculumRule" ADD CONSTRAINT "CourseCurriculumRule_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "CourseImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CourseCurriculumRule" ADD CONSTRAINT "CourseCurriculumRule_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseCurriculumRule" ADD CONSTRAINT "CourseCurriculumRule_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseSyllabusMetadata" ADD CONSTRAINT "CourseSyllabusMetadata_courseOfferingId_fkey" FOREIGN KEY ("courseOfferingId") REFERENCES "CourseOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;
