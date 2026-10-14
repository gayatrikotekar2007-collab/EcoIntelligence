import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EvidenceSection } from '../components/EvidenceSection';
import * as api from '../lib/api';

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    evidenceApi: {
      uploadEvidence: vi.fn().mockResolvedValue({ id: 101, file_name: 'field_sample.png' }),
      fetchEvidenceBlob: vi.fn().mockResolvedValue(new Blob(['blob-data'])),
      updateEvidence: vi.fn(),
      deleteEvidence: vi.fn(),
    },
  };
});

describe('EvidenceSection Workflows', () => {
  const onEvidenceChangedMock = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupModalWithFile = () => {
    const result = render(
      <EvidenceSection
        investigationId={1}
        evidence={[]}
        observations={[]}
        onEvidenceChanged={onEvidenceChangedMock}
        isAddModalOpen={true}
      />
    );

    expect(screen.getByText('Upload Investigation Evidence')).toBeInTheDocument();

    const file = new File(['fake-image-bytes'], 'field_sample.png', { type: 'image/png' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();
    fireEvent.change(fileInput, { target: { files: [file] } });

    const form = document.querySelector('form')!;
    expect(form).toBeTruthy();

    return { file, fileInput, form, ...result };
  };

  describe('Coordinate Validation', () => {
    it('rejects latitude when longitude is missing', async () => {
      const { form } = setupModalWithFile();

      const latInput = screen.getByPlaceholderText('e.g. 37.7749');
      fireEvent.change(latInput, { target: { value: '10.5' } });

      fireEvent.submit(form);

      expect(
        await screen.findByText(
          'Latitude and Longitude must both be provided together, or both omitted.'
        )
      ).toBeInTheDocument();
      expect(api.evidenceApi.uploadEvidence).not.toHaveBeenCalled();
    });

    it('rejects longitude when latitude is missing', async () => {
      const { form } = setupModalWithFile();

      const lngInput = screen.getByPlaceholderText('e.g. -122.4194');
      fireEvent.change(lngInput, { target: { value: '106.8' } });

      fireEvent.submit(form);

      expect(
        await screen.findByText(
          'Latitude and Longitude must both be provided together, or both omitted.'
        )
      ).toBeInTheDocument();
      expect(api.evidenceApi.uploadEvidence).not.toHaveBeenCalled();
    });

    it('rejects out-of-range latitude values beyond -90 to 90 degrees', async () => {
      const { form } = setupModalWithFile();

      const latInput = screen.getByPlaceholderText('e.g. 37.7749');
      const lngInput = screen.getByPlaceholderText('e.g. -122.4194');
      fireEvent.change(latInput, { target: { value: '95.5' } });
      fireEvent.change(lngInput, { target: { value: '45.0' } });

      fireEvent.submit(form);

      expect(
        await screen.findByText('Latitude must be a valid number between -90 and 90 degrees.')
      ).toBeInTheDocument();
      expect(api.evidenceApi.uploadEvidence).not.toHaveBeenCalled();
    });

    it('rejects out-of-range longitude values beyond -180 to 180 degrees', async () => {
      const { form } = setupModalWithFile();

      const latInput = screen.getByPlaceholderText('e.g. 37.7749');
      const lngInput = screen.getByPlaceholderText('e.g. -122.4194');
      fireEvent.change(latInput, { target: { value: '45.0' } });
      fireEvent.change(lngInput, { target: { value: '185.0' } });

      fireEvent.submit(form);

      expect(
        await screen.findByText('Longitude must be a valid number between -180 and 180 degrees.')
      ).toBeInTheDocument();
      expect(api.evidenceApi.uploadEvidence).not.toHaveBeenCalled();
    });

    it('rejects negative accuracy uncertainty values', async () => {
      const { form } = setupModalWithFile();

      const latInput = screen.getByPlaceholderText('e.g. 37.7749');
      const lngInput = screen.getByPlaceholderText('e.g. -122.4194');
      const accInput = screen.getByPlaceholderText('e.g. 5');
      fireEvent.change(latInput, { target: { value: '45.0' } });
      fireEvent.change(lngInput, { target: { value: '90.0' } });
      fireEvent.change(accInput, { target: { value: '-10' } });

      fireEvent.submit(form);

      expect(
        await screen.findByText(
          'Location accuracy uncertainty must be a non-negative number in meters.'
        )
      ).toBeInTheDocument();
      expect(api.evidenceApi.uploadEvidence).not.toHaveBeenCalled();
    });

    it('accepts valid coordinates and submits upload payload', async () => {
      const { form } = setupModalWithFile();

      const latInput = screen.getByPlaceholderText('e.g. 37.7749');
      const lngInput = screen.getByPlaceholderText('e.g. -122.4194');
      const accInput = screen.getByPlaceholderText('e.g. 5');
      fireEvent.change(latInput, { target: { value: '7.1234' } });
      fireEvent.change(lngInput, { target: { value: '98.5678' } });
      fireEvent.change(accInput, { target: { value: '15' } });

      fireEvent.submit(form);

      await waitFor(() => {
        expect(api.evidenceApi.uploadEvidence).toHaveBeenCalledTimes(1);
      });

      const [invId, formData] = vi.mocked(api.evidenceApi.uploadEvidence).mock.calls[0];
      expect(invId).toBe(1);
      expect(formData.get('location_latitude')).toBe('7.1234');
      expect(formData.get('location_longitude')).toBe('98.5678');
      expect(formData.get('location_accuracy_meters')).toBe('15');
    });
  });

  describe('Object URL Lifecycle & Cleanup', () => {
    it('creates and cleans up object URL when a preview file is replaced or cleared', async () => {
      const user = userEvent.setup();
      const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL');
      const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL');

      render(
        <EvidenceSection
          investigationId={1}
          evidence={[]}
          observations={[]}
          onEvidenceChanged={onEvidenceChangedMock}
          isAddModalOpen={true}
        />
      );

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      // 1. Upload first image
      const file1 = new File(['image-bytes-1'], 'photo1.png', { type: 'image/png' });
      fireEvent.change(fileInput, { target: { files: [file1] } });

      expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
      const firstUrl = createObjectURLSpy.mock.results[0].value;

      // Preview img rendered
      const previewImg = await screen.findByAltText('Selected evidence preview');
      expect(previewImg).toHaveAttribute('src', firstUrl);

      // 2. Upload replacement image
      const file2 = new File(['image-bytes-2'], 'photo2.png', { type: 'image/png' });
      fireEvent.change(fileInput, { target: { files: [file2] } });

      // Verify the previous URL was revoked
      expect(revokeObjectURLSpy).toHaveBeenCalledWith(firstUrl);
      expect(createObjectURLSpy).toHaveBeenCalledTimes(2);
      const secondUrl = createObjectURLSpy.mock.results[1].value;

      // Preview updated
      expect(screen.getByAltText('Selected evidence preview')).toHaveAttribute('src', secondUrl);

      // 3. Close modal and verify active preview URL is revoked
      const cancelBtn = screen.getByRole('button', { name: /^cancel$/i });
      await user.click(cancelBtn);

      expect(revokeObjectURLSpy).toHaveBeenCalledWith(secondUrl);
    });

    it('revokes all created object URLs when the component unmounts', async () => {
      const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL');
      const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL');

      const { unmount } = render(
        <EvidenceSection
          investigationId={1}
          evidence={[]}
          observations={[]}
          onEvidenceChanged={onEvidenceChangedMock}
          isAddModalOpen={true}
        />
      );

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['image-bytes-sample'], 'evidence.jpg', { type: 'image/jpeg' });
      fireEvent.change(fileInput, { target: { files: [file] } });

      expect(createObjectURLSpy).toHaveBeenCalled();
      const createdUrl = createObjectURLSpy.mock.results[0].value;

      // Unmount the component
      unmount();

      // Ensure object URL was revoked on unmount
      expect(revokeObjectURLSpy).toHaveBeenCalledWith(createdUrl);
    });
  });
});
