import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import {
  UserRole,
  KvastRespondentType,
  KvastCompetencyRating,
  KvastCompetencies,
  KVAST_RESPONDENT_LABELS,
  KVAST_COMPETENCY_LABELS,
  KVAST_COMPETENCY_KEYS,
  KVAST_RATING_LABELS,
  formatDateSv,
} from '@saga/shared';
import { ClipboardList, CheckCircle, X, ChevronRight, Users } from 'lucide-react';
import toast from 'react-hot-toast';

const defaultCompetencies: KvastCompetencies = {
  kommunikationPatienter: KvastCompetencyRating.EJ_OBSERVERAT,
  kommunikationMedarbetare: KvastCompetencyRating.EJ_OBSERVERAT,
  samarbetsformaga: KvastCompetencyRating.EJ_OBSERVERAT,
  ledarskap: KvastCompetencyRating.EJ_OBSERVERAT,
  etik: KvastCompetencyRating.EJ_OBSERVERAT,
  klinisktResonemang: KvastCompetencyRating.EJ_OBSERVERAT,
  organisationsformaga: KvastCompetencyRating.EJ_OBSERVERAT,
  pedagogik: KvastCompetencyRating.EJ_OBSERVERAT,
  mangfaldJamstallhet: KvastCompetencyRating.EJ_OBSERVERAT,
  vardhygien: KvastCompetencyRating.EJ_OBSERVERAT,
  patientsakerhet: KvastCompetencyRating.EJ_OBSERVERAT,
};

function getRatingButtonClass(current: KvastCompetencyRating, value: KvastCompetencyRating) {
  const base = 'flex-1 py-1.5 text-xs font-medium rounded border transition-colors ';
  if (current === value) {
    if (value === KvastCompetencyRating.INGA_PROBLEM)
      return base + 'bg-success-500 border-success-500 text-white';
    if (value === KvastCompetencyRating.BOR_ADRESSERAS)
      return base + 'bg-warning-500 border-warning-500 text-white';
    return base + 'bg-gray-400 border-gray-400 text-white';
  }
  return base + 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50';
}

interface KvastFormProps {
  traineeId: string;
  traineeName: string;
  onClose: () => void;
  onSuccess: () => void;
}

function KvastForm({ traineeId, traineeName, onClose, onSuccess }: KvastFormProps) {
  const [form, setForm] = useState({
    respondentType: '' as KvastRespondentType | '',
    positiveFeedback: '',
    improvementFeedback: '',
    competencies: { ...defaultCompetencies },
    addressComments: '',
    otherComments: '',
  });

  const hasBorAdresseras = KVAST_COMPETENCY_KEYS.some(
    (key) => form.competencies[key] === KvastCompetencyRating.BOR_ADRESSERAS
  );

  const mutation = useMutation({
    mutationFn: (data: typeof form) =>
      api.post('/api/kvast', {
        traineeProfileId: traineeId,
        ...data,
      }),
    onSuccess: () => {
      toast.success('Utvärdering skickad!');
      onSuccess();
    },
    onError: (err: any) => toast.error(err.message || 'Fel vid skickande'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.respondentType) {
      toast.error('Välj vem du är');
      return;
    }
    if (hasBorAdresseras && !form.addressComments.trim()) {
      toast.error('Kommentar är obligatorisk när "Bör adresseras" väljs');
      return;
    }
    mutation.mutate(form);
  };

  const setCompetency = (key: keyof KvastCompetencies, value: KvastCompetencyRating) => {
    setForm((prev) => ({
      ...prev,
      competencies: { ...prev.competencies, [key]: value },
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl w-full max-w-3xl my-4">
        {/* Header */}
        <div className="sticky top-0 bg-white rounded-t-xl p-5 border-b border-gray-200 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              KVAST – 360-graders evaluering
            </h2>
            <p className="text-sm text-gray-500">Version 2 – 2024 · {traineeName}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-8">
          {/* Section 1: Respondent type */}
          <section>
            <h3 className="text-base font-semibold text-gray-900 mb-3">
              1. Vem svarar?
            </h3>
            <div className="space-y-2">
              {Object.entries(KVAST_RESPONDENT_LABELS).map(([value, label]) => (
                <label
                  key={value}
                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <input
                    type="radio"
                    name="respondentType"
                    value={value}
                    checked={form.respondentType === value}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        respondentType: e.target.value as KvastRespondentType,
                      }))
                    }
                    className="text-primary-600"
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Section 2: Positive feedback */}
          <section>
            <h3 className="text-base font-semibold text-gray-900 mb-2">
              2. Vad har du observerat som är bra?
            </h3>
            <textarea
              className="input w-full h-24 resize-none"
              placeholder="Beskriv vad du observerat som är bra..."
              value={form.positiveFeedback}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, positiveFeedback: e.target.value }))
              }
            />
          </section>

          {/* Section 3: Improvement feedback */}
          <section>
            <h3 className="text-base font-semibold text-gray-900 mb-2">
              3. Vad har du observerat som behöver förändras?
            </h3>
            <textarea
              className="input w-full h-24 resize-none"
              placeholder="Beskriv vad du observerat som behöver förändras..."
              value={form.improvementFeedback}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, improvementFeedback: e.target.value }))
              }
            />
          </section>

          {/* Section 4: Competency matrix */}
          <section>
            <h3 className="text-base font-semibold text-gray-900 mb-1">
              4. Hur är ST-läkaren gällande:
            </h3>
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
              Kommentar är obligatorisk i kommentarsfältet nedan, om "Bör adresseras" väljs.
            </p>

            <div className="space-y-3">
              {/* Column headers */}
              <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
                <div />
                <div className="flex gap-1 w-64">
                  {Object.values(KvastCompetencyRating).map((r) => (
                    <div key={r} className="flex-1 text-center text-xs text-gray-500 font-medium px-1">
                      {KVAST_RATING_LABELS[r]}
                    </div>
                  ))}
                </div>
              </div>

              {KVAST_COMPETENCY_KEYS.map((key, idx) => (
                <div
                  key={key}
                  className="grid grid-cols-[1fr_auto] gap-2 items-center py-2 border-b border-gray-100 last:border-0"
                >
                  <p className="text-sm text-gray-700">
                    <span className="font-medium mr-1">{idx + 1}.</span>
                    {KVAST_COMPETENCY_LABELS[key]}
                  </p>
                  <div className="flex gap-1 w-64">
                    {Object.values(KvastCompetencyRating).map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        className={getRatingButtonClass(form.competencies[key], rating)}
                        onClick={() => setCompetency(key, rating)}
                      >
                        {rating === KvastCompetencyRating.INGA_PROBLEM && 'OK'}
                        {rating === KvastCompetencyRating.BOR_ADRESSERAS && 'Åtg.'}
                        {rating === KvastCompetencyRating.EJ_OBSERVERAT && '–'}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Comments for Bör adresseras */}
            <div className="mt-4">
              <label className="label">
                Kommentarer vid val "Bör adresseras":
                {hasBorAdresseras && <span className="text-red-500 ml-1">*</span>}
              </label>
              <textarea
                className="input w-full h-20 resize-none"
                placeholder="Beskriv vad som bör adresseras..."
                value={form.addressComments}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, addressComments: e.target.value }))
                }
              />
            </div>
          </section>

          {/* Section 5: Other */}
          <section>
            <h3 className="text-base font-semibold text-gray-900 mb-2">
              5. Något annat som bör tas upp?
            </h3>
            <textarea
              className="input w-full h-20 resize-none"
              placeholder="Övriga kommentarer..."
              value={form.otherComments}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, otherComments: e.target.value }))
              }
            />
          </section>

          {/* Submit */}
          <div className="flex gap-3 pt-2 border-t border-gray-200">
            <button type="button" className="btn-secondary flex-1" onClick={onClose}>
              Avbryt
            </button>
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? 'Skickar...' : 'Skicka utvärdering'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UtvarderingsgruppView() {
  const [selectedTrainee, setSelectedTrainee] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [showSuccess, setShowSuccess] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['kvast-trainees'],
    queryFn: () => api.get('/api/kvast/trainees'),
  });

  const trainees = data?.trainees || [];

  const handleSuccess = () => {
    const name = selectedTrainee?.name;
    setSelectedTrainee(null);
    setShowSuccess(name || null);
    setTimeout(() => setShowSuccess(null), 5000);
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-4 h-16" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">KVAST 360-graders evaluering</h1>
        <p className="text-gray-500 mt-1">
          Välj en ST/BT-läkare att utvärdera. Formuläret är konfidentiellt.
        </p>
      </div>

      {showSuccess && (
        <div className="flex items-center gap-3 bg-success-50 border border-success-200 rounded-xl p-4">
          <CheckCircle className="w-5 h-5 text-success-600 flex-shrink-0" />
          <p className="text-success-800 font-medium">
            Utvärdering för {showSuccess} har skickats. Tack!
          </p>
        </div>
      )}

      {trainees.length === 0 ? (
        <div className="card p-8 text-center">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Inga ST/BT-läkare hittades för din klinik</p>
        </div>
      ) : (
        <div className="card divide-y divide-gray-100">
          {trainees.map((trainee: any) => (
            <button
              key={trainee.id}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
              onClick={() =>
                setSelectedTrainee({ id: trainee.id, name: trainee.user?.name })
              }
            >
              <div>
                <p className="font-semibold text-gray-900">{trainee.user?.name}</p>
                <p className="text-sm text-gray-500">
                  {trainee.clinic?.name} · {trainee.trackType}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          ))}
        </div>
      )}

      {selectedTrainee && (
        <KvastForm
          traineeId={selectedTrainee.id}
          traineeName={selectedTrainee.name}
          onClose={() => setSelectedTrainee(null)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}

function TraineeKvastView() {
  const { traineeProfile } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['kvast', traineeProfile?.id],
    queryFn: () => api.get(`/api/kvast?traineeProfileId=${traineeProfile?.id}`),
    enabled: !!traineeProfile?.id,
  });

  const responses = data?.responses || [];

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2].map((i) => (
          <div key={i} className="card p-4 h-32" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mina KVAST 360-utvärderingar</h1>
        <p className="text-gray-500 mt-1">
          Anonymiserad återkoppling från kollegor och medarbetare
        </p>
      </div>

      {responses.length === 0 ? (
        <div className="card p-8 text-center">
          <ClipboardList className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Inga KVAST-utvärderingar inkomna ännu</p>
        </div>
      ) : (
        <div className="space-y-4">
          {responses.map((r: any, idx: number) => (
            <KvastResponseCard key={r.id} response={r} index={responses.length - idx} />
          ))}
        </div>
      )}
    </div>
  );
}

export function KvastResponseCard({ response, index }: { response: any; index?: number }) {
  const [expanded, setExpanded] = useState(false);

  const borAdresseras = KVAST_COMPETENCY_KEYS.filter(
    (k) => response.competencies?.[k] === KvastCompetencyRating.BOR_ADRESSERAS
  );

  return (
    <div className="card">
      <button
        className="w-full p-4 text-left flex items-center justify-between hover:bg-gray-50 rounded-xl"
        onClick={() => setExpanded(!expanded)}
      >
        <div>
          <div className="flex items-center gap-2">
            {index !== undefined && (
              <span className="text-xs font-bold text-gray-400">#{index}</span>
            )}
            <span className="font-semibold text-gray-900">
              {KVAST_RESPONDENT_LABELS[response.respondentType as KvastRespondentType] ||
                response.respondentType}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {formatDateSv(response.submittedAt)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {borAdresseras.length > 0 && (
            <span className="badge-warning text-xs">{borAdresseras.length} bör adresseras</span>
          )}
          <span className="text-xs text-gray-400">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-4">
          {/* Positive feedback */}
          {response.positiveFeedback && (
            <div>
              <p className="label">Vad är bra</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {response.positiveFeedback}
              </p>
            </div>
          )}

          {/* Improvement feedback */}
          {response.improvementFeedback && (
            <div>
              <p className="label">Vad behöver förändras</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {response.improvementFeedback}
              </p>
            </div>
          )}

          {/* Competency summary */}
          <div>
            <p className="label mb-2">Kompetensmatris</p>
            <div className="space-y-1.5">
              {KVAST_COMPETENCY_KEYS.map((key) => {
                const rating = response.competencies?.[key] as KvastCompetencyRating;
                let badgeClass = 'badge-gray';
                if (rating === KvastCompetencyRating.INGA_PROBLEM) badgeClass = 'badge-success';
                if (rating === KvastCompetencyRating.BOR_ADRESSERAS) badgeClass = 'badge-warning';
                return (
                  <div key={key} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-gray-600 flex-1">{KVAST_COMPETENCY_LABELS[key]}</span>
                    <span className={`${badgeClass} flex-shrink-0`}>
                      {KVAST_RATING_LABELS[rating] || rating}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Address comments */}
          {response.addressComments && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="label text-amber-800 mb-1">Kommentarer – Bör adresseras</p>
              <p className="text-sm text-amber-900 whitespace-pre-wrap">
                {response.addressComments}
              </p>
            </div>
          )}

          {/* Other comments */}
          {response.otherComments && (
            <div>
              <p className="label">Övriga kommentarer</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {response.otherComments}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function KvastPage() {
  const { user } = useAuth();

  if (user?.role === UserRole.UTVARDERINGSGRUPP || user?.role === UserRole.ADMIN) {
    return <UtvarderingsgruppView />;
  }

  return <TraineeKvastView />;
}
