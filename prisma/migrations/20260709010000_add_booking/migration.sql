-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "note" TEXT,
    "cancelToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Booking_cancelToken_key" ON "Booking"("cancelToken");

-- CreateIndex
CREATE INDEX "Booking_displayId_idx" ON "Booking"("displayId");

-- CreateIndex
CREATE INDEX "Booking_elementId_start_idx" ON "Booking"("elementId", "start");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_elementId_start_key" ON "Booking"("elementId", "start");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_displayId_fkey" FOREIGN KEY ("displayId") REFERENCES "Display"("id") ON DELETE CASCADE ON UPDATE CASCADE;
