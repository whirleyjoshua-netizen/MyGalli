CREATE TABLE "HubEvent" (
    "id" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HubEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "HubEvent_hubId_startsAt_idx" ON "HubEvent"("hubId", "startsAt");
ALTER TABLE "HubEvent" ADD CONSTRAINT "HubEvent_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "Hub"("id") ON DELETE CASCADE ON UPDATE CASCADE;
