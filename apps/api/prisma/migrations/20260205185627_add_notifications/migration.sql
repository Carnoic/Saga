-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ST_BT',
    "clinicId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Clinic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "organization" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TraineeProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "trackType" TEXT NOT NULL,
    "specialty" TEXT,
    "clinicId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "plannedEndDate" DATETIME NOT NULL,
    "supervisorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TraineeProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TraineeProfile_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TraineeProfile_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GoalSpec" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "specialty" TEXT,
    "source" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SubGoal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "goalSpecId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "SubGoal_goalSpecId_fkey" FOREIGN KEY ("goalSpecId") REFERENCES "GoalSpec" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TraineeSubGoalProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "traineeProfileId" TEXT NOT NULL,
    "subGoalId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'EJ_PABORJAD',
    "notes" TEXT,
    "signedById" TEXT,
    "signedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TraineeSubGoalProgress_traineeProfileId_fkey" FOREIGN KEY ("traineeProfileId") REFERENCES "TraineeProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TraineeSubGoalProgress_subGoalId_fkey" FOREIGN KEY ("subGoalId") REFERENCES "SubGoal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TraineeSubGoalProgress_signedById_fkey" FOREIGN KEY ("signedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Rotation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "traineeProfileId" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "specialtyArea" TEXT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "planned" BOOLEAN NOT NULL DEFAULT false,
    "supervisorName" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Rotation_traineeProfileId_fkey" FOREIGN KEY ("traineeProfileId") REFERENCES "TraineeProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RotationSubGoal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rotationId" TEXT NOT NULL,
    "subGoalId" TEXT NOT NULL,
    CONSTRAINT "RotationSubGoal_rotationId_fkey" FOREIGN KEY ("rotationId") REFERENCES "Rotation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RotationSubGoal_subGoalId_fkey" FOREIGN KEY ("subGoalId") REFERENCES "SubGoal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "traineeProfileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "provider" TEXT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "hours" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Course_traineeProfileId_fkey" FOREIGN KEY ("traineeProfileId") REFERENCES "TraineeProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CourseSubGoal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "subGoalId" TEXT NOT NULL,
    CONSTRAINT "CourseSubGoal_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CourseSubGoal_subGoalId_fkey" FOREIGN KEY ("subGoalId") REFERENCES "SubGoal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "traineeProfileId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "context" TEXT,
    "assessorId" TEXT,
    "rating" INTEGER,
    "narrativeFeedback" TEXT,
    "signedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Assessment_traineeProfileId_fkey" FOREIGN KEY ("traineeProfileId") REFERENCES "TraineeProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Assessment_assessorId_fkey" FOREIGN KEY ("assessorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssessmentSubGoal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assessmentId" TEXT NOT NULL,
    "subGoalId" TEXT NOT NULL,
    CONSTRAINT "AssessmentSubGoal_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssessmentSubGoal_subGoalId_fkey" FOREIGN KEY ("subGoalId") REFERENCES "SubGoal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupervisionMeeting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "traineeProfileId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "notes" TEXT,
    "agreedActions" TEXT,
    "supervisorId" TEXT,
    "signedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SupervisionMeeting_traineeProfileId_fkey" FOREIGN KEY ("traineeProfileId") REFERENCES "TraineeProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SupervisionMeeting_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "traineeProfileId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "issueDate" DATETIME,
    "issuer" TEXT,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "ocrText" TEXT,
    "ocrProcessedAt" DATETIME,
    "parsedFields" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Certificate_traineeProfileId_fkey" FOREIGN KEY ("traineeProfileId") REFERENCES "TraineeProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CertificateSubGoal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "certificateId" TEXT NOT NULL,
    "subGoalId" TEXT NOT NULL,
    CONSTRAINT "CertificateSubGoal_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CertificateSubGoal_subGoalId_fkey" FOREIGN KEY ("subGoalId") REFERENCES "SubGoal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" DATETIME,
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "emailSentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "deadlineReminders" BOOLEAN NOT NULL DEFAULT true,
    "unsignedAssessments" BOOLEAN NOT NULL DEFAULT true,
    "supervisionReminders" BOOLEAN NOT NULL DEFAULT true,
    "subGoalSigned" BOOLEAN NOT NULL DEFAULT true,
    "assessmentSigned" BOOLEAN NOT NULL DEFAULT true,
    "daysBeforeDeadline" INTEGER NOT NULL DEFAULT 30,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "ipAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_clinicId_idx" ON "User"("clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_token_idx" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TraineeProfile_userId_key" ON "TraineeProfile"("userId");

-- CreateIndex
CREATE INDEX "TraineeProfile_clinicId_idx" ON "TraineeProfile"("clinicId");

-- CreateIndex
CREATE INDEX "TraineeProfile_supervisorId_idx" ON "TraineeProfile"("supervisorId");

-- CreateIndex
CREATE UNIQUE INDEX "GoalSpec_name_version_key" ON "GoalSpec"("name", "version");

-- CreateIndex
CREATE INDEX "SubGoal_goalSpecId_idx" ON "SubGoal"("goalSpecId");

-- CreateIndex
CREATE INDEX "SubGoal_category_idx" ON "SubGoal"("category");

-- CreateIndex
CREATE UNIQUE INDEX "SubGoal_goalSpecId_code_key" ON "SubGoal"("goalSpecId", "code");

-- CreateIndex
CREATE INDEX "TraineeSubGoalProgress_traineeProfileId_idx" ON "TraineeSubGoalProgress"("traineeProfileId");

-- CreateIndex
CREATE INDEX "TraineeSubGoalProgress_subGoalId_idx" ON "TraineeSubGoalProgress"("subGoalId");

-- CreateIndex
CREATE UNIQUE INDEX "TraineeSubGoalProgress_traineeProfileId_subGoalId_key" ON "TraineeSubGoalProgress"("traineeProfileId", "subGoalId");

-- CreateIndex
CREATE INDEX "Rotation_traineeProfileId_idx" ON "Rotation"("traineeProfileId");

-- CreateIndex
CREATE INDEX "Rotation_startDate_endDate_idx" ON "Rotation"("startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "RotationSubGoal_rotationId_subGoalId_key" ON "RotationSubGoal"("rotationId", "subGoalId");

-- CreateIndex
CREATE INDEX "Course_traineeProfileId_idx" ON "Course"("traineeProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseSubGoal_courseId_subGoalId_key" ON "CourseSubGoal"("courseId", "subGoalId");

-- CreateIndex
CREATE INDEX "Assessment_traineeProfileId_idx" ON "Assessment"("traineeProfileId");

-- CreateIndex
CREATE INDEX "Assessment_assessorId_idx" ON "Assessment"("assessorId");

-- CreateIndex
CREATE INDEX "Assessment_signedAt_idx" ON "Assessment"("signedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentSubGoal_assessmentId_subGoalId_key" ON "AssessmentSubGoal"("assessmentId", "subGoalId");

-- CreateIndex
CREATE INDEX "SupervisionMeeting_traineeProfileId_idx" ON "SupervisionMeeting"("traineeProfileId");

-- CreateIndex
CREATE INDEX "SupervisionMeeting_supervisorId_idx" ON "SupervisionMeeting"("supervisorId");

-- CreateIndex
CREATE INDEX "Certificate_traineeProfileId_idx" ON "Certificate"("traineeProfileId");

-- CreateIndex
CREATE INDEX "Certificate_type_idx" ON "Certificate"("type");

-- CreateIndex
CREATE UNIQUE INDEX "CertificateSubGoal_certificateId_subGoalId_key" ON "CertificateSubGoal"("certificateId", "subGoalId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_read_idx" ON "Notification"("read");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE INDEX "NotificationPreference_userId_idx" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
