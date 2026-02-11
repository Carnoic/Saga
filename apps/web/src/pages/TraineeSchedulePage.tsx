import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { formatDateSv, UserRole } from '@saga/shared';
import { Calendar, ChevronLeft, ChevronRight, Users } from 'lucide-react';

interface Trainee {
  traineeId: string;
  traineeName: string;
  traineeEmail: string;
  trackType: string;
}

export default function TraineeSchedulePage() {
  const { user } = useAuth();
  const [selectedTraineeId, setSelectedTraineeId] = useState<string | null>(null);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  const isSupervisor = user?.role === UserRole.HANDLEDARE;

  // Fetch supervised trainees
  const { data: traineesData } = useQuery({
    queryKey: ['supervised-trainees'],
    queryFn: async () => {
      const res = await api.get('/api/trainees/supervised');
      return res.trainees || [];
    },
  });

  const trainees: Trainee[] = traineesData || [];

  // Auto-select first trainee
  useEffect(() => {
    if (trainees.length > 0 && !selectedTraineeId) {
      setSelectedTraineeId(trainees[0].traineeId);
    }
  }, [trainees, selectedTraineeId]);

  // Fetch rotations for selected trainee
  const { data: rotationsData, isLoading: rotationsLoading } = useQuery({
    queryKey: ['rotations', selectedTraineeId],
    queryFn: () => api.get(`/api/rotations?traineeProfileId=${selectedTraineeId}`),
    enabled: !!selectedTraineeId,
  });

  const rotations = rotationsData?.rotations || [];
  const selectedTrainee = trainees.find((t) => t.traineeId === selectedTraineeId);

  // Filter rotations visible in the current year
  const yearRotations = rotations.filter((r: any) => {
    const start = new Date(r.startDate).getFullYear();
    const end = new Date(r.endDate).getFullYear();
    return start <= currentYear && end >= currentYear;
  });

  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun',
    'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec',
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Schema</h1>
        <p className="text-gray-500">Översikt av ST-läkares placeringar</p>
      </div>

      {/* Trainee selector */}
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
          <p className="text-sm text-gray-500 mt-2">{selectedTrainee.traineeEmail}</p>
        )}
      </div>

      {!selectedTraineeId ? (
        <div className="card p-8 text-center">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Välj en ST/BT-läkare för att se schema</p>
        </div>
      ) : rotationsLoading ? (
        <div className="animate-pulse space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="card p-4 h-32" />
          ))}
        </div>
      ) : (
        <>
          {/* Year navigation + timeline */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setCurrentYear((y) => y - 1)}
                className="btn-secondary btn-sm"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xl font-bold">{currentYear}</span>
              <button
                onClick={() => setCurrentYear((y) => y + 1)}
                className="btn-secondary btn-sm"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Timeline */}
            <div className="overflow-x-auto">
              <div className="min-w-[800px]">
                {/* Month headers */}
                <div className="grid grid-cols-12 gap-1 mb-2">
                  {months.map((month, idx) => (
                    <div
                      key={month}
                      className={`text-center text-sm font-medium py-2 rounded ${
                        new Date().getFullYear() === currentYear && new Date().getMonth() === idx
                          ? 'bg-primary-100 text-primary-700'
                          : 'text-gray-500'
                      }`}
                    >
                      {month}
                    </div>
                  ))}
                </div>

                {/* Month grid background + rotation bars */}
                <div className="relative">
                  <div className="absolute inset-0 grid grid-cols-12 gap-1 pointer-events-none">
                    {months.map((_, idx) => (
                      <div
                        key={idx}
                        className={`h-full border border-gray-100 rounded ${
                          new Date().getFullYear() === currentYear && new Date().getMonth() === idx
                            ? 'bg-primary-50/50'
                            : 'bg-gray-50/50'
                        }`}
                      />
                    ))}
                  </div>

                  <div className="relative space-y-2 min-h-[100px]">
                    {yearRotations.length === 0 && (
                      <div className="flex items-center justify-center h-24 text-gray-400">
                        <span>Inga placeringar detta år</span>
                      </div>
                    )}
                    {yearRotations.map((rotation: any) => {
                      const start = new Date(rotation.startDate);
                      const end = new Date(rotation.endDate);
                      const now = new Date();
                      const isCurrent = start <= now && end >= now;
                      const startMonth = start.getFullYear() < currentYear ? 0 : start.getMonth();
                      const endMonth = end.getFullYear() > currentYear ? 11 : end.getMonth();
                      const span = endMonth - startMonth + 1;
                      const leftPercent = (startMonth / 12) * 100;
                      const widthPercent = (span / 12) * 100;

                      return (
                        <div key={rotation.id} className="relative h-14">
                          <div
                            className={`absolute h-full rounded-lg flex items-center px-3 ${
                              isCurrent
                                ? 'bg-emerald-500 text-white shadow-sm ring-2 ring-emerald-300'
                                : rotation.planned
                                  ? 'bg-gray-200 text-gray-700 border-2 border-dashed border-gray-400'
                                  : 'bg-primary-500 text-white shadow-sm'
                            }`}
                            style={{
                              left: `${leftPercent}%`,
                              width: `${widthPercent}%`,
                            }}
                          >
                            <div className="min-w-0">
                              <div className="font-medium text-sm truncate">{rotation.unit}</div>
                              {rotation.specialtyArea && span > 2 && (
                                <div className="text-xs truncate opacity-75">
                                  {rotation.specialtyArea}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-emerald-500 rounded ring-2 ring-emerald-300" />
                <span>Pågående</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-primary-500 rounded" />
                <span>Genomförd</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gray-200 border-2 border-dashed border-gray-400 rounded" />
                <span>Planerad</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-primary-100 rounded" />
                <span>Nuvarande månad</span>
              </div>
            </div>
          </div>

          {/* Rotation details list */}
          <div className="card">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Placeringar</h2>
            </div>
            <div className="divide-y divide-gray-200">
              {rotations.length === 0 ? (
                <div className="p-8 text-center">
                  <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Inga placeringar registrerade</p>
                </div>
              ) : (
                rotations.map((rotation: any) => (
                  <div
                    key={rotation.id}
                    className="p-4 hover:bg-gray-50 cursor-pointer"
                    onClick={() => setCurrentYear(new Date(rotation.startDate).getFullYear())}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{rotation.unit}</span>
                      {rotation.planned && <span className="badge-gray">Planerad</span>}
                    </div>
                    {rotation.specialtyArea && (
                      <p className="text-sm text-gray-500">{rotation.specialtyArea}</p>
                    )}
                    <p className="text-sm text-gray-500">
                      {formatDateSv(rotation.startDate)} – {formatDateSv(rotation.endDate)}
                    </p>
                    {rotation.supervisorName && (
                      <p className="text-sm text-gray-500">
                        Handledare: {rotation.supervisorName}
                      </p>
                    )}
                    {rotation.notes && (
                      <p className="text-sm text-gray-500 mt-1">{rotation.notes}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
