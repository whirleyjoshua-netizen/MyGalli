-- CreateTable
CREATE TABLE "Acknowledgment" (
    "id" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "displayId" TEXT,
    "hubPostId" TEXT,
    "userId" TEXT NOT NULL,
    "round" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Acknowledgment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcknowledgmentRound" (
    "scopeKey" TEXT NOT NULL,
    "round" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcknowledgmentRound_pkey" PRIMARY KEY ("scopeKey")
);

-- CreateIndex
CREATE UNIQUE INDEX "Acknowledgment_scopeKey_userId_round_key" ON "Acknowledgment"("scopeKey", "userId", "round");

-- CreateIndex
CREATE INDEX "Acknowledgment_scopeKey_round_idx" ON "Acknowledgment"("scopeKey", "round");

-- CreateIndex
CREATE INDEX "Acknowledgment_userId_idx" ON "Acknowledgment"("userId");

-- AddForeignKey
ALTER TABLE "Acknowledgment" ADD CONSTRAINT "Acknowledgment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
