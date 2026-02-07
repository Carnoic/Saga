import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { UserRole, formatDateSv, TRACK_TYPE_LABELS, RiskLevel, RISK_LEVEL_LABELS } from '@saga/shared';
import {
  Target,
  Calendar,
  FileText,
  ClipboardCheck,
  Users,
  AlertTriangle,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';

function ProgressRing({ percentage }: { percentage: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative w-24 h-24">
      <svg className="w-24 h-24 transform -rotate-90">
        <circle
          cx="48"
          cy="48"
          r={radius}
          stroke="currentColor"
          strokeWidth="8"
          fill="none"
          className="text-gray-200"
        />
        <circle
          cx="48"
          cy="48"
          r={radius}
          stroke="currentColor"
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          className="text-primary-600"
          style={{
            strokeDasharray: circumference,
            strokeDashoffset,
            transition: 'stroke-dashoffset 0.5s ease',
          }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl font-bold text-gray-900">{percentage}%</span>
      </div>
    </div>
  );
}

function TraineeDashboard() {
  const { traineeProfile } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'trainee', traineeProfile?.id],
    queryFn: () => api.get(`/api/dashboard/trainee?traineeProfileId=${traineeProfile?.id}`),
    enabled: !!traineeProfile?.id,
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const dashboard = data?.dashboard;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Översikt</h1>
          <p className="text-gray-500">
            {TRACK_TYPE_LABELS[dashboard?.profile?.trackType as keyof typeof TRACK_TYPE_LABELS]}
            {dashboard?.profile?.specialty && ` - ${dashboard.profile.specialty}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/kalender" className="btn-secondary btn-sm">
            <Calendar className="w-4 h-4 mr-2" />
            Lägg till placering
          </Link>
          <Link to="/intyg" className="btn-primary btn-sm">
            <FileText className="w-4 h-4 mr-2" />
            Ladda upp intyg
          </Link>
        </div>
      </div>

      {/* Warnings */}
      {dashboard?.warnings?.length > 0 && (
        <div className="space-y-2">
          {dashboard.warnings.map((warning: any, index: number) => (
            <div
              key={index}
              className={`p-4 rounded-lg flex items-center gap-3 ${
                warning.severity === RiskLevel.HIGH
                  ? 'bg-danger-50 text-danger-700'
                  : warning.severity === RiskLevel.MEDIUM
                  ? 'bg-warning-50 text-warning-700'
                  : 'bg-primary-50 text-primary-700'
              }`}
            >
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span>{warning.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Progress and stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Progress card */}
        <div className="card p-6 col-span-1 md:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Progression</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {dashboard?.progress?.completed}/{dashboard?.progress?.total}
              </p>
              <p className="text-sm text-gray-500 mt-1">delmål uppnådda</p>
            </div>
            <ProgressRing percentage={dashboard?.progress?.percentage || 0} />
          </div>
        </div>

        {/* Stats cards */}
        <div className="card p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-success-50 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-success-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Uppnådda</p>
              <p className="text-2xl font-bold text-gray-900">{dashboard?.progress?.completed || 0}</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-warning-50 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-warning-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Pågående</p>
              <p className="text-2xl font-bold text-gray-900">{dashboard?.progress?.inProgress || 0}</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-gray-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Ej påbörjade</p>
              <p className="text-2xl font-bold text-gray-900">{dashboard?.progress?.notStarted || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Current and upcoming */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current rotation */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Nuvarande placering
          </h2>
          {dashboard?.currentRotation ? (
            <div className="bg-primary-50 rounded-lg p-4">
              <p className="font-medium text-gray-900">{dashboard.currentRotation.unit}</p>
              {dashboard.currentRotation.specialtyArea && (
                <p className="text-sm text-gray-600">{dashboard.currentRotation.specialtyArea}</p>
              )}
              <p className="text-sm text-gray-500 mt-2">
                {formatDateSv(dashboard.currentRotation.startDate)} -{' '}
                {formatDateSv(dashboard.currentRotation.endDate)}
              </p>
            </div>
          ) : (
            <p className="text-gray-500">Ingen aktiv placering</p>
          )}

          {dashboard?.upcomingRotations?.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-500 mb-2">Kommande:</p>
              <div className="space-y-2">
                {dashboard.upcomingRotations.slice(0, 2).map((rotation: any) => (
                  <div key={rotation.id} className="flex justify-between text-sm">
                    <span className="text-gray-900">{rotation.unit}</span>
                    <span className="text-gray-500">{formatDateSv(rotation.startDate)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Last supervision */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Senaste handledarsamtal
          </h2>
          {dashboard?.lastSupervision ? (
            <div>
              <p className="text-gray-900">{formatDateSv(dashboard.lastSupervision.date)}</p>
              <p className="text-sm text-gray-500">
                {dashboard.daysSinceLastSupervision} dagar sedan
              </p>
              {dashboard.lastSupervision.supervisor && (
                <p className="text-sm text-gray-600 mt-2">
                  Med {dashboard.lastSupervision.supervisor.name}
                </p>
              )}
            </div>
          ) : (
            <p className="text-gray-500">Inget handledarsamtal registrerat</p>
          )}
          <Link
            to="/handledarsamtal"
            className="btn-secondary btn-sm mt-4 inline-flex"
          >
            Visa alla
          </Link>
        </div>
      </div>

      {/* Recent assessments */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5" />
            Senaste bedömningar
          </h2>
          {dashboard?.unsignedAssessments > 0 && (
            <span className="badge-warning">{dashboard.unsignedAssessments} osignerade</span>
          )}
        </div>
        {dashboard?.recentAssessments?.length > 0 ? (
          <div className="space-y-3">
            {dashboard.recentAssessments.map((assessment: any) => (
              <div
                key={assessment.id}
                className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
              >
                <div>
                  <p className="font-medium text-gray-900">{assessment.type}</p>
                  <p className="text-sm text-gray-500">{formatDateSv(assessment.date)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {assessment.rating && (
                    <span className="badge-primary">{assessment.rating}/5</span>
                  )}
                  {assessment.signedAt ? (
                    <span className="badge-success">Signerad</span>
                  ) : (
                    <span className="badge-warning">Osignerad</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">Inga bedömningar registrerade</p>
        )}
        <Link to="/bedomningar" className="btn-secondary btn-sm mt-4 inline-flex">
          Visa alla bedömningar
        </Link>
      </div>
    </div>
  );
}

function SupervisorDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'handledare'],
    queryFn: () => api.get('/api/dashboard/handledare'),
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const trainees = data?.trainees || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Min översikt</h1>
        <p className="text-gray-500">Dina tilldelade ST/BT-läkare</p>
      </div>

      {trainees.length === 0 ? (
        <div className="card p-8 text-center">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Inga tilldelade ST/BT-läkare</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {trainees.map((trainee: any) => (
            <Link
              key={trainee.traineeId}
              to={`/trainee/${trainee.traineeId}`}
              className="card p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{trainee.traineeName}</p>
                  <p className="text-sm text-gray-500">
                    {trainee.trackType} {trainee.specialty && `- ${trainee.specialty}`}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary-600">{trainee.progressPercentage}%</p>
                    <p className="text-xs text-gray-500">progression</p>
                  </div>
                  {trainee.unsignedAssessments > 0 && (
                    <span className="badge-warning">{trainee.unsignedAssessments} osignerade</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StudyDirectorDashboard() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'studierektor'],
    queryFn: () => api.get('/api/dashboard/studierektor'),
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const overview = data?.overview;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Studierektoröversikt</h1>
        <p className="text-gray-500">Alla ST/BT-läkare på din klinik</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-6">
          <p className="text-sm font-medium text-gray-500">Totalt antal</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{overview?.summary?.totalTrainees || 0}</p>
        </div>
        <div className="card p-6">
          <p className="text-sm font-medium text-gray-500">Hög risk</p>
          <p className="text-3xl font-bold text-danger-500 mt-1">{overview?.summary?.highRisk || 0}</p>
        </div>
        <div className="card p-6">
          <p className="text-sm font-medium text-gray-500">Medel risk</p>
          <p className="text-3xl font-bold text-warning-500 mt-1">{overview?.summary?.mediumRisk || 0}</p>
        </div>
        <div className="card p-6">
          <p className="text-sm font-medium text-gray-500">Snittprogresssion</p>
          <p className="text-3xl font-bold text-primary-600 mt-1">{overview?.summary?.averageProgress || 0}%</p>
        </div>
      </div>

      <Link to="/studierektor" className="btn-primary inline-flex">
        Visa detaljerad lista
      </Link>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-1/4"></div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card p-6">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();

  if (user?.role === UserRole.ST_BT) {
    return <TraineeDashboard />;
  }

  if (user?.role === UserRole.HANDLEDARE) {
    return <SupervisorDashboard />;
  }

  if (user?.role === UserRole.STUDIEREKTOR || user?.role === UserRole.ADMIN) {
    return <StudyDirectorDashboard />;
  }

  return <TraineeDashboard />;
}
