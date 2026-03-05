-- AlterTable: Make password optional for Google OAuth users
ALTER TABLE "User" ALTER COLUMN "password" DROP NOT NULL;

-- AlterTable: Add Google ID
ALTER TABLE "User" ADD COLUMN "googleId" TEXT;

-- CreateIndex: Unique constraint on googleId
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
