-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "body" TEXT,
    "mediaUrl" TEXT,
    "senderName" TEXT,
    "senderEmail" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipHash" TEXT,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Message_ownerId_read_idx" ON "Message"("ownerId", "read");
CREATE INDEX "Message_ownerId_createdAt_idx" ON "Message"("ownerId", "createdAt");
CREATE INDEX "Message_displayId_idx" ON "Message"("displayId");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_displayId_fkey" FOREIGN KEY ("displayId") REFERENCES "Display"("id") ON DELETE CASCADE ON UPDATE CASCADE;
