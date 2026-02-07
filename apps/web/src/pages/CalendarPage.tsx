import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { formatDateSv } from '@saga/shared';
import { Calendar, Plus, Edit, Trash2, ChevronLeft, ChevronRight, GripVertical, Move } from 'lucide-react';
import toast from 'react-hot-toast';

interface RotationForm {
  unit: string;
  specialtyArea: string;
  startDate: string;
  endDate: string;
  planned: boolean;
  supervisorName: string;
  notes: string;
}

interface DragState {
  rotationId: string;
  type: 'move' | 'resize-start' | 'resize-end';
  startX: number;
  originalStartDate: Date;
  originalEndDate: Date;
}

export default function CalendarPage() {
  const { traineeProfile } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RotationForm>({
    unit: '',
    specialtyArea: '',
    startDate: '',
    endDate: '',
    planned: false,
    supervisorName: '',
    notes: '',
  });
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragPreview, setDragPreview] = useState<{ startMonth: number; endMonth: number } | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['rotations', traineeProfile?.id],
    queryFn: () => api.get(`/api/rotations?traineeProfileId=${traineeProfile?.id}`),
    enabled: !!traineeProfile?.id,
  });

  const createMutation = useMutation({
    mutationFn: (data: RotationForm) =>
      api.post('/api/rotations', { ...data, traineeProfileId: traineeProfile?.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rotations'] });
      toast.success('Placering skapad');
      resetForm();
    },
    onError: (error: any) => toast.error(error.message || 'Kunde inte skapa placering'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<RotationForm> }) =>
      api.patch(`/api/rotations/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rotations'] });
      toast.success('Placering uppdaterad');
      resetForm();
    },
    onError: (error: any) => toast.error(error.message || 'Kunde inte uppdatera placering'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/rotations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rotations'] });
      toast.success('Placering borttagen');
    },
    onError: () => toast.error('Kunde inte ta bort placering'),
  });

  const resetForm = () => {
    setForm({
      unit: '',
      specialtyArea: '',
      startDate: '',
      endDate: '',
      planned: false,
      supervisorName: '',
      notes: '',
    });
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (rotation: any) => {
    setForm({
      unit: rotation.unit,
      specialtyArea: rotation.specialtyArea || '',
      startDate: rotation.startDate.split('T')[0],
      endDate: rotation.endDate.split('T')[0],
      planned: rotation.planned,
      supervisorName: rotation.supervisorName || '',
      notes: rotation.notes || '',
    });
    setEditingId(rotation.id);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  // Drag and drop handlers
  const getMonthFromX = useCallback((clientX: number): number => {
    if (!timelineRef.current) return 0;
    const rect = timelineRef.current.getBoundingClientRect();
    const relativeX = clientX - rect.left;
    const monthWidth = rect.width / 12;
    return Math.max(0, Math.min(11, Math.floor(relativeX / monthWidth)));
  }, []);

  const handleDragStart = useCallback((
    e: React.MouseEvent,
    rotationId: string,
    type: 'move' | 'resize-start' | 'resize-end',
    rotation: any
  ) => {
    e.preventDefault();
    e.stopPropagation();

    setDragState({
      rotationId,
      type,
      startX: e.clientX,
      originalStartDate: new Date(rotation.startDate),
      originalEndDate: new Date(rotation.endDate),
    });

    const startMonth = new Date(rotation.startDate).getFullYear() < currentYear ? 0 : new Date(rotation.startDate).getMonth();
    const endMonth = new Date(rotation.endDate).getFullYear() > currentYear ? 11 : new Date(rotation.endDate).getMonth();
    setDragPreview({ startMonth, endMonth });
  }, [currentYear]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState || !timelineRef.current) return;

    const currentMonth = getMonthFromX(e.clientX);
    const rect = timelineRef.current.getBoundingClientRect();
    const monthWidth = rect.width / 12;
    const deltaMonths = Math.round((e.clientX - dragState.startX) / monthWidth);

    let newStartMonth: number;
    let newEndMonth: number;

    const origStartMonth = dragState.originalStartDate.getFullYear() < currentYear ? 0 : dragState.originalStartDate.getMonth();
    const origEndMonth = dragState.originalEndDate.getFullYear() > currentYear ? 11 : dragState.originalEndDate.getMonth();

    if (dragState.type === 'move') {
      newStartMonth = Math.max(0, Math.min(11, origStartMonth + deltaMonths));
      const duration = origEndMonth - origStartMonth;
      newEndMonth = Math.min(11, newStartMonth + duration);
      newStartMonth = newEndMonth - duration;
    } else if (dragState.type === 'resize-start') {
      newStartMonth = Math.max(0, Math.min(origEndMonth - 1, origStartMonth + deltaMonths));
      newEndMonth = origEndMonth;
    } else {
      newStartMonth = origStartMonth;
      newEndMonth = Math.max(origStartMonth + 1, Math.min(11, origEndMonth + deltaMonths));
    }

    setDragPreview({ startMonth: newStartMonth, endMonth: newEndMonth });
  }, [dragState, currentYear, getMonthFromX]);

  const handleMouseUp = useCallback(() => {
    if (!dragState || !dragPreview) {
      setDragState(null);
      setDragPreview(null);
      return;
    }

    const rotation = rotations.find((r: any) => r.id === dragState.rotationId);
    if (!rotation) {
      setDragState(null);
      setDragPreview(null);
      return;
    }

    // Calculate new dates
    const origStartMonth = dragState.originalStartDate.getMonth();
    const origEndMonth = dragState.originalEndDate.getMonth();
    const origStartYear = dragState.originalStartDate.getFullYear();
    const origEndYear = dragState.originalEndDate.getFullYear();

    let newStartDate: Date;
    let newEndDate: Date;

    if (dragState.type === 'move') {
      const deltaMonths = dragPreview.startMonth - (origStartYear < currentYear ? 0 : origStartMonth);
      newStartDate = new Date(dragState.originalStartDate);
      newStartDate.setMonth(newStartDate.getMonth() + deltaMonths);
      newEndDate = new Date(dragState.originalEndDate);
      newEndDate.setMonth(newEndDate.getMonth() + deltaMonths);
    } else if (dragState.type === 'resize-start') {
      newStartDate = new Date(currentYear, dragPreview.startMonth, 1);
      newEndDate = dragState.originalEndDate;
    } else {
      newStartDate = dragState.originalStartDate;
      newEndDate = new Date(currentYear, dragPreview.endMonth + 1, 0); // Last day of month
    }

    // Only update if dates changed
    if (newStartDate.getTime() !== dragState.originalStartDate.getTime() ||
        newEndDate.getTime() !== dragState.originalEndDate.getTime()) {
      updateMutation.mutate({
        id: dragState.rotationId,
        data: {
          startDate: newStartDate.toISOString().split('T')[0],
          endDate: newEndDate.toISOString().split('T')[0],
        },
      });
    }

    setDragState(null);
    setDragPreview(null);
  }, [dragState, dragPreview, currentYear, updateMutation]);

  const rotations = data?.rotations || [];

  // Get years range
  const startYear = traineeProfile ? new Date(traineeProfile.startDate).getFullYear() : currentYear;
  const endYear = traineeProfile ? new Date(traineeProfile.plannedEndDate).getFullYear() : currentYear + 5;
  const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);

  // Get rotations for current year
  const yearRotations = rotations.filter((r: any) => {
    const start = new Date(r.startDate).getFullYear();
    const end = new Date(r.endDate).getFullYear();
    return start <= currentYear && end >= currentYear;
  });

  // Months
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun',
    'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kalender & Placeringar</h1>
          <p className="text-gray-500">{rotations.length} placeringar totalt</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          <Plus className="w-4 h-4 mr-2" />
          Ny placering
        </button>
      </div>

      {/* Drag instruction */}
      <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 flex items-center gap-2 text-sm text-primary-700">
        <Move className="w-4 h-4" />
        <span>Dra i mitten för att flytta, dra i kanterna för att ändra längd</span>
      </div>

      {/* Year navigation */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setCurrentYear((y) => Math.max(startYear, y - 1))}
            disabled={currentYear <= startYear}
            className="btn-secondary btn-sm"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xl font-bold">{currentYear}</span>
          <button
            onClick={() => setCurrentYear((y) => Math.min(endYear, y + 1))}
            disabled={currentYear >= endYear}
            className="btn-secondary btn-sm"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Year overview with drag-and-drop */}
        <div
          className="overflow-x-auto"
          onMouseMove={dragState ? handleMouseMove : undefined}
          onMouseUp={dragState ? handleMouseUp : undefined}
          onMouseLeave={dragState ? handleMouseUp : undefined}
        >
          <div className="min-w-[800px]" ref={timelineRef}>
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

            {/* Month grid background */}
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

              {/* Rotations */}
              <div className="relative space-y-2 min-h-[100px]">
                {yearRotations.length === 0 && (
                  <div className="flex items-center justify-center h-24 text-gray-400">
                    <span>Inga placeringar detta år</span>
                  </div>
                )}
                {yearRotations.map((rotation: any) => {
                  const start = new Date(rotation.startDate);
                  const end = new Date(rotation.endDate);

                  // Use preview if dragging this rotation
                  const isDragging = dragState?.rotationId === rotation.id;
                  const displayStartMonth = isDragging && dragPreview
                    ? dragPreview.startMonth
                    : (start.getFullYear() < currentYear ? 0 : start.getMonth());
                  const displayEndMonth = isDragging && dragPreview
                    ? dragPreview.endMonth
                    : (end.getFullYear() > currentYear ? 11 : end.getMonth());

                  const span = displayEndMonth - displayStartMonth + 1;
                  const leftPercent = (displayStartMonth / 12) * 100;
                  const widthPercent = (span / 12) * 100;

                  return (
                    <div
                      key={rotation.id}
                      className="relative h-14"
                    >
                      <div
                        className={`absolute h-full rounded-lg flex items-center transition-all ${
                          isDragging ? 'shadow-lg ring-2 ring-primary-400 z-10' : ''
                        } ${
                          rotation.planned
                            ? 'bg-gray-200 text-gray-700 border-2 border-dashed border-gray-400'
                            : 'bg-primary-500 text-white shadow-sm'
                        }`}
                        style={{
                          left: `${leftPercent}%`,
                          width: `${widthPercent}%`,
                        }}
                      >
                        {/* Resize handle - start */}
                        <div
                          className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-black/10 rounded-l-lg flex items-center justify-center"
                          onMouseDown={(e) => handleDragStart(e, rotation.id, 'resize-start', rotation)}
                        >
                          <div className="w-0.5 h-6 bg-current opacity-30 rounded" />
                        </div>

                        {/* Move handle - center */}
                        <div
                          className="flex-1 px-4 py-2 cursor-move overflow-hidden"
                          onMouseDown={(e) => handleDragStart(e, rotation.id, 'move', rotation)}
                        >
                          <div className="flex items-center gap-2">
                            <GripVertical className="w-3 h-3 opacity-50 flex-shrink-0" />
                            <div className="min-w-0">
                              <div className="font-medium text-sm truncate">{rotation.unit}</div>
                              {rotation.specialtyArea && span > 2 && (
                                <div className="text-xs truncate opacity-75">{rotation.specialtyArea}</div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Resize handle - end */}
                        <div
                          className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-black/10 rounded-r-lg flex items-center justify-center"
                          onMouseDown={(e) => handleDragStart(e, rotation.id, 'resize-end', rotation)}
                        >
                          <div className="w-0.5 h-6 bg-current opacity-30 rounded" />
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
        <div className="flex gap-4 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-primary-500 rounded"></div>
            <span>Genomförd</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-200 border-2 border-dashed border-gray-400 rounded"></div>
            <span>Planerad</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-primary-100 rounded"></div>
            <span>Nuvarande månad</span>
          </div>
        </div>
      </div>

      {/* 5-year overview */}
      <div className="card p-4">
        <h2 className="font-semibold text-gray-900 mb-4">5-årsöversikt</h2>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {years.map((year) => {
            const yearCount = rotations.filter((r: any) => {
              const start = new Date(r.startDate).getFullYear();
              const end = new Date(r.endDate).getFullYear();
              return start <= year && end >= year;
            }).length;

            return (
              <button
                key={year}
                onClick={() => setCurrentYear(year)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap flex flex-col items-center ${
                  year === currentYear
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span>{year}</span>
                {yearCount > 0 && (
                  <span className={`text-xs ${year === currentYear ? 'text-primary-200' : 'text-gray-500'}`}>
                    {yearCount} plac.
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Rotations list */}
      <div className="card">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Alla placeringar</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {rotations.length === 0 ? (
            <div className="p-8 text-center">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Inga placeringar registrerade</p>
            </div>
          ) : (
            rotations.map((rotation: any) => (
              <div key={rotation.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{rotation.unit}</span>
                    {rotation.planned && <span className="badge-gray">Planerad</span>}
                  </div>
                  {rotation.specialtyArea && (
                    <p className="text-sm text-gray-500">{rotation.specialtyArea}</p>
                  )}
                  <p className="text-sm text-gray-500">
                    {formatDateSv(rotation.startDate)} - {formatDateSv(rotation.endDate)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(rotation)} className="btn-secondary btn-sm">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Vill du ta bort denna placering?')) {
                        deleteMutation.mutate(rotation.id);
                      }
                    }}
                    className="btn-danger btn-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">
                {editingId ? 'Redigera placering' : 'Ny placering'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="label">Enhet *</label>
                <input
                  type="text"
                  className="input"
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Specialitetsområde</label>
                <input
                  type="text"
                  className="input"
                  value={form.specialtyArea}
                  onChange={(e) => setForm({ ...form, specialtyArea: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Startdatum *</label>
                  <input
                    type="date"
                    className="input"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="label">Slutdatum *</label>
                  <input
                    type="date"
                    className="input"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="label">Handledare</label>
                <input
                  type="text"
                  className="input"
                  value={form.supervisorName}
                  onChange={(e) => setForm({ ...form, supervisorName: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Anteckningar</label>
                <textarea
                  className="input"
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="planned"
                  checked={form.planned}
                  onChange={(e) => setForm({ ...form, planned: e.target.checked })}
                  className="w-4 h-4 text-primary-600 rounded"
                />
                <label htmlFor="planned" className="text-sm text-gray-700">
                  Planerad (ej genomförd)
                </label>
              </div>
              <div className="flex gap-2 pt-4">
                <button type="button" onClick={resetForm} className="btn-secondary flex-1">
                  Avbryt
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {editingId ? 'Spara' : 'Skapa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
