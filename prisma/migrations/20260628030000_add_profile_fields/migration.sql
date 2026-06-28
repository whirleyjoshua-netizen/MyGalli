-- AlterTable
ALTER TABLE "User" ADD COLUMN     "featuredDisplayId" TEXT,
ADD COLUMN     "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "links" JSONB,
ADD COLUMN     "location" TEXT;
