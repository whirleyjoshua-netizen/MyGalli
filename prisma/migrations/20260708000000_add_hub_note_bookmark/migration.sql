-- CreateTable
CREATE TABLE "HubNoteBookmark" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "page" INTEGER NOT NULL,
    "rects" JSONB NOT NULL,
    "text" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HubNoteBookmark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HubNoteBookmark_hubId_itemId_idx" ON "HubNoteBookmark"("hubId", "itemId");
CREATE INDEX "HubNoteBookmark_noteId_idx" ON "HubNoteBookmark"("noteId");

-- AddForeignKey
ALTER TABLE "HubNoteBookmark" ADD CONSTRAINT "HubNoteBookmark_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "HubNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "HubNote" ADD COLUMN "color" TEXT NOT NULL DEFAULT '#FDE047';
