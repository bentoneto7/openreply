CREATE TYPE "SubscriptionStatus" AS ENUM (
  'NONE',
  'INCOMPLETE',
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'UNPAID',
  'PAUSED',
  'CANCELED'
);

ALTER TABLE "Workspace"
  ADD COLUMN "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "stripeCustomerId" TEXT,
  ADD COLUMN "stripeSubscriptionId" TEXT,
  ADD COLUMN "stripePriceId" TEXT,
  ADD COLUMN "subscriptionPeriodEnd" TIMESTAMP(3),
  ADD COLUMN "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "BillingEvent" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT,
  "stripeEventId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "processedAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Workspace_stripeCustomerId_key"
  ON "Workspace"("stripeCustomerId");
CREATE UNIQUE INDEX "Workspace_stripeSubscriptionId_key"
  ON "Workspace"("stripeSubscriptionId");
CREATE UNIQUE INDEX "BillingEvent_stripeEventId_key"
  ON "BillingEvent"("stripeEventId");
CREATE INDEX "BillingEvent_workspaceId_idx" ON "BillingEvent"("workspaceId");
CREATE INDEX "BillingEvent_type_idx" ON "BillingEvent"("type");
CREATE INDEX "BillingEvent_createdAt_idx" ON "BillingEvent"("createdAt");

ALTER TABLE "BillingEvent"
  ADD CONSTRAINT "BillingEvent_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
