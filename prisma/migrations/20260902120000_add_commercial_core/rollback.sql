-- Manual rollback for 20260902120000_add_commercial_core.
--
-- WARNING: this removes all commercial events, sales, attribution and enriched
-- lead fields created after the forward migration. Export that data first.
-- Run only after deploying application code that no longer references these
-- columns or tables. Prisma does not execute this file automatically.
--
-- The fail-safe defaults `isActive=false` and `reportShareEnabled=false` are
-- independent security hardening. They intentionally survive this rollback so
-- reverting the commercial core cannot silently activate outbound campaigns or
-- public report links.

DROP TABLE IF EXISTS "Sale";
DROP TABLE IF EXISTS "LeadEvent";

ALTER TABLE "Lead"
  DROP CONSTRAINT IF EXISTS "Lead_instagramAccountId_workspaceId_fkey",
  DROP CONSTRAINT IF EXISTS "Lead_assigneeMemberId_assigneeWorkspaceId_fkey",
  DROP CONSTRAINT IF EXISTS "Lead_sourceAutomationId_sourceAutomationWorkspaceId_fkey",
  DROP CONSTRAINT IF EXISTS "Lead_assignee_tenant_check",
  DROP CONSTRAINT IF EXISTS "Lead_source_automation_tenant_check",
  DROP CONSTRAINT IF EXISTS "Lead_potential_value_check",
  DROP CONSTRAINT IF EXISTS "Lead_version_check";

DROP INDEX IF EXISTS "Lead_workspaceId_sourceAutomationId_idx";
DROP INDEX IF EXISTS "Lead_workspaceId_assigneeMemberId_nextActionAt_idx";
DROP INDEX IF EXISTS "Lead_workspaceId_status_updatedAt_id_idx";
DROP INDEX IF EXISTS "Lead_id_workspaceId_key";
DROP INDEX IF EXISTS "Automation_id_workspaceId_key";
DROP INDEX IF EXISTS "InstagramAccount_id_workspaceId_key";
DROP INDEX IF EXISTS "WorkspaceMember_id_workspaceId_key";

ALTER TABLE "Lead"
  DROP COLUMN IF EXISTS "assigneeMemberId",
  DROP COLUMN IF EXISTS "assigneeWorkspaceId",
  DROP COLUMN IF EXISTS "sourceAutomationId",
  DROP COLUMN IF EXISTS "sourceAutomationWorkspaceId",
  DROP COLUMN IF EXISTS "originType",
  DROP COLUMN IF EXISTS "originCommentId",
  DROP COLUMN IF EXISTS "originMessageId",
  DROP COLUMN IF EXISTS "originPostId",
  DROP COLUMN IF EXISTS "originKeyword",
  DROP COLUMN IF EXISTS "originText",
  DROP COLUMN IF EXISTS "productOffer",
  DROP COLUMN IF EXISTS "potentialValueCents",
  DROP COLUMN IF EXISTS "nextAction",
  DROP COLUMN IF EXISTS "nextActionAt",
  DROP COLUMN IF EXISTS "lossReason",
  DROP COLUMN IF EXISTS "newAt",
  DROP COLUMN IF EXISTS "approachedAt",
  DROP COLUMN IF EXISTS "respondedAt",
  DROP COLUMN IF EXISTS "negotiatingAt",
  DROP COLUMN IF EXISTS "wonAt",
  DROP COLUMN IF EXISTS "lostAt",
  DROP COLUMN IF EXISTS "intentCategory",
  DROP COLUMN IF EXISTS "intentSignals",
  DROP COLUMN IF EXISTS "intentSource",
  DROP COLUMN IF EXISTS "intentCorrectedAt",
  DROP COLUMN IF EXISTS "version";

DROP TYPE IF EXISTS "SaleSource";
DROP TYPE IF EXISTS "SaleStatus";
DROP TYPE IF EXISTS "LeadEventType";
DROP TYPE IF EXISTS "LeadIntentSource";
DROP TYPE IF EXISTS "LeadIntentCategory";
DROP TYPE IF EXISTS "LeadOriginType";
