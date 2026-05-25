-- Beta hardening: error tracking, auth events, upload metadata, and course merge metadata.

ALTER TABLE "Course"
  ADD COLUMN "mergedIntoCourseId" TEXT,
  ADD COLUMN "mergedAt" TIMESTAMP(3),
  ADD COLUMN "mergeNote" TEXT;

CREATE INDEX "Course_mergedIntoCourseId_idx" ON "Course"("mergedIntoCourseId");

ALTER TABLE "PortfolioItem"
  ADD COLUMN "storageMode" TEXT,
  ADD COLUMN "storageProvider" TEXT,
  ADD COLUMN "objectKey" TEXT,
  ADD COLUMN "scanStatus" TEXT NOT NULL DEFAULT 'not_scanned';

CREATE TABLE "ErrorEvent" (
  "id" TEXT NOT NULL,
  "appVersionId" TEXT NOT NULL DEFAULT 'legacy',
  "requestId" TEXT NOT NULL,
  "errorCode" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "path" TEXT,
  "method" TEXT,
  "status" INTEGER,
  "userId" TEXT,
  "actorRole" TEXT,
  "stackDigest" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ErrorEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ErrorEvent_requestId_key" ON "ErrorEvent"("requestId");
CREATE INDEX "ErrorEvent_appVersionId_createdAt_idx" ON "ErrorEvent"("appVersionId", "createdAt");
CREATE INDEX "ErrorEvent_errorCode_idx" ON "ErrorEvent"("errorCode");
CREATE INDEX "ErrorEvent_userId_createdAt_idx" ON "ErrorEvent"("userId", "createdAt");
CREATE INDEX "ErrorEvent_path_idx" ON "ErrorEvent"("path");

CREATE TABLE "AuthEvent" (
  "id" TEXT NOT NULL,
  "appVersionId" TEXT NOT NULL DEFAULT 'legacy',
  "email" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "success" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AuthEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuthEvent_appVersionId_email_action_purpose_createdAt_idx"
  ON "AuthEvent"("appVersionId", "email", "action", "purpose", "createdAt");
CREATE INDEX "AuthEvent_action_success_createdAt_idx" ON "AuthEvent"("action", "success", "createdAt");

ALTER TABLE "ErrorEvent"
  ADD CONSTRAINT "ErrorEvent_appVersionId_fkey"
  FOREIGN KEY ("appVersionId") REFERENCES "AppVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ErrorEvent"
  ADD CONSTRAINT "ErrorEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AuthEvent"
  ADD CONSTRAINT "AuthEvent_appVersionId_fkey"
  FOREIGN KEY ("appVersionId") REFERENCES "AppVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
