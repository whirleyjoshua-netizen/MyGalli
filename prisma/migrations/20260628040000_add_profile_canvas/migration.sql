-- AlterTable
ALTER TABLE "Display" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'page';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "profileDisplayId" TEXT;
