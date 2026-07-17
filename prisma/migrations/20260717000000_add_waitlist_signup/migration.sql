-- Wait List element: one signup row per (display, element, email). Additive only.
CREATE TABLE "WaitlistSignup" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaitlistSignup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WaitlistSignup_displayId_elementId_email_key" ON "WaitlistSignup"("displayId", "elementId", "email");
CREATE INDEX "WaitlistSignup_displayId_elementId_idx" ON "WaitlistSignup"("displayId", "elementId");

ALTER TABLE "WaitlistSignup" ADD CONSTRAINT "WaitlistSignup_displayId_fkey" FOREIGN KEY ("displayId") REFERENCES "Display"("id") ON DELETE CASCADE ON UPDATE CASCADE;
