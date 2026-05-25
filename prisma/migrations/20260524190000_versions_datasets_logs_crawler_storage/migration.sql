-- Add application version isolation, import datasets, checkpoints, and operation logs.

CREATE TABLE "AppVersion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phase" TEXT NOT NULL DEFAULT 'testing',
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "finalCheckpointId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AppVersion_pkey" PRIMARY KEY ("id")
);

INSERT INTO "AppVersion" ("id", "name", "phase", "status", "startedAt", "createdAt", "updatedAt")
VALUES ('legacy', 'Legacy Initial Version', 'testing', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "User" ADD COLUMN "appVersionId" TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE "EmailVerification" ADD COLUMN "appVersionId" TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE "School" ADD COLUMN "appVersionId" TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE "CourseImportBatch" ADD COLUMN "appVersionId" TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE "CourseImportBatch" ADD COLUMN "datasetId" TEXT;
ALTER TABLE "CourseImportBatch" ADD COLUMN "name" TEXT;
ALTER TABLE "AdminAuditLog" ADD COLUMN "appVersionId" TEXT NOT NULL DEFAULT 'legacy';

DROP INDEX IF EXISTS "User_email_key";
DROP INDEX IF EXISTS "School_shortName_key";
DROP INDEX IF EXISTS "SchoolEmailDomain_domain_key";

CREATE TABLE "CourseImportDataset" (
    "id" TEXT NOT NULL,
    "appVersionId" TEXT NOT NULL DEFAULT 'legacy',
    "schoolId" TEXT,
    "name" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "semesterCode" TEXT,
    "cohortYears" JSONB NOT NULL DEFAULT '[]',
    "sourceLabel" TEXT,
    "payloadHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "summary" JSONB NOT NULL DEFAULT '{}',
    "validationSummary" JSONB NOT NULL DEFAULT '{}',
    "originalFileName" TEXT NOT NULL,
    "originalStorageKey" TEXT,
    "originalSize" INTEGER,
    "originalContentType" TEXT NOT NULL DEFAULT 'application/json',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CourseImportDataset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourseImportDatasetSourceRef" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT,
    "url" TEXT,
    "sourceType" TEXT,
    "raw" JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT "CourseImportDatasetSourceRef_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourseImportDatasetFaculty" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "raw" JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT "CourseImportDatasetFaculty_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourseImportDatasetMajor" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "facultyCode" TEXT,
    "degreeType" TEXT,
    "raw" JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT "CourseImportDatasetMajor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourseImportDatasetCourse" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "credits" DOUBLE PRECISION,
    "categoryTags" JSONB NOT NULL DEFAULT '[]',
    "ownerUnit" JSONB NOT NULL DEFAULT '{}',
    "raw" JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT "CourseImportDatasetCourse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourseImportDatasetRule" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "courseCode" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "studentAction" TEXT NOT NULL,
    "audience" JSONB NOT NULL DEFAULT '{}',
    "relativeTermCodes" JSONB NOT NULL DEFAULT '[]',
    "sourceRefIds" JSONB NOT NULL DEFAULT '[]',
    "raw" JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT "CourseImportDatasetRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourseImportDatasetOffering" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "courseCode" TEXT NOT NULL,
    "semesterCode" TEXT,
    "sections" JSONB NOT NULL DEFAULT '[]',
    "raw" JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT "CourseImportDatasetOffering_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VersionCheckpoint" (
    "id" TEXT NOT NULL,
    "appVersionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'operation',
    "reason" TEXT,
    "triggeredByUserId" TEXT,
    "summary" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VersionCheckpoint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VersionCheckpointChunk" (
    "id" TEXT NOT NULL,
    "checkpointId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "data" JSONB NOT NULL DEFAULT '[]',
    CONSTRAINT "VersionCheckpointChunk_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OperationLog" (
    "id" TEXT NOT NULL,
    "appVersionId" TEXT NOT NULL DEFAULT 'legacy',
    "actorUserId" TEXT,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "method" TEXT,
    "path" TEXT,
    "status" TEXT NOT NULL DEFAULT 'success',
    "summary" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OperationLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AppVersion_status_idx" ON "AppVersion"("status");
CREATE INDEX "AppVersion_phase_idx" ON "AppVersion"("phase");
CREATE UNIQUE INDEX "User_appVersionId_email_key" ON "User"("appVersionId", "email");
CREATE INDEX "User_appVersionId_idx" ON "User"("appVersionId");
CREATE INDEX "EmailVerification_appVersionId_idx" ON "EmailVerification"("appVersionId");
CREATE UNIQUE INDEX "School_appVersionId_shortName_key" ON "School"("appVersionId", "shortName");
CREATE INDEX "School_appVersionId_idx" ON "School"("appVersionId");
CREATE UNIQUE INDEX "SchoolEmailDomain_schoolId_domain_key" ON "SchoolEmailDomain"("schoolId", "domain");
CREATE INDEX "SchoolEmailDomain_domain_idx" ON "SchoolEmailDomain"("domain");
CREATE INDEX "CourseImportBatch_appVersionId_idx" ON "CourseImportBatch"("appVersionId");
CREATE INDEX "CourseImportBatch_datasetId_idx" ON "CourseImportBatch"("datasetId");
CREATE INDEX "CourseImportDataset_appVersionId_idx" ON "CourseImportDataset"("appVersionId");
CREATE INDEX "CourseImportDataset_schoolId_idx" ON "CourseImportDataset"("schoolId");
CREATE INDEX "CourseImportDataset_status_idx" ON "CourseImportDataset"("status");
CREATE INDEX "CourseImportDataset_payloadHash_idx" ON "CourseImportDataset"("payloadHash");
CREATE UNIQUE INDEX "CourseImportDatasetSourceRef_datasetId_externalId_key" ON "CourseImportDatasetSourceRef"("datasetId", "externalId");
CREATE UNIQUE INDEX "CourseImportDatasetFaculty_datasetId_code_key" ON "CourseImportDatasetFaculty"("datasetId", "code");
CREATE UNIQUE INDEX "CourseImportDatasetMajor_datasetId_code_key" ON "CourseImportDatasetMajor"("datasetId", "code");
CREATE UNIQUE INDEX "CourseImportDatasetCourse_datasetId_code_key" ON "CourseImportDatasetCourse"("datasetId", "code");
CREATE INDEX "CourseImportDatasetCourse_code_idx" ON "CourseImportDatasetCourse"("code");
CREATE UNIQUE INDEX "CourseImportDatasetRule_datasetId_externalId_key" ON "CourseImportDatasetRule"("datasetId", "externalId");
CREATE INDEX "CourseImportDatasetRule_courseCode_idx" ON "CourseImportDatasetRule"("courseCode");
CREATE INDEX "CourseImportDatasetRule_classification_idx" ON "CourseImportDatasetRule"("classification");
CREATE UNIQUE INDEX "CourseImportDatasetOffering_datasetId_externalId_key" ON "CourseImportDatasetOffering"("datasetId", "externalId");
CREATE INDEX "CourseImportDatasetOffering_courseCode_idx" ON "CourseImportDatasetOffering"("courseCode");
CREATE INDEX "VersionCheckpoint_appVersionId_idx" ON "VersionCheckpoint"("appVersionId");
CREATE INDEX "VersionCheckpoint_createdAt_idx" ON "VersionCheckpoint"("createdAt");
CREATE UNIQUE INDEX "VersionCheckpointChunk_checkpointId_name_key" ON "VersionCheckpointChunk"("checkpointId", "name");
CREATE INDEX "OperationLog_appVersionId_createdAt_idx" ON "OperationLog"("appVersionId", "createdAt");
CREATE INDEX "OperationLog_actorUserId_createdAt_idx" ON "OperationLog"("actorUserId", "createdAt");
CREATE INDEX "OperationLog_action_idx" ON "OperationLog"("action");
CREATE INDEX "OperationLog_targetType_targetId_idx" ON "OperationLog"("targetType", "targetId");
CREATE INDEX "AdminAuditLog_appVersionId_createdAt_idx" ON "AdminAuditLog"("appVersionId", "createdAt");

ALTER TABLE "User" ADD CONSTRAINT "User_appVersionId_fkey" FOREIGN KEY ("appVersionId") REFERENCES "AppVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmailVerification" ADD CONSTRAINT "EmailVerification_appVersionId_fkey" FOREIGN KEY ("appVersionId") REFERENCES "AppVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "School" ADD CONSTRAINT "School_appVersionId_fkey" FOREIGN KEY ("appVersionId") REFERENCES "AppVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CourseImportBatch" ADD CONSTRAINT "CourseImportBatch_appVersionId_fkey" FOREIGN KEY ("appVersionId") REFERENCES "AppVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CourseImportBatch" ADD CONSTRAINT "CourseImportBatch_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "CourseImportDataset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CourseImportDataset" ADD CONSTRAINT "CourseImportDataset_appVersionId_fkey" FOREIGN KEY ("appVersionId") REFERENCES "AppVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CourseImportDataset" ADD CONSTRAINT "CourseImportDataset_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CourseImportDatasetSourceRef" ADD CONSTRAINT "CourseImportDatasetSourceRef_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "CourseImportDataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseImportDatasetFaculty" ADD CONSTRAINT "CourseImportDatasetFaculty_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "CourseImportDataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseImportDatasetMajor" ADD CONSTRAINT "CourseImportDatasetMajor_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "CourseImportDataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseImportDatasetCourse" ADD CONSTRAINT "CourseImportDatasetCourse_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "CourseImportDataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseImportDatasetRule" ADD CONSTRAINT "CourseImportDatasetRule_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "CourseImportDataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseImportDatasetOffering" ADD CONSTRAINT "CourseImportDatasetOffering_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "CourseImportDataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VersionCheckpoint" ADD CONSTRAINT "VersionCheckpoint_appVersionId_fkey" FOREIGN KEY ("appVersionId") REFERENCES "AppVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VersionCheckpointChunk" ADD CONSTRAINT "VersionCheckpointChunk_checkpointId_fkey" FOREIGN KEY ("checkpointId") REFERENCES "VersionCheckpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OperationLog" ADD CONSTRAINT "OperationLog_appVersionId_fkey" FOREIGN KEY ("appVersionId") REFERENCES "AppVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationLog" ADD CONSTRAINT "OperationLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_appVersionId_fkey" FOREIGN KEY ("appVersionId") REFERENCES "AppVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
