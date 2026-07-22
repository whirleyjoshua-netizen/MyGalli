-- Owner/collaborator announcements shown as a banner in the community hub header.
CREATE TABLE "HubAnnouncement" (
    "id" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HubAnnouncement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HubAnnouncement_hubId_createdAt_idx" ON "HubAnnouncement"("hubId", "createdAt");

ALTER TABLE "HubAnnouncement" ADD CONSTRAINT "HubAnnouncement_hubId_fkey"
    FOREIGN KEY ("hubId") REFERENCES "Hub"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HubAnnouncement" ADD CONSTRAINT "HubAnnouncement_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
