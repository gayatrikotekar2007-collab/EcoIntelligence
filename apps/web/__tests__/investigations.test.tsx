import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InvestigationsPage from '../app/investigations/page';
import InvestigationDetailPage from '../app/investigations/[id]/page';
import * as api from '../lib/api';

const mockUser: api.User = {
  id: 1,
  email: 'investigator@ecointelligence.org',
  display_name: 'Lead Investigator',
  role: 'admin',
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

vi.mock('../lib/auth-context', () => ({
  useAuth: vi.fn(() => ({
    user: mockUser,
    token: 'test-token',
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  })),
}));

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    investigationsApi: {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      patch: vi.fn(),
      createObservation: vi.fn(),
      deleteObservation: vi.fn(),
    },
    evidenceApi: {
      listByInvestigation: vi.fn(),
      uploadEvidence: vi.fn(),
      fetchEvidenceBlob: vi.fn(),
    },
    hypothesisApi: {
      listByInvestigation: vi.fn().mockResolvedValue([]),
    },
    actionApi: {
      listActions: vi.fn().mockResolvedValue([]),
      listVerifications: vi.fn().mockResolvedValue([]),
    },
  };
});

const mockInvestigationDetail: api.InvestigationDetail = {
  id: 1,
  owner_id: 1,
  title: 'Citarum River Heavy Metal Runoff',
  description: 'Initial chemical testing indicates elevated lead and mercury downstream.',
  category: 'water_pollution',
  status: 'active',
  location_id: null,
  location: null,
  investigation_date: '2026-02-01',
  created_at: '2026-02-01T10:00:00Z',
  updated_at: '2026-02-01T10:00:00Z',
  observations: [],
  timeline_entries: [],
  evidence: [],
};

describe('Investigations Workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('InvestigationsPage - Filter workflows', () => {
    it('requests archived investigations when archived filter is selected', async () => {
      const user = userEvent.setup();
      // Initial list request returns an active investigation
      vi.mocked(api.investigationsApi.list).mockResolvedValueOnce([
        {
          id: 1,
          owner_id: 1,
          title: 'Active Case 1',
          description: null,
          category: 'water_pollution',
          status: 'active',
          location_id: null,
          investigation_date: '2026-02-01',
          created_at: '2026-02-01T10:00:00Z',
          updated_at: '2026-02-01T10:00:00Z',
          observations_count: 2,
        },
      ]);

      render(<InvestigationsPage />);

      // Verify initial list request
      await waitFor(() => {
        expect(api.investigationsApi.list).toHaveBeenCalledWith(undefined);
      });
      expect(screen.getByText('Active Case 1')).toBeInTheDocument();

      // Configure mock for the archived filter request returning an archived case
      vi.mocked(api.investigationsApi.list).mockResolvedValueOnce([
        {
          id: 99,
          owner_id: 1,
          title: 'Historical Mining Incident 2024',
          description: null,
          category: 'soil_contamination',
          status: 'archived',
          location_id: null,
          investigation_date: '2024-01-01',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-06-01T00:00:00Z',
          observations_count: 5,
        },
      ]);

      // Select 'archived' filter
      const statusSelect = screen.getByDisplayValue('All Statuses');
      await user.selectOptions(statusSelect, 'archived');

      // Verify API was called with 'archived' parameter
      await waitFor(() => {
        expect(api.investigationsApi.list).toHaveBeenCalledWith('archived');
      });

      // Verify archived investigation is displayed
      expect(await screen.findByText('Historical Mining Incident 2024')).toBeInTheDocument();
    });
  });

  describe('InvestigationDetailPage - Edit workflow', () => {
    it('opens metadata edit modal prefilled with current investigation details', async () => {
      const user = userEvent.setup();
      vi.mocked(api.investigationsApi.get).mockResolvedValue(mockInvestigationDetail);

      render(<InvestigationDetailPage params={{ id: '1' }} />);

      // Wait for page to load
      expect(await screen.findByText('Citarum River Heavy Metal Runoff')).toBeInTheDocument();

      // Click Edit Details button
      const editButton = screen.getByRole('button', { name: /edit details/i });
      await user.click(editButton);

      // Verify modal is displayed with title and description prefilled
      expect(screen.getByText('Edit Investigation Details')).toBeInTheDocument();
      const titleInput = screen.getByDisplayValue('Citarum River Heavy Metal Runoff');
      expect(titleInput).toBeInTheDocument();
      expect(
        screen.getByDisplayValue(
          'Initial chemical testing indicates elevated lead and mercury downstream.'
        )
      ).toBeInTheDocument();
    });

    it('enforces required title validation and prevents submission with empty title', async () => {
      const user = userEvent.setup();
      vi.mocked(api.investigationsApi.get).mockResolvedValue(mockInvestigationDetail);

      render(<InvestigationDetailPage params={{ id: '1' }} />);

      await screen.findByText('Citarum River Heavy Metal Runoff');

      // Open modal
      await user.click(screen.getByRole('button', { name: /edit details/i }));

      // Find prefilled title input and clear it
      const titleInput = screen.getByDisplayValue('Citarum River Heavy Metal Runoff');
      await user.clear(titleInput);

      // Submit form with empty title
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      const form = saveButton.closest('form')!;
      fireEvent.submit(form);

      // Validation feedback shown
      expect(await screen.findByText('Investigation title is required.')).toBeInTheDocument();

      // Ensure API patch was NOT called
      expect(api.investigationsApi.patch).not.toHaveBeenCalled();
    });

    it('cancels metadata editing without making API calls and dismisses the modal', async () => {
      const user = userEvent.setup();
      vi.mocked(api.investigationsApi.get).mockResolvedValue(mockInvestigationDetail);

      render(<InvestigationDetailPage params={{ id: '1' }} />);

      await screen.findByText('Citarum River Heavy Metal Runoff');

      // Open modal
      await user.click(screen.getByRole('button', { name: /edit details/i }));
      expect(screen.getByText('Edit Investigation Details')).toBeInTheDocument();

      // Modify title but click Cancel
      const titleInput = screen.getByDisplayValue('Citarum River Heavy Metal Runoff');
      await user.type(titleInput, ' - Unsaved Modification');

      const cancelButton = screen.getByRole('button', { name: /^cancel$/i });
      await user.click(cancelButton);

      // Modal is closed
      await waitFor(() => {
        expect(screen.queryByText('Edit Investigation Details')).not.toBeInTheDocument();
      });

      // API patch was NOT called
      expect(api.investigationsApi.patch).not.toHaveBeenCalled();
    });

    it('submits updated metadata and reloads investigation details', async () => {
      const user = userEvent.setup();
      vi.mocked(api.investigationsApi.get).mockResolvedValue(mockInvestigationDetail);
      vi.mocked(api.investigationsApi.patch).mockResolvedValue({
        ...mockInvestigationDetail,
        title: 'Citarum River Heavy Metal Runoff - Verified Phase',
      });

      render(<InvestigationDetailPage params={{ id: '1' }} />);

      await screen.findByText('Citarum River Heavy Metal Runoff');

      // Open edit modal
      await user.click(screen.getByRole('button', { name: /edit details/i }));

      // Update title
      const titleInput = screen.getByDisplayValue('Citarum River Heavy Metal Runoff');
      await user.clear(titleInput);
      await user.type(titleInput, 'Citarum River Heavy Metal Runoff - Verified Phase');

      // Submit form
      await user.click(screen.getByRole('button', { name: /save changes/i }));

      // API patch was called with sanitized payload
      await waitFor(() => {
        expect(api.investigationsApi.patch).toHaveBeenCalledWith(1, {
          title: 'Citarum River Heavy Metal Runoff - Verified Phase',
          category: 'water_pollution',
          description: 'Initial chemical testing indicates elevated lead and mercury downstream.',
        });
      });

      // Modal closed
      expect(screen.queryByText('Edit Investigation Details')).not.toBeInTheDocument();
    });
  });
});
