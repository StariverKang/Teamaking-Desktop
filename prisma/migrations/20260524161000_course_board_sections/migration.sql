CREATE TABLE "CourseBoardSection" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'student_created',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CourseBoardSection_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CourseBoardMembership" ADD COLUMN "sectionId" TEXT, ADD COLUMN "sectionCode" TEXT;

CREATE UNIQUE INDEX "CourseBoardSection_boardId_code_key" ON "CourseBoardSection"("boardId", "code");
CREATE INDEX "CourseBoardSection_code_idx" ON "CourseBoardSection"("code");
CREATE INDEX "CourseBoardMembership_sectionId_idx" ON "CourseBoardMembership"("sectionId");
CREATE INDEX "CourseBoardMembership_sectionCode_idx" ON "CourseBoardMembership"("sectionCode");

ALTER TABLE "CourseBoardSection" ADD CONSTRAINT "CourseBoardSection_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "CourseBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseBoardSection" ADD CONSTRAINT "CourseBoardSection_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CourseBoardMembership" ADD CONSTRAINT "CourseBoardMembership_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "CourseBoardSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
