-- CreateTable
CREATE TABLE "AppVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phase" TEXT NOT NULL DEFAULT 'testing',
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "createdByUserId" TEXT,
    "finalCheckpointId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appVersionId" TEXT NOT NULL DEFAULT 'legacy',
    "email" TEXT NOT NULL,
    "schoolId" TEXT,
    "role" TEXT NOT NULL DEFAULT 'verified_user',
    "passwordHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "suspendedUntil" DATETIME,
    "adminNote" TEXT,
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_appVersionId_fkey" FOREIGN KEY ("appVersionId") REFERENCES "AppVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "User_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmailVerification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appVersionId" TEXT NOT NULL DEFAULT 'legacy',
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'login',
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailVerification_appVersionId_fkey" FOREIGN KEY ("appVersionId") REFERENCES "AppVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "nickname" TEXT,
    "avatarUrl" TEXT,
    "backgroundImageUrl" TEXT,
    "headline" TEXT,
    "bio" TEXT NOT NULL DEFAULT '',
    "grade" TEXT,
    "entryYear" INTEGER,
    "entryTerm" TEXT,
    "facultyId" TEXT,
    "majorId" TEXT,
    "outputTags" JSONB NOT NULL DEFAULT '[]',
    "resumeUrl" TEXT,
    "resumeFileName" TEXT,
    "resumeParsedData" JSONB NOT NULL DEFAULT '{}',
    "openToBeDiscovered" BOOLEAN NOT NULL DEFAULT true,
    "visibilitySettings" JSONB NOT NULL DEFAULT '{}',
    "onboardingTourDismissedAt" DATETIME,
    "academicOverrideReason" TEXT,
    "academicOverrideByUserId" TEXT,
    "academicOverrideAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserProfile_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "UserProfile_majorId_fkey" FOREIGN KEY ("majorId") REFERENCES "Major" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContactInfo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "schoolEmail" TEXT NOT NULL,
    "wechatId" TEXT,
    "wechatQrImageUrl" TEXT,
    "linkedinUrl" TEXT,
    "personalEmail" TEXT,
    "visibilitySettings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContactInfo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "UserSkill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'beginner',
    "evidenceNote" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "UserSkill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appVersionId" TEXT NOT NULL DEFAULT 'legacy',
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "School_appVersionId_fkey" FOREIGN KEY ("appVersionId") REFERENCES "AppVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SchoolEmailDomain" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    CONSTRAINT "SchoolEmailDomain_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Faculty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    CONSTRAINT "Faculty_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Major" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "facultyId" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "degreeType" TEXT NOT NULL DEFAULT 'undergraduate',
    CONSTRAINT "Major_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Major_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Semester" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "term" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Semester_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "credits" REAL,
    "ownerUnit" JSONB NOT NULL DEFAULT '{}',
    "categoryTags" JSONB NOT NULL DEFAULT '[]',
    "sourceRefIds" JSONB NOT NULL DEFAULT '[]',
    "manualOverrideFields" JSONB NOT NULL DEFAULT '[]',
    "manualNote" TEXT,
    "catalogEffectiveYear" INTEGER,
    "catalogValidThroughYear" INTEGER,
    "catalogFingerprint" TEXT,
    "courseType" TEXT NOT NULL DEFAULT 'coursework',
    "status" TEXT NOT NULL DEFAULT 'active',
    "source" TEXT NOT NULL DEFAULT 'admin_seed',
    "mergedIntoCourseId" TEXT,
    "mergedAt" DATETIME,
    "mergeNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Course_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CourseOffering" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "teacherName" TEXT,
    "section" TEXT,
    "sourceRefIds" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CourseOffering_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CourseOffering_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CourseMajorMapping" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "majorId" TEXT NOT NULL,
    "recommendedGrade" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isDefaultRecommended" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "CourseMajorMapping_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CourseMajorMapping_majorId_fkey" FOREIGN KEY ("majorId") REFERENCES "Major" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CourseBoard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseOfferingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "rules" TEXT NOT NULL DEFAULT '请尊重同学，清楚表达自己的贡献方式，不要把 Course People 误认为官方选课名单。',
    "openFrom" DATETIME,
    "openUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CourseBoard_courseOfferingId_fkey" FOREIGN KEY ("courseOfferingId") REFERENCES "CourseOffering" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CourseBoardSection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "boardId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'student_created',
    "createdByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CourseBoardSection_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "CourseBoard" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CourseBoardSection_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CourseBoardMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "sectionId" TEXT,
    "sectionCode" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "status" TEXT NOT NULL DEFAULT 'active',
    "originRuleId" TEXT,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" DATETIME,
    CONSTRAINT "CourseBoardMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CourseBoardMembership_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "CourseBoard" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CourseBoardMembership_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "CourseBoardSection" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CourseImportBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appVersionId" TEXT NOT NULL DEFAULT 'legacy',
    "datasetId" TEXT,
    "schoolId" TEXT,
    "name" TEXT,
    "schemaVersion" TEXT NOT NULL,
    "semesterCode" TEXT,
    "cohortYears" JSONB NOT NULL DEFAULT '[]',
    "payloadHash" TEXT,
    "summary" JSONB NOT NULL DEFAULT '{}',
    "sourceLabel" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payload" JSONB NOT NULL,
    "validationSummary" JSONB NOT NULL DEFAULT '{}',
    "approvedByUserId" TEXT,
    "approvedAt" DATETIME,
    "rejectedByUserId" TEXT,
    "rejectedAt" DATETIME,
    "adminNote" TEXT,
    "approvalDecisions" JSONB NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CourseImportBatch_appVersionId_fkey" FOREIGN KEY ("appVersionId") REFERENCES "AppVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CourseImportBatch_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "CourseImportDataset" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CourseImportBatch_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CourseImportDataset" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CourseImportDataset_appVersionId_fkey" FOREIGN KEY ("appVersionId") REFERENCES "AppVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CourseImportDataset_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CourseImportDatasetSourceRef" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "datasetId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT,
    "url" TEXT,
    "sourceType" TEXT,
    "raw" JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT "CourseImportDatasetSourceRef_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "CourseImportDataset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CourseImportDatasetFaculty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "datasetId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "raw" JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT "CourseImportDatasetFaculty_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "CourseImportDataset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CourseImportDatasetMajor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "datasetId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "facultyCode" TEXT,
    "degreeType" TEXT,
    "raw" JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT "CourseImportDatasetMajor_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "CourseImportDataset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CourseImportDatasetCourse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "datasetId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "credits" REAL,
    "categoryTags" JSONB NOT NULL DEFAULT '[]',
    "ownerUnit" JSONB NOT NULL DEFAULT '{}',
    "sourceRefIds" JSONB NOT NULL DEFAULT '[]',
    "effectiveYear" INTEGER,
    "fingerprint" TEXT,
    "raw" JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT "CourseImportDatasetCourse_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "CourseImportDataset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CourseImportDatasetRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "datasetId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "courseCode" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "studentAction" TEXT NOT NULL,
    "audience" JSONB NOT NULL DEFAULT '{}',
    "relativeTermCodes" JSONB NOT NULL DEFAULT '[]',
    "sourceRefIds" JSONB NOT NULL DEFAULT '[]',
    "raw" JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT "CourseImportDatasetRule_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "CourseImportDataset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CourseImportDatasetOffering" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "datasetId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "courseCode" TEXT NOT NULL,
    "semesterCode" TEXT,
    "sections" JSONB NOT NULL DEFAULT '[]',
    "raw" JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT "CourseImportDatasetOffering_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "CourseImportDataset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CourseCurriculumRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importBatchId" TEXT,
    "externalId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "classificationLabel" TEXT,
    "studentAction" TEXT NOT NULL,
    "audience" JSONB NOT NULL DEFAULT '{}',
    "relativeTermCodes" JSONB NOT NULL DEFAULT '[]',
    "ownerUnit" JSONB NOT NULL DEFAULT '{}',
    "sourceRefIds" JSONB NOT NULL DEFAULT '[]',
    "confidence" TEXT NOT NULL DEFAULT 'unknown',
    "status" TEXT NOT NULL DEFAULT 'active',
    "raw" JSONB NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CourseCurriculumRule_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "CourseImportBatch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CourseCurriculumRule_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CourseCurriculumRule_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CourseSyllabusMetadata" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseOfferingId" TEXT NOT NULL,
    "teamworkRequirement" TEXT NOT NULL DEFAULT 'unknown',
    "teamworkSummary" TEXT,
    "evidenceSourceRefIds" JSONB NOT NULL DEFAULT '[]',
    "confidence" TEXT NOT NULL DEFAULT 'unknown',
    "raw" JSONB NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CourseSyllabusMetadata_courseOfferingId_fkey" FOREIGN KEY ("courseOfferingId") REFERENCES "CourseOffering" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CrawlerJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "createdByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CrawlerJob_appVersionId_fkey" FOREIGN KEY ("appVersionId") REFERENCES "AppVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserSubmittedCourse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "submittedByUserId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "teacherName" TEXT,
    "semesterText" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "adminNote" TEXT,
    "matchedCourseId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserSubmittedCourse_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserSubmittedCourse_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "submittedByUserId" TEXT,
    "email" TEXT,
    "category" TEXT NOT NULL DEFAULT 'other',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "relatedUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "adminNote" TEXT,
    "adminReply" TEXT,
    "adminRepliedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SupportTicket_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeamakingPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "boardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseOfferingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "strengths" JSONB NOT NULL DEFAULT '[]',
    "contributionTypes" JSONB NOT NULL DEFAULT '[]',
    "expectedOutcome" TEXT NOT NULL,
    "portfolioItemIds" JSONB NOT NULL DEFAULT '[]',
    "showWechatId" BOOLEAN NOT NULL DEFAULT false,
    "showWechatQr" BOOLEAN NOT NULL DEFAULT false,
    "showLinkedin" BOOLEAN NOT NULL DEFAULT false,
    "showPersonalEmail" BOOLEAN NOT NULL DEFAULT false,
    "visibility" TEXT NOT NULL DEFAULT 'same_course_board',
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TeamakingPost_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "CourseBoard" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamakingPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamakingPost_courseOfferingId_fkey" FOREIGN KEY ("courseOfferingId") REFERENCES "CourseOffering" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeamUpRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "senderContribution" TEXT NOT NULL,
    "senderContactSnapshot" JSONB NOT NULL DEFAULT '{}',
    "receiverContactSnapshot" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'sent',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TeamUpRequest_postId_fkey" FOREIGN KEY ("postId") REFERENCES "TeamakingPost" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamUpRequest_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamUpRequest_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FollowRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FollowRequest_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FollowRequest_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PortfolioItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "relatedCourseId" TEXT,
    "semesterText" TEXT,
    "myRole" TEXT,
    "contributionDescription" TEXT NOT NULL,
    "isGroupWork" BOOLEAN NOT NULL DEFAULT false,
    "fileName" TEXT,
    "fileMimeType" TEXT,
    "fileSize" INTEGER,
    "fileExtension" TEXT,
    "storageKey" TEXT,
    "storageMode" TEXT,
    "storageProvider" TEXT,
    "objectKey" TEXT,
    "scanStatus" TEXT NOT NULL DEFAULT 'not_scanned',
    "fileUrl" TEXT,
    "externalUrl" TEXT,
    "previewKind" TEXT NOT NULL DEFAULT 'link',
    "outcome" TEXT,
    "reflection" TEXT,
    "parsedText" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "visibility" TEXT NOT NULL DEFAULT 'same_school',
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PortfolioItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PortfolioItem_relatedCourseId_fkey" FOREIGN KEY ("relatedCourseId") REFERENCES "Course" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Endorsement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "willingToCollaborateAgain" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Endorsement_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Endorsement_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Endorsement_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CourseReviewComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentId" TEXT,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "deletedAt" DATETIME,
    "deletedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CourseReviewComment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CourseReviewComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CourseReviewComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CourseReviewComment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ErrorEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ErrorEvent_appVersionId_fkey" FOREIGN KEY ("appVersionId") REFERENCES "AppVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ErrorEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuthEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appVersionId" TEXT NOT NULL DEFAULT 'legacy',
    "email" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuthEvent_appVersionId_fkey" FOREIGN KEY ("appVersionId") REFERENCES "AppVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SiteConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedByUserId" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SiteAnnouncement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appVersionId" TEXT NOT NULL DEFAULT 'legacy',
    "titleZh" TEXT NOT NULL,
    "titleEn" TEXT,
    "bodyZh" TEXT NOT NULL,
    "bodyEn" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "audience" TEXT NOT NULL DEFAULT 'all',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "startsAt" DATETIME,
    "endsAt" DATETIME,
    "publishedAt" DATETIME,
    "publishedByUserId" TEXT,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SiteAnnouncement_appVersionId_fkey" FOREIGN KEY ("appVersionId") REFERENCES "AppVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SiteAnnouncement_publishedByUserId_fkey" FOREIGN KEY ("publishedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContentDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appVersionId" TEXT NOT NULL DEFAULT 'legacy',
    "kind" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL DEFAULT 'document',
    "parentId" TEXT,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "bodyMarkdown" TEXT NOT NULL DEFAULT '',
    "imageUrls" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" DATETIME,
    "updatedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContentDocument_appVersionId_fkey" FOREIGN KEY ("appVersionId") REFERENCES "AppVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ContentDocument_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ContentDocument" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserAnnouncementRead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "announcementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dismissedAt" DATETIME,
    CONSTRAINT "UserAnnouncementRead_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "SiteAnnouncement" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserAnnouncementRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VersionCheckpoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appVersionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'operation',
    "reason" TEXT,
    "triggeredByUserId" TEXT,
    "summary" JSONB NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VersionCheckpoint_appVersionId_fkey" FOREIGN KEY ("appVersionId") REFERENCES "AppVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VersionCheckpointChunk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "checkpointId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "data" JSONB NOT NULL DEFAULT '[]',
    CONSTRAINT "VersionCheckpointChunk_checkpointId_fkey" FOREIGN KEY ("checkpointId") REFERENCES "VersionCheckpoint" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OperationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OperationLog_appVersionId_fkey" FOREIGN KEY ("appVersionId") REFERENCES "AppVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OperationLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appVersionId" TEXT NOT NULL DEFAULT 'legacy',
    "adminUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "beforeValue" JSONB,
    "afterValue" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminAuditLog_appVersionId_fkey" FOREIGN KEY ("appVersionId") REFERENCES "AppVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AdminAuditLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AppVersion_status_idx" ON "AppVersion"("status");

-- CreateIndex
CREATE INDEX "AppVersion_phase_idx" ON "AppVersion"("phase");

-- CreateIndex
CREATE INDEX "User_appVersionId_idx" ON "User"("appVersionId");

-- CreateIndex
CREATE INDEX "User_schoolId_idx" ON "User"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "User_appVersionId_email_key" ON "User"("appVersionId", "email");

-- CreateIndex
CREATE INDEX "EmailVerification_appVersionId_idx" ON "EmailVerification"("appVersionId");

-- CreateIndex
CREATE INDEX "EmailVerification_email_idx" ON "EmailVerification"("email");

-- CreateIndex
CREATE INDEX "EmailVerification_email_purpose_idx" ON "EmailVerification"("email", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE INDEX "UserProfile_majorId_idx" ON "UserProfile"("majorId");

-- CreateIndex
CREATE INDEX "UserProfile_entryYear_entryTerm_idx" ON "UserProfile"("entryYear", "entryTerm");

-- CreateIndex
CREATE UNIQUE INDEX "ContactInfo_userId_key" ON "ContactInfo"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_name_key" ON "Skill"("name");

-- CreateIndex
CREATE UNIQUE INDEX "UserSkill_userId_skillId_key" ON "UserSkill"("userId", "skillId");

-- CreateIndex
CREATE INDEX "School_appVersionId_idx" ON "School"("appVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "School_appVersionId_shortName_key" ON "School"("appVersionId", "shortName");

-- CreateIndex
CREATE INDEX "SchoolEmailDomain_domain_idx" ON "SchoolEmailDomain"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolEmailDomain_schoolId_domain_key" ON "SchoolEmailDomain"("schoolId", "domain");

-- CreateIndex
CREATE UNIQUE INDEX "Faculty_schoolId_name_key" ON "Faculty"("schoolId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Faculty_schoolId_code_key" ON "Faculty"("schoolId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Major_schoolId_name_key" ON "Major"("schoolId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Major_schoolId_code_key" ON "Major"("schoolId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Semester_schoolId_name_key" ON "Semester"("schoolId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Semester_schoolId_code_key" ON "Semester"("schoolId", "code");

-- CreateIndex
CREATE INDEX "Course_title_idx" ON "Course"("title");

-- CreateIndex
CREATE INDEX "Course_catalogEffectiveYear_idx" ON "Course"("catalogEffectiveYear");

-- CreateIndex
CREATE INDEX "Course_catalogValidThroughYear_idx" ON "Course"("catalogValidThroughYear");

-- CreateIndex
CREATE INDEX "Course_catalogFingerprint_idx" ON "Course"("catalogFingerprint");

-- CreateIndex
CREATE INDEX "Course_mergedIntoCourseId_idx" ON "Course"("mergedIntoCourseId");

-- CreateIndex
CREATE UNIQUE INDEX "Course_schoolId_code_key" ON "Course"("schoolId", "code");

-- CreateIndex
CREATE INDEX "CourseOffering_courseId_semesterId_idx" ON "CourseOffering"("courseId", "semesterId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseMajorMapping_courseId_majorId_recommendedGrade_key" ON "CourseMajorMapping"("courseId", "majorId", "recommendedGrade");

-- CreateIndex
CREATE INDEX "CourseBoard_courseOfferingId_idx" ON "CourseBoard"("courseOfferingId");

-- CreateIndex
CREATE INDEX "CourseBoardSection_code_idx" ON "CourseBoardSection"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CourseBoardSection_boardId_code_key" ON "CourseBoardSection"("boardId", "code");

-- CreateIndex
CREATE INDEX "CourseBoardMembership_status_idx" ON "CourseBoardMembership"("status");

-- CreateIndex
CREATE INDEX "CourseBoardMembership_originRuleId_idx" ON "CourseBoardMembership"("originRuleId");

-- CreateIndex
CREATE INDEX "CourseBoardMembership_sectionId_idx" ON "CourseBoardMembership"("sectionId");

-- CreateIndex
CREATE INDEX "CourseBoardMembership_sectionCode_idx" ON "CourseBoardMembership"("sectionCode");

-- CreateIndex
CREATE UNIQUE INDEX "CourseBoardMembership_userId_boardId_key" ON "CourseBoardMembership"("userId", "boardId");

-- CreateIndex
CREATE INDEX "CourseImportBatch_appVersionId_idx" ON "CourseImportBatch"("appVersionId");

-- CreateIndex
CREATE INDEX "CourseImportBatch_datasetId_idx" ON "CourseImportBatch"("datasetId");

-- CreateIndex
CREATE INDEX "CourseImportBatch_schoolId_idx" ON "CourseImportBatch"("schoolId");

-- CreateIndex
CREATE INDEX "CourseImportBatch_status_idx" ON "CourseImportBatch"("status");

-- CreateIndex
CREATE INDEX "CourseImportBatch_semesterCode_idx" ON "CourseImportBatch"("semesterCode");

-- CreateIndex
CREATE INDEX "CourseImportBatch_payloadHash_idx" ON "CourseImportBatch"("payloadHash");

-- CreateIndex
CREATE INDEX "CourseImportDataset_appVersionId_idx" ON "CourseImportDataset"("appVersionId");

-- CreateIndex
CREATE INDEX "CourseImportDataset_schoolId_idx" ON "CourseImportDataset"("schoolId");

-- CreateIndex
CREATE INDEX "CourseImportDataset_status_idx" ON "CourseImportDataset"("status");

-- CreateIndex
CREATE INDEX "CourseImportDataset_payloadHash_idx" ON "CourseImportDataset"("payloadHash");

-- CreateIndex
CREATE UNIQUE INDEX "CourseImportDatasetSourceRef_datasetId_externalId_key" ON "CourseImportDatasetSourceRef"("datasetId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseImportDatasetFaculty_datasetId_code_key" ON "CourseImportDatasetFaculty"("datasetId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "CourseImportDatasetMajor_datasetId_code_key" ON "CourseImportDatasetMajor"("datasetId", "code");

-- CreateIndex
CREATE INDEX "CourseImportDatasetCourse_code_idx" ON "CourseImportDatasetCourse"("code");

-- CreateIndex
CREATE INDEX "CourseImportDatasetCourse_effectiveYear_idx" ON "CourseImportDatasetCourse"("effectiveYear");

-- CreateIndex
CREATE INDEX "CourseImportDatasetCourse_fingerprint_idx" ON "CourseImportDatasetCourse"("fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "CourseImportDatasetCourse_datasetId_code_key" ON "CourseImportDatasetCourse"("datasetId", "code");

-- CreateIndex
CREATE INDEX "CourseImportDatasetRule_courseCode_idx" ON "CourseImportDatasetRule"("courseCode");

-- CreateIndex
CREATE INDEX "CourseImportDatasetRule_classification_idx" ON "CourseImportDatasetRule"("classification");

-- CreateIndex
CREATE UNIQUE INDEX "CourseImportDatasetRule_datasetId_externalId_key" ON "CourseImportDatasetRule"("datasetId", "externalId");

-- CreateIndex
CREATE INDEX "CourseImportDatasetOffering_courseCode_idx" ON "CourseImportDatasetOffering"("courseCode");

-- CreateIndex
CREATE UNIQUE INDEX "CourseImportDatasetOffering_datasetId_externalId_key" ON "CourseImportDatasetOffering"("datasetId", "externalId");

-- CreateIndex
CREATE INDEX "CourseCurriculumRule_courseId_idx" ON "CourseCurriculumRule"("courseId");

-- CreateIndex
CREATE INDEX "CourseCurriculumRule_classification_idx" ON "CourseCurriculumRule"("classification");

-- CreateIndex
CREATE INDEX "CourseCurriculumRule_studentAction_idx" ON "CourseCurriculumRule"("studentAction");

-- CreateIndex
CREATE INDEX "CourseCurriculumRule_status_idx" ON "CourseCurriculumRule"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CourseCurriculumRule_semesterId_externalId_key" ON "CourseCurriculumRule"("semesterId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseSyllabusMetadata_courseOfferingId_key" ON "CourseSyllabusMetadata"("courseOfferingId");

-- CreateIndex
CREATE INDEX "CourseSyllabusMetadata_teamworkRequirement_idx" ON "CourseSyllabusMetadata"("teamworkRequirement");

-- CreateIndex
CREATE INDEX "CrawlerJob_appVersionId_startedAt_idx" ON "CrawlerJob"("appVersionId", "startedAt");

-- CreateIndex
CREATE INDEX "CrawlerJob_status_idx" ON "CrawlerJob"("status");

-- CreateIndex
CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket"("status");

-- CreateIndex
CREATE INDEX "SupportTicket_category_idx" ON "SupportTicket"("category");

-- CreateIndex
CREATE INDEX "SupportTicket_submittedByUserId_idx" ON "SupportTicket"("submittedByUserId");

-- CreateIndex
CREATE INDEX "TeamakingPost_boardId_status_idx" ON "TeamakingPost"("boardId", "status");

-- CreateIndex
CREATE INDEX "TeamakingPost_userId_idx" ON "TeamakingPost"("userId");

-- CreateIndex
CREATE INDEX "TeamUpRequest_senderId_idx" ON "TeamUpRequest"("senderId");

-- CreateIndex
CREATE INDEX "TeamUpRequest_receiverId_idx" ON "TeamUpRequest"("receiverId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamUpRequest_postId_senderId_key" ON "TeamUpRequest"("postId", "senderId");

-- CreateIndex
CREATE INDEX "FollowRequest_senderId_idx" ON "FollowRequest"("senderId");

-- CreateIndex
CREATE INDEX "FollowRequest_receiverId_idx" ON "FollowRequest"("receiverId");

-- CreateIndex
CREATE UNIQUE INDEX "FollowRequest_senderId_receiverId_key" ON "FollowRequest"("senderId", "receiverId");

-- CreateIndex
CREATE INDEX "CourseReviewComment_courseId_parentId_createdAt_idx" ON "CourseReviewComment"("courseId", "parentId", "createdAt");

-- CreateIndex
CREATE INDEX "CourseReviewComment_userId_createdAt_idx" ON "CourseReviewComment"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CourseReviewComment_status_idx" ON "CourseReviewComment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ErrorEvent_requestId_key" ON "ErrorEvent"("requestId");

-- CreateIndex
CREATE INDEX "ErrorEvent_appVersionId_createdAt_idx" ON "ErrorEvent"("appVersionId", "createdAt");

-- CreateIndex
CREATE INDEX "ErrorEvent_errorCode_idx" ON "ErrorEvent"("errorCode");

-- CreateIndex
CREATE INDEX "ErrorEvent_userId_createdAt_idx" ON "ErrorEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ErrorEvent_path_idx" ON "ErrorEvent"("path");

-- CreateIndex
CREATE INDEX "AuthEvent_appVersionId_email_action_purpose_createdAt_idx" ON "AuthEvent"("appVersionId", "email", "action", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "AuthEvent_action_success_createdAt_idx" ON "AuthEvent"("action", "success", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SiteConfig_key_key" ON "SiteConfig"("key");

-- CreateIndex
CREATE INDEX "SiteAnnouncement_appVersionId_status_publishedAt_idx" ON "SiteAnnouncement"("appVersionId", "status", "publishedAt");

-- CreateIndex
CREATE INDEX "SiteAnnouncement_audience_idx" ON "SiteAnnouncement"("audience");

-- CreateIndex
CREATE INDEX "ContentDocument_appVersionId_kind_status_idx" ON "ContentDocument"("appVersionId", "kind", "status");

-- CreateIndex
CREATE INDEX "ContentDocument_nodeType_idx" ON "ContentDocument"("nodeType");

-- CreateIndex
CREATE INDEX "ContentDocument_parentId_idx" ON "ContentDocument"("parentId");

-- CreateIndex
CREATE INDEX "ContentDocument_displayOrder_idx" ON "ContentDocument"("displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ContentDocument_appVersionId_kind_slug_key" ON "ContentDocument"("appVersionId", "kind", "slug");

-- CreateIndex
CREATE INDEX "UserAnnouncementRead_userId_readAt_idx" ON "UserAnnouncementRead"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserAnnouncementRead_announcementId_userId_key" ON "UserAnnouncementRead"("announcementId", "userId");

-- CreateIndex
CREATE INDEX "VersionCheckpoint_appVersionId_idx" ON "VersionCheckpoint"("appVersionId");

-- CreateIndex
CREATE INDEX "VersionCheckpoint_createdAt_idx" ON "VersionCheckpoint"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "VersionCheckpointChunk_checkpointId_name_key" ON "VersionCheckpointChunk"("checkpointId", "name");

-- CreateIndex
CREATE INDEX "OperationLog_appVersionId_createdAt_idx" ON "OperationLog"("appVersionId", "createdAt");

-- CreateIndex
CREATE INDEX "OperationLog_actorUserId_createdAt_idx" ON "OperationLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "OperationLog_action_idx" ON "OperationLog"("action");

-- CreateIndex
CREATE INDEX "OperationLog_targetType_targetId_idx" ON "OperationLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_appVersionId_createdAt_idx" ON "AdminAuditLog"("appVersionId", "createdAt");
