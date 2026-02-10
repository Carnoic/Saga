import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { formatDateSv, ASSESSMENT_TYPE_LABELS, AssessmentType, UserRole } from '@saga/shared';
import { ClipboardCheck, Plus, Trash2, CheckCircle, X, Users } from 'lucide-react';
import toast from 'react-hot-toast';

interface Trainee {
  traineeId: string;
  traineeName: string;
  traineeEmail: string;
  trackType: string;
}

export default function AssessmentsPage() {
  const { user, traineeProfile } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [selectedTraineeId, setSelectedTraineeId] = useState<string | null>(null);
  const [form, setForm] = useState({
    type: 'DOPS' as AssessmentType,
    date: new Date().toISOString().split('T')[0],
    context: '',
    rating: '',
    narrativeFeedback: '',
  });

  const isTrainee = user?.role === UserRole.ST_BT;
  const isSupervisor = user?.role === UserRole.HANDLEDARE;
  const isStudierektor = user?.role === UserRole.STUDIEREKTOR || user?.role === UserRole.ADMIN;

  // For trainees, use their own profile ID
  // For supervisors/studierektorer, use selected trainee
  const profileId = isTrainee ? traineeProfile?.id : selectedTraineeId;

  // Fetch trainees for supervisors/studierektorer
  const { data: traineesData } = useQuery({
    queryKey: ['supervised-trainees'],
    queryFn: async () => {
      if (isStudierektor) {
        // Fetch all trainees from studierektor endpoint
        const res = await api.get('/api/dashboard/studierektor');
        return res.overview?.trainees || [];
      } else if (isSupervisor) {
        // Fetch trainees this supervisor is assigned to
        const res = await api.get('/api/trainees/supervised');
        return res.trainees || [];
      }
      return [];
    },
    enabled: !isTrainee,
  });

  const trainees: Trainee[] = traineesData || [];

  // Auto-select first trainee if none selected
  useEffect(() => {
    if (!isTrainee && trainees.length > 0 && !selectedTraineeId) {
      setSelectedTraineeId(trainees[0].traineeId);
    }
  }, [isTrainee, trainees, selectedTraineeId]);

  const { data, isLoading } = useQuery({
    queryKey: ['assessments', profileId],
    queryFn: () => api.get(`/api/assessments?traineeProfileId=${profileId}`),
    enabled: !!profileId,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/api/assessments', { ...data, traineeProfileId: profileId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      toast.success('Bedömning skapad');
      resetForm();
    },
    onError: (error: any) => toast.error(error.message || 'Kunde inte skapa bedömning'),
  });

  const signMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/assessments/${id}/sign`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      toast.success('Bedömning signerad');
    },
    onError: (error: any) => toast.error(error.message || 'Kunde inte signera'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/assessments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      toast.success('Bedömning borttagen');
    },
    onError: (error: any) => toast.error(error.message || 'Kunde inte ta bort'),
  });

  const resetForm = () => {
    setForm({
      type: 'DOPS',
      date: new Date().toISOString().split('T')[0],
      context: '',
      rating: '',
      narrativeFeedback: '',
    });
    setShowForm(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileId) {
      toast.error('Välj en ST/BT-läkare först');
      return;
    }
    createMutation.mutate({
      ...form,
      rating: form.rating ? parseInt(form.rating) : undefined,
    });
  };

  const assessments = data?.assessments || [];
  const canSign = user?.role === UserRole.HANDLEDARE || user?.role === UserRole.STUDIEREKTOR || user?.role === UserRole.ADMIN;
  const selectedTrainee = trainees.find(t => t.traineeId === selectedTraineeId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bedömningar</h1>
          <p className="text-gray-500">DOPS, Mini-CEX, CBD och andra bedömningar</p>
        </div>
        {profileId && (
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            Ny bedömning
          </button>
        )}
      </div>

      {/* Trainee selector for supervisors */}
      {!isTrainee && (
        <div className="card p-4">
          <label className="label flex items-center gap-2">
            <Users className="w-4 h-4" />
            Välj ST/BT-läkare
          </label>
          {trainees.length === 0 ? (
            <p className="text-gray-500 text-sm">
              {isSupervisor
                ? 'Du är inte tilldelad som handledare för några ST/BT-läkare'
                : 'Inga ST/BT-läkare på kliniken'}
            </p>
          ) : (
            <select
              className="input mt-1"
              value={selectedTraineeId || ''}
              onChange={(e) => setSelectedTraineeId(e.target.value)}
            >
              {trainees.map((t) => (
                <option key={t.traineeId} value={t.traineeId}>
                  {t.traineeName} ({t.trackType})
                </option>
              ))}
            </select>
          )}
          {selectedTrainee && (
            <p className="text-sm text-gray-500 mt-2">
              {selectedTrainee.traineeEmail}
            </p>
          )}
        </div>
      )}

      {/* Assessments list */}
      {!profileId ? (
        <div className="card p-8 text-center">
          <ClipboardCheck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">
            {isTrainee
              ? 'Din profil kunde inte hittas'
              : 'Välj en ST/BT-läkare för att se bedömningar'}
          </p>
        </div>
      ) : isLoading ? (
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-4 h-24"></div>
          ))}
        </div>
      ) : assessments.length === 0 ? (
        <div className="card p-8 text-center">
          <ClipboardCheck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Inga bedömningar registrerade</p>
        </div>
      ) : (
        <div className="space-y-4">
          {assessments.map((assessment: any) => (
            <div key={assessment.id} className="card p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="badge-primary">
                      {ASSESSMENT_TYPE_LABELS[assessment.type as AssessmentType]}
                    </span>
                    {assessment.rating && (
                      <span className="badge-gray">{assessment.rating}/5</span>
                    )}
                    {assessment.signedAt ? (
                      <span className="badge-success">Signerad</span>
                    ) : (
                      <span className="badge-warning">Osignerad</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{formatDateSv(assessment.date)}</p>
                  {assessment.context && (
                    <p className="mt-2 text-gray-700">{assessment.context}</p>
                  )}
                  {assessment.narrativeFeedback && (
                    <p className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                      {assessment.narrativeFeedback}
                    </p>
                  )}
                  {assessment.assessor && (
                    <p className="mt-2 text-sm text-gray-500">
                      Bedömare: {assessment.assessor.name}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 ml-4">
                  {canSign && !assessment.signedAt && (
                    <button
                      onClick={() => signMutation.mutate(assessment.id)}
                      className="btn-success btn-sm"
                      title="Signera"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  )}
                  {!assessment.signedAt && (
                    <button
                      onClick={() => {
                        if (confirm('Vill du ta bort denna bedömning?')) {
                          deleteMutation.mutate(assessment.id);
                        }
                      }}
                      className="btn-danger btn-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Ny bedömning</h2>
              <button onClick={resetForm} className="text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {!isTrainee && selectedTrainee && (
                <div className="p-3 bg-blue-50 rounded-lg text-sm">
                  <span className="font-medium">ST/BT-läkare:</span> {selectedTrainee.traineeName}
                </div>
              )}
              <div>
                <label className="label">Typ *</label>
                <select
                  className="input"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as AssessmentType })}
                >
                  {Object.entries(ASSESSMENT_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Datum *</label>
                <input
                  type="date"
                  className="input"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Kontext/Situation</label>
                <input
                  type="text"
                  className="input"
                  value={form.context}
                  onChange={(e) => setForm({ ...form, context: e.target.value })}
                  placeholder="Beskriv situationen"
                />
              </div>
              <div>
                <label className="label">Betyg (1-5)</label>
                <select
                  className="input"
                  value={form.rating}
                  onChange={(e) => setForm({ ...form, rating: e.target.value })}
                >
                  <option value="">Inget betyg</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Återkoppling</label>
                <textarea
                  className="input"
                  rows={4}
                  value={form.narrativeFeedback}
                  onChange={(e) => setForm({ ...form, narrativeFeedback: e.target.value })}
                  placeholder="Skriv din återkoppling här..."
                />
              </div>
              <div className="flex gap-2 pt-4">
                <button type="button" onClick={resetForm} className="btn-secondary flex-1">
                  Avbryt
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="btn-primary flex-1"
                >
                  Skapa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
