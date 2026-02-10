import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { RiskLevel, RISK_LEVEL_LABELS, formatDateSv, TrackType } from '@saga/shared';
import { Users, AlertTriangle, TrendingUp, Eye, MessageSquare, Star, BarChart3, Plus, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

type Tab = 'overview' | 'feedback';

interface FeedbackStatistics {
  totalResponses: number;
  byUnit: {
    unit: string;
    responseCount: number;
    averageOverall: number;
    averageEducational: number;
    averageSupervision: number;
    averageEnvironment: number;
  }[];
}

interface FeedbackEntry {
  id: string;
  rotationId: string;
  unit: string;
  startDate: string;
  endDate: string;
  traineeName: string;
  overallRating: number;
  educationalValue: number;
  supervisionQuality: number;
  workEnvironment: number;
  positives?: string;
  improvements?: string;
  otherComments?: string;
  anonymous: boolean;
  submittedAt: string;
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-4 h-4 ${
            star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
          }`}
        />
      ))}
      <span className="ml-1 text-sm text-gray-600">{rating.toFixed(1)}</span>
    </div>
  );
}

interface NewTraineeForm {
  email: string;
  password: string;
  name: string;
  trackType: 'ST' | 'BT';
  specialty: string;
  startDate: string;
  plannedEndDate: string;
  supervisorId: string;
}

const initialTraineeForm: NewTraineeForm = {
  email: '',
  password: '',
  name: '',
  trackType: 'ST',
  specialty: '',
  startDate: new Date().toISOString().split('T')[0],
  plannedEndDate: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  supervisorId: '',
};

export default function StudyDirectorPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [selectedUnit, setSelectedUnit] = useState<string>('');
  const [showNewTraineeForm, setShowNewTraineeForm] = useState(false);
  const [traineeForm, setTraineeForm] = useState<NewTraineeForm>(initialTraineeForm);

  const { data, isLoading } = useQuery({
    queryKey: ['studierektor', 'overview'],
    queryFn: () => api.get('/api/dashboard/studierektor'),
  });

  const { data: statsData } = useQuery({
    queryKey: ['feedback', 'statistics'],
    queryFn: () => api.get<FeedbackStatistics>('/api/feedback/statistics'),
    enabled: activeTab === 'feedback',
  });

  const { data: feedbackList } = useQuery({
    queryKey: ['feedback', 'unit', selectedUnit],
    queryFn: () =>
      api.get<FeedbackEntry[]>(`/api/feedback/unit${selectedUnit ? `?unit=${encodeURIComponent(selectedUnit)}` : ''}`),
    enabled: activeTab === 'feedback',
  });

  // Fetch supervisors (handledare) for the form
  const { data: supervisorsData } = useQuery({
    queryKey: ['supervisors'],
    queryFn: () => api.get('/api/users/supervisors'),
    enabled: showNewTraineeForm,
  });
  const supervisors = supervisorsData?.supervisors || [];

  const createTraineeMutation = useMutation({
    mutationFn: (data: NewTraineeForm) => api.post('/api/trainees', {
      ...data,
      clinicId: user?.clinicId,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studierektor'] });
      toast.success('ST/BT-läkare skapad');
      setShowNewTraineeForm(false);
      setTraineeForm(initialTraineeForm);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Kunde inte skapa ST/BT-läkare');
    },
  });

  const handleCreateTrainee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!traineeForm.email || !traineeForm.password || !traineeForm.name) {
      toast.error('Fyll i alla obligatoriska fält');
      return;
    }
    createTraineeMutation.mutate(traineeForm);
  };

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Studierektoröversikt</h1>
          <p className="text-gray-500">Alla ST/BT-läkare på kliniken</p>
        </div>
        <button
          onClick={() => setShowNewTraineeForm(true)}
          className="btn-primary"
        >
          <Plus className="w-4 h-4 mr-2" />
          Ny ST/BT-läkare
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 font-medium text-sm border-b-2 -mb-px transition-colors ${
              activeTab === 'overview'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            ST/BT-läkare
          </button>
          <button
            onClick={() => setActiveTab('feedback')}
            className={`px-4 py-2 font-medium text-sm border-b-2 -mb-px transition-colors ${
              activeTab === 'feedback'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <MessageSquare className="w-4 h-4 inline mr-2" />
            Placeringsfeedback
          </button>
        </nav>
      </div>

      {activeTab === 'overview' && (
        <>
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
        </>
      )}

      {activeTab === 'feedback' && (
        <>
          {/* Statistics cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Statistik per enhet
              </h3>
              {statsData?.byUnit && statsData.byUnit.length > 0 ? (
                <div className="space-y-4">
                  {statsData.byUnit.map((unit) => (
                    <div
                      key={unit.unit}
                      className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                        selectedUnit === unit.unit
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedUnit(selectedUnit === unit.unit ? '' : unit.unit)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{unit.unit}</h4>
                        <span className="text-sm text-gray-500">{unit.responseCount} svar</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Helhet:</span>
                          <StarDisplay rating={unit.averageOverall} />
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Utbildning:</span>
                          <StarDisplay rating={unit.averageEducational} />
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Handledning:</span>
                          <StarDisplay rating={unit.averageSupervision} />
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Arbetsmiljö:</span>
                          <StarDisplay rating={unit.averageEnvironment} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">Ingen feedback har lämnats ännu</p>
              )}
            </div>

            <div className="card p-6">
              <h3 className="font-semibold text-gray-900 mb-4">
                Sammanfattning
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Totalt antal svar</span>
                  <span className="text-2xl font-bold">{statsData?.totalResponses || 0}</span>
                </div>
                {statsData?.byUnit && statsData.byUnit.length > 0 && (
                  <>
                    <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                      <span className="text-gray-600">Högst betyg</span>
                      <div className="text-right">
                        <p className="font-medium">
                          {
                            statsData.byUnit.reduce((best, u) =>
                              u.averageOverall > best.averageOverall ? u : best
                            ).unit
                          }
                        </p>
                        <StarDisplay
                          rating={Math.max(...statsData.byUnit.map((u) => u.averageOverall))}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg">
                      <span className="text-gray-600">Behöver förbättring</span>
                      <div className="text-right">
                        <p className="font-medium">
                          {
                            statsData.byUnit.reduce((worst, u) =>
                              u.averageOverall < worst.averageOverall ? u : worst
                            ).unit
                          }
                        </p>
                        <StarDisplay
                          rating={Math.min(...statsData.byUnit.map((u) => u.averageOverall))}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Feedback list */}
          <div className="card">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold">
                {selectedUnit ? `Feedback för ${selectedUnit}` : 'All feedback'}
              </h3>
              {selectedUnit && (
                <button
                  onClick={() => setSelectedUnit('')}
                  className="text-sm text-primary-600 hover:underline"
                >
                  Visa alla
                </button>
              )}
            </div>
            <div className="divide-y">
              {feedbackList && feedbackList.length > 0 ? (
                feedbackList.map((fb) => (
                  <div key={fb.id} className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-medium">{fb.unit}</h4>
                        <p className="text-sm text-gray-500">
                          {format(new Date(fb.startDate), 'd MMM', { locale: sv })} -{' '}
                          {format(new Date(fb.endDate), 'd MMM yyyy', { locale: sv })}
                        </p>
                        <p className="text-sm text-gray-500">
                          Av: {fb.traineeName} | {format(new Date(fb.submittedAt), 'd MMM yyyy', { locale: sv })}
                        </p>
                      </div>
                      <div className="text-right">
                        <StarDisplay rating={fb.overallRating} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm mb-3">
                      <div>
                        <span className="text-gray-500">Utbildning: </span>
                        <span className="font-medium">{fb.educationalValue}/5</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Handledning: </span>
                        <span className="font-medium">{fb.supervisionQuality}/5</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Arbetsmiljö: </span>
                        <span className="font-medium">{fb.workEnvironment}/5</span>
                      </div>
                    </div>
                    {(fb.positives || fb.improvements) && (
                      <div className="space-y-2 text-sm">
                        {fb.positives && (
                          <div className="p-2 bg-green-50 rounded">
                            <span className="font-medium text-green-700">Positivt: </span>
                            <span className="text-green-900">{fb.positives}</span>
                          </div>
                        )}
                        {fb.improvements && (
                          <div className="p-2 bg-orange-50 rounded">
                            <span className="font-medium text-orange-700">Förbättringar: </span>
                            <span className="text-orange-900">{fb.improvements}</span>
                          </div>
                        )}
                        {fb.otherComments && (
                          <div className="p-2 bg-gray-50 rounded">
                            <span className="font-medium text-gray-700">Övrigt: </span>
                            <span className="text-gray-900">{fb.otherComments}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-gray-500">
                  {selectedUnit
                    ? `Ingen feedback för ${selectedUnit} ännu`
                    : 'Ingen feedback har lämnats ännu'}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* New trainee modal */}
      {showNewTraineeForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Ny ST/BT-läkare</h2>
              <button onClick={() => setShowNewTraineeForm(false)} className="text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateTrainee} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">Namn *</label>
                  <input
                    type="text"
                    className="input"
                    value={traineeForm.name}
                    onChange={(e) => setTraineeForm({ ...traineeForm, name: e.target.value })}
                    placeholder="För- och efternamn"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="label">E-post *</label>
                  <input
                    type="email"
                    className="input"
                    value={traineeForm.email}
                    onChange={(e) => setTraineeForm({ ...traineeForm, email: e.target.value })}
                    placeholder="e-post@example.com"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="label">Lösenord *</label>
                  <input
                    type="password"
                    className="input"
                    value={traineeForm.password}
                    onChange={(e) => setTraineeForm({ ...traineeForm, password: e.target.value })}
                    placeholder="Minst 6 tecken"
                    minLength={6}
                    required
                  />
                </div>
                <div>
                  <label className="label">Utbildningstyp *</label>
                  <select
                    className="input"
                    value={traineeForm.trackType}
                    onChange={(e) => setTraineeForm({ ...traineeForm, trackType: e.target.value as 'ST' | 'BT' })}
                  >
                    <option value="ST">ST-läkare</option>
                    <option value="BT">BT-läkare</option>
                  </select>
                </div>
                <div>
                  <label className="label">Specialitet</label>
                  <input
                    type="text"
                    className="input"
                    value={traineeForm.specialty}
                    onChange={(e) => setTraineeForm({ ...traineeForm, specialty: e.target.value })}
                    placeholder="t.ex. Allmänmedicin"
                  />
                </div>
                <div>
                  <label className="label">Startdatum *</label>
                  <input
                    type="date"
                    className="input"
                    value={traineeForm.startDate}
                    onChange={(e) => setTraineeForm({ ...traineeForm, startDate: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="label">Planerat slutdatum *</label>
                  <input
                    type="date"
                    className="input"
                    value={traineeForm.plannedEndDate}
                    onChange={(e) => setTraineeForm({ ...traineeForm, plannedEndDate: e.target.value })}
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="label">Handledare</label>
                  <select
                    className="input"
                    value={traineeForm.supervisorId}
                    onChange={(e) => setTraineeForm({ ...traineeForm, supervisorId: e.target.value })}
                  >
                    <option value="">Välj handledare (valfritt)</option>
                    {supervisors.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewTraineeForm(false);
                    setTraineeForm(initialTraineeForm);
                  }}
                  className="btn-secondary flex-1"
                >
                  Avbryt
                </button>
                <button
                  type="submit"
                  disabled={createTraineeMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {createTraineeMutation.isPending ? 'Skapar...' : 'Skapa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
