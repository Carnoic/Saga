import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { Star, MessageSquare, CheckCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface PendingRotation {
  id: string;
  unit: string;
  startDate: string;
  endDate: string;
}

interface FeedbackForm {
  overallRating: number;
  educationalValue: number;
  supervisionQuality: number;
  workEnvironment: number;
  positives: string;
  improvements: string;
  otherComments: string;
  anonymous: boolean;
}

const initialForm: FeedbackForm = {
  overallRating: 0,
  educationalValue: 0,
  supervisionQuality: 0,
  workEnvironment: 0,
  positives: '',
  improvements: '',
  otherComments: '',
  anonymous: false,
};

function StarRating({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const [hover, setHover] = useState(0);

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className="p-1 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(star)}
          >
            <Star
              className={`w-8 h-8 ${
                star <= (hover || value)
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-gray-300'
              }`}
            />
          </button>
        ))}
        <span className="ml-2 text-sm text-gray-500 self-center">
          {value > 0 ? `${value}/5` : 'Välj betyg'}
        </span>
      </div>
    </div>
  );
}

export default function FeedbackPage() {
  const queryClient = useQueryClient();
  const [selectedRotation, setSelectedRotation] = useState<PendingRotation | null>(null);
  const [form, setForm] = useState<FeedbackForm>(initialForm);

  const { data: pendingData, isLoading } = useQuery({
    queryKey: ['pending-feedback'],
    queryFn: () => api.get<{ pendingFeedback: PendingRotation[] }>('/api/feedback/pending'),
  });

  const submitMutation = useMutation({
    mutationFn: (data: { rotationId: string; feedback: FeedbackForm }) =>
      api.post(`/api/feedback/rotation/${data.rotationId}`, data.feedback),
    onSuccess: () => {
      toast.success('Tack för din feedback!');
      queryClient.invalidateQueries({ queryKey: ['pending-feedback'] });
      setSelectedRotation(null);
      setForm(initialForm);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRotation) return;

    // Validate ratings
    if (
      form.overallRating === 0 ||
      form.educationalValue === 0 ||
      form.supervisionQuality === 0 ||
      form.workEnvironment === 0
    ) {
      toast.error('Vänligen fyll i alla betyg');
      return;
    }

    submitMutation.mutate({
      rotationId: selectedRotation.id,
      feedback: form,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  const pendingRotations = pendingData?.pendingFeedback || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Placeringsfeedback</h1>
        <p className="text-gray-600">
          Lämna feedback på avslutade placeringar för att hjälpa förbättra utbildningen
        </p>
      </div>

      {!selectedRotation ? (
        <>
          {pendingRotations.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Ingen feedback att lämna</h2>
              <p className="text-gray-600">
                Du har lämnat feedback för alla dina avslutade placeringar.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b">
                <h2 className="font-semibold flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-orange-500" />
                  Placeringar som väntar på feedback ({pendingRotations.length})
                </h2>
              </div>
              <ul className="divide-y">
                {pendingRotations.map((rotation) => (
                  <li key={rotation.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">{rotation.unit}</h3>
                        <p className="text-sm text-gray-500">
                          {format(new Date(rotation.startDate), 'd MMM yyyy', { locale: sv })} -{' '}
                          {format(new Date(rotation.endDate), 'd MMM yyyy', { locale: sv })}
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedRotation(rotation)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                      >
                        <MessageSquare className="w-4 h-4" />
                        Lämna feedback
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="font-semibold">Feedback för: {selectedRotation.unit}</h2>
            <p className="text-sm text-gray-500">
              {format(new Date(selectedRotation.startDate), 'd MMM yyyy', { locale: sv })} -{' '}
              {format(new Date(selectedRotation.endDate), 'd MMM yyyy', { locale: sv })}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <StarRating
                label="Helhetsintryck"
                value={form.overallRating}
                onChange={(v) => setForm({ ...form, overallRating: v })}
              />
              <StarRating
                label="Utbildningsvärde"
                value={form.educationalValue}
                onChange={(v) => setForm({ ...form, educationalValue: v })}
              />
              <StarRating
                label="Handledningens kvalitet"
                value={form.supervisionQuality}
                onChange={(v) => setForm({ ...form, supervisionQuality: v })}
              />
              <StarRating
                label="Arbetsmiljö"
                value={form.workEnvironment}
                onChange={(v) => setForm({ ...form, workEnvironment: v })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vad var bra med placeringen?
              </label>
              <textarea
                value={form.positives}
                onChange={(e) => setForm({ ...form, positives: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Beskriv vad som fungerade bra..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vad kan förbättras?
              </label>
              <textarea
                value={form.improvements}
                onChange={(e) => setForm({ ...form, improvements: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ge förslag på förbättringar..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Övriga kommentarer (valfritt)
              </label>
              <textarea
                value={form.otherComments}
                onChange={(e) => setForm({ ...form, otherComments: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Andra tankar eller synpunkter..."
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="anonymous"
                checked={form.anonymous}
                onChange={(e) => setForm({ ...form, anonymous: e.target.checked })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="anonymous" className="text-sm text-gray-700">
                Lämna feedback anonymt (ditt namn visas inte för studierektorn)
              </label>
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => {
                  setSelectedRotation(null);
                  setForm(initialForm);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Avbryt
              </button>
              <button
                type="submit"
                disabled={submitMutation.isPending}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {submitMutation.isPending ? 'Skickar...' : 'Skicka feedback'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
