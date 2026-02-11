-- CreateTable
CREATE TABLE "RotationFeedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rotationId" TEXT NOT NULL,
    "traineeProfileId" TEXT NOT NULL,
    "overallRating" INTEGER NOT NULL,
    "educationalValue" INTEGER NOT NULL,
    "supervisionQuality" INTEGER NOT NULL,
    "workEnvironment" INTEGER NOT NULL,
    "positives" TEXT,
    "improvements" TEXT,
    "otherComments" TEXT,
    "anonymous" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RotationFeedback_rotationId_fkey" FOREIGN KEY ("rotationId") REFERENCES "Rotation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RotationFeedback_traineeProfileId_fkey" FOREIGN KEY ("traineeProfileId") REFERENCES "TraineeProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FeedbackTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FeedbackTemplate_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FeedbackQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "questionType" TEXT NOT NULL,
    "options" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "FeedbackQuestion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "FeedbackTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FeedbackAnswer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "feedbackId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    CONSTRAINT "FeedbackAnswer_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "RotationFeedback" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FeedbackAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "FeedbackQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Assessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "traineeProfileId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "context" TEXT,
    "assessorId" TEXT,
    "rating" INTEGER,
    "narrativeFeedback" TEXT,
    "signedAt" DATETIME,
    "voidedAt" DATETIME,
    "voidedById" TEXT,
    "voidReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Assessment_traineeProfileId_fkey" FOREIGN KEY ("traineeProfileId") REFERENCES "TraineeProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Assessment_assessorId_fkey" FOREIGN KEY ("assessorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Assessment_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Assessment" ("assessorId", "context", "createdAt", "date", "id", "narrativeFeedback", "rating", "signedAt", "traineeProfileId", "type", "updatedAt") SELECT "assessorId", "context", "createdAt", "date", "id", "narrativeFeedback", "rating", "signedAt", "traineeProfileId", "type", "updatedAt" FROM "Assessment";
DROP TABLE "Assessment";
ALTER TABLE "new_Assessment" RENAME TO "Assessment";
CREATE INDEX "Assessment_traineeProfileId_idx" ON "Assessment"("traineeProfileId");
CREATE INDEX "Assessment_assessorId_idx" ON "Assessment"("assessorId");
CREATE INDEX "Assessment_signedAt_idx" ON "Assessment"("signedAt");
CREATE TABLE "new_SupervisionMeeting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "traineeProfileId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "notes" TEXT,
    "agreedActions" TEXT,
    "supervisorId" TEXT,
    "signedAt" DATETIME,
    "voidedAt" DATETIME,
    "voidedById" TEXT,
    "voidReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SupervisionMeeting_traineeProfileId_fkey" FOREIGN KEY ("traineeProfileId") REFERENCES "TraineeProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SupervisionMeeting_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SupervisionMeeting_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SupervisionMeeting" ("agreedActions", "createdAt", "date", "id", "notes", "signedAt", "supervisorId", "traineeProfileId", "updatedAt") SELECT "agreedActions", "createdAt", "date", "id", "notes", "signedAt", "supervisorId", "traineeProfileId", "updatedAt" FROM "SupervisionMeeting";
DROP TABLE "SupervisionMeeting";
ALTER TABLE "new_SupervisionMeeting" RENAME TO "SupervisionMeeting";
CREATE INDEX "SupervisionMeeting_traineeProfileId_idx" ON "SupervisionMeeting"("traineeProfileId");
CREATE INDEX "SupervisionMeeting_supervisorId_idx" ON "SupervisionMeeting"("supervisorId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "RotationFeedback_rotationId_key" ON "RotationFeedback"("rotationId");

-- CreateIndex
CREATE INDEX "RotationFeedback_rotationId_idx" ON "RotationFeedback"("rotationId");

-- CreateIndex
CREATE INDEX "RotationFeedback_traineeProfileId_idx" ON "RotationFeedback"("traineeProfileId");

-- CreateIndex
CREATE INDEX "FeedbackTemplate_clinicId_idx" ON "FeedbackTemplate"("clinicId");

-- CreateIndex
CREATE INDEX "FeedbackQuestion_templateId_idx" ON "FeedbackQuestion"("templateId");

-- CreateIndex
CREATE INDEX "FeedbackAnswer_feedbackId_idx" ON "FeedbackAnswer"("feedbackId");

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackAnswer_feedbackId_questionId_key" ON "FeedbackAnswer"("feedbackId", "questionId");
