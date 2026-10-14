import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import DashboardPage from '../app/dashboard/page';
import * as api from '../lib/api';

// Mock Auth Context
const mockUser: api.User = {
  id: 42,
  email: 'investigator@ecointelligence.org',
  display_name: 'Dr. Jane Goodall',
  role: 'lead_investigator',
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

vi.mock('../lib/auth-context', () => ({
  useAuth: vi.fn(() => ({
    user: mockUser,
    token: 'jwt-auth-token-xyz',
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  })),
}));

// Mock API boundaries
vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    investigationsApi: {
      list: vi.fn(),
      create: vi.fn(),
      createObservation: vi.fn(),
    },
    dashboardApi: {
      getStats: vi.fn(),
    },
    evidenceApi: {
      uploadEvidence: vi.fn(),
    },
  };
});

const mockNonZeroStats: api.DashboardStats = {
  active_investigations_count: 3,
  total_investigations_count: 5,
  evidence_count: 14,
  observations_count: 27,
  pending_actions_count: 4,
};

const mockZeroStats: api.DashboardStats = {
  active_investigations_count: 0,
  total_investigations_count: 0,
  evidence_count: 0,
  observations_count: 0,
  pending_actions_count: 0,
};

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading indicators while dashboard statistics request is in-flight', async () => {
    // Keep promise pending during initial render check
    let resolveStats: (val: api.DashboardStats) => void;
    const statsPromise = new Promise<api.DashboardStats>((resolve) => {
      resolveStats = resolve;
    });

    vi.mocked(api.dashboardApi.getStats).mockReturnValue(statsPromise);
    vi.mocked(api.investigationsApi.list).mockResolvedValue([]);

    render(<DashboardPage />);

    // Renders user greeting in heading
    expect(
      screen.getByRole('heading', { level: 2, name: /Dr\. Jane Goodall/ })
    ).toBeInTheDocument();

    // Verify loading placeholders and loading descriptions for metrics
    expect(screen.getByText('Loading active investigations...')).toBeInTheDocument();
    expect(screen.getByText('Loading evidence artifacts...')).toBeInTheDocument();
    expect(screen.getByText('Loading recorded observations...')).toBeInTheDocument();
    expect(screen.getByText('Loading action plans...')).toBeInTheDocument();

    // Resolve promise to allow component cleanup
    resolveStats!(mockNonZeroStats);
    await waitFor(() => {
      expect(screen.queryByText('Loading active investigations...')).not.toBeInTheDocument();
    });
  });

  it('renders real dashboard statistics accurately when API succeeds', async () => {
    vi.mocked(api.dashboardApi.getStats).mockResolvedValue(mockNonZeroStats);
    vi.mocked(api.investigationsApi.list).mockResolvedValue([]);

    render(<DashboardPage />);

    // Active investigations
    expect(await screen.findByText('3')).toBeInTheDocument();
    expect(screen.getByText('active cases')).toBeInTheDocument();

    // Evidence artifacts
    expect(screen.getByText('14')).toBeInTheDocument();
    expect(screen.getByText('artifacts')).toBeInTheDocument();

    // Recorded observations
    expect(screen.getByText('27')).toBeInTheDocument();
    expect(screen.getByText('records')).toBeInTheDocument();

    // Pending remediation actions
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('pending actions')).toBeInTheDocument();

    // Descriptions for non-zero populated data
    expect(screen.getByText('Field photos, logs & verification files.')).toBeInTheDocument();
    expect(screen.getByText('Field observations & anchored notes.')).toBeInTheDocument();
    expect(screen.getByText('Awaiting execution or verification.')).toBeInTheDocument();
  });

  it('renders genuine zero values distinctly from loading or errors', async () => {
    vi.mocked(api.dashboardApi.getStats).mockResolvedValue(mockZeroStats);
    vi.mocked(api.investigationsApi.list).mockResolvedValue([]);

    render(<DashboardPage />);

    // Verify genuine zero counts are displayed
    await waitFor(() => {
      expect(screen.queryByText('Loading active investigations...')).not.toBeInTheDocument();
    });

    // Zero-specific descriptive state strings
    expect(screen.getByText('Zero active cases recorded.')).toBeInTheDocument();
    expect(screen.getByText('Zero evidence artifacts collected.')).toBeInTheDocument();
    expect(screen.getByText('Zero field observations recorded.')).toBeInTheDocument();
    expect(screen.getByText('Zero pending remediation actions.')).toBeInTheDocument();

    // Empty state heading in recent investigations section
    expect(screen.getByText('Your investigation workspace is empty.')).toBeInTheDocument();
  });

  it('renders error state when dashboard statistics fail to load', async () => {
    vi.mocked(api.dashboardApi.getStats).mockRejectedValue(
      new Error('Database connectivity interrupted')
    );
    vi.mocked(api.investigationsApi.list).mockRejectedValue(
      new Error('Database connectivity interrupted')
    );

    render(<DashboardPage />);

    // Error indicators on stat cards
    await waitFor(() => {
      const errorElements = screen.getAllByText('Error');
      expect(errorElements.length).toBeGreaterThanOrEqual(1);
    });

    expect(screen.getByText('Failed to load evidence count.')).toBeInTheDocument();
    expect(screen.getByText('Failed to load observations count.')).toBeInTheDocument();
    expect(screen.getByText('Failed to load pending actions.')).toBeInTheDocument();
  });

  it('avoids treating failed requests as genuine zero counts', async () => {
    vi.mocked(api.dashboardApi.getStats).mockRejectedValue(
      new Error('API Gateway timeout')
    );
    vi.mocked(api.investigationsApi.list).mockResolvedValue([]);

    render(<DashboardPage />);

    // Wait for the error state to settle
    await waitFor(() => {
      expect(screen.getByText('Failed to load evidence count.')).toBeInTheDocument();
    });

    // CRITICAL: Ensure genuine zero messages are NEVER shown when requests fail
    expect(screen.queryByText('Zero evidence artifacts collected.')).not.toBeInTheDocument();
    expect(screen.queryByText('Zero field observations recorded.')).not.toBeInTheDocument();
    expect(screen.queryByText('Zero pending remediation actions.')).not.toBeInTheDocument();
  });
});
