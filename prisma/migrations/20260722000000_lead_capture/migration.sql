-- CreateTable
CREATE TABLE "LeadCapture" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "delivered" BOOLEAN NOT NULL DEFAULT false,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadCapture_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadCapture_displayId_elementId_idx" ON "LeadCapture"("displayId", "elementId");

-- CreateIndex
CREATE INDEX "LeadCapture_displayId_createdAt_idx" ON "LeadCapture"("displayId", "createdAt");

-- AddForeignKey
ALTER TABLE "LeadCapture" ADD CONSTRAINT "LeadCapture_displayId_fkey" FOREIGN KEY ("displayId") REFERENCES "Display"("id") ON DELETE CASCADE ON UPDATE CASCADE;
