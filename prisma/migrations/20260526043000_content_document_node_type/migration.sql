ALTER TABLE "ContentDocument" ADD COLUMN "nodeType" TEXT NOT NULL DEFAULT 'document';

CREATE INDEX "ContentDocument_nodeType_idx" ON "ContentDocument"("nodeType");
