import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { RiskLevel, RISK_LEVEL_LABELS, formatDateSv } from '@saga/shared';
import { Users, AlertTriangle, TrendingUp, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function StudyDirectorPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['studierektor', 'overview'],
    queryFn: () => api.get('/api/dashboard/studierektor'),
  });

  const overview = data?.overview;
  const trainees = overview?.trainees || [];

  const getRiskBadge = (riskLevel: RiskLevel) => {
    switch (riskLevel) {
      case RiskLevel.HIGH:
        return 'badge-danger';
      case RiskLevel.MEDIUM:
        return 'badge-warning';
      case RiskLevel.LOW:
        return 'badge-primary';
      default:
        return 'badge-success';
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 rounded w-1/4"></div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card p-4 h-24"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Studierektoröversikt</h1>
        <p className="text-gray-500">Alla ST/BT-läkare på kliniken</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary-50 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Totalt</p>
              <p className="text-2xl font-bold">{overview?.summary?.totalTrainees || 0}</p>
            </div>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-danger-50 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-danger-500" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Hög risk</p>
              <p className="text-2xl font-bold text-danger-500">{overview?.summary?.highRisk || 0}</p>
            </div>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-warning-50 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-warning-500" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Medel risk</p>
              <p className="text-2xl font-bold text-warning-500">{overview?.summary?.mediumRisk || 0}</p>
            </div>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-success-50 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-success-500" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Snittprogression</p>
              <p className="text-2xl font-bold">{overview?.summary?.averageProgress || 0}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Trainees table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Namn</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Typ</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Handledare</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-500">Progression</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-500">Senaste samtal</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-500">Osignerade</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-500">Risk</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {trainees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    Inga ST/BT-läkare på kliniken
                  </td>
                </tr>
              ) : (
                trainees.map((t: any) => (
                  <tr key={t.traineeId} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{t.traineeName}</p>
                        <p className="text-sm text-gray-500">{t.traineeEmail}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="badge-gray">{t.trackType}</span>
                      {t.specialty && (
                        <p className="text-xs text-gray-500 mt-1">{t.specialty}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {t.supervisor?.name || '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary-500 rounded-full"
                            style={{ width: `${t.progressPercentage}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">{t.progressPercentage}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-sm">
                      {t.lastSupervisionDate ? (
                        <div>
                          <p>{formatDateSv(t.lastSupervisionDate)}</p>
                          <p className="text-xs text-gray-500">{t.daysSinceSupervision}d sedan</p>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {t.unsignedAssessments > 0 ? (
                        <span className="badge-warning">{t.unsignedAssessments}</span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={getRiskBadge(t.riskLevel)}>
                        {RISK_LEVEL_LABELS[t.riskLevel as RiskLevel]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/trainee/${t.traineeId}`}
                        className="btn-secondary btn-sm"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
