import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { formatDateSv, UserRole } from '@saga/shared';
import { Users, Plus, Trash2, CheckCircle, X, Ban } from 'lucide-react';
import toast from 'react-hot-toast';

interface Trainee {
  traineeId: string;
  traineeName: string;
  traineeEmail: string;
  trackType: string;
}

export default function SupervisionPage() {
  const { user, traineeProfile } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [voidTarget, setVoidTarget] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [selectedTraineeId, setSelectedTraineeId] = useState<string | null>(null);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    notes: '',
    agreedActions: '',
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
      const res = await api.get('/api/trainees/supervised');
      return res.trainees || [];
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
    queryKey: ['supervision', profileId],
    queryFn: () => api.get(`/api/supervision?traineeProfileId=${profileId}`),
    enabled: !!profileId,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/api/supervision', { ...data, traineeProfileId: profileId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supervision'] });
      toast.success('Handledarsamtal skapat');
      resetForm();
    },
    onError: (error: any) => toast.error(error.message || 'Kunde inte skapa handledarsamtal'),
  });

  const signMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/supervision/${id}/sign`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supervision'] });
      toast.success('Handledarsamtal signerat');
    },
    onError: (error: any) => toast.error(error.message || 'Kunde inte signera'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/supervision/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supervision'] });
      toast.success('Handledarsamtal borttaget');
    },
    onError: (error: any) => toast.error(error.message || 'Kunde inte ta bort'),
  });

  const voidMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/api/supervision/${id}/void`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supervision'] });
      toast.success('Handledarsamtal makulerat');
      setVoidTarget(null);
      setVoidReason('');
    },
    onError: (error: any) => toast.error(error.message || 'Kunde inte makulera'),
  });

  const resetForm = () => {
    setForm({ date: new Date().toISOString().split('T')[0], notes: '', agreedActions: '' });
    setShowForm(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileId) {
      toast.error('Välj en ST/BT-läkare först');
      return;
    }
    createMutation.mutate(form);
  };

  const meetings = data?.meetings || [];
  const canSign = user?.role === UserRole.HANDLEDARE || user?.role === UserRole.STUDIEREKTOR || user?.role === UserRole.ADMIN;
  const selectedTrainee = trainees.find(t => t.traineeId === selectedTraineeId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Handledarsamtal</h1>
          <p className="text-gray-500">{meetings.length} samtal registrerade</p>
        </div>
        {profileId && (
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            Nytt handledarsamtal
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

      {/* Meetings list */}
      {!profileId ? (
        <div className="card p-8 text-center">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">
            {isTrainee
              ? 'Din profil kunde inte hittas'
              : 'Välj en ST/BT-läkare för att se handledarsamtal'}
          </p>
        </div>
      ) : isLoading ? (
        <div className="animate-pulse space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="card p-4 h-32"></div>
          ))}
        </div>
      ) : meetings.length === 0 ? (
        <div className="card p-8 text-center">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Inga handledarsamtal registrerade</p>
        </div>
      ) : (
        <div className="space-y-4">
          {meetings.map((meeting: any) => (
            <div key={meeting.id} className={`card p-4 ${meeting.voidedAt ? 'bg-gray-100 opacity-70' : ''}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`font-medium text-gray-900 ${meeting.voidedAt ? 'line-through' : ''}`}>
                      {formatDateSv(meeting.date)}
                    </span>
                    {meeting.voidedAt ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">Makulerad</span>
                    ) : meeting.signedAt ? (
                      <span className="badge-success">Signerat</span>
                    ) : (
                      <span className="badge-warning">Ej signerat</span>
                    )}
                  </div>
                  {meeting.supervisor && (
                    <p className="text-sm text-gray-500 mb-2">
                      Handledare: {meeting.supervisor.name}
                    </p>
                  )}
                  {meeting.notes && (
                    <div className="mb-2">
                      <p className="text-sm text-gray-500">Anteckningar:</p>
                      <p className={`text-gray-700 ${meeting.voidedAt ? 'line-through' : ''}`}>{meeting.notes}</p>
                    </div>
                  )}
                  {meeting.agreedActions && (
                    <div>
                      <p className="text-sm text-gray-500">Överenskomna åtgärder:</p>
                      <p className={`text-gray-700 ${meeting.voidedAt ? 'line-through' : ''}`}>{meeting.agreedActions}</p>
                    </div>
                  )}
                  {meeting.voidedAt && (
                    <p className="mt-2 text-sm text-red-600">
                      Makulerad {formatDateSv(meeting.voidedAt)} av {meeting.voidedBy?.name || 'okänd'}. Anledning: {meeting.voidReason}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 ml-4">
                  {!meeting.voidedAt && canSign && !meeting.signedAt && (
                    <button
                      onClick={() => signMutation.mutate(meeting.id)}
                      className="btn-success btn-sm"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  )}
                  {!meeting.voidedAt && canSign && meeting.signedAt && (
                    <button
                      onClick={() => setVoidTarget(meeting.id)}
                      className="btn-danger btn-sm"
                      title="Makulera"
                    >
                      <Ban className="w-4 h-4" />
                    </button>
                  )}
                  {!meeting.voidedAt && !meeting.signedAt && (
                    <button
                      onClick={() => {
                        if (confirm('Ta bort handledarsamtalet?')) {
                          deleteMutation.mutate(meeting.id);
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

      {/* Void modal */}
      {voidTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Makulera handledarsamtal</h2>
              <button onClick={() => { setVoidTarget(null); setVoidReason(''); }}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-600">
                Ange anledning till makuleringen. Handledarsamtalet kommer att markeras som makulerat och exkluderas från export.
              </p>
              <div>
                <label className="label">Anledning *</label>
                <textarea
                  className="input"
                  rows={3}
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="Ange anledning till makulering..."
                  required
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setVoidTarget(null); setVoidReason(''); }}
                  className="btn-secondary flex-1"
                >
                  Avbryt
                </button>
                <button
                  onClick={() => {
                    if (!voidReason.trim()) {
                      toast.error('Ange en anledning');
                      return;
                    }
                    voidMutation.mutate({ id: voidTarget, reason: voidReason.trim() });
                  }}
                  disabled={voidMutation.isPending || !voidReason.trim()}
                  className="btn-danger flex-1"
                >
                  Makulera
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Nytt handledarsamtal</h2>
              <button onClick={resetForm}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {!isTrainee && selectedTrainee && (
                <div className="p-3 bg-blue-50 rounded-lg text-sm">
                  <span className="font-medium">ST/BT-läkare:</span> {selectedTrainee.traineeName}
                </div>
              )}
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
                <label className="label">Anteckningar</label>
                <textarea
                  className="input"
                  rows={4}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Överenskomna åtgärder</label>
                <textarea
                  className="input"
                  rows={3}
                  value={form.agreedActions}
                  onChange={(e) => setForm({ ...form, agreedActions: e.target.value })}
                />
              </div>
              <div className="flex gap-2 pt-4">
                <button type="button" onClick={resetForm} className="btn-secondary flex-1">
                  Avbryt
                </button>
                <button type="submit" disabled={createMutation.isPending} className="btn-primary flex-1">
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
