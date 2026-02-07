// SAGA Shared Types and Constants

// ============================================
// ENUMS
// ============================================

export enum UserRole {
  ST_BT = 'ST_BT',
  HANDLEDARE = 'HANDLEDARE',
  STUDIEREKTOR = 'STUDIEREKTOR',
  ADMIN = 'ADMIN',
}

export enum TrackType {
  ST = 'ST',
  BT = 'BT',
}

export enum SubGoalStatus {
  EJ_PABORJAD = 'EJ_PABORJAD',
  PAGAENDE = 'PAGAENDE',
  UPPNADD = 'UPPNADD',
}

export enum SubGoalCategory {
  MEDICINSK_KOMPETENS = 'MEDICINSK_KOMPETENS',
  KOMMUNIKATION = 'KOMMUNIKATION',
  LEDARSKAP = 'LEDARSKAP',
  VETENSKAP = 'VETENSKAP',
  PROFESSIONALISM = 'PROFESSIONALISM',
}

export enum AssessmentType {
  DOPS = 'DOPS',
  MINI_CEX = 'MINI_CEX',
  CBD = 'CBD',
  ANNAT = 'ANNAT',
}

export enum CertificateType {
  TJANSTGORNINGSINTYG = 'TJANSTGORNINGSINTYG',
  KURSINTYG = 'KURSINTYG',
  KOMPETENSBEVIS = 'KOMPETENSBEVIS',
  HANDLEDARINTYG = 'HANDLEDARINTYG',
  OVRIGT = 'OVRIGT',
}

export enum RiskLevel {
  NONE = 'NONE',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export enum NotificationType {
  DEADLINE_REMINDER = 'DEADLINE_REMINDER',
  UNSIGNED_ASSESSMENT = 'UNSIGNED_ASSESSMENT',
  SUPERVISION_REMINDER = 'SUPERVISION_REMINDER',
  SUBGOAL_SIGNED = 'SUBGOAL_SIGNED',
  ASSESSMENT_SIGNED = 'ASSESSMENT_SIGNED',
  ROTATION_STARTING = 'ROTATION_STARTING',
  ROTATION_ENDING = 'ROTATION_ENDING',
  GENERAL = 'GENERAL',
}

// ============================================
// INTERFACES - User & Auth
// ============================================

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  clinicId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserCreateInput {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  clinicId?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token?: string;
}

// ============================================
// INTERFACES - Trainee Profile
// ============================================

export interface TraineeProfile {
  id: string;
  userId: string;
  user?: User;
  trackType: TrackType;
  specialty?: string;
  clinicId: string;
  clinic?: Clinic;
  startDate: Date;
  plannedEndDate: Date;
  supervisorId?: string;
  supervisor?: User;
  createdAt: Date;
  updatedAt: Date;
}

export interface TraineeProfileCreateInput {
  userId: string;
  trackType: TrackType;
  specialty?: string;
  clinicId: string;
  startDate: Date;
  plannedEndDate: Date;
  supervisorId?: string;
}

// ============================================
// INTERFACES - Clinic
// ============================================

export interface Clinic {
  id: string;
  name: string;
  organization?: string;
  createdAt: Date;
}

// ============================================
// INTERFACES - Goal Specification & SubGoals
// ============================================

export interface GoalSpec {
  id: string;
  name: string;
  version: string;
  specialty?: string;
  source?: string;
  createdAt: Date;
}

export interface SubGoal {
  id: string;
  goalSpecId: string;
  code: string;
  title: string;
  description?: string;
  category: SubGoalCategory;
  sortOrder: number;
}

export interface TraineeSubGoalProgress {
  id: string;
  traineeProfileId: string;
  subGoalId: string;
  subGoal?: SubGoal;
  status: SubGoalStatus;
  notes?: string;
  signedById?: string;
  signedBy?: User;
  signedAt?: Date;
  updatedAt: Date;
}

// ============================================
// INTERFACES - Rotation (Placering)
// ============================================

export interface Rotation {
  id: string;
  traineeProfileId: string;
  unit: string;
  specialtyArea?: string;
  startDate: Date;
  endDate: Date;
  planned: boolean;
  supervisorName?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RotationCreateInput {
  traineeProfileId: string;
  unit: string;
  specialtyArea?: string;
  startDate: Date;
  endDate: Date;
  planned: boolean;
  supervisorName?: string;
  notes?: string;
}

// ============================================
// INTERFACES - Course (Kurs)
// ============================================

export interface Course {
  id: string;
  traineeProfileId: string;
  title: string;
  provider?: string;
  startDate: Date;
  endDate?: Date;
  hours?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CourseCreateInput {
  traineeProfileId: string;
  title: string;
  provider?: string;
  startDate: Date;
  endDate?: Date;
  hours?: number;
  notes?: string;
  subGoalIds?: string[];
}

// ============================================
// INTERFACES - Assessment (Bedomning)
// ============================================

export interface Assessment {
  id: string;
  traineeProfileId: string;
  type: AssessmentType;
  date: Date;
  context?: string;
  assessorId?: string;
  assessor?: User;
  rating?: number;
  narrativeFeedback?: string;
  signedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssessmentCreateInput {
  traineeProfileId: string;
  type: AssessmentType;
  date: Date;
  context?: string;
  assessorId?: string;
  rating?: number;
  narrativeFeedback?: string;
  subGoalIds?: string[];
}

// ============================================
// INTERFACES - Supervision Meeting (Handledarsamtal)
// ============================================

export interface SupervisionMeeting {
  id: string;
  traineeProfileId: string;
  date: Date;
  notes?: string;
  agreedActions?: string;
  supervisorId?: string;
  supervisor?: User;
  signedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SupervisionMeetingCreateInput {
  traineeProfileId: string;
  date: Date;
  notes?: string;
  agreedActions?: string;
  supervisorId?: string;
}

// ============================================
// INTERFACES - Certificate (Intyg)
// ============================================

export interface Certificate {
  id: string;
  traineeProfileId: string;
  type: CertificateType;
  title?: string;
  issueDate?: Date;
  issuer?: string;
  filePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  ocrText?: string;
  ocrProcessedAt?: Date;
  parsedFields?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CertificateCreateInput {
  traineeProfileId: string;
  type: CertificateType;
  title?: string;
  issueDate?: Date;
  issuer?: string;
  subGoalIds?: string[];
}

export interface CertificateUpdateInput {
  type?: CertificateType;
  title?: string;
  issueDate?: Date;
  issuer?: string;
  ocrText?: string;
  parsedFields?: Record<string, unknown>;
  subGoalIds?: string[];
}

// ============================================
// INTERFACES - Audit Log
// ============================================

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: Date;
}

// ============================================
// INTERFACES - Notifications
// ============================================

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  readAt?: Date;
  emailSent: boolean;
  emailSentAt?: Date;
  createdAt: Date;
}

export interface NotificationPreference {
  id: string;
  userId: string;
  emailEnabled: boolean;
  deadlineReminders: boolean;
  unsignedAssessments: boolean;
  supervisionReminders: boolean;
  subGoalSigned: boolean;
  assessmentSigned: boolean;
  daysBeforeDeadline: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationPreferenceUpdateInput {
  emailEnabled?: boolean;
  deadlineReminders?: boolean;
  unsignedAssessments?: boolean;
  supervisionReminders?: boolean;
  subGoalSigned?: boolean;
  assessmentSigned?: boolean;
  daysBeforeDeadline?: number;
}

// ============================================
// INTERFACES - Dashboard & Statistics
// ============================================

export interface ProgressSummary {
  totalSubGoals: number;
  completedSubGoals: number;
  inProgressSubGoals: number;
  notStartedSubGoals: number;
  progressPercentage: number;
}

export interface TraineeDashboard {
  profile: TraineeProfile;
  progress: ProgressSummary;
  recentRotations: Rotation[];
  upcomingRotations: Rotation[];
  recentAssessments: Assessment[];
  unsignedAssessments: number;
  lastSupervisionMeeting?: SupervisionMeeting;
  daysSinceLastSupervision?: number;
  certificates: number;
  missingCertificates: string[];
  warnings: DashboardWarning[];
}

export interface DashboardWarning {
  type: 'MISSING_CERTIFICATE' | 'OLD_SUPERVISION' | 'UNSIGNED_ASSESSMENT' | 'ENDING_ROTATION';
  message: string;
  severity: RiskLevel;
}

export interface StudyDirectorOverview {
  traineeId: string;
  traineeName: string;
  trackType: TrackType;
  specialty?: string;
  progressPercentage: number;
  lastSupervisionDate?: Date;
  unsignedAssessments: number;
  riskLevel: RiskLevel;
}

// ============================================
// INTERFACES - Export
// ============================================

export interface ExportPackage {
  trainee: TraineeProfile;
  rotations: Rotation[];
  courses: Course[];
  assessments: Assessment[];
  supervisionMeetings: SupervisionMeeting[];
  certificates: Certificate[];
  subGoalProgress: TraineeSubGoalProgress[];
  generatedAt: Date;
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================
// CONSTANTS
// ============================================

export const SUBGOAL_CATEGORY_LABELS: Record<SubGoalCategory, string> = {
  [SubGoalCategory.MEDICINSK_KOMPETENS]: 'Medicinsk kompetens',
  [SubGoalCategory.KOMMUNIKATION]: 'Kommunikation',
  [SubGoalCategory.LEDARSKAP]: 'Ledarskap',
  [SubGoalCategory.VETENSKAP]: 'Vetenskap och kvalitetsarbete',
  [SubGoalCategory.PROFESSIONALISM]: 'Professionalism',
};

export const SUBGOAL_STATUS_LABELS: Record<SubGoalStatus, string> = {
  [SubGoalStatus.EJ_PABORJAD]: 'Ej påbörjad',
  [SubGoalStatus.PAGAENDE]: 'Pågående',
  [SubGoalStatus.UPPNADD]: 'Uppnådd',
};

export const ASSESSMENT_TYPE_LABELS: Record<AssessmentType, string> = {
  [AssessmentType.DOPS]: 'DOPS',
  [AssessmentType.MINI_CEX]: 'Mini-CEX',
  [AssessmentType.CBD]: 'CBD',
  [AssessmentType.ANNAT]: 'Annat',
};

export const CERTIFICATE_TYPE_LABELS: Record<CertificateType, string> = {
  [CertificateType.TJANSTGORNINGSINTYG]: 'Tjänstgöringsintyg',
  [CertificateType.KURSINTYG]: 'Kursintyg',
  [CertificateType.KOMPETENSBEVIS]: 'Kompetensbevis',
  [CertificateType.HANDLEDARINTYG]: 'Handledarintyg',
  [CertificateType.OVRIGT]: 'Övrigt',
};

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.ST_BT]: 'ST/BT-läkare',
  [UserRole.HANDLEDARE]: 'Handledare',
  [UserRole.STUDIEREKTOR]: 'Studierektor',
  [UserRole.ADMIN]: 'Administratör',
};

export const TRACK_TYPE_LABELS: Record<TrackType, string> = {
  [TrackType.ST]: 'ST (Specialisttjänstgöring)',
  [TrackType.BT]: 'BT (Bastjänstgöring)',
};

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  [RiskLevel.NONE]: 'Ingen risk',
  [RiskLevel.LOW]: 'Låg risk',
  [RiskLevel.MEDIUM]: 'Medel risk',
  [RiskLevel.HIGH]: 'Hög risk',
};

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  [NotificationType.DEADLINE_REMINDER]: 'Påminnelse om deadline',
  [NotificationType.UNSIGNED_ASSESSMENT]: 'Osignerad bedömning',
  [NotificationType.SUPERVISION_REMINDER]: 'Påminnelse om handledning',
  [NotificationType.SUBGOAL_SIGNED]: 'Delmål signerat',
  [NotificationType.ASSESSMENT_SIGNED]: 'Bedömning signerad',
  [NotificationType.ROTATION_STARTING]: 'Placering startar snart',
  [NotificationType.ROTATION_ENDING]: 'Placering slutar snart',
  [NotificationType.GENERAL]: 'Allmän notifikation',
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

export function formatDateSv(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('sv-SE');
}

export function formatDateTimeSv(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('sv-SE');
}

export function calculateProgressPercentage(completed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

export function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round(Math.abs((date1.getTime() - date2.getTime()) / oneDay));
}

export function isOverlapping(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean {
  return start1 <= end2 && end1 >= start2;
}
