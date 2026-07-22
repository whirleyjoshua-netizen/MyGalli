-- Member-attached Pages on a community hub, moderated like HubDrop.
CREATE TABLE "HubPage" (
    "id" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "addedById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HubPage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HubPage_hubId_displayId_key" ON "HubPage"("hubId", "displayId");
CREATE INDEX "HubPage_hubId_status_idx" ON "HubPage"("hubId", "status");

ALTER TABLE "HubPage" ADD CONSTRAINT "HubPage_hubId_fkey"
    FOREIGN KEY ("hubId") REFERENCES "Hub"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HubPage" ADD CONSTRAINT "HubPage_displayId_fkey"
    FOREIGN KEY ("displayId") REFERENCES "Display"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HubPage" ADD CONSTRAINT "HubPage_addedById_fkey"
    FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
