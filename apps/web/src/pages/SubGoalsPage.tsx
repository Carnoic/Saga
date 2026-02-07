import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { SUBGOAL_CATEGORY_LABELS, SUBGOAL_STATUS_LABELS, SubGoalStatus, SubGoalCategory } from '@saga/shared';
import { Target, CheckCircle2, Clock, Circle, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SubGoalsPage() {
  const { traineeProfile } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<SubGoalStatus | 'ALL'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<SubGoalCategory | 'ALL'>('ALL');
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ['subgoals', 'progress', traineeProfile?.id],
    queryFn: () => api.get(`/api/subgoals/progress?traineeProfileId=${traineeProfile?.id}`),
    enabled: !!traineeProfile?.id,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: SubGoalStatus }) =>
      api.patch(`/api/subgoals/progress/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subgoals'] });
      toast.success('Delmålsstatus uppdaterad');
    },
    onError: () => toast.error('Kunde inte uppdatera status'),
  });

  const progress = data?.progress || [];

  const filteredProgress = progress.filter((p: any) => {
    if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
    if (categoryFilter !== 'ALL' && p.subGoal?.category !== categoryFilter) return false;
    return true;
  });

  const groupedByCategory = filteredProgress.reduce((acc: Record<string, any[]>, p: any) => {
    const cat = p.subGoal?.category || 'OVRIGT';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedGoals);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedGoals(newExpanded);
  };

  const getStatusIcon = (status: SubGoalStatus) => {
    switch (status) {
      case SubGoalStatus.UPPNADD:
        return <CheckCircle2 className="w-5 h-5 text-success-500" />;
      case SubGoalStatus.PAGAENDE:
        return <Clock className="w-5 h-5 text-warning-500" />;
      default:
        return <Circle className="w-5 h-5 text-gray-300" />;
    }
  };

  const getStatusBadge = (status: SubGoalStatus) => {
    switch (status) {
      case SubGoalStatus.UPPNADD:
        return 'badge-success';
      case SubGoalStatus.PAGAENDE:
        return 'badge-warning';
      default:
        return 'badge-gray';
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/4"></div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-4">
            <div className="h-6 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Delmål</h1>
          <p className="text-gray-500">
            {filteredProgress.length} delmål visas
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-500">Filter:</span>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as SubGoalStatus | 'ALL')}
          className="input w-auto"
        >
          <option value="ALL">Alla status</option>
          {Object.entries(SUBGOAL_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as SubGoalCategory | 'ALL')}
          className="input w-auto"
        >
          <option value="ALL">Alla kategorier</option>
          {Object.entries(SUBGOAL_CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {/* Goals by category */}
      {Object.entries(groupedByCategory).map(([category, goals]) => (
        <div key={category} className="space-y-2">
          <h2 className="font-semibold text-gray-700 flex items-center gap-2">
            <Target className="w-5 h-5" />
            {SUBGOAL_CATEGORY_LABELS[category as SubGoalCategory] || category}
            <span className="text-sm font-normal text-gray-500">({goals.length})</span>
          </h2>

          <div className="space-y-2">
            {goals.map((p: any) => (
              <div key={p.id} className="card">
                <div
                  className="p-4 flex items-center gap-4 cursor-pointer"
                  onClick={() => toggleExpand(p.id)}
                >
                  {getStatusIcon(p.status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-gray-500">{p.subGoal?.code}</span>
                      <span className="font-medium text-gray-900 truncate">{p.subGoal?.title}</span>
                    </div>
                  </div>
                  <span className={getStatusBadge(p.status)}>
                    {SUBGOAL_STATUS_LABELS[p.status as SubGoalStatus]}
                  </span>
                  {expandedGoals.has(p.id) ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>

                {expandedGoals.has(p.id) && (
                  <div className="px-4 pb-4 border-t border-gray-100">
                    <div className="pt-4 space-y-4">
                      {p.subGoal?.description && (
                        <p className="text-sm text-gray-600">{p.subGoal.description}</p>
                      )}

                      {/* Status change */}
                      <div>
                        <label className="label">Ändra status</label>
                        <div className="flex gap-2">
                          {Object.entries(SUBGOAL_STATUS_LABELS).map(([value, label]) => (
                            <button
                              key={value}
                              onClick={(e) => {
                                e.stopPropagation();
                                updateStatusMutation.mutate({ id: p.id, status: value as SubGoalStatus });
                              }}
                              disabled={p.signedAt && value !== 'UPPNADD'}
                              className={`btn-sm ${
                                p.status === value ? 'btn-primary' : 'btn-secondary'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Evidence */}
                      {p.evidence && (
                        <div>
                          <label className="label">Kopplad evidens</label>
                          <div className="text-sm text-gray-600 space-y-1">
                            {p.evidence.rotations?.length > 0 && (
                              <p>Placeringar: {p.evidence.rotations.map((r: any) => r.unit).join(', ')}</p>
                            )}
                            {p.evidence.courses?.length > 0 && (
                              <p>Kurser: {p.evidence.courses.map((c: any) => c.title).join(', ')}</p>
                            )}
                            {p.evidence.assessments?.length > 0 && (
                              <p>Bedömningar: {p.evidence.assessments.length} st</p>
                            )}
                            {p.evidence.certificates?.length > 0 && (
                              <p>Intyg: {p.evidence.certificates.length} st</p>
                            )}
                            {!p.evidence.rotations?.length && !p.evidence.courses?.length &&
                             !p.evidence.assessments?.length && !p.evidence.certificates?.length && (
                              <p className="text-gray-400">Ingen evidens kopplad</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Signed info */}
                      {p.signedAt && (
                        <div className="bg-success-50 rounded-lg p-3">
                          <p className="text-sm text-success-700">
                            Signerat av {p.signedBy?.name} den{' '}
                            {new Date(p.signedAt).toLocaleDateString('sv-SE')}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {filteredProgress.length === 0 && (
        <div className="card p-8 text-center">
          <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Inga delmål matchar dina filter</p>
        </div>
      )}
    </div>
  );
}
