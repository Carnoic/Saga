import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatDateSv, TRACK_TYPE_LABELS, ASSESSMENT_TYPE_LABELS, AssessmentType } from '@saga/shared';
import { User, Target, Calendar, FileText, ClipboardCheck, Users, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function TraineeDetailPage() {
  const { traineeId } = useParams<{ traineeId: string }>();

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery({
    queryKey: ['dashboard', 'trainee', traineeId],
    queryFn: () => api.get(`/api/dashboard/trainee?traineeProfileId=${traineeId}`),
    enabled: !!traineeId,
  });

  const { data: rotationsData } = useQuery({
    queryKey: ['rotations', traineeId],
    queryFn: () => api.get(`/api/rotations?traineeProfileId=${traineeId}`),
    enabled: !!traineeId,
  });

  const { data: assessmentsData } = useQuery({
    queryKey: ['assessments', traineeId],
    queryFn: () => api.get(`/api/assessments?traineeProfileId=${traineeId}`),
    enabled: !!traineeId,
  });

  if (dashboardLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 rounded w-1/3"></div>
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-4 h-32"></div>
          ))}
        </div>
      </div>
    );
  }

  const dashboard = dashboardData?.dashboard;
  const profile = dashboard?.profile;
  const progress = dashboard?.progress;
  const rotations = rotationsData?.rotations || [];
  const assessments = assessmentsData?.assessments || [];

  if (!profile) {
    return (
      <div className="card p-8 text-center">
        <p className="text-gray-500">ST/BT-läkare hittades inte</p>
        <Link to="/studierektor" className="btn-primary mt-4 inline-flex">
          Tillbaka
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/studierektor" className="btn-secondary btn-sm">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{profile.user?.name}</h1>
          <p className="text-gray-500">
            {TRACK_TYPE_LABELS[profile.trackType as keyof typeof TRACK_TYPE_LABELS]}
            {profile.specialty && ` - ${profile.specialty}`}
          </p>
        </div>
      </div>

      {/* Profile info */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <User className="w-5 h-5" />
          Profilinformation
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-500">E-post</p>
            <p className="font-medium">{profile.user?.email}</p>
          </div>
          <div>
            <p className="text-gray-500">Klinik</p>
            <p className="font-medium">{profile.clinic?.name}</p>
          </div>
          <div>
            <p className="text-gray-500">Handledare</p>
            <p className="font-medium">{profile.supervisor?.name || '-'}</p>
          </div>
          <div>
            <p className="text-gray-500">Startdatum</p>
            <p className="font-medium">{formatDateSv(profile.startDate)}</p>
          </div>
          <div>
            <p className="text-gray-500">Planerat slutdatum</p>
            <p className="font-medium">{formatDateSv(profile.plannedEndDate)}</p>
          </div>
        </div>
      </div>

      {/* Progress summary */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Target className="w-5 h-5" />
          Progression
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-primary-600">{progress?.percentage || 0}%</p>
            <p className="text-sm text-gray-500">Total progression</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-success-500">{progress?.completed || 0}</p>
            <p className="text-sm text-gray-500">Uppnådda</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-warning-500">{progress?.inProgress || 0}</p>
            <p className="text-sm text-gray-500">Pågående</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-400">{progress?.notStarted || 0}</p>
            <p className="text-sm text-gray-500">Ej påbörjade</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rotations */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Placeringar ({rotations.length})
          </h2>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {rotations.length === 0 ? (
              <p className="text-gray-500">Inga placeringar</p>
            ) : (
              rotations.slice(0, 10).map((r: any) => (
                <div key={r.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="font-medium text-gray-900">{r.unit}</p>
                    <p className="text-xs text-gray-500">
                      {formatDateSv(r.startDate)} - {formatDateSv(r.endDate)}
                    </p>
                  </div>
                  {r.planned && <span className="badge-gray">Planerad</span>}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Assessments */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5" />
            Bedömningar ({assessments.length})
          </h2>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {assessments.length === 0 ? (
              <p className="text-gray-500">Inga bedömningar</p>
            ) : (
              assessments.slice(0, 10).map((a: any) => (
                <div key={a.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="font-medium text-gray-900">
                      {ASSESSMENT_TYPE_LABELS[a.type as AssessmentType]}
                    </p>
                    <p className="text-xs text-gray-500">{formatDateSv(a.date)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {a.rating && <span className="badge-primary">{a.rating}/5</span>}
                    {a.signedAt ? (
                      <span className="badge-success">Signerad</span>
                    ) : (
                      <span className="badge-warning">Osignerad</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Supervision meetings */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Users className="w-5 h-5" />
          Senaste handledarsamtal
        </h2>
        {dashboard?.lastSupervision ? (
          <div>
            <p className="font-medium">{formatDateSv(dashboard.lastSupervision.date)}</p>
            <p className="text-sm text-gray-500">
              {dashboard.daysSinceLastSupervision} dagar sedan
            </p>
            {dashboard.lastSupervision.notes && (
              <p className="mt-2 text-gray-600">{dashboard.lastSupervision.notes}</p>
            )}
          </div>
        ) : (
          <p className="text-gray-500">Inget handledarsamtal registrerat</p>
        )}
      </div>
    </div>
  );
}
