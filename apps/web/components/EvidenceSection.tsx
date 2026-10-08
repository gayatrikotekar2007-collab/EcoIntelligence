'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Evidence,
  Observation,
  EvidenceSourceType,
  VerificationStateType,
  evidenceApi,
  UpdateEvidencePayload,
  Location,
  ImageAnalysisResult,
} from '../lib/api';
import {
  FileTextIcon,
  PlusIcon,
  AlertCircleIcon,
  CloseIcon,
  EyeIcon,
  ShieldCheckIcon,
  GridIcon,
  ListIcon,
  CompareIcon,
  MapPinIcon,
  ClockIcon,
} from './Icons';
import { BeforeAfterComparisonModal } from './BeforeAfterComparisonModal';
import { TemporalEvidenceSequence } from './TemporalEvidenceSequence';

interface EvidenceSectionProps {
  investigationId: number;
  evidence: Evidence[];
  observations: Observation[];
  investigationLocation?: Location | null;
  onEvidenceChanged: () => Promise<void>;
  onOpenGaps?: () => void;
}

export function EvidenceSection({
  investigationId,
  evidence = [],
  observations = [],
  investigationLocation,
  onEvidenceChanged,
}: EvidenceSectionProps) {
  // View mode: grid vs table
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Filter state
  const [filterType, setFilterType] = useState<'all' | 'image' | 'document'>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedEvidenceForDetail, setSelectedEvidenceForDetail] = useState<Evidence | null>(null);
  const [editingEvidence, setEditingEvidence] = useState<Evidence | null>(null);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [isTemporalModalOpen, setIsTemporalModalOpen] = useState(false);

  // Before / After Comparison state
  const [beforeEvidenceId, setBeforeEvidenceId] = useState<number | null>(null);
  const [afterEvidenceId, setAfterEvidenceId] = useState<number | null>(null);

  // Image Difference Analysis state (Eco-Eye)
  const [analysisResult, setAnalysisResult] = useState<ImageAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const handleOpenPairComparison = (
    beforeId: number,
    afterId: number,
    mode: 'split' | 'heatmap' | 'region'
  ) => {
    setBeforeEvidenceId(beforeId);
    setAfterEvidenceId(afterId);
    setIsTemporalModalOpen(false);
    setIsCompareModalOpen(true);
  };

  // Add Form state
  const [file, setFile] = useState<File | null>(null);
  const [sourceType, setSourceType] = useState<EvidenceSourceType>('observed');
  const [verificationState, setVerificationState] = useState<VerificationStateType>('needs_verification');
  const [description, setDescription] = useState('');
  const [selectedObsId, setSelectedObsId] = useState<string>('');
  const [capturedAt, setCapturedAt] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit Form state
  const [editDescription, setEditDescription] = useState('');
  const [editSourceType, setEditSourceType] = useState<EvidenceSourceType>('observed');
  const [editVerificationState, setEditVerificationState] = useState<VerificationStateType>('needs_verification');
  const [editObsId, setEditObsId] = useState<string>('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Action states
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  // Thumbnail blob cache for authenticated image previews
  const [imageUrls, setImageUrls] = useState<Record<number, string>>({});

  // Fetch thumbnails securely using JWT
  useEffect(() => {
    let isCancelled = false;
    const loadThumbnails = async () => {
      for (const item of evidence) {
        if (item.evidence_type === 'image' && !imageUrls[item.id]) {
          try {
            const blob = await evidenceApi.fetchEvidenceBlob(item.id);
            if (!isCancelled) {
              const url = URL.createObjectURL(blob);
              setImageUrls((prev) => ({ ...prev, [item.id]: url }));
            }
          } catch {
            // thumbnail load failed or unauthorized
          }
        }
      }
    };
    loadThumbnails();

    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evidence]);

  // Sync selected evidence for detail if evidence list updates
  useEffect(() => {
    if (selectedEvidenceForDetail) {
      const updated = evidence.find((e) => e.id === selectedEvidenceForDetail.id);
      if (updated) {
        setSelectedEvidenceForDetail(updated);
      }
    }
  }, [evidence, selectedEvidenceForDetail]);

  // Image items for comparison
  const imageEvidenceItems = useMemo(
    () => evidence.filter((e) => e.evidence_type === 'image'),
    [evidence]
  );

  // Auto-initialize comparison selection
  useEffect(() => {
    if (imageEvidenceItems.length >= 2) {
      if (!beforeEvidenceId || !imageEvidenceItems.some((e) => e.id === beforeEvidenceId)) {
        setBeforeEvidenceId(imageEvidenceItems[imageEvidenceItems.length - 1].id);
      }
      if (!afterEvidenceId || !imageEvidenceItems.some((e) => e.id === afterEvidenceId)) {
        setAfterEvidenceId(imageEvidenceItems[0].id);
      }
    }
  }, [imageEvidenceItems, beforeEvidenceId, afterEvidenceId]);

  // Stats calculation
  const totalCount = evidence.length;
  const imageCount = evidence.filter((e) => e.evidence_type === 'image').length;
  const docCount = evidence.filter((e) => e.evidence_type === 'document').length;
  const linkedCount = evidence.filter((e) => !!e.observation_id).length;

  // Filtered evidence
  const filteredEvidence = useMemo(() => {
    return evidence.filter((item) => {
      if (filterType === 'image' && item.evidence_type !== 'image') return false;
      if (filterType === 'document' && item.evidence_type !== 'document') return false;
      if (sourceFilter !== 'all' && item.source_type !== sourceFilter) return false;
      return true;
    });
  }, [evidence, filterType, sourceFilter]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (selected.size > 10 * 1024 * 1024) {
        setUploadError('File size exceeds the 10MB maximum limit.');
        setFile(null);
        return;
      }
      setUploadError(null);
      setFile(selected);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setUploadError('Please select a file to upload.');
      return;
    }

    try {
      setUploading(true);
      setUploadError(null);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('source_type', sourceType);
      formData.append('verification_state', verificationState);
      if (description.trim()) {
        formData.append('description', description.trim());
      }
      if (selectedObsId) {
        formData.append('observation_id', selectedObsId);
      }
      if (capturedAt) {
        formData.append('captured_at', new Date(capturedAt).toISOString());
      }

      await evidenceApi.uploadEvidence(investigationId, formData);

      // Reset and close
      setIsAddModalOpen(false);
      setFile(null);
      setDescription('');
      setSelectedObsId('');
      setCapturedAt('');
      setSourceType('observed');
      setVerificationState('needs_verification');
      if (fileInputRef.current) fileInputRef.current.value = '';

      await onEvidenceChanged();
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload evidence file.');
    } finally {
      setUploading(false);
    }
  };

  const openEditModal = (item: Evidence) => {
    setEditingEvidence(item);
    setEditDescription(item.description || '');
    setEditSourceType(item.source_type);
    setEditVerificationState(item.verification_state || 'needs_verification');
    setEditObsId(item.observation_id ? item.observation_id.toString() : '');
    setEditError(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvidence) return;

    try {
      setEditSaving(true);
      setEditError(null);

      const payload: UpdateEvidencePayload = {
        description: editDescription.trim(),
        source_type: editSourceType,
        verification_state: editVerificationState,
        observation_id: editObsId ? parseInt(editObsId, 10) : null,
      };

      await evidenceApi.updateEvidence(editingEvidence.id, payload);
      setEditingEvidence(null);
      await onEvidenceChanged();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update evidence metadata.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (evidenceId: number, filename: string) => {
    if (
      !confirm(
        `Are you sure you want to delete evidence file "${filename}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      setDeletingId(evidenceId);
      await evidenceApi.deleteEvidence(evidenceId);
      if (selectedEvidenceForDetail?.id === evidenceId) {
        setSelectedEvidenceForDetail(null);
      }
      await onEvidenceChanged();
    } catch (err: any) {
      alert(err.message || 'Failed to delete evidence.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = async (evidenceId: number, originalFilename: string) => {
    try {
      setDownloadingId(evidenceId);
      await evidenceApi.downloadEvidence(evidenceId, originalFilename);
    } catch (err: any) {
      alert(err.message || 'Failed to download evidence file.');
    } finally {
      setDownloadingId(null);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  // Explicit Provenance & Source helper (No invented sources)
  const getProvenanceBadge = (source: EvidenceSourceType) => {
    switch (source) {
      case 'observed':
        return {
          code: 'OBSERVED',
          label: 'Observed Field Evidence',
          origin: 'Direct primary capture by investigator on-site',
          cls: 'bg-emerald-50 text-emerald-800 border-emerald-300',
        };
      case 'user_reported':
        return {
          code: 'USER_REPORTED',
          label: 'User Reported',
          origin: 'Eyewitness account submitted by community observer',
          cls: 'bg-blue-50 text-blue-800 border-blue-300',
        };
      case 'external_source':
        return {
          code: 'EXTERNAL_SOURCE',
          label: 'External Source',
          origin: 'Laboratory test, official public dataset, or agency record',
          cls: 'bg-indigo-50 text-indigo-800 border-indigo-300',
        };
      case 'inferred':
        return {
          code: 'INFERRED',
          label: 'Inferred / Modelled',
          origin: 'Algorithmic or spatial derivation (requires ground-truth validation)',
          cls: 'bg-purple-50 text-purple-800 border-purple-300',
        };
      case 'estimated':
        return {
          code: 'ESTIMATED',
          label: 'Estimated',
          origin: 'Empirical approximation (subject to measurement error margin)',
          cls: 'bg-amber-50 text-amber-800 border-amber-300',
        };
      default:
        return {
          code: 'USER_UPLOADED',
          label: 'User Uploaded',
          origin: 'Uploaded evidence artifact pending source categorization',
          cls: 'bg-slate-100 text-slate-700 border-slate-300',
        };
    }
  };

  const getVerificationBadge = (vstate: VerificationStateType) => {
    switch (vstate) {
      case 'verified':
        return {
          label: 'Verified',
          cls: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        };
      case 'disputed':
        return {
          label: 'Disputed',
          cls: 'bg-red-100 text-red-800 border-red-300',
        };
      case 'needs_verification':
      default:
        return {
          label: 'Needs Verification',
          cls: 'bg-amber-100 text-amber-800 border-amber-300',
        };
    }
  };

  // 4 Transparent Evidence Quality Dimensions (No arbitrary overall score)
  const getQualityDimensions = (item: Evidence) => {
    // 1. Source Reliability
    let reliability = { level: 'Medium', label: 'Reported', cls: 'text-blue-700 bg-blue-50 border-blue-200' };
    if (item.source_type === 'observed' || item.source_type === 'external_source') {
      reliability = { level: 'High', label: 'Primary Field / Lab', cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
    } else if (item.source_type === 'inferred' || item.source_type === 'estimated') {
      reliability = { level: 'Provisional', label: 'Modelled / Inferred', cls: 'text-purple-700 bg-purple-50 border-purple-200' };
    }

    // 2. Completeness
    const hasDesc = !!item.description && item.description.trim().length > 0;
    const hasTime = !!item.captured_at;
    const hasObs = !!item.observation_id;
    const completeScore = (hasDesc ? 1 : 0) + (hasTime ? 1 : 0) + (hasObs ? 1 : 0);
    let completeness = { level: 'Complete', desc: 'Metadata, timestamp & observation linked', cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
    if (completeScore === 1 || completeScore === 2) {
      completeness = { level: 'Partial', desc: 'Missing notes, capture time, or observation link', cls: 'text-amber-700 bg-amber-50 border-amber-200' };
    } else if (completeScore === 0) {
      completeness = { level: 'Minimal', desc: 'Raw file upload without context', cls: 'text-slate-700 bg-slate-100 border-slate-200' };
    }

    // 3. Recency
    const dateObj = new Date(item.captured_at || item.uploaded_at);
    const diffDays = Math.max(0, Math.floor((Date.now() - dateObj.getTime()) / (1000 * 60 * 60 * 24)));
    let recency = { level: 'Fresh', label: `<7d (${diffDays}d ago)`, cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
    if (diffDays > 30) {
      recency = { level: 'Historical', label: `>30d (${diffDays}d ago)`, cls: 'text-slate-600 bg-slate-100 border-slate-200' };
    } else if (diffDays > 7) {
      recency = { level: 'Recent', label: `<30d (${diffDays}d ago)`, cls: 'text-blue-700 bg-blue-50 border-blue-200' };
    }

    // 4. Geographic Precision
    const matchingObs = observations.find((o) => o.id === item.observation_id);
    const loc = matchingObs?.location || investigationLocation;
    let precision = { level: 'Unanchored', label: 'No GPS Coordinates', cls: 'text-slate-500 bg-slate-100 border-slate-200' };
    if (loc && loc.latitude !== null && loc.longitude !== null) {
      if (loc.accuracy_meters !== null && loc.accuracy_meters <= 50) {
        precision = { level: 'Precise GPS', label: `±${loc.accuracy_meters}m Radius`, cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
      } else {
        precision = { level: 'Approximate', label: 'Anchored Location', cls: 'text-amber-700 bg-amber-50 border-amber-200' };
      }
    }

    return { reliability, completeness, recency, precision };
  };

  // Before / After Evidence Objects
  const beforeEvidence = imageEvidenceItems.find((e) => e.id === beforeEvidenceId);
  const afterEvidence = imageEvidenceItems.find((e) => e.id === afterEvidenceId);

  // Sync / initialize analysis result from metadata if already computed
  useEffect(() => {
    if (afterEvidence?.metadata?.visual_comparison && beforeEvidenceId) {
      const vc = afterEvidence.metadata.visual_comparison;
      if (vc.compared_to_evidence_id === beforeEvidenceId) {
        setAnalysisResult({
          status: 'ANALYZED',
          investigation_id: investigationId,
          before_evidence_id: beforeEvidenceId,
          after_evidence_id: afterEvidence.id,
          similarity: vc.similarity,
          changed_pixel_percentage: vc.changed_pixel_percentage,
          alignment_status: vc.alignment_status,
          before_dimensions: { width: 0, height: 0 },
          after_dimensions: { width: 0, height: 0 },
          difference_region: vc.difference_region || null,
          analyzed_at: vc.analyzed_at,
          warnings: vc.warnings || [],
          limitations: vc.limitations || [
            'Visual pixel differences do not establish environmental improvement or degradation.',
            'Lighting, shadow variations, and seasonal changes may account for detected visual differences.',
            'Ground-truth field verification is required to interpret physical environmental causes.',
          ],
        });
        setAnalysisError(null);
        return;
      }
    }
    setAnalysisResult(null);
    setAnalysisError(null);
  }, [beforeEvidenceId, afterEvidenceId, afterEvidence, investigationId]);

  const handleRunAnalysis = async () => {
    if (!beforeEvidenceId || !afterEvidenceId) {
      setAnalysisError('Please select both a Before and an After evidence image.');
      return;
    }
    if (beforeEvidenceId === afterEvidenceId) {
      setAnalysisError('Cannot compare an image with itself. Please select two distinct images.');
      return;
    }

    try {
      setIsAnalyzing(true);
      setAnalysisError(null);
      const res = await evidenceApi.compareEvidence(investigationId, {
        before_evidence_id: beforeEvidenceId,
        after_evidence_id: afterEvidenceId,
      });
      setAnalysisResult(res);
      await onEvidenceChanged();
    } catch (err: any) {
      setAnalysisError(err.message || 'Failed to execute image analysis.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
      {/* 1. Header & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 mb-4 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheckIcon className="h-5 w-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900">
              Evidence Intelligence ({totalCount})
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Traceable, timestamped physical artifacts supporting this investigation. Evidence supports observations — not autonomous inferences.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Before / After Comparison Button */}
          {imageCount >= 2 && (
            <button
              onClick={() => setIsCompareModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition shadow-2xs"
              title="Compare two image evidence items side-by-side"
            >
              <CompareIcon className="h-3.5 w-3.5" />
              Before / After Comparison
            </button>
          )}

          {/* Multi-Temporal Sequence Button (Phase 7A) */}
          {imageCount >= 3 && (
            <button
              type="button"
              onClick={() => setIsTemporalModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 transition shadow-2xs"
              title="Analyze chronological sequence across 3+ captures"
            >
              <ClockIcon className="h-3.5 w-3.5" />
              Temporal Sequence ({imageCount})
            </button>
          )}

          {/* View Mode Toggle */}
          <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold text-slate-600">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 transition ${
                viewMode === 'grid' ? 'bg-white text-slate-900 shadow-2xs' : 'hover:text-slate-900'
              }`}
              title="Grid View"
            >
              <GridIcon className="h-3.5 w-3.5" />
              Grid
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 transition ${
                viewMode === 'table' ? 'bg-white text-slate-900 shadow-2xs' : 'hover:text-slate-900'
              }`}
              title="Table View"
            >
              <ListIcon className="h-3.5 w-3.5" />
              Table
            </button>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition"
          >
            <PlusIcon className="h-4 w-4" />
            Add Evidence
          </button>
        </div>
      </div>

      {/* 2. Statistical Breakdown & Filters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Artifacts</span>
          <div className="text-xl font-bold text-slate-900 mt-0.5">{totalCount}</div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Photographic Evidence</span>
          <div className="text-xl font-bold text-emerald-700 mt-0.5">{imageCount}</div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Reports & Documents</span>
          <div className="text-xl font-bold text-blue-700 mt-0.5">{docCount}</div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Linked to Observations</span>
          <div className="text-xl font-bold text-purple-700 mt-0.5">{linkedCount}</div>
        </div>
      </div>

      {/* Filter Tabs & Source Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 pt-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Filter Type:</span>
          <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium text-slate-600">
            <button
              onClick={() => setFilterType('all')}
              className={`rounded-md px-2.5 py-1 transition ${
                filterType === 'all' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'hover:text-slate-900'
              }`}
            >
              All ({totalCount})
            </button>
            <button
              onClick={() => setFilterType('image')}
              className={`rounded-md px-2.5 py-1 transition ${
                filterType === 'image' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'hover:text-slate-900'
              }`}
            >
              Images ({imageCount})
            </button>
            <button
              onClick={() => setFilterType('document')}
              className={`rounded-md px-2.5 py-1 transition ${
                filterType === 'document' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'hover:text-slate-900'
              }`}
            >
              Docs ({docCount})
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 font-semibold">Provenance:</span>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 focus:border-emerald-500 focus:outline-none"
          >
            <option value="all">All Provenance Types</option>
            <option value="observed">Observed (Field Capture)</option>
            <option value="user_reported">User Reported</option>
            <option value="external_source">External Source (Lab / Public)</option>
            <option value="inferred">Inferred / Modelled</option>
            <option value="estimated">Estimated</option>
          </select>
        </div>
      </div>

      {/* 3. Empty State */}
      {filteredEvidence.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
            <ShieldCheckIcon className="h-6 w-6" />
          </div>
          <h4 className="text-xs font-bold text-slate-800">
            {totalCount === 0
              ? 'No evidence artifacts attached yet.'
              : `No evidence items match your filter criteria.`}
          </h4>
          <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
            Attach primary source materials such as site photographs, satellite imagery captures, lab analysis PDFs, or sensor outputs to substantiate observations.
          </p>
          {totalCount === 0 && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-emerald-700 shadow-xs hover:bg-slate-50 transition"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              Add First Evidence Item
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* 4. Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredEvidence.map((item) => {
            const prov = getProvenanceBadge(item.source_type);
            const vState = getVerificationBadge(item.verification_state);
            const isImage = item.evidence_type === 'image';
            const imgUrl = imageUrls[item.id];
            const matchingObs = observations.find((o) => o.id === item.observation_id);
            const dims =
              item.metadata?.width && item.metadata?.height
                ? `${item.metadata.width} × ${item.metadata.height} px`
                : null;
            const quality = getQualityDimensions(item);

            return (
              <div
                key={item.id}
                className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-slate-300 hover:shadow-xs transition"
              >
                <div>
                  {/* Image Preview or Document Card */}
                  {isImage ? (
                    <div
                      onClick={() => setSelectedEvidenceForDetail(item)}
                      className="relative mb-3 flex h-44 w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-slate-900/5 hover:opacity-95 transition"
                    >
                      {imgUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={imgUrl}
                          alt={item.original_filename}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-slate-400">
                          <EyeIcon className="h-6 w-6 animate-pulse" />
                          <span className="text-[11px]">Loading preview...</span>
                        </div>
                      )}
                      <div className="absolute bottom-2 right-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-xs">
                        Inspect Detail
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => setSelectedEvidenceForDetail(item)}
                      className="mb-3 flex cursor-pointer items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/70 p-3 hover:bg-slate-100/60 transition"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                        <FileTextIcon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-bold text-slate-800">
                          {item.original_filename}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          PDF Document • {formatBytes(item.file_size_bytes)}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Badges: Provenance & Verification */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    <span
                      title={prov.origin}
                      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${prov.cls}`}
                    >
                      {prov.code}
                    </span>

                    <span
                      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${vState.cls}`}
                    >
                      {vState.label}
                    </span>

                    {dims && (
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                        {dims}
                      </span>
                    )}

                    <span className="text-[10px] font-medium text-slate-400">
                      {formatBytes(item.file_size_bytes)}
                    </span>

                    {item.latitude != null && item.longitude != null ? (
                      <span
                        title={`Location: ${item.latitude.toFixed(5)}°, ${item.longitude.toFixed(5)}° (${item.location_source || 'GPS'}${item.location_accuracy != null ? ` ±${item.location_accuracy}m` : ''})`}
                        className="inline-flex items-center gap-1 rounded-md bg-sky-50 border border-sky-200 px-1.5 py-0.5 text-[10px] font-medium text-sky-700"
                      >
                        📍 {item.latitude.toFixed(3)}°, {item.longitude.toFixed(3)}°
                      </span>
                    ) : (
                      <span
                        title="Geographic coordinates unrecorded"
                        className="inline-flex items-center rounded-md bg-slate-50 border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-400"
                      >
                        📍 No GPS
                      </span>
                    )}
                  </div>

                  {/* Title / Original Filename */}
                  <h3
                    onClick={() => setSelectedEvidenceForDetail(item)}
                    className="text-xs font-bold text-slate-900 break-all cursor-pointer hover:text-emerald-700 transition"
                  >
                    {item.original_filename}
                  </h3>

                  {/* Description */}
                  {item.description ? (
                    <p className="mt-1 text-xs text-slate-600 line-clamp-2 leading-relaxed font-normal">
                      {item.description}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-slate-400 italic">No notes provided.</p>
                  )}

                  {/* Evidence Supports Observation Linking */}
                  <div className="mt-2.5 pt-2 border-t border-slate-100">
                    {matchingObs ? (
                      <div className="flex items-center gap-1 text-[11px] text-emerald-800 bg-emerald-50/80 rounded-md px-2 py-1 border border-emerald-100">
                        <span className="font-semibold shrink-0">Supports Observation #{matchingObs.id}:</span>
                        <span className="truncate text-emerald-700 capitalize">
                          {matchingObs.category.replace('_', ' ')}
                        </span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 italic">
                        General investigation evidence (not linked to an observation)
                      </div>
                    )}
                  </div>

                  {/* Quality Dimensions Mini Chips */}
                  <div className="mt-2.5 pt-2 border-t border-slate-100 grid grid-cols-2 gap-1.5 text-[10px]">
                    <div className="flex items-center justify-between text-slate-500">
                      <span>Reliability:</span>
                      <span className={`px-1.5 py-0.2 rounded border font-semibold ${quality.reliability.cls}`}>
                        {quality.reliability.level}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500">
                      <span>Recency:</span>
                      <span className={`px-1.5 py-0.2 rounded border font-semibold ${quality.recency.cls}`}>
                        {quality.recency.level}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Metadata & Actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-400">
                    {new Date(item.captured_at || item.uploaded_at).toLocaleDateString()}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedEvidenceForDetail(item)}
                      className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 transition"
                    >
                      Inspect
                    </button>

                    <span className="text-slate-300">•</span>

                    <button
                      onClick={() => handleDownload(item.id, item.original_filename)}
                      disabled={downloadingId === item.id}
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition disabled:opacity-50"
                    >
                      {downloadingId === item.id ? '...' : 'Download'}
                    </button>

                    <span className="text-slate-300">•</span>

                    <button
                      onClick={() => openEditModal(item)}
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
                    >
                      Edit
                    </button>

                    <span className="text-slate-300">•</span>

                    <button
                      onClick={() => handleDelete(item.id, item.original_filename)}
                      disabled={deletingId === item.id}
                      className="text-xs font-semibold text-red-600 hover:text-red-800 transition disabled:opacity-50"
                    >
                      {deletingId === item.id ? '...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* 5. Detailed / Table View */
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Artifact</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Provenance</th>
                <th className="py-2.5 px-3">Supports Observation</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">State</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredEvidence.map((item) => {
                const prov = getProvenanceBadge(item.source_type);
                const vState = getVerificationBadge(item.verification_state);
                const matchingObs = observations.find((o) => o.id === item.observation_id);
                const isImage = item.evidence_type === 'image';
                const imgUrl = imageUrls[item.id];

                return (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-2.5 px-3 font-semibold text-slate-900 max-w-[200px] truncate">
                      <div className="flex items-center gap-2">
                        {isImage && imgUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={imgUrl}
                            alt=""
                            className="h-8 w-8 rounded object-cover shrink-0 border border-slate-200"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded bg-slate-100 flex items-center justify-center shrink-0 text-slate-400">
                            <FileTextIcon className="h-4 w-4" />
                          </div>
                        )}
                        <span
                          onClick={() => setSelectedEvidenceForDetail(item)}
                          className="truncate cursor-pointer hover:text-emerald-700"
                          title={item.original_filename}
                        >
                          {item.original_filename}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 capitalize">{item.evidence_type}</td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold border ${prov.cls}`}>
                        {prov.code}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {matchingObs ? (
                        <span className="text-[11px] font-medium text-emerald-800">
                          Obs #{matchingObs.id}: {matchingObs.category.replace('_', ' ')}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">None</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                      {new Date(item.captured_at || item.uploaded_at).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold border ${vState.cls}`}>
                        {vState.label}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-2 text-xs">
                        <button
                          onClick={() => setSelectedEvidenceForDetail(item)}
                          className="font-semibold text-emerald-700 hover:text-emerald-900"
                        >
                          Inspect
                        </button>
                        <button
                          onClick={() => handleDownload(item.id, item.original_filename)}
                          className="font-semibold text-slate-600 hover:text-slate-900"
                        >
                          Download
                        </button>
                        <button
                          onClick={() => handleDelete(item.id, item.original_filename)}
                          className="font-semibold text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 6. Comprehensive Evidence Detail Modal */}
      {selectedEvidenceForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className="relative max-h-[92vh] max-w-3xl w-full flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden my-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
              <div className="min-w-0 pr-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Evidence Artifact #{selectedEvidenceForDetail.id}
                </span>
                <h3 className="text-base font-bold text-slate-900 truncate">
                  {selectedEvidenceForDetail.original_filename}
                </h3>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() =>
                    handleDownload(
                      selectedEvidenceForDetail.id,
                      selectedEvidenceForDetail.original_filename
                    )
                  }
                  className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition"
                >
                  Download File
                </button>
                <button
                  onClick={() => setSelectedEvidenceForDetail(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                >
                  <CloseIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Preview Area */}
              {selectedEvidenceForDetail.evidence_type === 'image' ? (
                <div className="flex items-center justify-center bg-slate-950 rounded-xl overflow-hidden max-h-80 p-2">
                  {imageUrls[selectedEvidenceForDetail.id] ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={imageUrls[selectedEvidenceForDetail.id]}
                      alt={selectedEvidenceForDetail.original_filename}
                      className="max-h-76 max-w-full object-contain"
                    />
                  ) : (
                    <div className="text-white text-xs py-12 animate-pulse">Loading preview image...</div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                    <FileTextIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      {selectedEvidenceForDetail.original_filename}
                    </h4>
                    <p className="text-xs text-slate-500">
                      {selectedEvidenceForDetail.mime_type} • {formatBytes(selectedEvidenceForDetail.file_size_bytes)}
                    </p>
                  </div>
                </div>
              )}

              {/* Observation Linkage Section */}
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 space-y-2">
                <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider">
                  Observation Linkage
                </span>
                {selectedEvidenceForDetail.observation_id ? (
                  <div className="flex items-start gap-2 text-xs">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 mt-1 shrink-0" />
                    <div>
                      <span className="font-bold text-emerald-900">
                        Evidence supports Observation #{selectedEvidenceForDetail.observation_id}
                      </span>
                      {selectedEvidenceForDetail.observation_description && (
                        <p className="mt-0.5 text-emerald-800 text-[11px]">
                          &quot;{selectedEvidenceForDetail.observation_description}&quot;
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">
                    This artifact is attached at the investigation level and not linked to a specific observation.
                  </p>
                )}
                <p className="text-[10px] text-slate-500 border-t border-emerald-200/50 pt-2 leading-relaxed">
                  Evidence-first: Physical artifacts substantiate recorded field observations. Inferences and causes remain distinct from objective evidence.
                </p>
              </div>

              {/* Transparent Quality Dimensions (4 Dimensions) */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Evidence Quality Dimensions
                </h4>
                {(() => {
                  const q = getQualityDimensions(selectedEvidenceForDetail);
                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 space-y-1">
                        <span className="text-[10px] text-slate-400 font-semibold uppercase">Source Reliability</span>
                        <div className={`font-bold text-xs ${q.reliability.cls.split(' ')[0]}`}>
                          {q.reliability.level}
                        </div>
                        <p className="text-[10px] text-slate-500">{q.reliability.label}</p>
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 space-y-1">
                        <span className="text-[10px] text-slate-400 font-semibold uppercase">Completeness</span>
                        <div className={`font-bold text-xs ${q.completeness.cls.split(' ')[0]}`}>
                          {q.completeness.level}
                        </div>
                        <p className="text-[10px] text-slate-500">{q.completeness.desc}</p>
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 space-y-1">
                        <span className="text-[10px] text-slate-400 font-semibold uppercase">Recency</span>
                        <div className={`font-bold text-xs ${q.recency.cls.split(' ')[0]}`}>
                          {q.recency.level}
                        </div>
                        <p className="text-[10px] text-slate-500">{q.recency.label}</p>
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 space-y-1">
                        <span className="text-[10px] text-slate-400 font-semibold uppercase">Geographic Anchor</span>
                        <div className={`font-bold text-xs ${q.precision.cls.split(' ')[0]}`}>
                          {q.precision.level}
                        </div>
                        <p className="text-[10px] text-slate-500">{q.precision.label}</p>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Provenance & Description */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs">
                  <h5 className="font-bold text-slate-800 uppercase text-[10px]">Provenance & Origin</h5>
                  {(() => {
                    const prov = getProvenanceBadge(selectedEvidenceForDetail.source_type);
                    return (
                      <div>
                        <span className={`inline-flex rounded px-2 py-0.5 text-xs font-bold border ${prov.cls}`}>
                          {prov.code}
                        </span>
                        <p className="mt-1.5 text-[11px] text-slate-600 leading-relaxed">
                          {prov.origin}
                        </p>
                      </div>
                    );
                  })()}
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs">
                  <h5 className="font-bold text-slate-800 uppercase text-[10px]">Verification State</h5>
                  {(() => {
                    const v = getVerificationBadge(selectedEvidenceForDetail.verification_state);
                    return (
                      <div>
                        <span className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold border ${v.cls}`}>
                          {v.label}
                        </span>
                        <p className="mt-1.5 text-[11px] text-slate-600 leading-relaxed">
                          Verification tracks whether this physical artifact has been corroborated by field checks.
                        </p>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Description / Notes */}
              <div>
                <h5 className="text-xs font-bold text-slate-800 uppercase mb-1">Analytical Notes</h5>
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 text-xs text-slate-700 leading-relaxed">
                  {selectedEvidenceForDetail.description || (
                    <span className="text-slate-400 italic">No notes recorded for this artifact.</span>
                  )}
                </div>
              </div>

              {/* Technical Metadata Table */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs">
                <h5 className="font-bold text-slate-800 uppercase text-[10px] mb-2">Technical Metadata</h5>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-2 gap-x-4 text-[11px]">
                  <div>
                    <span className="text-slate-400 block">File Size:</span>
                    <span className="font-semibold text-slate-800">
                      {formatBytes(selectedEvidenceForDetail.file_size_bytes)} ({selectedEvidenceForDetail.file_size_bytes} bytes)
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">MIME Type:</span>
                    <span className="font-semibold text-slate-800">{selectedEvidenceForDetail.mime_type}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Dimensions:</span>
                    <span className="font-semibold text-slate-800">
                      {selectedEvidenceForDetail.metadata?.width && selectedEvidenceForDetail.metadata?.height
                        ? `${selectedEvidenceForDetail.metadata.width} × ${selectedEvidenceForDetail.metadata.height} px`
                        : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Captured At:</span>
                    <span className="font-semibold text-slate-800">
                      {selectedEvidenceForDetail.captured_at
                        ? new Date(selectedEvidenceForDetail.captured_at).toLocaleString()
                        : 'Unrecorded'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Uploaded At:</span>
                    <span className="font-semibold text-slate-800">
                      {new Date(selectedEvidenceForDetail.uploaded_at).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Storage Reference:</span>
                    <span className="font-mono text-[10px] text-slate-700 truncate block" title={selectedEvidenceForDetail.storage_key}>
                      {selectedEvidenceForDetail.storage_key}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Geographic Coordinates:</span>
                    <span className="font-semibold text-slate-800">
                      {selectedEvidenceForDetail.latitude != null && selectedEvidenceForDetail.longitude != null
                        ? `${selectedEvidenceForDetail.latitude.toFixed(5)}°, ${selectedEvidenceForDetail.longitude.toFixed(5)}°`
                        : 'Unrecorded / UNAVAILABLE'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Location Source:</span>
                    <span className="font-semibold text-slate-800">
                      {selectedEvidenceForDetail.location_source || 'UNAVAILABLE'}
                      {selectedEvidenceForDetail.location_accuracy != null
                        ? ` (±${selectedEvidenceForDetail.location_accuracy}m)`
                        : ''}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-100 px-6 py-3.5 bg-slate-50 flex items-center justify-between">
              <button
                onClick={() => {
                  const target = selectedEvidenceForDetail;
                  setSelectedEvidenceForDetail(null);
                  openEditModal(target);
                }}
                className="rounded-xl border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                Edit Metadata & Links
              </button>

              <button
                onClick={() => setSelectedEvidenceForDetail(null)}
                className="rounded-xl bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Before / After Comparison Modal (Extended in Phase 6B) */}
      <BeforeAfterComparisonModal
        isOpen={isCompareModalOpen}
        onClose={() => setIsCompareModalOpen(false)}
        investigationId={investigationId}
        evidenceItems={evidence}
        imageUrls={imageUrls}
        beforeEvidenceId={beforeEvidenceId}
        afterEvidenceId={afterEvidenceId}
        onSelectBeforeId={setBeforeEvidenceId}
        onSelectAfterId={setAfterEvidenceId}
        analysisResult={analysisResult}
        isAnalyzing={isAnalyzing}
        analysisError={analysisError}
        onRunAnalysis={handleRunAnalysis}
      />

      {/* 7B. Multi-Temporal Evidence Sequence Modal (Phase 7A & 7B) */}
      <TemporalEvidenceSequence
        isOpen={isTemporalModalOpen}
        onClose={() => setIsTemporalModalOpen(false)}
        investigationId={investigationId}
        evidenceItems={evidence}
        imageUrls={imageUrls}
        onOpenPairComparison={handleOpenPairComparison}
        onOpenEvidenceDetail={(evidenceId) => {
          const item = evidence.find((e) => e.id === evidenceId);
          if (item) {
            setIsTemporalModalOpen(false);
            setSelectedEvidenceForDetail(item);
          }
        }}
        onEvidenceChanged={onEvidenceChanged}
      />

      {/* 8. Add Evidence Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                  <ShieldCheckIcon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Upload Investigation Evidence</h3>
                  <p className="text-[11px] text-slate-500">Supported formats: JPG, PNG, WEBP, PDF (max 10MB)</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            {uploadError && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-800 flex items-center gap-2">
                <AlertCircleIcon className="h-4 w-4 text-red-600 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Evidence File *
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  required
                  accept=".jpg,.jpeg,.png,.webp,.pdf"
                  onChange={handleFileSelect}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2 text-xs font-medium text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-600 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white hover:file:bg-emerald-700 focus:outline-none"
                />
                {file && (
                  <div className="mt-1 text-[11px] text-slate-500">
                    Selected: <span className="font-semibold text-slate-700">{file.name}</span> ({formatBytes(file.size)})
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Source Classification *
                  </label>
                  <select
                    value={sourceType}
                    onChange={(e) => setSourceType(e.target.value as EvidenceSourceType)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="observed">Observed (Field Capture)</option>
                    <option value="user_reported">User Reported (Witness)</option>
                    <option value="external_source">External Source (Lab / Public)</option>
                    <option value="inferred">Inferred (Model / Algorithmic)</option>
                    <option value="estimated">Estimated (Approximation)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Verification State
                  </label>
                  <select
                    value={verificationState}
                    onChange={(e) => setVerificationState(e.target.value as VerificationStateType)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="needs_verification">Needs Verification</option>
                    <option value="verified">Verified</option>
                    <option value="disputed">Disputed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Connect to Observation (Optional)
                </label>
                <select
                  value={selectedObsId}
                  onChange={(e) => setSelectedObsId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">-- Investigation Level (No specific observation) --</option>
                  {observations.map((obs) => (
                    <option key={obs.id} value={obs.id}>
                      Obs #{obs.id}: {obs.category.replace('_', ' ')} - {obs.description.slice(0, 45)}...
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Evidence Description & Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Record factual details about this artifact (e.g., photo taken facing north at discharge canal)..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Captured Timestamp (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={capturedAt}
                  onChange={(e) => setCapturedAt(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition"
                >
                  {uploading ? 'Uploading Evidence...' : 'Save & Attach Evidence'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. Edit Evidence Modal */}
      {editingEvidence && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Edit Evidence Metadata</h3>
                <p className="text-[11px] text-slate-500">{editingEvidence.original_filename}</p>
              </div>
              <button
                onClick={() => setEditingEvidence(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            {editError && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-800 flex items-center gap-2">
                <AlertCircleIcon className="h-4 w-4 text-red-600 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Source Classification
                  </label>
                  <select
                    value={editSourceType}
                    onChange={(e) => setEditSourceType(e.target.value as EvidenceSourceType)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="observed">Observed (Field Capture)</option>
                    <option value="user_reported">User Reported (Witness)</option>
                    <option value="external_source">External Source (Lab / Public)</option>
                    <option value="inferred">Inferred (Model / Algorithmic)</option>
                    <option value="estimated">Estimated (Approximation)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Verification State
                  </label>
                  <select
                    value={editVerificationState}
                    onChange={(e) => setEditVerificationState(e.target.value as VerificationStateType)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="needs_verification">Needs Verification</option>
                    <option value="verified">Verified</option>
                    <option value="disputed">Disputed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Associated Observation
                </label>
                <select
                  value={editObsId}
                  onChange={(e) => setEditObsId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">-- No specific observation (Investigation Level) --</option>
                  {observations.map((obs) => (
                    <option key={obs.id} value={obs.id}>
                      Obs #{obs.id}: {obs.category.replace('_', ' ')} - {obs.description.slice(0, 45)}...
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description / Analytical Notes
                </label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingEvidence(null)}
                  className="rounded-xl border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition"
                >
                  {editSaving ? 'Saving...' : 'Update Evidence'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
