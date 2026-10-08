'use client';

import React, { useState, useEffect } from 'react';
import {
  hypothesesApi,
  Hypothesis,
  HypothesisDetail,
  HypothesisComparisonResponse,
  HypothesisStatusType,
  HypothesisConfidenceType,
  HypothesisRelationshipType,
  RequirementPriorityType,
  RequirementStatusType,
  Evidence,
  Observation,
} from '../lib/api';
import {
  FileTextIcon,
  PlusIcon,
  CloseIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  EyeIcon,
  ClockIcon,
  LayersIcon,
} from './Icons';
import { HypothesisComparisonWorkspace } from './HypothesisComparisonWorkspace';

interface HypothesisWorkspaceProps {
  investigationId: number;
  evidenceList: Evidence[];
  observationsList: Observation[];
  onHypothesisChanged?: () => void;
}

export function HypothesisWorkspace({
  investigationId,
  evidenceList,
  observationsList,
  onHypothesisChanged,
}: HypothesisWorkspaceProps) {
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Selected hypothesis for deep workspace modal
  const [selectedHypothesisId, setSelectedHypothesisId] = useState<number | null>(null);
  const [hypothesisDetail, setHypothesisDetail] = useState<HypothesisDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Create Hypothesis Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createReasoning, setCreateReasoning] = useState('');
  const [createStatus, setCreateStatus] = useState<HypothesisStatusType>('OPEN');
  const [createConfidence, setCreateConfidence] = useState<HypothesisConfidenceType>('LOW');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit details inside workspace modal
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editReasoning, setEditReasoning] = useState('');
  const [editStatus, setEditStatus] = useState<HypothesisStatusType>('OPEN');
  const [editConfidence, setEditConfidence] = useState<HypothesisConfidenceType>('LOW');
  const [updating, setUpdating] = useState(false);

  // Link Evidence form state
  const [linkEvidenceId, setLinkEvidenceId] = useState<string>('');
  const [linkEvidenceRel, setLinkEvidenceRel] = useState<HypothesisRelationshipType>('SUPPORTS');
  const [linkEvidenceNote, setLinkEvidenceNote] = useState('');
  const [linkingEvidence, setLinkingEvidence] = useState(false);

  // Link Observation form state
  const [linkObsId, setLinkObsId] = useState<string>('');
  const [linkObsRel, setLinkObsRel] = useState<HypothesisRelationshipType>('SUPPORTS');
  const [linkObsNote, setLinkObsNote] = useState('');
  const [linkingObs, setLinkingObs] = useState(false);

  // Missing Evidence form state
  const [missingDesc, setMissingDesc] = useState('');
  const [missingPriority, setMissingPriority] = useState<RequirementPriorityType>('MEDIUM');
  const [addingMissing, setAddingMissing] = useState(false);

  // Active workspace tab
  const [activeTab, setActiveTab] = useState<'evidence' | 'observations' | 'missing' | 'timeline'>('evidence');

  // Phase 8B: Comparative Evaluation State
  const [selectedForComparison, setSelectedForComparison] = useState<number[]>([]);
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [comparisonData, setComparisonData] = useState<HypothesisComparisonResponse | null>(null);
  const [comparingLoading, setComparingLoading] = useState<boolean>(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);

  const toggleSelectForComparison = (id: number) => {
    setSelectedForComparison((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleStartComparison = async (overrideIds?: number[]) => {
    const idsToCompare = overrideIds || selectedForComparison;
    if (idsToCompare.length < 2) {
      alert('Please select at least two hypotheses to compare.');
      return;
    }
    try {
      setComparingLoading(true);
      setComparisonError(null);
      const data = await hypothesesApi.compare(investigationId, idsToCompare);
      setComparisonData(data);
      setIsComparing(true);
    } catch (err: any) {
      setComparisonError(err.message || 'Failed to compare hypotheses.');
      alert(err.message || 'Failed to compare hypotheses.');
    } finally {
      setComparingLoading(false);
    }
  };

  const fetchHypotheses = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await hypothesesApi.list(investigationId);
      setHypotheses(data);
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve hypotheses.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (investigationId) {
      fetchHypotheses();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [investigationId]);

  const openHypothesisDetail = async (id: number) => {
    setSelectedHypothesisId(id);
    setLoadingDetail(true);
    setDetailError(null);
    try {
      const data = await hypothesesApi.get(investigationId, id);
      setHypothesisDetail(data);
      setEditTitle(data.title);
      setEditDescription(data.description || '');
      setEditReasoning(data.reasoning || '');
      setEditStatus(data.status);
      setEditConfidence(data.confidence);
    } catch (err: any) {
      setDetailError(err.message || 'Failed to load hypothesis workspace.');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCreateHypothesis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTitle.trim()) {
      setCreateError('Hypothesis title cannot be empty.');
      return;
    }
    try {
      setCreating(true);
      setCreateError(null);
      await hypothesesApi.create(investigationId, {
        title: createTitle.trim(),
        description: createDescription.trim() || undefined,
        reasoning: createReasoning.trim() || undefined,
        status: createStatus,
        confidence: createConfidence,
      });
      setCreateTitle('');
      setCreateDescription('');
      setCreateReasoning('');
      setCreateStatus('OPEN');
      setCreateConfidence('LOW');
      setIsCreateModalOpen(false);
      await fetchHypotheses();
      if (onHypothesisChanged) onHypothesisChanged();
    } catch (err: any) {
      setCreateError(err.message || 'Failed to record hypothesis.');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateHypothesis = async () => {
    if (!selectedHypothesisId) return;
    try {
      setUpdating(true);
      const updated = await hypothesesApi.update(investigationId, selectedHypothesisId, {
        title: editTitle.trim() || undefined,
        description: editDescription.trim() || undefined,
        reasoning: editReasoning.trim() || undefined,
        status: editStatus,
        confidence: editConfidence,
      });
      setHypothesisDetail(updated);
      await fetchHypotheses();
      if (onHypothesisChanged) onHypothesisChanged();
    } catch (err: any) {
      alert(err.message || 'Failed to update hypothesis.');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteHypothesis = async () => {
    if (!selectedHypothesisId) return;
    if (!confirm('Are you sure you want to delete this hypothesis? This action cannot be undone.')) return;
    try {
      await hypothesesApi.delete(investigationId, selectedHypothesisId);
      setSelectedHypothesisId(null);
      setHypothesisDetail(null);
      await fetchHypotheses();
      if (onHypothesisChanged) onHypothesisChanged();
    } catch (err: any) {
      alert(err.message || 'Failed to delete hypothesis.');
    }
  };

  // Link Evidence
  const handleLinkEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHypothesisId || !linkEvidenceId) return;
    try {
      setLinkingEvidence(true);
      await hypothesesApi.linkEvidence(investigationId, selectedHypothesisId, {
        evidence_id: parseInt(linkEvidenceId, 10),
        relationship_type: linkEvidenceRel,
        note: linkEvidenceNote.trim() || undefined,
      });
      setLinkEvidenceId('');
      setLinkEvidenceNote('');
      // Reload detail
      const refreshed = await hypothesesApi.get(investigationId, selectedHypothesisId);
      setHypothesisDetail(refreshed);
      await fetchHypotheses();
      if (onHypothesisChanged) onHypothesisChanged();
    } catch (err: any) {
      alert(err.message || 'Failed to link evidence.');
    } finally {
      setLinkingEvidence(false);
    }
  };

  const handleUnlinkEvidence = async (evId: number) => {
    if (!selectedHypothesisId) return;
    try {
      await hypothesesApi.unlinkEvidence(investigationId, selectedHypothesisId, evId);
      const refreshed = await hypothesesApi.get(investigationId, selectedHypothesisId);
      setHypothesisDetail(refreshed);
      await fetchHypotheses();
      if (onHypothesisChanged) onHypothesisChanged();
    } catch (err: any) {
      alert(err.message || 'Failed to unlink evidence.');
    }
  };

  // Link Observation
  const handleLinkObservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHypothesisId || !linkObsId) return;
    try {
      setLinkingObs(true);
      await hypothesesApi.linkObservation(investigationId, selectedHypothesisId, {
        observation_id: parseInt(linkObsId, 10),
        relationship_type: linkObsRel,
        note: linkObsNote.trim() || undefined,
      });
      setLinkObsId('');
      setLinkObsNote('');
      const refreshed = await hypothesesApi.get(investigationId, selectedHypothesisId);
      setHypothesisDetail(refreshed);
      await fetchHypotheses();
      if (onHypothesisChanged) onHypothesisChanged();
    } catch (err: any) {
      alert(err.message || 'Failed to link observation.');
    } finally {
      setLinkingObs(false);
    }
  };

  const handleUnlinkObservation = async (obsId: number) => {
    if (!selectedHypothesisId) return;
    try {
      await hypothesesApi.unlinkObservation(investigationId, selectedHypothesisId, obsId);
      const refreshed = await hypothesesApi.get(investigationId, selectedHypothesisId);
      setHypothesisDetail(refreshed);
      await fetchHypotheses();
      if (onHypothesisChanged) onHypothesisChanged();
    } catch (err: any) {
      alert(err.message || 'Failed to unlink observation.');
    }
  };

  // Missing Evidence
  const handleAddMissingEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHypothesisId || !missingDesc.trim()) return;
    try {
      setAddingMissing(true);
      await hypothesesApi.addMissingEvidence(investigationId, selectedHypothesisId, {
        description: missingDesc.trim(),
        priority: missingPriority,
        status: 'OPEN',
      });
      setMissingDesc('');
      setMissingPriority('MEDIUM');
      const refreshed = await hypothesesApi.get(investigationId, selectedHypothesisId);
      setHypothesisDetail(refreshed);
      await fetchHypotheses();
      if (onHypothesisChanged) onHypothesisChanged();
    } catch (err: any) {
      alert(err.message || 'Failed to add missing evidence requirement.');
    } finally {
      setAddingMissing(false);
    }
  };

  const handleUpdateMissingStatus = async (reqId: number, status: RequirementStatusType) => {
    if (!selectedHypothesisId) return;
    try {
      await hypothesesApi.updateMissingEvidence(investigationId, selectedHypothesisId, reqId, {
        status,
      });
      const refreshed = await hypothesesApi.get(investigationId, selectedHypothesisId);
      setHypothesisDetail(refreshed);
      await fetchHypotheses();
      if (onHypothesisChanged) onHypothesisChanged();
    } catch (err: any) {
      alert(err.message || 'Failed to update requirement status.');
    }
  };

  const handleDeleteMissingEvidence = async (reqId: number) => {
    if (!selectedHypothesisId) return;
    try {
      await hypothesesApi.deleteMissingEvidence(investigationId, selectedHypothesisId, reqId);
      const refreshed = await hypothesesApi.get(investigationId, selectedHypothesisId);
      setHypothesisDetail(refreshed);
      await fetchHypotheses();
      if (onHypothesisChanged) onHypothesisChanged();
    } catch (err: any) {
      alert(err.message || 'Failed to delete requirement.');
    }
  };

  const getStatusBadge = (status: HypothesisStatusType) => {
    switch (status) {
      case 'OPEN':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'UNDER_REVIEW':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'SUPPORTED':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'WEAKENED':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'REJECTED':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'UNRESOLVED':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getConfidenceBadge = (confidence: HypothesisConfidenceType) => {
    switch (confidence) {
      case 'HIGH':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'MEDIUM':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'LOW':
        return 'bg-slate-100 text-slate-600 border-slate-200';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getPriorityBadge = (priority: RequirementPriorityType) => {
    switch (priority) {
      case 'HIGH':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'MEDIUM':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'LOW':
        return 'bg-slate-50 text-slate-600 border-slate-200';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  // Filter evidence that is not yet linked
  const linkedEvIds = new Set(hypothesisDetail?.evidence_links.map((l) => l.evidence_id) || []);
  const availableEvidence = evidenceList.filter((e) => !linkedEvIds.has(e.id));

  // Filter observations that are not yet linked
  const linkedObsIds = new Set(hypothesisDetail?.observation_links.map((l) => l.observation_id) || []);
  const availableObservations = observationsList.filter((o) => !linkedObsIds.has(o.id));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
      {isComparing && comparisonData ? (
        <HypothesisComparisonWorkspace
          comparison={comparisonData}
          onClose={() => setIsComparing(false)}
          evidenceList={evidenceList}
          observationsList={observationsList}
        />
      ) : (
        <>
          {/* 1. Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs">
                  8A/8B
                </span>
                <h2 className="text-base font-bold text-slate-900">
                  Root-Cause Hypotheses Workspace
                </h2>
              </div>
              <p className="mt-1 text-xs text-slate-500 max-w-2xl">
                Investigator reasoning workspace for formulating candidate explanations and performing
                comparative matrix analysis against common evidence and observations.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {hypotheses.length >= 2 && (
                <button
                  onClick={() => {
                    if (selectedForComparison.length >= 2) {
                      handleStartComparison();
                    } else {
                      const allOrFirst = hypotheses.slice(0, 3).map((h) => h.id);
                      setSelectedForComparison(allOrFirst);
                      handleStartComparison(allOrFirst);
                    }
                  }}
                  disabled={comparingLoading}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 px-3.5 py-2 text-xs font-semibold text-purple-700 shadow-2xs hover:bg-purple-100 transition shrink-0"
                >
                  <LayersIcon className="h-4 w-4 text-purple-600" />
                  {comparingLoading ? 'Analyzing...' : 'Compare Hypotheses (8B)'}
                </button>
              )}

              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition shrink-0"
              >
                <PlusIcon className="h-4 w-4" />
                Formulate Hypothesis
              </button>
            </div>
          </div>

          {/* 2. Guardrail Banner */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3.5 text-xs text-blue-900 flex items-start gap-2.5">
            <AlertCircleIcon className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-semibold text-blue-950">Deterministic Evidence-First Guardrail: </span>
              Hypotheses are investigator-governed candidate explanations. The platform never automatically asserts causality or predicts environmental fault. Confidence represents investigator assessment, not statistical probability.
            </div>
          </div>

          {/* 2b. Comparison Selection Bar (Step 3) */}
          {selectedForComparison.length > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-purple-200 bg-purple-50/70 p-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-700 text-[10px] font-bold text-white">
                  {selectedForComparison.length}
                </span>
                <span className="font-semibold text-purple-950">
                  {selectedForComparison.length === 1
                    ? '1 hypothesis selected (select at least 2 to compare)'
                    : `${selectedForComparison.length} hypotheses selected for comparative matrix evaluation`}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedForComparison([])}
                  className="text-[11px] font-medium text-slate-500 hover:text-slate-700"
                >
                  Clear Selection
                </button>
                <button
                  disabled={selectedForComparison.length < 2 || comparingLoading}
                  onClick={() => handleStartComparison()}
                  className="rounded-lg bg-purple-700 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-purple-800 transition disabled:opacity-50 shadow-2xs"
                >
                  {comparingLoading ? 'Analyzing...' : 'Compare Selected Hypotheses →'}
                </button>
              </div>
            </div>
          )}

          {/* 3. Hypotheses List */}
          {loading ? (
            <div className="flex h-36 items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                <span className="text-xs text-slate-500">Loading hypotheses...</span>
              </div>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">
              {error}
            </div>
          ) : hypotheses.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center space-y-2">
              <FileTextIcon className="mx-auto h-8 w-8 text-slate-300" />
              <h4 className="text-xs font-bold text-slate-700">No Root-Cause Hypotheses Formulated Yet</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Formulate possible explanations to account for observed environmental findings.
                Link supporting or contradicting evidence and identify critical missing information requirements.
              </p>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-slate-50 transition"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                Formulate First Hypothesis
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {hypotheses.map((h) => {
                const isSelected = selectedForComparison.includes(h.id);
                return (
                  <div
                    key={h.id}
                    className={`rounded-xl border p-4 transition flex flex-col justify-between ${
                      isSelected
                        ? 'border-purple-300 bg-purple-50/30 shadow-2xs'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-white hover:shadow-xs'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectForComparison(h.id)}
                            title="Select for Comparative Evaluation (Phase 8B)"
                            className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 h-4 w-4 cursor-pointer"
                          />
                          <h3 className="text-xs font-bold text-slate-900 leading-snug line-clamp-2">
                            {h.title}
                          </h3>
                        </div>
                        <span
                          className={`inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${getStatusBadge(
                            h.status
                          )}`}
                        >
                          {h.status.replace('_', ' ')}
                        </span>
                      </div>

                {h.description && (
                  <p className="text-xs text-slate-600 line-clamp-2 mb-3 leading-relaxed">
                    {h.description}
                  </p>
                )}

                <div className="mb-3">
                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium ${getConfidenceBadge(
                      h.confidence
                    )}`}
                  >
                    Investigator-assessed confidence: {h.confidence}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200/70 space-y-2.5">
                <div className="grid grid-cols-3 gap-1.5 text-center text-[11px]">
                  <div className="rounded-lg bg-emerald-50 border border-emerald-100 py-1 px-1.5">
                    <span className="block font-bold text-emerald-800">{h.supporting_evidence_count}</span>
                    <span className="text-[10px] text-emerald-600">Supporting</span>
                  </div>
                  <div className="rounded-lg bg-rose-50 border border-rose-100 py-1 px-1.5">
                    <span className="block font-bold text-rose-800">{h.contradicting_evidence_count}</span>
                    <span className="text-[10px] text-rose-600">Contradicting</span>
                  </div>
                  <div className="rounded-lg bg-amber-50 border border-amber-100 py-1 px-1.5">
                    <span className="block font-bold text-amber-800">{h.missing_evidence_count}</span>
                    <span className="text-[10px] text-amber-600">Missing Gaps</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <ClockIcon className="h-3 w-3" />
                    Updated: {new Date(h.updated_at).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => openHypothesisDetail(h.id)}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800 transition"
                  >
                    Open Workspace →
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    )}

      {/* 4. Formulate Hypothesis Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Formulate Root-Cause Hypothesis</h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            {createError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateHypothesis} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Hypothesis Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Unpermitted Night-Time Industrial Drainage Overflow"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Possible Explanation Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Describe the candidate mechanism or environmental event..."
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Investigator Reasoning / Rationale
                </label>
                <textarea
                  rows={2}
                  placeholder="Why is this hypothesis considered plausible? Reference preliminary observations..."
                  value={createReasoning}
                  onChange={(e) => setCreateReasoning(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Initial Workflow Status
                  </label>
                  <select
                    value={createStatus}
                    onChange={(e) => setCreateStatus(e.target.value as HypothesisStatusType)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs bg-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="OPEN">OPEN</option>
                    <option value="UNDER_REVIEW">UNDER REVIEW</option>
                    <option value="SUPPORTED">SUPPORTED</option>
                    <option value="WEAKENED">WEAKENED</option>
                    <option value="REJECTED">REJECTED</option>
                    <option value="UNRESOLVED">UNRESOLVED</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Investigator-Assessed Confidence
                  </label>
                  <select
                    value={createConfidence}
                    onChange={(e) => setCreateConfidence(e.target.value as HypothesisConfidenceType)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs bg-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-50"
                >
                  {creating ? 'Saving...' : 'Create Hypothesis'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Deep Hypothesis Detail Workspace Modal */}
      {selectedHypothesisId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/80">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-xs">
                  H
                </span>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                    {hypothesisDetail?.title || 'Hypothesis Workspace'}
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Hypothesis #{selectedHypothesisId} in Investigation #{investigationId}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleDeleteHypothesis}
                  className="rounded-lg border border-red-200 px-2.5 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 transition"
                >
                  Delete
                </button>
                <button
                  onClick={() => {
                    setSelectedHypothesisId(null);
                    setHypothesisDetail(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <CloseIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            {loadingDetail ? (
              <div className="flex h-96 items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="h-8 w-8 animate-spin rounded-full border-3 border-emerald-600 border-t-transparent" />
                  <span className="text-xs text-slate-500">Loading workspace data...</span>
                </div>
              </div>
            ) : detailError || !hypothesisDetail ? (
              <div className="p-6 text-center text-xs text-red-600">
                {detailError || 'Failed to load hypothesis.'}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Hypothesis Metadata & Reasoning Bar */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Workflow Status
                      </label>
                      <select
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value as HypothesisStatusType)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800"
                      >
                        <option value="OPEN">OPEN</option>
                        <option value="UNDER_REVIEW">UNDER REVIEW</option>
                        <option value="SUPPORTED">SUPPORTED</option>
                        <option value="WEAKENED">WEAKENED</option>
                        <option value="REJECTED">REJECTED</option>
                        <option value="UNRESOLVED">UNRESOLVED</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Investigator-Assessed Confidence
                      </label>
                      <select
                        value={editConfidence}
                        onChange={(e) => setEditConfidence(e.target.value as HypothesisConfidenceType)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800"
                      >
                        <option value="LOW">LOW</option>
                        <option value="MEDIUM">MEDIUM</option>
                        <option value="HIGH">HIGH</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Investigator Reasoning & Rationale
                    </label>
                    <textarea
                      rows={2}
                      value={editReasoning}
                      onChange={(e) => setEditReasoning(e.target.value)}
                      placeholder="Record current investigator reasoning explaining why this hypothesis remains viable, weakened, or unresolved..."
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">
                      Last Updated: {new Date(hypothesisDetail.updated_at).toLocaleString()}
                    </span>
                    <button
                      onClick={handleUpdateHypothesis}
                      disabled={updating}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-50"
                    >
                      {updating ? 'Saving...' : 'Save Status & Reasoning'}
                    </button>
                  </div>
                </div>

                {/* Workspace Navigation Tabs */}
                <div className="flex border-b border-slate-200 text-xs">
                  <button
                    onClick={() => setActiveTab('evidence')}
                    className={`py-2 px-4 font-semibold border-b-2 transition ${
                      activeTab === 'evidence'
                        ? 'border-emerald-600 text-emerald-800'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Evidence Evaluation ({hypothesisDetail.evidence_links.length})
                  </button>

                  <button
                    onClick={() => setActiveTab('observations')}
                    className={`py-2 px-4 font-semibold border-b-2 transition ${
                      activeTab === 'observations'
                        ? 'border-emerald-600 text-emerald-800'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Observations Evaluation ({hypothesisDetail.observation_links.length})
                  </button>

                  <button
                    onClick={() => setActiveTab('missing')}
                    className={`py-2 px-4 font-semibold border-b-2 transition ${
                      activeTab === 'missing'
                        ? 'border-emerald-600 text-emerald-800'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Missing Evidence Gaps ({hypothesisDetail.missing_evidence.length})
                  </button>

                  <button
                    onClick={() => setActiveTab('timeline')}
                    className={`py-2 px-4 font-semibold border-b-2 transition ${
                      activeTab === 'timeline'
                        ? 'border-emerald-600 text-emerald-800'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Activity Log
                  </button>
                </div>

                {/* TAB 1: EVIDENCE EVALUATION */}
                {activeTab === 'evidence' && (
                  <div className="space-y-6">
                    {/* Link Evidence Form */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Link Evidence from Investigation
                      </h4>
                      {availableEvidence.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">
                          All available evidence for this investigation is already linked.
                        </p>
                      ) : (
                        <form onSubmit={handleLinkEvidence} className="space-y-3 text-xs">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="sm:col-span-2">
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Select Evidence Item
                              </label>
                              <select
                                required
                                value={linkEvidenceId}
                                onChange={(e) => setLinkEvidenceId(e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
                              >
                                <option value="">-- Choose Evidence Item --</option>
                                {availableEvidence.map((ev) => (
                                  <option key={ev.id} value={ev.id}>
                                    #{ev.id} - {ev.original_filename} ({ev.evidence_type})
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Relationship Type
                              </label>
                              <select
                                value={linkEvidenceRel}
                                onChange={(e) => setLinkEvidenceRel(e.target.value as HypothesisRelationshipType)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
                              >
                                <option value="SUPPORTS">SUPPORTS</option>
                                <option value="CONTRADICTS">CONTRADICTS</option>
                                <option value="CONTEXT">CONTEXT</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Investigator Note / Linking Rationale
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Discoloration in photo directly corroborates effluent outfall timing."
                              value={linkEvidenceNote}
                              onChange={(e) => setLinkEvidenceNote(e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
                            />
                          </div>

                          <div className="flex justify-end">
                            <button
                              type="submit"
                              disabled={linkingEvidence || !linkEvidenceId}
                              className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-50"
                            >
                              {linkingEvidence ? 'Linking...' : 'Link Evidence to Hypothesis'}
                            </button>
                          </div>
                        </form>
                      )}
                    </div>

                    {/* Linked Evidence Sections (Supports / Contradicts / Context) */}
                    <div className="space-y-4">
                      {/* Supporting */}
                      <div>
                        <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <CheckCircleIcon className="h-4 w-4 text-emerald-600" />
                          Supporting Evidence (
                          {
                            hypothesisDetail.evidence_links.filter((l) => l.relationship_type === 'SUPPORTS')
                              .length
                          }
                          )
                        </h4>
                        {hypothesisDetail.evidence_links.filter((l) => l.relationship_type === 'SUPPORTS')
                          .length === 0 ? (
                          <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-lg border border-slate-100">
                            No supporting evidence linked yet.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {hypothesisDetail.evidence_links
                              .filter((l) => l.relationship_type === 'SUPPORTS')
                              .map((link) => (
                                <div
                                  key={link.id}
                                  className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-3 flex items-start justify-between gap-3 text-xs"
                                >
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-900">
                                        Evidence #{link.evidence_id}
                                      </span>
                                      <span className="text-slate-500">
                                        {link.evidence?.original_filename || 'File'}
                                      </span>
                                    </div>
                                    {link.note && (
                                      <p className="mt-1 text-slate-600 text-[11px] leading-relaxed">
                                        Note: {link.note}
                                      </p>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => handleUnlinkEvidence(link.evidence_id)}
                                    className="text-red-500 hover:text-red-700 text-[11px] font-medium shrink-0"
                                  >
                                    Unlink
                                  </button>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>

                      {/* Contradicting */}
                      <div>
                        <h4 className="text-xs font-bold text-rose-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <AlertCircleIcon className="h-4 w-4 text-rose-600" />
                          Contradicting Evidence (
                          {
                            hypothesisDetail.evidence_links.filter((l) => l.relationship_type === 'CONTRADICTS')
                              .length
                          }
                          )
                        </h4>
                        {hypothesisDetail.evidence_links.filter((l) => l.relationship_type === 'CONTRADICTS')
                          .length === 0 ? (
                          <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-lg border border-slate-100">
                            No contradicting evidence linked yet.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {hypothesisDetail.evidence_links
                              .filter((l) => l.relationship_type === 'CONTRADICTS')
                              .map((link) => (
                                <div
                                  key={link.id}
                                  className="rounded-xl border border-rose-200 bg-rose-50/30 p-3 flex items-start justify-between gap-3 text-xs"
                                >
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-900">
                                        Evidence #{link.evidence_id}
                                      </span>
                                      <span className="text-slate-500">
                                        {link.evidence?.original_filename || 'File'}
                                      </span>
                                    </div>
                                    {link.note && (
                                      <p className="mt-1 text-slate-600 text-[11px] leading-relaxed">
                                        Note: {link.note}
                                      </p>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => handleUnlinkEvidence(link.evidence_id)}
                                    className="text-red-500 hover:text-red-700 text-[11px] font-medium shrink-0"
                                  >
                                    Unlink
                                  </button>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>

                      {/* Context */}
                      <div>
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                          Context Evidence (
                          {
                            hypothesisDetail.evidence_links.filter((l) => l.relationship_type === 'CONTEXT')
                              .length
                          }
                          )
                        </h4>
                        {hypothesisDetail.evidence_links.filter((l) => l.relationship_type === 'CONTEXT')
                          .length === 0 ? (
                          <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-lg border border-slate-100">
                            No context evidence linked.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {hypothesisDetail.evidence_links
                              .filter((l) => l.relationship_type === 'CONTEXT')
                              .map((link) => (
                                <div
                                  key={link.id}
                                  className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex items-start justify-between gap-3 text-xs"
                                >
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-900">
                                        Evidence #{link.evidence_id}
                                      </span>
                                      <span className="text-slate-500">
                                        {link.evidence?.original_filename || 'File'}
                                      </span>
                                    </div>
                                    {link.note && (
                                      <p className="mt-1 text-slate-600 text-[11px] leading-relaxed">
                                        Note: {link.note}
                                      </p>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => handleUnlinkEvidence(link.evidence_id)}
                                    className="text-red-500 hover:text-red-700 text-[11px] font-medium shrink-0"
                                  >
                                    Unlink
                                  </button>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: OBSERVATIONS EVALUATION */}
                {activeTab === 'observations' && (
                  <div className="space-y-6">
                    {/* Link Observation Form */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Link Field Observation from Investigation
                      </h4>
                      {availableObservations.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">
                          All recorded observations for this investigation are already linked.
                        </p>
                      ) : (
                        <form onSubmit={handleLinkObservation} className="space-y-3 text-xs">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="sm:col-span-2">
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Select Observation Item
                              </label>
                              <select
                                required
                                value={linkObsId}
                                onChange={(e) => setLinkObsId(e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
                              >
                                <option value="">-- Choose Observation --</option>
                                {availableObservations.map((obs) => (
                                  <option key={obs.id} value={obs.id}>
                                    #{obs.id} - [{obs.category}] {obs.description.slice(0, 50)}...
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Relationship Type
                              </label>
                              <select
                                value={linkObsRel}
                                onChange={(e) => setLinkObsRel(e.target.value as HypothesisRelationshipType)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
                              >
                                <option value="SUPPORTS">SUPPORTS</option>
                                <option value="CONTRADICTS">CONTRADICTS</option>
                                <option value="CONTEXT">CONTEXT</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Investigator Note / Correlation Reason
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Odor timing matches reported pump activity."
                              value={linkObsNote}
                              onChange={(e) => setLinkObsNote(e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
                            />
                          </div>

                          <div className="flex justify-end">
                            <button
                              type="submit"
                              disabled={linkingObs || !linkObsId}
                              className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-50"
                            >
                              {linkingObs ? 'Linking...' : 'Link Observation to Hypothesis'}
                            </button>
                          </div>
                        </form>
                      )}
                    </div>

                    {/* Linked Observations List */}
                    <div className="space-y-4">
                      {/* Supporting */}
                      <div>
                        <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <EyeIcon className="h-4 w-4 text-emerald-600" />
                          Supporting Observations (
                          {
                            hypothesisDetail.observation_links.filter((l) => l.relationship_type === 'SUPPORTS')
                              .length
                          }
                          )
                        </h4>
                        {hypothesisDetail.observation_links.filter((l) => l.relationship_type === 'SUPPORTS')
                          .length === 0 ? (
                          <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-lg border border-slate-100">
                            No supporting observations linked.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {hypothesisDetail.observation_links
                              .filter((l) => l.relationship_type === 'SUPPORTS')
                              .map((link) => (
                                <div
                                  key={link.id}
                                  className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-3 flex items-start justify-between gap-3 text-xs"
                                >
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-900">
                                        Observation #{link.observation_id}
                                      </span>
                                      <span className="text-slate-500 capitalize">
                                        [{link.observation?.category.replace('_', ' ')}]
                                      </span>
                                    </div>
                                    <p className="mt-1 text-slate-700 text-xs">
                                      {link.observation?.description}
                                    </p>
                                    {link.note && (
                                      <p className="mt-1 text-slate-500 text-[11px] italic">
                                        Note: {link.note}
                                      </p>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => handleUnlinkObservation(link.observation_id)}
                                    className="text-red-500 hover:text-red-700 text-[11px] font-medium shrink-0"
                                  >
                                    Unlink
                                  </button>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>

                      {/* Contradicting */}
                      <div>
                        <h4 className="text-xs font-bold text-rose-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <AlertCircleIcon className="h-4 w-4 text-rose-600" />
                          Contradicting Observations (
                          {
                            hypothesisDetail.observation_links.filter((l) => l.relationship_type === 'CONTRADICTS')
                              .length
                          }
                          )
                        </h4>
                        {hypothesisDetail.observation_links.filter((l) => l.relationship_type === 'CONTRADICTS')
                          .length === 0 ? (
                          <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-lg border border-slate-100">
                            No contradicting observations linked.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {hypothesisDetail.observation_links
                              .filter((l) => l.relationship_type === 'CONTRADICTS')
                              .map((link) => (
                                <div
                                  key={link.id}
                                  className="rounded-xl border border-rose-200 bg-rose-50/30 p-3 flex items-start justify-between gap-3 text-xs"
                                >
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-900">
                                        Observation #{link.observation_id}
                                      </span>
                                      <span className="text-slate-500 capitalize">
                                        [{link.observation?.category.replace('_', ' ')}]
                                      </span>
                                    </div>
                                    <p className="mt-1 text-slate-700 text-xs">
                                      {link.observation?.description}
                                    </p>
                                    {link.note && (
                                      <p className="mt-1 text-slate-500 text-[11px] italic">
                                        Note: {link.note}
                                      </p>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => handleUnlinkObservation(link.observation_id)}
                                    className="text-red-500 hover:text-red-700 text-[11px] font-medium shrink-0"
                                  >
                                    Unlink
                                  </button>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: MISSING EVIDENCE REQUIREMENTS */}
                {activeTab === 'missing' && (
                  <div className="space-y-6">
                    {/* Add Missing Requirement Form */}
                    <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-4 space-y-3">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          Record Missing Information Requirement
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Missing evidence is an information requirement, not evidence itself. Document what data must be collected to evaluate this hypothesis.
                        </p>
                      </div>

                      <form onSubmit={handleAddMissingEvidence} className="space-y-3 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                          <div className="sm:col-span-3">
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Requirement Description <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. Need upstream water sample before discharge point to confirm baseline."
                              value={missingDesc}
                              onChange={(e) => setMissingDesc(e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Priority
                            </label>
                            <select
                              value={missingPriority}
                              onChange={(e) => setMissingPriority(e.target.value as RequirementPriorityType)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
                            >
                              <option value="HIGH">HIGH</option>
                              <option value="MEDIUM">MEDIUM</option>
                              <option value="LOW">LOW</option>
                            </select>
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <button
                            type="submit"
                            disabled={addingMissing || !missingDesc.trim()}
                            className="rounded-lg bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition disabled:opacity-50"
                          >
                            {addingMissing ? 'Adding...' : 'Add Requirement'}
                          </button>
                        </div>
                      </form>
                    </div>

                    {/* Requirements List */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Information Requirements ({hypothesisDetail.missing_evidence.length})
                      </h4>
                      {hypothesisDetail.missing_evidence.length === 0 ? (
                        <p className="text-xs text-slate-400 italic bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                          No missing evidence requirements recorded for this hypothesis yet.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {hypothesisDetail.missing_evidence.map((req) => (
                            <div
                              key={req.id}
                              className={`rounded-xl border p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs ${
                                req.status === 'COLLECTED'
                                  ? 'bg-emerald-50/40 border-emerald-200'
                                  : req.status === 'OPEN'
                                  ? 'bg-white border-slate-200'
                                  : 'bg-slate-50 border-slate-200 opacity-70'
                              }`}
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${getPriorityBadge(
                                      req.priority
                                    )}`}
                                  >
                                    {req.priority} PRIORITY
                                  </span>
                                  <span
                                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${
                                      req.status === 'OPEN'
                                        ? 'bg-amber-100 text-amber-800 border-amber-200'
                                        : req.status === 'COLLECTED'
                                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                        : 'bg-slate-100 text-slate-700 border-slate-200'
                                    }`}
                                  >
                                    {req.status}
                                  </span>
                                </div>
                                <p className="text-slate-800 text-xs font-medium">
                                  {req.description}
                                </p>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {req.status === 'OPEN' ? (
                                  <>
                                    <button
                                      onClick={() => handleUpdateMissingStatus(req.id, 'COLLECTED')}
                                      className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 transition"
                                    >
                                      Mark Collected
                                    </button>
                                    <button
                                      onClick={() => handleUpdateMissingStatus(req.id, 'NOT_AVAILABLE')}
                                      className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 transition"
                                    >
                                      Unavailable
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    onClick={() => handleUpdateMissingStatus(req.id, 'OPEN')}
                                    className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 transition"
                                  >
                                    Re-open
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteMissingEvidence(req.id)}
                                  className="text-red-500 hover:text-red-700 text-[11px] font-medium ml-1"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 4: TIMELINE / ACTIVITY HISTORY */}
                {activeTab === 'timeline' && (
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Hypothesis Audit Timeline
                    </h4>
                    {hypothesisDetail.timeline_entries.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No activity logged yet.</p>
                    ) : (
                      <div className="relative pl-6 space-y-3 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                        {hypothesisDetail.timeline_entries.map((entry) => (
                          <div key={entry.id} className="relative">
                            <span className="absolute -left-6 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-4 ring-white" />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-800">{entry.title}</span>
                                <span className="text-[11px] text-slate-400">
                                  {new Date(entry.event_timestamp).toLocaleString()}
                                </span>
                              </div>
                              {entry.description && (
                                <p className="mt-0.5 text-xs text-slate-600">{entry.description}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )}
</div>
);
}

