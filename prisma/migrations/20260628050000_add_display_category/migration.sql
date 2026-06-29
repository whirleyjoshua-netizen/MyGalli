-- AlterTable
ALTER TABLE "Display" ADD COLUMN     "category" TEXT;

-- CreateIndex
CREATE INDEX "Display_category_idx" ON "Display"("category");
