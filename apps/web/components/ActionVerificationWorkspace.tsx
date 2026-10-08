'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  actionsApi,
  hypothesesApi,
  Hypothesis,
  ActionPlan,
  ActionDetail,
  ActionPlanStatus,
  ActionPlanPriority,
  MeasurementType,
  ComparisonOperator,
  ActionRelationshipType,
  VerificationStatus,
  CriterionResultStatus,
  Evidence,
  Observation,
  TimelineEntry,
} from '../lib/api';
import {
  CheckCircleIcon,
  AlertCircleIcon,
  PlusIcon,
  CloseIcon,
  EyeIcon,
  ClockIcon,
  TrashIcon,
  FileTextIcon,
  ActivityIcon,
  ShieldCheckIcon,
} from './Icons';

interface ActionVerificationWorkspaceProps {
  investigationId: number;
  evidenceList: Evidence[];
  observationsList: Observation[];
  timelineEntries?: TimelineEntry[];
  hypothesesList?: { id: number; title: string }[];
  onActionChanged?: () => void;
}

export function ActionVerificationWorkspace({
  investigationId,
  evidenceList,
  observationsList,
  timelineEntries = [],
  hypothesesList = [],
  onActionChanged,
}: ActionVerificationWorkspaceProps) {
  const [actions, setActions] = useState<ActionPlan[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Status Filter
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Selected Action for Detail View / Modal
  const [selectedActionId, setSelectedActionId] = useState<number | null>(null);
  const [actionDetail, setActionDetail] = useState<ActionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'criteria' | 'evidence' | 'observations' | 'verification' | 'activity'
  >('overview');

  // Create Action Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createRationale, setCreateRationale] = useState('');
  const [createHypothesisId, setCreateHypothesisId] = useState<string>('');
  const [createPriority, setCreatePriority] = useState<ActionPlanPriority>('MEDIUM');
  const [createResponsiblePerson, setCreateResponsiblePerson] = useState('');
  const [createPlannedStart, setCreatePlannedStart] = useState('');
  const [createTargetDate, setCreateTargetDate] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Add Criterion Modal State
  const [isAddCriterionOpen, setIsAddCriterionOpen] = useState<boolean>(false);
  const [critDescription, setCritDescription] = useState('');
  const [critMeasurementType, setCritMeasurementType] = useState<MeasurementType>('NUMERIC');
  const [critTargetValue, setCritTargetValue] = useState<string>('');
  const [critTargetUnit, setCritTargetUnit] = useState<string>('');
  const [critComparisonOp, setCritComparisonOp] = useState<ComparisonOperator>('LTE');
  const [addingCriterion, setAddingCriterion] = useState(false);

  // Link Evidence Modal State
  const [isLinkEvidenceOpen, setIsLinkEvidenceOpen] = useState<boolean>(false);
  const [linkEvidenceId, setLinkEvidenceId] = useState<string>('');
  const [linkEvidenceRel, setLinkEvidenceRel] = useState<ActionRelationshipType>('BEFORE_ACTION');
  const [linkEvidenceNote, setLinkEvidenceNote] = useState('');
  const [linkingEvidence, setLinkingEvidence] = useState(false);

  // Link Observation Modal State
  const [isLinkObsOpen, setIsLinkObsOpen] = useState<boolean>(false);
  const [linkObsId, setLinkObsId] = useState<string>('');
  const [linkObsRel, setLinkObsRel] = useState<ActionRelationshipType>('BEFORE_ACTION');
  const [linkObsNote, setLinkObsNote] = useState('');
  const [linkingObs, setLinkingObs] = useState(false);

  // Record Verification Modal State
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState<boolean>(false);
  const [verifySummary, setVerifySummary] = useState('');
  const [verifyUncertainty, setVerifyUncertainty] = useState('');
  const [verifyStatusOverride, setVerifyStatusOverride] = useState<string>('');
  const [criterionInputs, setCriterionInputs] = useState<
    Record<
      number,
      {
        result: CriterionResultStatus;
        observed_value: string;
        observed_unit: string;
        note: string;
      }
    >
  >({});
  const [submittingVerification, setSubmittingVerification] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const [loadedHypotheses, setLoadedHypotheses] = useState<{ id: number; title: string }[]>([]);

  useEffect(() => {
    if (hypothesesList && hypothesesList.length > 0) {
      setLoadedHypotheses(hypothesesList);
    } else {
      hypothesesApi
        .list(investigationId)
        .then((data) => {
          setLoadedHypotheses(data.map((h) => ({ id: h.id, title: h.title })));
        })
        .catch(() => {});
    }
  }, [investigationId, hypothesesList]);

  const fetchActions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await actionsApi.list(
        investigationId,
        statusFilter === 'ALL' ? undefined : statusFilter
      );
      setActions(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load actions.');
    } finally {
      setLoading(false);
    }
  }, [investigationId, statusFilter]);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  const loadActionDetail = async (actionId: number) => {
    try {
      setLoadingDetail(true);
      setDetailError(null);
      const detail = await actionsApi.get(investigationId, actionId);
      setActionDetail(detail);
      setSelectedActionId(actionId);
    } catch (err: any) {
      setDetailError(err.message || 'Failed to load action details.');
    } finally {
      setLoadingDetail(false);
    }
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setCreateTitle('');
    setCreateDescription('');
    setCreateRationale('');
    setCreateHypothesisId('');
    setCreatePriority('MEDIUM');
    setCreateResponsiblePerson('');
    setCreatePlannedStart('');
    setCreateTargetDate('');
    setCreateError(null);
    setIsCreateModalOpen(true);
  };

  // Submit Create Action
  const handleCreateAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTitle.trim()) {
      setCreateError('Title is required.');
      return;
    }
    try {
      setCreating(true);
      setCreateError(null);
      const newAction = await actionsApi.create(investigationId, {
        title: createTitle.trim(),
        description: createDescription.trim() || undefined,
        rationale: createRationale.trim() || undefined,
        hypothesis_id: createHypothesisId ? parseInt(createHypothesisId, 10) : undefined,
        priority: createPriority,
        responsible_person: createResponsiblePerson.trim() || undefined,
        planned_start_date: createPlannedStart ? new Date(createPlannedStart).toISOString() : undefined,
        target_date: createTargetDate ? new Date(createTargetDate).toISOString() : undefined,
      });
      setIsCreateModalOpen(false);
      await fetchActions();
      if (onActionChanged) onActionChanged();
      // Open detail view for new action
      await loadActionDetail(newAction.id);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create action plan.');
    } finally {
      setCreating(false);
    }
  };

  // Update Action Status
  const handleUpdateStatus = async (newStatus: ActionPlanStatus) => {
    if (!actionDetail) return;
    try {
      const updated = await actionsApi.update(investigationId, actionDetail.id, {
        status: newStatus,
      });
      setActionDetail(updated);
      await fetchActions();
      if (onActionChanged) onActionChanged();
    } catch (err: any) {
      alert(err.message || 'Failed to update action status.');
    }
  };

  // Delete Action
  const handleDeleteAction = async () => {
    if (!actionDetail) return;
    if (!confirm('Are you sure you want to delete this action plan? This will also remove criteria and verification logs.')) return;
    try {
      await actionsApi.delete(investigationId, actionDetail.id);
      setSelectedActionId(null);
      setActionDetail(null);
      await fetchActions();
      if (onActionChanged) onActionChanged();
    } catch (err: any) {
      alert(err.message || 'Failed to delete action plan.');
    }
  };

  // Add Criterion
  const handleAddCriterion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionDetail || !critDescription.trim()) return;
    try {
      setAddingCriterion(true);
      await actionsApi.addCriterion(investigationId, actionDetail.id, {
        description: critDescription.trim(),
        measurement_type: critMeasurementType,
        target_value: critTargetValue ? parseFloat(critTargetValue) : null,
        target_unit: critTargetUnit.trim() || null,
        comparison_operator: critMeasurementType === 'NUMERIC' ? critComparisonOp : null,
      });
      setIsAddCriterionOpen(false);
      setCritDescription('');
      setCritTargetValue('');
      setCritTargetUnit('');
      const refreshed = await actionsApi.get(investigationId, actionDetail.id);
      setActionDetail(refreshed);
      await fetchActions();
      if (onActionChanged) onActionChanged();
    } catch (err: any) {
      alert(err.message || 'Failed to add criterion.');
    } finally {
      setAddingCriterion(false);
    }
  };

  // Delete Criterion
  const handleDeleteCriterion = async (criterionId: number) => {
    if (!actionDetail) return;
    if (!confirm('Delete this verification criterion?')) return;
    try {
      await actionsApi.deleteCriterion(investigationId, actionDetail.id, criterionId);
      const refreshed = await actionsApi.get(investigationId, actionDetail.id);
      setActionDetail(refreshed);
      await fetchActions();
      if (onActionChanged) onActionChanged();
    } catch (err: any) {
      alert(err.message || 'Failed to delete criterion.');
    }
  };

  // Link Evidence
  const handleLinkEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionDetail || !linkEvidenceId) return;
    try {
      setLinkingEvidence(true);
      await actionsApi.linkEvidence(investigationId, actionDetail.id, {
        evidence_id: parseInt(linkEvidenceId, 10),
        relationship_type: linkEvidenceRel,
        note: linkEvidenceNote.trim() || undefined,
      });
      setIsLinkEvidenceOpen(false);
      setLinkEvidenceId('');
      setLinkEvidenceNote('');
      const refreshed = await actionsApi.get(investigationId, actionDetail.id);
      setActionDetail(refreshed);
      await fetchActions();
      if (onActionChanged) onActionChanged();
    } catch (err: any) {
      alert(err.message || 'Failed to link evidence.');
    } finally {
      setLinkingEvidence(false);
    }
  };

  // Unlink Evidence
  const handleUnlinkEvidence = async (evidenceId: number) => {
    if (!actionDetail) return;
    try {
      await actionsApi.unlinkEvidence(investigationId, actionDetail.id, evidenceId);
      const refreshed = await actionsApi.get(investigationId, actionDetail.id);
      setActionDetail(refreshed);
      await fetchActions();
      if (onActionChanged) onActionChanged();
    } catch (err: any) {
      alert(err.message || 'Failed to unlink evidence.');
    }
  };

  // Link Observation
  const handleLinkObservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionDetail || !linkObsId) return;
    try {
      setLinkingObs(true);
      await actionsApi.linkObservation(investigationId, actionDetail.id, {
        observation_id: parseInt(linkObsId, 10),
        relationship_type: linkObsRel,
        note: linkObsNote.trim() || undefined,
      });
      setIsLinkObsOpen(false);
      setLinkObsId('');
      setLinkObsNote('');
      const refreshed = await actionsApi.get(investigationId, actionDetail.id);
      setActionDetail(refreshed);
      await fetchActions();
      if (onActionChanged) onActionChanged();
    } catch (err: any) {
      alert(err.message || 'Failed to link observation.');
    } finally {
      setLinkingObs(false);
    }
  };

  // Unlink Observation
  const handleUnlinkObservation = async (obsId: number) => {
    if (!actionDetail) return;
    try {
      await actionsApi.unlinkObservation(investigationId, actionDetail.id, obsId);
      const refreshed = await actionsApi.get(investigationId, actionDetail.id);
      setActionDetail(refreshed);
      await fetchActions();
      if (onActionChanged) onActionChanged();
    } catch (err: any) {
      alert(err.message || 'Failed to unlink observation.');
    }
  };

  // Open Verification Modal
  const handleOpenVerifyModal = () => {
    if (!actionDetail) return;
    setVerifySummary('');
    setVerifyUncertainty('');
    setVerifyStatusOverride('');
    setVerifyError(null);

    // Initialize criterion inputs
    const initialInputs: Record<number, any> = {};
    for (const c of actionDetail.criteria) {
      initialInputs[c.id] = {
        result: 'PASS',
        observed_value: '',
        observed_unit: c.target_unit || '',
        note: '',
      };
    }
    setCriterionInputs(initialInputs);
    setIsVerifyModalOpen(true);
  };

  // Submit Verification
  const handleRecordVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionDetail) return;
    try {
      setSubmittingVerification(true);
      setVerifyError(null);

      const criterion_results = actionDetail.criteria.map((c) => {
        const inp = criterionInputs[c.id] || { result: 'NOT_ASSESSED' };
        return {
          criterion_id: c.id,
          result: inp.result,
          observed_value: inp.observed_value !== '' ? parseFloat(inp.observed_value) : null,
          observed_unit: inp.observed_unit || null,
          note: inp.note ? inp.note.trim() : null,
        };
      });

      await actionsApi.recordVerification(investigationId, actionDetail.id, {
        summary: verifySummary.trim() || undefined,
        uncertainty_notes: verifyUncertainty.trim() || undefined,
        status: (verifyStatusOverride as VerificationStatus) || undefined,
        criterion_results,
      });

      setIsVerifyModalOpen(false);
      const refreshed = await actionsApi.get(investigationId, actionDetail.id);
      setActionDetail(refreshed);
      await fetchActions();
      if (onActionChanged) onActionChanged();
    } catch (err: any) {
      setVerifyError(err.message || 'Failed to record verification.');
    } finally {
      setSubmittingVerification(false);
    }
  };

  // Compute live numeric result preview for modal
  const computeLiveNumericResult = (
    c: any,
    valStr: string
  ): 'PASS' | 'FAIL' | null => {
    if (c.measurement_type !== 'NUMERIC' || !c.comparison_operator || c.target_value == null || valStr === '') {
      return null;
    }
    const oVal = parseFloat(valStr);
    if (isNaN(oVal)) return null;
    const tVal = c.target_value;

    switch (c.comparison_operator) {
      case 'LT':
        return oVal < tVal ? 'PASS' : 'FAIL';
      case 'LTE':
        return oVal <= tVal ? 'PASS' : 'FAIL';
      case 'EQ':
        return Math.abs(oVal - tVal) < 1e-9 ? 'PASS' : 'FAIL';
      case 'GTE':
        return oVal >= tVal ? 'PASS' : 'FAIL';
      case 'GT':
        return oVal > tVal ? 'PASS' : 'FAIL';
      default:
        return null;
    }
  };

  // Badges & styling
  const getActionStatusBadge = (st: ActionPlanStatus) => {
    switch (st) {
      case 'PLANNED':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'IN_PROGRESS':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'COMPLETED':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'CANCELLED':
        return 'bg-gray-100 text-gray-500 border-gray-200 line-through';
      case 'VERIFICATION_PENDING':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'VERIFIED':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'PARTIALLY_VERIFIED':
        return 'bg-yellow-50 text-yellow-800 border-yellow-200';
      case 'NOT_VERIFIED':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getVerificationStatusBadge = (st: VerificationStatus | null) => {
    if (!st) return 'bg-slate-50 text-slate-500 border-slate-200';
    switch (st) {
      case 'VERIFIED':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'PARTIALLY_VERIFIED':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'NOT_VERIFIED':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'INCONCLUSIVE':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'PENDING':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getPriorityBadge = (p: ActionPlanPriority) => {
    switch (p) {
      case 'HIGH':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'MEDIUM':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'LOW':
        return 'bg-slate-50 text-slate-600 border-slate-200';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  const getRelationshipBadge = (r: ActionRelationshipType) => {
    switch (r) {
      case 'BEFORE_ACTION':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'DURING_ACTION':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'AFTER_ACTION':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'VERIFICATION':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  // Activity filter for this action
  const actionActivity = useMemo(() => {
    if (!actionDetail) return [];
    const searchTerms = [
      actionDetail.title.toLowerCase(),
      `action '${actionDetail.title.toLowerCase()}'`,
    ];
    return timelineEntries.filter((entry) => {
      const desc = (entry.description || '').toLowerCase();
      const title = entry.title.toLowerCase();
      const isActionType = entry.event_type.startsWith('action_') || entry.event_type.startsWith('criterion_');
      if (!isActionType) return false;
      return searchTerms.some((t) => desc.includes(t) || title.includes(t));
    });
  }, [timelineEntries, actionDetail]);

  // Available Evidence for linking
  const linkedEvIds = useMemo(() => {
    return new Set(actionDetail?.evidence_links.map((l) => l.evidence_id) || []);
  }, [actionDetail]);
  const availableEvidence = useMemo(() => {
    return evidenceList.filter((e) => !linkedEvIds.has(e.id));
  }, [evidenceList, linkedEvIds]);

  // Available Observations for linking
  const linkedObsIds = useMemo(() => {
    return new Set(actionDetail?.observation_links.map((l) => l.observation_id) || []);
  }, [actionDetail]);
  const availableObservations = useMemo(() => {
    return observationsList.filter((o) => !linkedObsIds.has(o.id));
  }, [observationsList, linkedObsIds]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-100 text-teal-800 font-bold text-xs">
              8C
            </span>
            <h2 className="text-base font-bold text-slate-900">
              Remediation & Action Verification
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-500 max-w-2xl">
            Investigator-defined remediation tracking, measurable criteria definition, post-action evidence capture, and deterministic criteria verification.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-teal-700 transition shrink-0"
        >
          <PlusIcon className="h-4 w-4" />
          New Action Plan
        </button>
      </div>

      {/* 2. Evidence-First Guardrail Banner */}
      <div className="rounded-xl border border-teal-100 bg-teal-50/70 p-3.5 text-xs text-teal-900 flex items-start gap-2.5">
        <AlertCircleIcon className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-semibold text-teal-950">Deterministic Evidence-First Guardrail: </span>
          Actions are investigator-defined. EcoIntelligence records rationale, criteria, evidence and verification. Verification does not establish causality.
        </div>
      </div>

      {/* 3. Filter Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        {[
          { key: 'ALL', label: 'All' },
          { key: 'PLANNED', label: 'Planned' },
          { key: 'IN_PROGRESS', label: 'In Progress' },
          { key: 'COMPLETED', label: 'Completed' },
          { key: 'VERIFICATION_PENDING', label: 'Verification Pending' },
          { key: 'VERIFIED', label: 'Verified' },
          { key: 'PARTIALLY_VERIFIED', label: 'Partially Verified' },
          { key: 'NOT_VERIFIED', label: 'Not Verified' },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`rounded-lg px-2.5 py-1 font-medium transition whitespace-nowrap ${
              statusFilter === f.key
                ? 'bg-teal-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 4. Action Cards Grid */}
      {loading ? (
        <div className="py-8 text-center text-xs text-slate-400">Loading action plans...</div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          {error}
        </div>
      ) : actions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
          <FileTextIcon className="mx-auto h-8 w-8 text-slate-300 mb-2" />
          <h4 className="text-xs font-bold text-slate-700">No remediation actions recorded</h4>
          <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
            Define proposed actions, document investigator rationale, establish observable criteria, and attach post-action verification evidence.
          </p>
          <button
            onClick={handleOpenCreateModal}
            className="mt-3 inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-slate-50 transition"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            Define First Action Plan
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {actions.map((act) => (
            <div
              key={act.id}
              onClick={() => loadActionDetail(act.id)}
              className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-4 transition hover:border-teal-300 hover:shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-teal-700 transition">
                    {act.title}
                  </h3>
                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${getPriorityBadge(
                      act.priority
                    )}`}
                  >
                    {act.priority}
                  </span>
                </div>

                {act.description && (
                  <p className="text-xs text-slate-600 line-clamp-2 mb-3">
                    {act.description}
                  </p>
                )}

                {/* Status Badges */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${getActionStatusBadge(
                      act.status
                    )}`}
                  >
                    Action: {act.status.replace('_', ' ')}
                  </span>

                  {act.latest_verification_status ? (
                    <span
                      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${getVerificationStatusBadge(
                        act.latest_verification_status
                      )}`}
                    >
                      Verification: {act.latest_verification_status.replace('_', ' ')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                      Unverified
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <div className="flex items-center gap-3">
                  <span>{act.criteria_count} criteria</span>
                  <span>{act.evidence_count} evidence</span>
                  <span>{act.observation_count} obs</span>
                </div>
                {act.target_date && (
                  <span className="text-slate-400">
                    Target: {new Date(act.target_date).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 5. Create Action Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                  <ShieldCheckIcon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Define Remediation Action Plan</h3>
                  <p className="text-[11px] text-slate-500">Document proposed intervention, rationale & verification targets</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            {createError && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-800 flex items-center gap-2">
                <AlertCircleIcon className="h-4 w-4 text-red-600 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateAction} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Action Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Install geotextile silt barriers along eastern grading perimeter"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Why this action was considered (Investigator Rationale) *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Explain why this action is being proposed based on observed conditions..."
                  value={createRationale}
                  onChange={(e) => setCreateRationale(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Action Description & Scope
                </label>
                <textarea
                  rows={2}
                  placeholder="Document specific steps, equipment, and implementation details..."
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-teal-500 focus:outline-none"
                />
              </div>

              {loadedHypotheses.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Related Hypothesis (Optional)
                  </label>
                  <select
                    value={createHypothesisId}
                    onChange={(e) => setCreateHypothesisId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-teal-500 focus:outline-none"
                  >
                    <option value="">None / Independent action</option>
                    {loadedHypotheses.map((h) => (
                      <option key={h.id} value={h.id}>
                        Hypothesis #{h.id}: {h.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={createPriority}
                    onChange={(e) => setCreatePriority(e.target.value as ActionPlanPriority)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-teal-500 focus:outline-none"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Responsible Person / Team
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Field Team Delta"
                    value={createResponsiblePerson}
                    onChange={(e) => setCreateResponsiblePerson(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Planned Start Date
                  </label>
                  <input
                    type="date"
                    value={createPlannedStart}
                    onChange={(e) => setCreatePlannedStart(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-teal-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Target Completion Date
                  </label>
                  <input
                    type="date"
                    value={createTargetDate}
                    onChange={(e) => setCreateTargetDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-xl bg-teal-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-teal-700 disabled:opacity-50 transition"
                >
                  {creating ? 'Saving...' : 'Create Action Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Action Detail View Modal */}
      {selectedActionId && actionDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl my-6 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${getActionStatusBadge(
                      actionDetail.status
                    )}`}
                  >
                    Action: {actionDetail.status.replace('_', ' ')}
                  </span>

                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${getPriorityBadge(
                      actionDetail.priority
                    )}`}
                  >
                    Priority: {actionDetail.priority}
                  </span>

                  {actionDetail.latest_verification_status && (
                    <span
                      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${getVerificationStatusBadge(
                        actionDetail.latest_verification_status
                      )}`}
                    >
                      Verification: {actionDetail.latest_verification_status.replace('_', ' ')}
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-bold text-slate-900">{actionDetail.title}</h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleDeleteAction}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                  title="Delete Action"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setSelectedActionId(null);
                    setActionDetail(null);
                  }}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                >
                  <CloseIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Workspace Navigation Tabs */}
            <div className="flex items-center gap-1 border-b border-slate-100 pt-3 pb-1 overflow-x-auto text-xs font-semibold">
              {[
                { key: 'overview', label: '1. Overview' },
                { key: 'criteria', label: `2. Criteria (${actionDetail.criteria.length})` },
                { key: 'evidence', label: `3. Evidence (${actionDetail.evidence_links.length})` },
                { key: 'observations', label: `4. Observations (${actionDetail.observation_links.length})` },
                { key: 'verification', label: `5. Verification (${actionDetail.verifications.length})` },
                { key: 'activity', label: `6. Activity (${actionActivity.length})` },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key as any)}
                  className={`rounded-lg px-3 py-1.5 transition whitespace-nowrap ${
                    activeTab === t.key
                      ? 'bg-teal-50 text-teal-800 font-bold border-b-2 border-teal-600'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-4 text-xs">
                  {/* Status Picker Bar */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 flex flex-wrap items-center justify-between gap-3">
                    <span className="font-semibold text-slate-700">Update Action Lifecycle Status:</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {[
                        'PLANNED',
                        'IN_PROGRESS',
                        'COMPLETED',
                        'CANCELLED',
                        'VERIFICATION_PENDING',
                      ].map((st) => (
                        <button
                          key={st}
                          onClick={() => handleUpdateStatus(st as ActionPlanStatus)}
                          className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
                            actionDetail.status === st
                              ? 'bg-teal-700 text-white border-teal-700 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {st.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Why this action was considered */}
                  <div className="rounded-xl border border-teal-100 bg-teal-50/40 p-4">
                    <h4 className="font-bold text-teal-950 mb-1 flex items-center gap-1.5">
                      <FileTextIcon className="h-4 w-4 text-teal-700" />
                      Why this action was considered (Investigator Rationale)
                    </h4>
                    <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">
                      {actionDetail.rationale || 'No rationale documented.'}
                    </p>
                  </div>

                  {actionDetail.description && (
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <h4 className="font-bold text-slate-900 mb-1">Description & Implementation Scope</h4>
                      <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {actionDetail.description}
                      </p>
                    </div>
                  )}

                  {actionDetail.hypothesis_id && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 flex items-center justify-between">
                      <div>
                        <span className="text-[11px] text-slate-500 block">Associated Hypothesis:</span>
                        <span className="font-bold text-slate-800">
                          Hypothesis #{actionDetail.hypothesis_id}: {actionDetail.hypothesis_title || 'Linked'}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-slate-600">
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Responsible</span>
                      <span className="font-semibold text-slate-800">
                        {actionDetail.responsible_person || 'Not assigned'}
                      </span>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Priority</span>
                      <span className="font-semibold text-slate-800">{actionDetail.priority}</span>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Planned Start</span>
                      <span className="font-semibold text-slate-800">
                        {actionDetail.planned_start_date
                          ? new Date(actionDetail.planned_start_date).toLocaleDateString()
                          : 'Not set'}
                      </span>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Target Date</span>
                      <span className="font-semibold text-slate-800">
                        {actionDetail.target_date
                          ? new Date(actionDetail.target_date).toLocaleDateString()
                          : 'Not set'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: CRITERIA */}
              {activeTab === 'criteria' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        Verification Criteria ({actionDetail.criteria.length})
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Measurable and observable conditions required to verify outcome.
                      </p>
                    </div>

                    <button
                      onClick={() => setIsAddCriterionOpen(true)}
                      className="inline-flex items-center gap-1 rounded-xl bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 transition"
                    >
                      <PlusIcon className="h-3.5 w-3.5" />
                      Add Criterion
                    </button>
                  </div>

                  {actionDetail.criteria.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                      No criteria defined yet. Add numeric or qualitative verification conditions.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {actionDetail.criteria.map((c) => (
                        <div
                          key={c.id}
                          className="rounded-xl border border-slate-200 bg-white p-3.5 flex items-start justify-between gap-3 text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                                {c.measurement_type}
                              </span>

                              {c.measurement_type === 'NUMERIC' && (
                                <span className="font-mono font-bold text-teal-800 text-[11px]">
                                  Target: {c.comparison_operator || '=='} {c.target_value}{' '}
                                  {c.target_unit || ''}
                                </span>
                              )}
                            </div>
                            <p className="text-slate-800">{c.description}</p>
                          </div>

                          <button
                            onClick={() => handleDeleteCriterion(c.id)}
                            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Criterion Sub-Form */}
                  {isAddCriterionOpen && (
                    <div className="rounded-xl border border-teal-200 bg-teal-50/30 p-4 space-y-3 text-xs">
                      <div className="flex items-center justify-between border-b border-teal-100 pb-2">
                        <span className="font-bold text-teal-950">Add Verification Criterion</span>
                        <button
                          onClick={() => setIsAddCriterionOpen(false)}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          <CloseIcon className="h-4 w-4" />
                        </button>
                      </div>

                      <form onSubmit={handleAddCriterion} className="space-y-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Criterion Description *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Discharge turbidity should be below documented threshold"
                            value={critDescription}
                            onChange={(e) => setCritDescription(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-teal-500"
                          />
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Measurement Type
                            </label>
                            <select
                              value={critMeasurementType}
                              onChange={(e) => setCritMeasurementType(e.target.value as MeasurementType)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none"
                            >
                              <option value="NUMERIC">NUMERIC</option>
                              <option value="OBSERVATION">OBSERVATION</option>
                              <option value="BOOLEAN">BOOLEAN</option>
                              <option value="TEXT">TEXT</option>
                            </select>
                          </div>

                          {critMeasurementType === 'NUMERIC' && (
                            <>
                              <div>
                                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                  Operator
                                </label>
                                <select
                                  value={critComparisonOp}
                                  onChange={(e) => setCritComparisonOp(e.target.value as ComparisonOperator)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none"
                                >
                                  <option value="LTE">&lt;= (LTE)</option>
                                  <option value="LT">&lt; (LT)</option>
                                  <option value="EQ">== (EQ)</option>
                                  <option value="GTE">&gt;= (GTE)</option>
                                  <option value="GT">&gt; (GT)</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                  Target Value
                                </label>
                                <input
                                  type="number"
                                  step="any"
                                  placeholder="e.g. 10.0"
                                  value={critTargetValue}
                                  onChange={(e) => setCritTargetValue(e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none"
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                  Unit
                                </label>
                                <input
                                  type="text"
                                  placeholder="e.g. NTU, mg/L"
                                  value={critTargetUnit}
                                  onChange={(e) => setCritTargetUnit(e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none"
                                />
                              </div>
                            </>
                          )}
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => setIsAddCriterionOpen(false)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={addingCriterion}
                            className="rounded-lg bg-teal-600 px-3.5 py-1 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                          >
                            {addingCriterion ? 'Saving...' : 'Add'}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: EVIDENCE */}
              {activeTab === 'evidence' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        Linked Evidence ({actionDetail.evidence_links.length})
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Corroborate pre-action condition, execution status, and post-action verification.
                      </p>
                    </div>

                    <button
                      onClick={() => setIsLinkEvidenceOpen(true)}
                      className="inline-flex items-center gap-1 rounded-xl bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 transition"
                    >
                      <PlusIcon className="h-3.5 w-3.5" />
                      Link Evidence
                    </button>
                  </div>

                  {actionDetail.evidence_links.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                      No evidence linked to this action yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {actionDetail.evidence_links.map((link) => (
                        <div
                          key={link.id}
                          className="rounded-xl border border-slate-200 bg-white p-3.5 flex items-start justify-between gap-2.5 text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <span
                                className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold border ${getRelationshipBadge(
                                  link.relationship_type
                                )}`}
                              >
                                {link.relationship_type.replace('_', ' ')}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                #{link.evidence_id}
                              </span>
                            </div>

                            <p className="font-semibold text-slate-800">
                              {link.evidence?.original_filename || `Evidence #${link.evidence_id}`}
                            </p>

                            {link.evidence?.description && (
                              <p className="text-slate-600 text-[11px] mt-1 line-clamp-2">
                                {link.evidence.description}
                              </p>
                            )}

                            {link.note && (
                              <p className="text-teal-800 text-[11px] mt-1 italic">
                                Note: {link.note}
                              </p>
                            )}
                          </div>

                          <button
                            onClick={() => handleUnlinkEvidence(link.evidence_id)}
                            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                            title="Unlink"
                          >
                            <CloseIcon className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Link Evidence Sub-Form */}
                  {isLinkEvidenceOpen && (
                    <div className="rounded-xl border border-teal-200 bg-teal-50/30 p-4 space-y-3 text-xs">
                      <div className="flex items-center justify-between border-b border-teal-100 pb-2">
                        <span className="font-bold text-teal-950">Link Investigation Evidence</span>
                        <button
                          onClick={() => setIsLinkEvidenceOpen(false)}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          <CloseIcon className="h-4 w-4" />
                        </button>
                      </div>

                      {availableEvidence.length === 0 ? (
                        <p className="text-slate-500 italic text-xs">
                          All investigation evidence is already linked to this action.
                        </p>
                      ) : (
                        <form onSubmit={handleLinkEvidence} className="space-y-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Select Evidence *
                            </label>
                            <select
                              required
                              value={linkEvidenceId}
                              onChange={(e) => setLinkEvidenceId(e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-none"
                            >
                              <option value="">-- Choose Evidence Item --</option>
                              {availableEvidence.map((ev) => (
                                <option key={ev.id} value={ev.id}>
                                  #{ev.id} - {ev.original_filename} ({ev.evidence_type})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                Relationship Classification
                              </label>
                              <select
                                value={linkEvidenceRel}
                                onChange={(e) => setLinkEvidenceRel(e.target.value as ActionRelationshipType)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-none"
                              >
                                <option value="BEFORE_ACTION">BEFORE ACTION</option>
                                <option value="DURING_ACTION">DURING ACTION</option>
                                <option value="AFTER_ACTION">AFTER ACTION</option>
                                <option value="VERIFICATION">VERIFICATION</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                Investigator Note
                              </label>
                              <input
                                type="text"
                                placeholder="Optional context..."
                                value={linkEvidenceNote}
                                onChange={(e) => setLinkEvidenceNote(e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="flex justify-end gap-2 pt-2">
                            <button
                              type="button"
                              onClick={() => setIsLinkEvidenceOpen(false)}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={linkingEvidence}
                              className="rounded-lg bg-teal-600 px-3.5 py-1 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                            >
                              {linkingEvidence ? 'Linking...' : 'Link Evidence'}
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: OBSERVATIONS */}
              {activeTab === 'observations' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        Linked Observations ({actionDetail.observation_links.length})
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Field indicators recorded before, during, or after action execution.
                      </p>
                    </div>

                    <button
                      onClick={() => setIsLinkObsOpen(true)}
                      className="inline-flex items-center gap-1 rounded-xl bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 transition"
                    >
                      <PlusIcon className="h-3.5 w-3.5" />
                      Link Observation
                    </button>
                  </div>

                  {actionDetail.observation_links.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                      No field observations linked to this action yet.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {actionDetail.observation_links.map((link) => (
                        <div
                          key={link.id}
                          className="rounded-xl border border-slate-200 bg-white p-3.5 flex items-start justify-between gap-3 text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-2 mb-1.5">
                              <span
                                className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold border ${getRelationshipBadge(
                                  link.relationship_type
                                )}`}
                              >
                                {link.relationship_type.replace('_', ' ')}
                              </span>

                              {link.observation && (
                                <span className="capitalize text-[11px] font-semibold text-slate-500">
                                  {link.observation.category.replace('_', ' ')}
                                </span>
                              )}
                            </div>

                            <p className="text-slate-800">
                              {link.observation?.description || `Observation #${link.observation_id}`}
                            </p>

                            {link.note && (
                              <p className="text-teal-800 text-[11px] mt-1 italic">
                                Note: {link.note}
                              </p>
                            )}
                          </div>

                          <button
                            onClick={() => handleUnlinkObservation(link.observation_id)}
                            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                            title="Unlink"
                          >
                            <CloseIcon className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Link Observation Sub-Form */}
                  {isLinkObsOpen && (
                    <div className="rounded-xl border border-teal-200 bg-teal-50/30 p-4 space-y-3 text-xs">
                      <div className="flex items-center justify-between border-b border-teal-100 pb-2">
                        <span className="font-bold text-teal-950">Link Field Observation</span>
                        <button
                          onClick={() => setIsLinkObsOpen(false)}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          <CloseIcon className="h-4 w-4" />
                        </button>
                      </div>

                      {availableObservations.length === 0 ? (
                        <p className="text-slate-500 italic text-xs">
                          All observations are already linked to this action.
                        </p>
                      ) : (
                        <form onSubmit={handleLinkObservation} className="space-y-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Select Observation *
                            </label>
                            <select
                              required
                              value={linkObsId}
                              onChange={(e) => setLinkObsId(e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-none"
                            >
                              <option value="">-- Choose Observation --</option>
                              {availableObservations.map((obs) => (
                                <option key={obs.id} value={obs.id}>
                                  #{obs.id} [{obs.category}] {obs.description.slice(0, 70)}...
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                Relationship Classification
                              </label>
                              <select
                                value={linkObsRel}
                                onChange={(e) => setLinkObsRel(e.target.value as ActionRelationshipType)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-none"
                              >
                                <option value="BEFORE_ACTION">BEFORE ACTION</option>
                                <option value="DURING_ACTION">DURING ACTION</option>
                                <option value="AFTER_ACTION">AFTER ACTION</option>
                                <option value="VERIFICATION">VERIFICATION</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                Investigator Note
                              </label>
                              <input
                                type="text"
                                placeholder="Optional context..."
                                value={linkObsNote}
                                onChange={(e) => setLinkObsNote(e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="flex justify-end gap-2 pt-2">
                            <button
                              type="button"
                              onClick={() => setIsLinkObsOpen(false)}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={linkingObs}
                              className="rounded-lg bg-teal-600 px-3.5 py-1 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                            >
                              {linkingObs ? 'Linking...' : 'Link Observation'}
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: VERIFICATION */}
              {activeTab === 'verification' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        Verification History ({actionDetail.verifications.length})
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Deterministic criterion checks and investigator-recorded outcomes.
                      </p>
                    </div>

                    <button
                      onClick={handleOpenVerifyModal}
                      className="inline-flex items-center gap-1 rounded-xl bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 transition"
                    >
                      <CheckCircleIcon className="h-3.5 w-3.5" />
                      Record Verification
                    </button>
                  </div>

                  {actionDetail.verifications.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
                      <ShieldCheckIcon className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                      <h5 className="text-xs font-bold text-slate-700">No verification recorded yet</h5>
                      <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                        Evaluate whether the documented criteria were observed following action completion.
                      </p>
                      <button
                        onClick={handleOpenVerifyModal}
                        className="mt-3 inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-slate-50 transition"
                      >
                        <CheckCircleIcon className="h-3.5 w-3.5" />
                        Execute Verification Assessment
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {actionDetail.verifications.map((v) => (
                        <div
                          key={v.id}
                          className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 text-xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-bold ${getVerificationStatusBadge(
                                  v.status
                                )}`}
                              >
                                Criteria {v.status.replace('_', ' ')}
                              </span>

                              <span className="text-[11px] text-slate-500">
                                Verified by <strong className="text-slate-700">{v.verifier_name || `User #${v.verified_by}`}</strong>
                              </span>
                            </div>

                            <span className="text-[11px] text-slate-400">
                              {new Date(v.verified_at).toLocaleString()}
                            </span>
                          </div>

                          {v.summary && (
                            <p className="text-slate-800 leading-relaxed font-medium">
                              {v.summary}
                            </p>
                          )}

                          {v.uncertainty_notes && (
                            <div className="rounded-lg bg-amber-50/70 border border-amber-200/60 p-2.5 text-[11px] text-amber-900">
                              <strong>Uncertainty / Caveats: </strong> {v.uncertainty_notes}
                            </div>
                          )}

                          {/* Criterion Results Table */}
                          <div className="rounded-lg border border-slate-200 overflow-hidden">
                            <div className="bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-700 border-b border-slate-200 grid grid-cols-12 gap-2">
                              <span className="col-span-5">Criterion</span>
                              <span className="col-span-2">Result</span>
                              <span className="col-span-3">Observed</span>
                              <span className="col-span-2">Mode</span>
                            </div>

                            <div className="divide-y divide-slate-100">
                              {v.criterion_results.map((res) => (
                                <div
                                  key={res.id}
                                  className="px-3 py-2 text-[11px] grid grid-cols-12 gap-2 items-center"
                                >
                                  <div className="col-span-5 text-slate-800">
                                    {res.criterion?.description || `Criterion #${res.criterion_id}`}
                                  </div>

                                  <div className="col-span-2">
                                    <span
                                      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                        res.result === 'PASS'
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : res.result === 'FAIL'
                                          ? 'bg-red-100 text-red-800'
                                          : 'bg-slate-100 text-slate-700'
                                      }`}
                                    >
                                      {res.result}
                                    </span>
                                  </div>

                                  <div className="col-span-3 text-slate-600 font-mono">
                                    {res.observed_value != null
                                      ? `${res.observed_value} ${res.observed_unit || ''}`
                                      : '—'}
                                  </div>

                                  <div className="col-span-2 text-slate-400 text-[10px] capitalize">
                                    {res.evaluation_mode === 'numeric_comparison'
                                      ? 'Numeric'
                                      : 'Investigator'}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Record Verification Modal */}
                  {isVerifyModalOpen && (
                    <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
                      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl my-8 text-xs max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                              <ShieldCheckIcon className="h-4 w-4" />
                            </div>
                            <div>
                              <h3 className="text-sm font-bold text-slate-900">
                                Record Action Verification
                              </h3>
                              <p className="text-[11px] text-slate-500">
                                Deterministic criterion assessment & investigator evaluation
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => setIsVerifyModalOpen(false)}
                            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                          >
                            <CloseIcon className="h-5 w-5" />
                          </button>
                        </div>

                        {verifyError && (
                          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">
                            {verifyError}
                          </div>
                        )}

                        <form onSubmit={handleRecordVerification} className="mt-4 space-y-4 flex-1 overflow-y-auto pr-1">
                          {/* Banner: Verification does not establish causality */}
                          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900">
                            <strong>Notice: </strong> Verification records whether the documented criteria were observed. It does not establish that the action caused the observed condition.
                          </div>

                          {/* Criteria list to evaluate */}
                          <div className="space-y-3">
                            <h4 className="font-bold text-slate-800">
                              Evaluate Criteria ({actionDetail.criteria.length})
                            </h4>

                            {actionDetail.criteria.map((c) => {
                              const currentInp = criterionInputs[c.id] || {
                                result: 'PASS',
                                observed_value: '',
                                observed_unit: c.target_unit || '',
                                note: '',
                              };

                              const liveCalc = computeLiveNumericResult(c, currentInp.observed_value);

                              return (
                                <div
                                  key={c.id}
                                  className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-2.5"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <p className="font-bold text-slate-800">{c.description}</p>
                                      {c.measurement_type === 'NUMERIC' && (
                                        <span className="font-mono text-teal-800 font-semibold text-[11px]">
                                          Target: {c.comparison_operator} {c.target_value} {c.target_unit}
                                        </span>
                                      )}
                                    </div>

                                    {liveCalc && (
                                      <span
                                        className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                                          liveCalc === 'PASS'
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : 'bg-red-100 text-red-800'
                                        }`}
                                      >
                                        Auto-calculated: {liveCalc}
                                      </span>
                                    )}
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                                    {c.measurement_type === 'NUMERIC' && (
                                      <div>
                                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                                          Observed Value
                                        </label>
                                        <input
                                          type="number"
                                          step="any"
                                          placeholder="Enter reading"
                                          value={currentInp.observed_value}
                                          onChange={(e) =>
                                            setCriterionInputs((prev) => ({
                                              ...prev,
                                              [c.id]: {
                                                ...prev[c.id],
                                                observed_value: e.target.value,
                                              },
                                            }))
                                          }
                                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs"
                                        />
                                      </div>
                                    )}

                                    <div>
                                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                                        Assessed Result
                                      </label>
                                      <select
                                        value={currentInp.result}
                                        onChange={(e) =>
                                          setCriterionInputs((prev) => ({
                                            ...prev,
                                            [c.id]: {
                                              ...prev[c.id],
                                              result: e.target.value as CriterionResultStatus,
                                            },
                                          }))
                                        }
                                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs"
                                      >
                                        <option value="PASS">PASS</option>
                                        <option value="FAIL">FAIL</option>
                                        <option value="NOT_ASSESSED">NOT ASSESSED</option>
                                        <option value="INCONCLUSIVE">INCONCLUSIVE</option>
                                      </select>
                                    </div>

                                    <div>
                                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                                        Note / Measurement Context
                                      </label>
                                      <input
                                        type="text"
                                        placeholder="Sensor # or condition"
                                        value={currentInp.note}
                                        onChange={(e) =>
                                          setCriterionInputs((prev) => ({
                                            ...prev,
                                            [c.id]: {
                                              ...prev[c.id],
                                              note: e.target.value,
                                            },
                                          }))
                                        }
                                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs"
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Verification Summary & Findings
                            </label>
                            <textarea
                              rows={2}
                              placeholder="Record observed post-action facts..."
                              value={verifySummary}
                              onChange={(e) => setVerifySummary(e.target.value)}
                              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-teal-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Uncertainty / Caveats & Confounding Factors
                            </label>
                            <textarea
                              rows={2}
                              placeholder="Document any limits of observation (weather, sensor precision, duration)..."
                              value={verifyUncertainty}
                              onChange={(e) => setVerifyUncertainty(e.target.value)}
                              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-teal-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Authoritative Status Override (Optional)
                            </label>
                            <select
                              value={verifyStatusOverride}
                              onChange={(e) => setVerifyStatusOverride(e.target.value)}
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none"
                            >
                              <option value="">Auto-derive from criteria (Recommended)</option>
                              <option value="VERIFIED">Force VERIFIED</option>
                              <option value="PARTIALLY_VERIFIED">Force PARTIALLY VERIFIED</option>
                              <option value="NOT_VERIFIED">Force NOT VERIFIED</option>
                              <option value="INCONCLUSIVE">Force INCONCLUSIVE</option>
                            </select>
                          </div>

                          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => setIsVerifyModalOpen(false)}
                              className="rounded-xl border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={submittingVerification}
                              className="rounded-xl bg-teal-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-teal-700 disabled:opacity-50"
                            >
                              {submittingVerification ? 'Recording...' : 'Record Verification'}
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 6: ACTIVITY */}
              {activeTab === 'activity' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      Action Activity Audit Trail ({actionActivity.length})
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Chronological immutable audit log of events pertaining to this action plan.
                    </p>
                  </div>

                  {actionActivity.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                      No events recorded specifically for this action in timeline yet.
                    </div>
                  ) : (
                    <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                      {actionActivity.map((entry) => (
                        <div key={entry.id} className="relative text-xs">
                          <span className="absolute -left-6 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-teal-500 ring-4 ring-white" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-800">{entry.title}</span>
                              <span className="text-[11px] text-slate-400">
                                {new Date(entry.event_timestamp).toLocaleString()}
                              </span>
                            </div>
                            {entry.description && (
                              <p className="mt-0.5 text-slate-600 leading-relaxed">
                                {entry.description}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
