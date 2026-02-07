import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { USER_ROLE_LABELS, UserRole, NotificationPreference, NotificationPreferenceUpdateInput } from '@saga/shared';
import { User, Lock, Bell, Shield } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [changingPassword, setChangingPassword] = useState(false);

  // Fetch notification preferences
  const { data: notificationPrefs, isLoading: loadingPrefs } = useQuery<NotificationPreference>({
    queryKey: ['notification-preferences'],
    queryFn: () => api.get('/api/notifications/preferences'),
  });

  // Update notification preferences mutation
  const updatePrefsMutation = useMutation({
    mutationFn: (data: NotificationPreferenceUpdateInput) =>
      api.patch('/api/notifications/preferences', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
      toast.success('Notifikationsinställningar sparade');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Kunde inte spara inställningar');
    },
  });

  const handlePrefChange = (key: keyof NotificationPreferenceUpdateInput, value: boolean | number) => {
    updatePrefsMutation.mutate({ [key]: value });
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Lösenorden matchar inte');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast.error('Lösenordet måste vara minst 6 tecken');
      return;
    }

    setChangingPassword(true);

    try {
      await api.post('/api/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      toast.success('Lösenordet har ändrats');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      toast.error(error.message || 'Kunde inte ändra lösenord');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Inställningar</h1>
        <p className="text-gray-500">Hantera ditt konto och inställningar</p>
      </div>

      {/* Profile info */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <User className="w-5 h-5" />
          Profilinformation
        </h2>
        <div className="space-y-4">
          <div>
            <label className="label">Namn</label>
            <p className="font-medium text-gray-900">{user?.name}</p>
          </div>
          <div>
            <label className="label">E-post</label>
            <p className="font-medium text-gray-900">{user?.email}</p>
          </div>
          <div>
            <label className="label">Roll</label>
            <p className="font-medium text-gray-900">
              {USER_ROLE_LABELS[user?.role as UserRole]}
            </p>
          </div>
        </div>
      </div>

      {/* Change password */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Lock className="w-5 h-5" />
          Byt lösenord
        </h2>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="label">Nuvarande lösenord</label>
            <input
              type="password"
              className="input"
              value={passwordForm.currentPassword}
              onChange={(e) =>
                setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
              }
              required
            />
          </div>
          <div>
            <label className="label">Nytt lösenord</label>
            <input
              type="password"
              className="input"
              value={passwordForm.newPassword}
              onChange={(e) =>
                setPasswordForm({ ...passwordForm, newPassword: e.target.value })
              }
              required
              minLength={6}
            />
          </div>
          <div>
            <label className="label">Bekräfta nytt lösenord</label>
            <input
              type="password"
              className="input"
              value={passwordForm.confirmPassword}
              onChange={(e) =>
                setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
              }
              required
            />
          </div>
          <button
            type="submit"
            disabled={changingPassword}
            className="btn-primary"
          >
            {changingPassword ? 'Sparar...' : 'Byt lösenord'}
          </button>
        </form>
      </div>

      {/* Notification preferences */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Notifikationer
        </h2>
        {loadingPrefs ? (
          <p className="text-gray-500">Laddar inställningar...</p>
        ) : (
          <div className="space-y-4">
            {/* Email enabled */}
            <label className="flex items-center justify-between">
              <div>
                <span className="font-medium text-gray-900">E-postnotifikationer</span>
                <p className="text-sm text-gray-500">Få notifikationer via e-post</p>
              </div>
              <input
                type="checkbox"
                checked={notificationPrefs?.emailEnabled ?? true}
                onChange={(e) => handlePrefChange('emailEnabled', e.target.checked)}
                className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
              />
            </label>

            <div className="border-t border-gray-200 pt-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Notifikationstyper</p>

              {/* Deadline reminders */}
              <label className="flex items-center justify-between py-2">
                <div>
                  <span className="text-gray-900">Påminnelser om slutdatum</span>
                  <p className="text-sm text-gray-500">Få påminnelse inför utbildningens slut</p>
                </div>
                <input
                  type="checkbox"
                  checked={notificationPrefs?.deadlineReminders ?? true}
                  onChange={(e) => handlePrefChange('deadlineReminders', e.target.checked)}
                  className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                />
              </label>

              {/* Unsigned assessments */}
              <label className="flex items-center justify-between py-2">
                <div>
                  <span className="text-gray-900">Osignerade bedömningar</span>
                  <p className="text-sm text-gray-500">Påminnelse om bedömningar som väntar på signatur</p>
                </div>
                <input
                  type="checkbox"
                  checked={notificationPrefs?.unsignedAssessments ?? true}
                  onChange={(e) => handlePrefChange('unsignedAssessments', e.target.checked)}
                  className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                />
              </label>

              {/* Supervision reminders */}
              <label className="flex items-center justify-between py-2">
                <div>
                  <span className="text-gray-900">Handledningspåminnelser</span>
                  <p className="text-sm text-gray-500">Påminnelse om att boka handledarsamtal</p>
                </div>
                <input
                  type="checkbox"
                  checked={notificationPrefs?.supervisionReminders ?? true}
                  onChange={(e) => handlePrefChange('supervisionReminders', e.target.checked)}
                  className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                />
              </label>

              {/* Subgoal signed */}
              <label className="flex items-center justify-between py-2">
                <div>
                  <span className="text-gray-900">Delmål signerade</span>
                  <p className="text-sm text-gray-500">Notifiering när delmål blir signerade</p>
                </div>
                <input
                  type="checkbox"
                  checked={notificationPrefs?.subGoalSigned ?? true}
                  onChange={(e) => handlePrefChange('subGoalSigned', e.target.checked)}
                  className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                />
              </label>

              {/* Assessment signed */}
              <label className="flex items-center justify-between py-2">
                <div>
                  <span className="text-gray-900">Bedömningar signerade</span>
                  <p className="text-sm text-gray-500">Notifiering när bedömningar blir signerade</p>
                </div>
                <input
                  type="checkbox"
                  checked={notificationPrefs?.assessmentSigned ?? true}
                  onChange={(e) => handlePrefChange('assessmentSigned', e.target.checked)}
                  className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                />
              </label>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <label className="block">
                <span className="font-medium text-gray-900">Dagar innan deadline för påminnelse</span>
                <p className="text-sm text-gray-500 mb-2">Hur många dagar innan slutdatum vill du bli påmind?</p>
                <select
                  value={notificationPrefs?.daysBeforeDeadline ?? 30}
                  onChange={(e) => handlePrefChange('daysBeforeDeadline', parseInt(e.target.value, 10))}
                  className="input w-32"
                >
                  <option value={7}>7 dagar</option>
                  <option value={14}>14 dagar</option>
                  <option value={30}>30 dagar</option>
                  <option value={60}>60 dagar</option>
                  <option value={90}>90 dagar</option>
                </select>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Security info */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Säkerhet
        </h2>
        <div className="text-sm text-gray-600 space-y-2">
          <p>• Dina data lagras krypterat på servern</p>
          <p>• Sessioner avslutas automatiskt efter 7 dagar</p>
          <p>• Lösenord hashas med argon2id</p>
          <p>• Alla ändringar loggas för spårbarhet</p>
        </div>
      </div>

      {/* About */}
      <div className="card p-6 bg-gray-50">
        <h2 className="font-semibold text-gray-900 mb-2">Om SAGA</h2>
        <p className="text-sm text-gray-600 mb-2">
          SAGA är ett planerings- och dokumentationssystem för ST- och BT-läkare.
        </p>
        <p className="text-xs text-gray-500">Version 1.0.0</p>
      </div>
    </div>
  );
}
