import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock the auth context
const mockUser = {
  id: '1',
  email: 'test@saga.se',
  name: 'Test User',
  role: 'ST_BT' as const,
  clinicId: '1',
};

const mockTraineeProfile = {
  id: '1',
  trackType: 'ST',
  specialty: 'Allmänmedicin',
  clinicId: '1',
  startDate: '2023-01-01',
  plannedEndDate: '2028-01-01',
};

vi.mock('./contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    traineeProfile: mockTraineeProfile,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock API
vi.mock('./lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({
      dashboard: {
        profile: mockTraineeProfile,
        progress: {
          total: 30,
          completed: 5,
          inProgress: 10,
          notStarted: 15,
          percentage: 17,
        },
        warnings: [],
        recentAssessments: [],
        unsignedAssessments: 2,
      },
    }),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>
  );
}

describe('App smoke tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the dashboard for ST/BT users', async () => {
    // Import App dynamically to ensure mocks are set up
    const { default: App } = await import('./App');

    renderWithProviders(<App />);

    // Dashboard should show "Översikt" heading
    expect(await screen.findByText('Översikt')).toBeInTheDocument();
  });

  it('shows navigation menu items', async () => {
    const { default: App } = await import('./App');

    renderWithProviders(<App />);

    // Check for key navigation items
    expect(await screen.findByText('Delmål')).toBeInTheDocument();
    expect(await screen.findByText('Kalender')).toBeInTheDocument();
    expect(await screen.findByText('Intyg')).toBeInTheDocument();
    expect(await screen.findByText('Bedömningar')).toBeInTheDocument();
    expect(await screen.findByText('Export')).toBeInTheDocument();
  });

  it('shows user name in sidebar', async () => {
    const { default: App } = await import('./App');

    renderWithProviders(<App />);

    expect(await screen.findByText('Test User')).toBeInTheDocument();
  });

  it('shows SAGA branding', async () => {
    const { default: App } = await import('./App');

    renderWithProviders(<App />);

    expect(await screen.findByText('SAGA')).toBeInTheDocument();
  });
});

describe('Export button visibility', () => {
  it('export navigation item is visible for trainees', async () => {
    const { default: App } = await import('./App');

    renderWithProviders(<App />);

    const exportLink = await screen.findByText('Export');
    expect(exportLink).toBeInTheDocument();
    expect(exportLink.closest('a')).toHaveAttribute('href', '/export');
  });
});
