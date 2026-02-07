import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserRole } from '@saga/shared';
import { api } from '../lib/api';
import toast from 'react-hot-toast';

interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  clinicId?: string | null;
}

interface TraineeProfile {
  id: string;
  trackType: string;
  specialty?: string;
  clinicId: string;
  startDate: string;
  plannedEndDate: string;
  supervisor?: { id: string; name: string };
}

interface AuthContextType {
  user: User | null;
  traineeProfile: TraineeProfile | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [traineeProfile, setTraineeProfile] = useState<TraineeProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const fetchCurrentUser = async () => {
    try {
      const response = await api.get('/api/auth/me');
      setUser(response.user);
      setTraineeProfile(response.traineeProfile);
    } catch (error) {
      setUser(null);
      setTraineeProfile(null);
    }
  };

  useEffect(() => {
    fetchCurrentUser().finally(() => setIsLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await api.post('/api/auth/login', { email, password });
      setUser(response.user);
      await fetchCurrentUser(); // Get full profile
      toast.success(`Välkommen, ${response.user.name}!`);
      navigate('/');
    } catch (error: any) {
      toast.error(error.message || 'Inloggningen misslyckades');
      throw error;
    }
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (error) {
      // Ignore errors on logout
    }
    setUser(null);
    setTraineeProfile(null);
    navigate('/login');
    toast.success('Du har loggat ut');
  };

  const refreshUser = async () => {
    await fetchCurrentUser();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        traineeProfile,
        isLoading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
