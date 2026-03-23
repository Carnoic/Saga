-- CreateTable
CREATE TABLE "Kvast360Response" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "traineeProfileId" TEXT NOT NULL,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedById" TEXT,
    "respondentType" TEXT NOT NULL,
    "positiveFeedback" TEXT,
    "improvementFeedback" TEXT,
    "competencies" TEXT NOT NULL,
    "addressComments" TEXT,
    "otherComments" TEXT,
    CONSTRAINT "Kvast360Response_traineeProfileId_fkey" FOREIGN KEY ("traineeProfileId") REFERENCES "TraineeProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Kvast360Response_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Kvast360Response_traineeProfileId_idx" ON "Kvast360Response"("traineeProfileId");

-- CreateIndex
CREATE INDEX "Kvast360Response_submittedAt_idx" ON "Kvast360Response"("submittedAt");
