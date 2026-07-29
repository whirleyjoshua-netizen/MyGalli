CREATE TABLE "CrmStage" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#39D98A',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CrmStage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmContact" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "mergeKey" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "followUpAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CrmContact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmActivity" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceId" TEXT,
    "displayId" TEXT,
    "summary" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CrmActivity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CrmStage_ownerId_name_key" ON "CrmStage"("ownerId", "name");
CREATE INDEX "CrmStage_ownerId_order_idx" ON "CrmStage"("ownerId", "order");
CREATE UNIQUE INDEX "CrmContact_ownerId_mergeKey_key" ON "CrmContact"("ownerId", "mergeKey");
CREATE INDEX "CrmContact_ownerId_stageId_idx" ON "CrmContact"("ownerId", "stageId");
CREATE INDEX "CrmContact_ownerId_updatedAt_idx" ON "CrmContact"("ownerId", "updatedAt");
CREATE UNIQUE INDEX "CrmActivity_source_sourceId_key" ON "CrmActivity"("source", "sourceId");
CREATE INDEX "CrmActivity_contactId_occurredAt_idx" ON "CrmActivity"("contactId", "occurredAt");

ALTER TABLE "CrmStage" ADD CONSTRAINT "CrmStage_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmContact" ADD CONSTRAINT "CrmContact_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmContact" ADD CONSTRAINT "CrmContact_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "CrmStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
