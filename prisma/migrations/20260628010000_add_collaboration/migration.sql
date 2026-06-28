-- AlterTable
ALTER TABLE "Display" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "DisplayCollaborator" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'editor',
    "invitedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisplayCollaborator_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DisplayCollaborator_userId_idx" ON "DisplayCollaborator"("userId");

-- CreateIndex
CREATE INDEX "DisplayCollaborator_displayId_idx" ON "DisplayCollaborator"("displayId");

-- CreateIndex
CREATE UNIQUE INDEX "DisplayCollaborator_displayId_userId_key" ON "DisplayCollaborator"("displayId", "userId");

-- AddForeignKey
ALTER TABLE "DisplayCollaborator" ADD CONSTRAINT "DisplayCollaborator_displayId_fkey" FOREIGN KEY ("displayId") REFERENCES "Display"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisplayCollaborator" ADD CONSTRAINT "DisplayCollaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
