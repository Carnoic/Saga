import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { UserRole, USER_ROLE_LABELS } from '@saga/shared';
import { Users, Building2, Settings, Plus, X, Trash2, ChevronDown, ChevronRight, ArrowUp, ArrowDown, Pencil, ToggleLeft, ToggleRight } from 'lucide-react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import toast from 'react-hot-toast';

type Tab = 'users' | 'clinics' | 'settings';

interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  clinicId: string | null;
  clinic?: { name: string } | null;
  createdAt: string;
}

interface Clinic {
  id: string;
  name: string;
  region: string | null;
  _count?: {
    users: number;
    traineeProfiles: number;
  };
}

interface NewUserForm {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  clinicId: string;
}

interface NewClinicForm {
  name: string;
  region: string;
}

interface FeedbackQuestion {
  id: string;
  templateId: string;
  questionText: string;
  questionType: 'RATING' | 'TEXT' | 'MULTIPLE_CHOICE';
  options: string | null;
  required: boolean;
  sortOrder: number;
}

interface FeedbackTemplate {
  id: string;
  clinicId: string;
  name: string;
  isActive: boolean;
  questions: FeedbackQuestion[];
}

type QuestionType = 'RATING' | 'TEXT' | 'MULTIPLE_CHOICE';

interface QuestionFormData {
  questionText: string;
  questionType: QuestionType;
  options: string;
  required: boolean;
}

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  RATING: 'Betyg',
  TEXT: 'Fritext',
  MULTIPLE_CHOICE: 'Flerval',
};

const initialQuestionForm: QuestionFormData = {
  questionText: '',
  questionType: 'RATING',
  options: '',
  required: false,
};

const initialUserForm: NewUserForm = {
  email: '',
  password: '',
  name: '',
  role: UserRole.ST_BT,
  clinicId: '',
};

const initialClinicForm: NewClinicForm = {
  name: '',
  region: '',
};

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('users');
  const [showNewUserForm, setShowNewUserForm] = useState(false);
  const [showNewClinicForm, setShowNewClinicForm] = useState(false);
  const [userForm, setUserForm] = useState<NewUserForm>(initialUserForm);
  const [clinicForm, setClinicForm] = useState<NewClinicForm>(initialClinicForm);
  const [filterRole, setFilterRole] = useState<string>('');
  const [filterClinic, setFilterClinic] = useState<string>('');

  // Feedback template state
  const [selectedClinicId, setSelectedClinicId] = useState<string>('');
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);
  const [showNewTemplateModal, setShowNewTemplateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<FeedbackQuestion | null>(null);
  const [questionForm, setQuestionForm] = useState<QuestionFormData>(initialQuestionForm);
  const [questionTemplateId, setQuestionTemplateId] = useState<string>('');

  // Fetch all users
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['admin', 'users', filterRole, filterClinic],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filterRole) params.append('role', filterRole);
      if (filterClinic) params.append('clinicId', filterClinic);
      return api.get(`/api/admin/users?${params.toString()}`);
    },
    enabled: activeTab === 'users',
  });
  const users: User[] = usersData?.users || [];

  // Fetch all clinics
  const { data: clinicsData, isLoading: clinicsLoading } = useQuery({
    queryKey: ['admin', 'clinics'],
    queryFn: () => api.get('/api/admin/clinics'),
  });
  const clinics: Clinic[] = clinicsData?.clinics || [];

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: (data: NewUserForm) => api.post('/api/admin/users', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success('Användare skapad');
      setShowNewUserForm(false);
      setUserForm(initialUserForm);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Kunde inte skapa användare');
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success('Användare borttagen');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Kunde inte ta bort användare');
    },
  });

  // Create clinic mutation
  const createClinicMutation = useMutation({
    mutationFn: (data: NewClinicForm) => api.post('/api/admin/clinics', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'clinics'] });
      toast.success('Klinik skapad');
      setShowNewClinicForm(false);
      setClinicForm(initialClinicForm);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Kunde inte skapa klinik');
    },
  });

  // Fetch feedback templates for selected clinic
  const { data: templatesData, isLoading: templatesLoading } = useQuery({
    queryKey: ['admin', 'feedback-templates', selectedClinicId],
    queryFn: () => api.get(`/api/admin/feedback-templates?clinicId=${selectedClinicId}`),
    enabled: activeTab === 'settings' && !!selectedClinicId,
  });
  const templates: FeedbackTemplate[] = templatesData?.templates || [];

  // Template mutations
  const createTemplateMutation = useMutation({
    mutationFn: (data: { clinicId: string; name: string }) => api.post('/api/admin/feedback-templates', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'feedback-templates', selectedClinicId] });
      toast.success('Mall skapad');
      setShowNewTemplateModal(false);
      setNewTemplateName('');
    },
    onError: (error: any) => toast.error(error.message || 'Kunde inte skapa mall'),
  });

  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; isActive?: boolean } }) =>
      api.patch(`/api/admin/feedback-templates/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'feedback-templates', selectedClinicId] });
    },
    onError: (error: any) => toast.error(error.message || 'Kunde inte uppdatera mall'),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/feedback-templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'feedback-templates', selectedClinicId] });
      toast.success('Mall borttagen');
      setExpandedTemplateId(null);
    },
    onError: (error: any) => toast.error(error.message || 'Kunde inte ta bort mall'),
  });

  // Question mutations
  const createQuestionMutation = useMutation({
    mutationFn: ({ templateId, data }: { templateId: string; data: Record<string, unknown> }) =>
      api.post(`/api/admin/feedback-templates/${templateId}/questions`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'feedback-templates', selectedClinicId] });
      toast.success('Fråga tillagd');
      closeQuestionModal();
    },
    onError: (error: any) => toast.error(error.message || 'Kunde inte lägga till fråga'),
  });

  const updateQuestionMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.patch(`/api/admin/feedback-questions/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'feedback-templates', selectedClinicId] });
      toast.success('Fråga uppdaterad');
      closeQuestionModal();
    },
    onError: (error: any) => toast.error(error.message || 'Kunde inte uppdatera fråga'),
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/feedback-questions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'feedback-templates', selectedClinicId] });
      toast.success('Fråga borttagen');
    },
    onError: (error: any) => toast.error(error.message || 'Kunde inte ta bort fråga'),
  });

  const openAddQuestion = (templateId: string) => {
    setQuestionTemplateId(templateId);
    setEditingQuestion(null);
    setQuestionForm(initialQuestionForm);
    setShowQuestionModal(true);
  };

  const openEditQuestion = (question: FeedbackQuestion) => {
    setQuestionTemplateId(question.templateId);
    setEditingQuestion(question);
    setQuestionForm({
      questionText: question.questionText,
      questionType: question.questionType,
      options: question.options || '',
      required: question.required,
    });
    setShowQuestionModal(true);
  };

  const closeQuestionModal = () => {
    setShowQuestionModal(false);
    setEditingQuestion(null);
    setQuestionForm(initialQuestionForm);
    setQuestionTemplateId('');
  };

  const handleSaveQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionForm.questionText.trim()) {
      toast.error('Ange frågetext');
      return;
    }
    const data: Record<string, unknown> = {
      questionText: questionForm.questionText,
      questionType: questionForm.questionType,
      required: questionForm.required,
    };
    if (questionForm.questionType === 'MULTIPLE_CHOICE') {
      data.options = questionForm.options;
    } else {
      data.options = null;
    }

    if (editingQuestion) {
      updateQuestionMutation.mutate({ id: editingQuestion.id, data });
    } else {
      createQuestionMutation.mutate({ templateId: questionTemplateId, data });
    }
  };

  const handleMoveQuestion = (question: FeedbackQuestion, direction: 'up' | 'down') => {
    const template = templates.find(t => t.id === question.templateId);
    if (!template) return;
    const sorted = [...template.questions].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex(q => q.id === question.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    updateQuestionMutation.mutate({ id: sorted[idx].id, data: { sortOrder: sorted[swapIdx].sortOrder } });
    updateQuestionMutation.mutate({ id: sorted[swapIdx].id, data: { sortOrder: sorted[idx].sortOrder } });
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.email || !userForm.password || !userForm.name) {
      toast.error('Fyll i alla obligatoriska fält');
      return;
    }
    createUserMutation.mutate(userForm);
  };

  const handleCreateClinic = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicForm.name) {
      toast.error('Ange klinikens namn');
      return;
    }
    createClinicMutation.mutate(clinicForm);
  };

  const getRoleBadgeClass = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN:
        return 'badge-danger';
      case UserRole.STUDIEREKTOR:
        return 'badge-primary';
      case UserRole.HANDLEDARE:
        return 'badge-success';
      case UserRole.ST_BT:
        return 'badge-gray';
      case UserRole.UTVARDERINGSGRUPP:
        return 'badge-warning';
      default:
        return 'badge-gray';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Administration</h1>
          <p className="text-gray-500">Hantera användare, kliniker och systeminställningar</p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'users' && (
            <button onClick={() => setShowNewUserForm(true)} className="btn-primary">
              <Plus className="w-4 h-4 mr-2" />
              Ny användare
            </button>
          )}
          {activeTab === 'clinics' && (
            <button onClick={() => setShowNewClinicForm(true)} className="btn-primary">
              <Plus className="w-4 h-4 mr-2" />
              Ny klinik
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 font-medium text-sm border-b-2 -mb-px transition-colors ${
              activeTab === 'users'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            Användare
          </button>
          <button
            onClick={() => setActiveTab('clinics')}
            className={`px-4 py-2 font-medium text-sm border-b-2 -mb-px transition-colors ${
              activeTab === 'clinics'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Building2 className="w-4 h-4 inline mr-2" />
            Kliniker
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 font-medium text-sm border-b-2 -mb-px transition-colors ${
              activeTab === 'settings'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Settings className="w-4 h-4 inline mr-2" />
            Inställningar
          </button>
        </nav>
      </div>

      {/* Users tab */}
      {activeTab === 'users' && (
        <>
          {/* Filters */}
          <div className="flex gap-4 flex-wrap">
            <select
              className="input w-auto"
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
            >
              <option value="">Alla roller</option>
              {Object.entries(USER_ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select
              className="input w-auto"
              value={filterClinic}
              onChange={(e) => setFilterClinic(e.target.value)}
            >
              <option value="">Alla kliniker</option>
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Namn</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">E-post</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Roll</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Klinik</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-500">Skapad</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {usersLoading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        Laddar...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        Inga användare hittades
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{u.name}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{u.email}</td>
                        <td className="px-4 py-3">
                          <span className={getRoleBadgeClass(u.role)}>
                            {USER_ROLE_LABELS[u.role]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {u.clinic?.name || '-'}
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-gray-500">
                          {format(new Date(u.createdAt), 'd MMM yyyy', { locale: sv })}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => {
                              if (confirm(`Ta bort ${u.name}?`)) {
                                deleteUserMutation.mutate(u.id);
                              }
                            }}
                            className="btn-danger btn-sm"
                            title="Ta bort"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {/* Clinics tab */}
      {activeTab === 'clinics' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Namn</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Region</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-500">Användare</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-500">ST/BT-läkare</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {clinicsLoading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                      Laddar...
                    </td>
                  </tr>
                ) : clinics.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                      Inga kliniker. Klicka "Ny klinik" för att skapa en.
                    </td>
                  </tr>
                ) : (
                  clinics.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{c.name}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{c.region || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="badge-gray">{c._count?.users || 0}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="badge-primary">{c._count?.traineeProfiles || 0}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Settings tab */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Feedback-mallar per klinik</h2>

            {/* Clinic selector */}
            <div className="flex items-center gap-4 mb-6">
              <label className="label mb-0">Välj klinik:</label>
              <select
                className="input w-auto"
                value={selectedClinicId}
                onChange={(e) => {
                  setSelectedClinicId(e.target.value);
                  setExpandedTemplateId(null);
                }}
              >
                <option value="">-- Välj klinik --</option>
                {clinics.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {selectedClinicId && (
                <button
                  onClick={() => setShowNewTemplateModal(true)}
                  className="btn-primary"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Ny mall
                </button>
              )}
            </div>

            {/* Template list */}
            {!selectedClinicId ? (
              <p className="text-gray-500 text-sm">Välj en klinik för att hantera feedback-mallar.</p>
            ) : templatesLoading ? (
              <p className="text-gray-500 text-sm">Laddar mallar...</p>
            ) : templates.length === 0 ? (
              <p className="text-gray-500 text-sm">Inga mallar för denna klinik. Klicka "Ny mall" för att skapa en.</p>
            ) : (
              <div className="space-y-3">
                {templates.map((template) => (
                  <div key={template.id} className="border border-gray-200 rounded-lg">
                    {/* Template header */}
                    <div className="flex items-center gap-3 p-4">
                      <button
                        onClick={() => setExpandedTemplateId(expandedTemplateId === template.id ? null : template.id)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        {expandedTemplateId === template.id
                          ? <ChevronDown className="w-5 h-5" />
                          : <ChevronRight className="w-5 h-5" />
                        }
                      </button>
                      <span className="font-medium text-gray-900 flex-1">{template.name}</span>
                      <span className="text-xs text-gray-500">{template.questions.length} frågor</span>
                      <button
                        onClick={() => updateTemplateMutation.mutate({
                          id: template.id,
                          data: { isActive: !template.isActive },
                        })}
                        className={`flex items-center gap-1 text-sm ${template.isActive ? 'text-green-600' : 'text-gray-400'}`}
                        title={template.isActive ? 'Aktiv — klicka för att inaktivera' : 'Inaktiv — klicka för att aktivera'}
                      >
                        {template.isActive
                          ? <ToggleRight className="w-5 h-5" />
                          : <ToggleLeft className="w-5 h-5" />
                        }
                        <span className="hidden sm:inline">{template.isActive ? 'Aktiv' : 'Inaktiv'}</span>
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Ta bort mallen "${template.name}" och alla dess frågor?`)) {
                            deleteTemplateMutation.mutate(template.id);
                          }
                        }}
                        className="btn-danger btn-sm"
                        title="Ta bort mall"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Expanded template: questions */}
                    {expandedTemplateId === template.id && (
                      <div className="border-t border-gray-200 p-4 bg-gray-50">
                        {template.questions.length === 0 ? (
                          <p className="text-sm text-gray-500 mb-3">Inga frågor ännu.</p>
                        ) : (
                          <div className="space-y-2 mb-3">
                            {[...template.questions]
                              .sort((a, b) => a.sortOrder - b.sortOrder)
                              .map((q, idx, arr) => (
                                <div key={q.id} className="flex items-center gap-2 bg-white rounded-lg p-3 border border-gray-200">
                                  <div className="flex flex-col gap-1">
                                    <button
                                      disabled={idx === 0}
                                      onClick={() => handleMoveQuestion(q, 'up')}
                                      className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                      title="Flytta upp"
                                    >
                                      <ArrowUp className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      disabled={idx === arr.length - 1}
                                      onClick={() => handleMoveQuestion(q, 'down')}
                                      className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                      title="Flytta ner"
                                    >
                                      <ArrowDown className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm text-gray-900 truncate">{q.questionText}</p>
                                  </div>
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    q.questionType === 'RATING' ? 'bg-blue-100 text-blue-700' :
                                    q.questionType === 'TEXT' ? 'bg-green-100 text-green-700' :
                                    'bg-purple-100 text-purple-700'
                                  }`}>
                                    {QUESTION_TYPE_LABELS[q.questionType]}
                                  </span>
                                  {q.required && (
                                    <span className="text-xs text-red-500 font-medium">Obligatorisk</span>
                                  )}
                                  <button
                                    onClick={() => openEditQuestion(q)}
                                    className="text-gray-400 hover:text-gray-600"
                                    title="Redigera"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (confirm('Ta bort denna fråga?')) {
                                        deleteQuestionMutation.mutate(q.id);
                                      }
                                    }}
                                    className="text-gray-400 hover:text-red-500"
                                    title="Ta bort"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                          </div>
                        )}
                        <button
                          onClick={() => openAddQuestion(template.id)}
                          className="btn-secondary btn-sm"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Lägg till fråga
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Other planned settings */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Övriga inställningar</h2>
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">Planerade funktioner:</h3>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                <li>Hantera delmålspecifikationer</li>
                <li>Systemloggar och revisionshistorik</li>
                <li>E-postmallar och notifikationsinställningar</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* New user modal */}
      {showNewUserForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Ny användare</h2>
              <button onClick={() => setShowNewUserForm(false)} className="text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="p-4 space-y-4">
              <div>
                <label className="label">Namn *</label>
                <input
                  type="text"
                  className="input"
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  placeholder="För- och efternamn"
                  required
                />
              </div>
              <div>
                <label className="label">E-post *</label>
                <input
                  type="email"
                  className="input"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  placeholder="e-post@example.com"
                  required
                />
              </div>
              <div>
                <label className="label">Lösenord *</label>
                <input
                  type="password"
                  className="input"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  placeholder="Minst 6 tecken"
                  minLength={6}
                  required
                />
              </div>
              <div>
                <label className="label">Roll *</label>
                <select
                  className="input"
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value as UserRole })}
                >
                  {Object.entries(USER_ROLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Klinik</label>
                <select
                  className="input"
                  value={userForm.clinicId}
                  onChange={(e) => setUserForm({ ...userForm, clinicId: e.target.value })}
                >
                  <option value="">Ingen klinik</option>
                  {clinics.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewUserForm(false);
                    setUserForm(initialUserForm);
                  }}
                  className="btn-secondary flex-1"
                >
                  Avbryt
                </button>
                <button
                  type="submit"
                  disabled={createUserMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {createUserMutation.isPending ? 'Skapar...' : 'Skapa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New template modal */}
      {showNewTemplateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Ny feedback-mall</h2>
              <button onClick={() => { setShowNewTemplateModal(false); setNewTemplateName(''); }} className="text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newTemplateName.trim()) { toast.error('Ange mallens namn'); return; }
                createTemplateMutation.mutate({ clinicId: selectedClinicId, name: newTemplateName.trim() });
              }}
              className="p-4 space-y-4"
            >
              <div>
                <label className="label">Mallnamn *</label>
                <input
                  type="text"
                  className="input"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="t.ex. Standard-feedback"
                  required
                  autoFocus
                />
              </div>
              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowNewTemplateModal(false); setNewTemplateName(''); }}
                  className="btn-secondary flex-1"
                >
                  Avbryt
                </button>
                <button type="submit" disabled={createTemplateMutation.isPending} className="btn-primary flex-1">
                  {createTemplateMutation.isPending ? 'Skapar...' : 'Skapa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Question modal (add/edit) */}
      {showQuestionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingQuestion ? 'Redigera fråga' : 'Lägg till fråga'}</h2>
              <button onClick={closeQuestionModal} className="text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveQuestion} className="p-4 space-y-4">
              <div>
                <label className="label">Frågetext *</label>
                <textarea
                  className="input"
                  rows={3}
                  value={questionForm.questionText}
                  onChange={(e) => setQuestionForm({ ...questionForm, questionText: e.target.value })}
                  placeholder="Skriv din fråga här..."
                  required
                />
              </div>
              <div>
                <label className="label">Typ</label>
                <select
                  className="input"
                  value={questionForm.questionType}
                  onChange={(e) => setQuestionForm({ ...questionForm, questionType: e.target.value as QuestionType })}
                >
                  <option value="RATING">Betyg</option>
                  <option value="TEXT">Fritext</option>
                  <option value="MULTIPLE_CHOICE">Flerval</option>
                </select>
              </div>
              {questionForm.questionType === 'MULTIPLE_CHOICE' && (
                <div>
                  <label className="label">Alternativ (kommaseparerade)</label>
                  <input
                    type="text"
                    className="input"
                    value={questionForm.options}
                    onChange={(e) => setQuestionForm({ ...questionForm, options: e.target.value })}
                    placeholder="t.ex. Bra, Medel, Dålig"
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="question-required"
                  checked={questionForm.required}
                  onChange={(e) => setQuestionForm({ ...questionForm, required: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <label htmlFor="question-required" className="text-sm text-gray-700">Obligatorisk fråga</label>
              </div>
              <div className="flex gap-2 pt-4">
                <button type="button" onClick={closeQuestionModal} className="btn-secondary flex-1">
                  Avbryt
                </button>
                <button
                  type="submit"
                  disabled={createQuestionMutation.isPending || updateQuestionMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {(createQuestionMutation.isPending || updateQuestionMutation.isPending) ? 'Sparar...' : 'Spara'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New clinic modal */}
      {showNewClinicForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Ny klinik</h2>
              <button onClick={() => setShowNewClinicForm(false)} className="text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateClinic} className="p-4 space-y-4">
              <div>
                <label className="label">Namn *</label>
                <input
                  type="text"
                  className="input"
                  value={clinicForm.name}
                  onChange={(e) => setClinicForm({ ...clinicForm, name: e.target.value })}
                  placeholder="Klinikens namn"
                  required
                />
              </div>
              <div>
                <label className="label">Region</label>
                <input
                  type="text"
                  className="input"
                  value={clinicForm.region}
                  onChange={(e) => setClinicForm({ ...clinicForm, region: e.target.value })}
                  placeholder="t.ex. Region Stockholm"
                />
              </div>
              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewClinicForm(false);
                    setClinicForm(initialClinicForm);
                  }}
                  className="btn-secondary flex-1"
                >
                  Avbryt
                </button>
                <button
                  type="submit"
                  disabled={createClinicMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {createClinicMutation.isPending ? 'Skapar...' : 'Skapa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
