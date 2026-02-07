import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { formatDateSv } from '@saga/shared';
import { GraduationCap, Plus, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CoursesPage() {
  const { traineeProfile } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '',
    provider: '',
    startDate: '',
    endDate: '',
    hours: '',
    notes: '',
  });

  const profileId = traineeProfile?.id;

  const { data, isLoading } = useQuery({
    queryKey: ['courses', profileId],
    queryFn: () => api.get(`/api/courses?traineeProfileId=${profileId}`),
    enabled: !!profileId,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/api/courses', { ...data, traineeProfileId: profileId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      toast.success('Kurs skapad');
      resetForm();
    },
    onError: (error: any) => toast.error(error.message || 'Kunde inte skapa kurs'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/courses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      toast.success('Kurs borttagen');
    },
    onError: () => toast.error('Kunde inte ta bort kurs'),
  });

  const resetForm = () => {
    setForm({ title: '', provider: '', startDate: '', endDate: '', hours: '', notes: '' });
    setShowForm(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      ...form,
      hours: form.hours ? parseInt(form.hours) : undefined,
    });
  };

  const courses = data?.courses || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kurser</h1>
          <p className="text-gray-500">{courses.length} kurser registrerade</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          <Plus className="w-4 h-4 mr-2" />
          Lägg till kurs
        </button>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="card p-4 h-24"></div>
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="card p-8 text-center">
          <GraduationCap className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Inga kurser registrerade</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {courses.map((course: any) => (
            <div key={course.id} className="card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">{course.title}</h3>
                  {course.provider && (
                    <p className="text-sm text-gray-500">{course.provider}</p>
                  )}
                  <p className="text-sm text-gray-500 mt-1">
                    {formatDateSv(course.startDate)}
                    {course.endDate && ` - ${formatDateSv(course.endDate)}`}
                  </p>
                  {course.hours && (
                    <span className="badge-primary mt-2">{course.hours} timmar</span>
                  )}
                </div>
                <button
                  onClick={() => {
                    if (confirm('Ta bort kursen?')) {
                      deleteMutation.mutate(course.id);
                    }
                  }}
                  className="btn-danger btn-sm"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Lägg till kurs</h2>
              <button onClick={resetForm}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="label">Kurstitel *</label>
                <input
                  type="text"
                  className="input"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Arrangör</label>
                <input
                  type="text"
                  className="input"
                  value={form.provider}
                  onChange={(e) => setForm({ ...form, provider: e.target.value })}
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
                  <label className="label">Slutdatum</label>
                  <input
                    type="date"
                    className="input"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="label">Antal timmar</label>
                <input
                  type="number"
                  className="input"
                  value={form.hours}
                  onChange={(e) => setForm({ ...form, hours: e.target.value })}
                  min="1"
                />
              </div>
              <div className="flex gap-2 pt-4">
                <button type="button" onClick={resetForm} className="btn-secondary flex-1">
                  Avbryt
                </button>
                <button type="submit" disabled={createMutation.isPending} className="btn-primary flex-1">
                  Lägg till
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
