-- Additive commercial core. Existing leads remain valid and acquire no
-- invented stage timestamp: newAt is nullable for historical rows and gets a
-- default only for rows created after this migration.

-- Fail-safe default: every newly persisted campaign starts paused. Existing
-- campaigns keep their current value; activation remains an explicit action.
ALTER TABLE "Automation"
  ALTER COLUMN "isActive" SET DEFAULT false,
  ALTER COLUMN "reportShareEnabled" SET DEFAULT false;

CREATE TYPE "LeadOriginType" AS ENUM ('COMMENT', 'DIRECT_MESSAGE', 'MANUAL');
CREATE TYPE "LeadIntentCategory" AS ENUM (
  'PRICE',
  'LINK',
  'PURCHASE',
  'QUESTION',
  'OBJECTION',
  'COMPARISON',
  'URGENCY',
  'STRONG_INTEREST',
  'SUPPORT',
  'NO_COMMERCIAL_INTENT',
  'UNKNOWN'
);
CREATE TYPE "LeadIntentSource" AS ENUM ('RULE', 'HUMAN', 'AI');
CREATE TYPE "LeadEventType" AS ENUM (
  'OBSERVED_COMMENT',
  'OBSERVED_DM',
  'STATUS_CHANGED',
  'ASSIGNEE_CHANGED',
  'COMMERCIAL_FIELDS_UPDATED',
  'INTENT_CLASSIFIED',
  'INTENT_CORRECTED',
  'SALE_CONFIRMED',
  'SALE_VOIDED'
);
CREATE TYPE "SaleStatus" AS ENUM ('CONFIRMED', 'VOIDED');
CREATE TYPE "SaleSource" AS ENUM ('MANUAL', 'API');

ALTER TABLE "Lead"
  ADD COLUMN "assigneeMemberId" TEXT,
  ADD COLUMN "assigneeWorkspaceId" TEXT,
  ADD COLUMN "sourceAutomationId" TEXT,
  ADD COLUMN "sourceAutomationWorkspaceId" TEXT,
  ADD COLUMN "originType" "LeadOriginType",
  ADD COLUMN "originCommentId" TEXT,
  ADD COLUMN "originMessageId" TEXT,
  ADD COLUMN "originPostId" TEXT,
  ADD COLUMN "originKeyword" TEXT,
  ADD COLUMN "originText" TEXT,
  ADD COLUMN "productOffer" TEXT,
  ADD COLUMN "potentialValueCents" INTEGER,
  ADD COLUMN "nextAction" TEXT,
  ADD COLUMN "nextActionAt" TIMESTAMP(3),
  ADD COLUMN "lossReason" TEXT,
  ADD COLUMN "newAt" TIMESTAMP(3),
  ADD COLUMN "approachedAt" TIMESTAMP(3),
  ADD COLUMN "respondedAt" TIMESTAMP(3),
  ADD COLUMN "negotiatingAt" TIMESTAMP(3),
  ADD COLUMN "wonAt" TIMESTAMP(3),
  ADD COLUMN "lostAt" TIMESTAMP(3),
  ADD COLUMN "intentCategory" "LeadIntentCategory",
  ADD COLUMN "intentSignals" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "intentSource" "LeadIntentSource",
  ADD COLUMN "intentCorrectedAt" TIMESTAMP(3),
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Lead"
  ALTER COLUMN "newAt" SET DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX "WorkspaceMember_id_workspaceId_key"
  ON "WorkspaceMember"("id", "workspaceId");
CREATE UNIQUE INDEX "InstagramAccount_id_workspaceId_key"
  ON "InstagramAccount"("id", "workspaceId");
CREATE UNIQUE INDEX "Automation_id_workspaceId_key"
  ON "Automation"("id", "workspaceId");
CREATE UNIQUE INDEX "Lead_id_workspaceId_key"
  ON "Lead"("id", "workspaceId");
CREATE INDEX "Lead_workspaceId_status_updatedAt_id_idx"
  ON "Lead"("workspaceId", "status", "updatedAt", "id");
CREATE INDEX "Lead_workspaceId_assigneeMemberId_nextActionAt_idx"
  ON "Lead"("workspaceId", "assigneeMemberId", "nextActionAt");
CREATE INDEX "Lead_workspaceId_sourceAutomationId_idx"
  ON "Lead"("workspaceId", "sourceAutomationId");

ALTER TABLE "Lead"
  ADD CONSTRAINT "Lead_assignee_tenant_check" CHECK (
    ("assigneeMemberId" IS NULL AND "assigneeWorkspaceId" IS NULL)
    OR
    ("assigneeMemberId" IS NOT NULL AND "assigneeWorkspaceId" IS NOT NULL AND "assigneeWorkspaceId" = "workspaceId")
  ),
  ADD CONSTRAINT "Lead_source_automation_tenant_check" CHECK (
    ("sourceAutomationId" IS NULL AND "sourceAutomationWorkspaceId" IS NULL)
    OR
    ("sourceAutomationId" IS NOT NULL AND "sourceAutomationWorkspaceId" IS NOT NULL AND "sourceAutomationWorkspaceId" = "workspaceId")
  ),
  ADD CONSTRAINT "Lead_potential_value_check" CHECK (
    "potentialValueCents" IS NULL OR "potentialValueCents" >= 0
  ),
  ADD CONSTRAINT "Lead_version_check" CHECK ("version" > 0);

ALTER TABLE "Lead"
  ADD CONSTRAINT "Lead_instagramAccountId_workspaceId_fkey"
  FOREIGN KEY ("instagramAccountId", "workspaceId")
  REFERENCES "InstagramAccount"("id", "workspaceId")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Lead_assigneeMemberId_assigneeWorkspaceId_fkey"
  FOREIGN KEY ("assigneeMemberId", "assigneeWorkspaceId")
  REFERENCES "WorkspaceMember"("id", "workspaceId")
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Lead_sourceAutomationId_sourceAutomationWorkspaceId_fkey"
  FOREIGN KEY ("sourceAutomationId", "sourceAutomationWorkspaceId")
  REFERENCES "Automation"("id", "workspaceId")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "LeadEvent" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "type" "LeadEventType" NOT NULL,
  "fromStatus" "LeadStatus",
  "toStatus" "LeadStatus",
  "actorMemberId" TEXT,
  "actorWorkspaceId" TEXT,
  "sourceEventKey" TEXT NOT NULL,
  "requestFingerprint" TEXT,
  "metadata" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LeadEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LeadEvent_actor_tenant_check" CHECK (
    ("actorMemberId" IS NULL AND "actorWorkspaceId" IS NULL)
    OR
    ("actorMemberId" IS NOT NULL AND "actorWorkspaceId" IS NOT NULL AND "actorWorkspaceId" = "workspaceId")
  )
);

CREATE UNIQUE INDEX "LeadEvent_workspaceId_sourceEventKey_key"
  ON "LeadEvent"("workspaceId", "sourceEventKey");
CREATE INDEX "LeadEvent_workspaceId_leadId_occurredAt_idx"
  ON "LeadEvent"("workspaceId", "leadId", "occurredAt");
CREATE INDEX "LeadEvent_workspaceId_type_occurredAt_idx"
  ON "LeadEvent"("workspaceId", "type", "occurredAt");

ALTER TABLE "LeadEvent"
  ADD CONSTRAINT "LeadEvent_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "LeadEvent_leadId_workspaceId_fkey"
  FOREIGN KEY ("leadId", "workspaceId") REFERENCES "Lead"("id", "workspaceId")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "LeadEvent_actorMemberId_actorWorkspaceId_fkey"
  FOREIGN KEY ("actorMemberId", "actorWorkspaceId")
  REFERENCES "WorkspaceMember"("id", "workspaceId")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Sale" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "status" "SaleStatus" NOT NULL DEFAULT 'CONFIRMED',
  "amountCents" INTEGER NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "source" "SaleSource" NOT NULL DEFAULT 'MANUAL',
  "confirmedAt" TIMESTAMP(3) NOT NULL,
  "voidedAt" TIMESTAMP(3),
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Sale_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Sale_amount_check" CHECK ("amountCents" > 0),
  CONSTRAINT "Sale_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "Sale_status_timestamp_check" CHECK (
    ("status" = 'CONFIRMED' AND "voidedAt" IS NULL)
    OR
    ("status" = 'VOIDED' AND "voidedAt" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "Sale_workspaceId_idempotencyKey_key"
  ON "Sale"("workspaceId", "idempotencyKey");
CREATE UNIQUE INDEX "Sale_one_confirmed_per_lead_key"
  ON "Sale"("workspaceId", "leadId")
  WHERE "status" = 'CONFIRMED';
CREATE INDEX "Sale_workspaceId_status_confirmedAt_idx"
  ON "Sale"("workspaceId", "status", "confirmedAt");
CREATE INDEX "Sale_workspaceId_leadId_idx"
  ON "Sale"("workspaceId", "leadId");

ALTER TABLE "Sale"
  ADD CONSTRAINT "Sale_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Sale_leadId_workspaceId_fkey"
  FOREIGN KEY ("leadId", "workspaceId") REFERENCES "Lead"("id", "workspaceId")
  ON DELETE CASCADE ON UPDATE CASCADE;
