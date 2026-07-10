-- Allow profile-scoped messages (no owning page)
ALTER TABLE "Message" ALTER COLUMN "displayId" DROP NOT NULL;
