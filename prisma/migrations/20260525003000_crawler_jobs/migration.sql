CREATE TABLE "CrawlerJob" (
    "id" TEXT NOT NULL,
    "appVersionId" TEXT NOT NULL DEFAULT 'legacy',
    "name" TEXT NOT NULL,
    "target" TEXT NOT NULL DEFAULT 'programme_handbook',
    "status" TEXT NOT NULL DEFAULT 'running',
    "input" JSONB NOT NULL DEFAULT '{}',
    "command" TEXT,
    "logs" JSONB NOT NULL DEFAULT '[]',
    "outputs" JSONB NOT NULL DEFAULT '[]',
    "errorMessage" TEXT,
    "exitCode" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrawlerJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CrawlerJob_appVersionId_startedAt_idx" ON "CrawlerJob"("appVersionId", "startedAt");
CREATE INDEX "CrawlerJob_status_idx" ON "CrawlerJob"("status");

ALTER TABLE "CrawlerJob" ADD CONSTRAINT "CrawlerJob_appVersionId_fkey" FOREIGN KEY ("appVersionId") REFERENCES "AppVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
