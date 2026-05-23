-- Add password-based user auth, account moderation state, and purpose-specific email verification.
ALTER TABLE "User"
ADD COLUMN "passwordHash" TEXT,
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN "suspendedUntil" TIMESTAMP(3),
ADD COLUMN "adminNote" TEXT;

ALTER TABLE "EmailVerification"
ADD COLUMN "purpose" TEXT NOT NULL DEFAULT 'login';

CREATE INDEX "EmailVerification_email_purpose_idx" ON "EmailVerification"("email", "purpose");

ALTER TABLE "SupportTicket"
ADD COLUMN "adminReply" TEXT,
ADD COLUMN "adminRepliedAt" TIMESTAMP(3);
