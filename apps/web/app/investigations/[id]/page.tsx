'use client';

import React, { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth-context';
import { AppShell } from '../../../components/AppShell';
import { EvidenceSection } from '../../../components/EvidenceSection';
import { EvidenceGapsCard } from '../../../components/EvidenceGapsCard';
import { HypothesisWorkspace } from '../../../components/HypothesisWorkspace';
import { ActionVerificationWorkspace } from '../../../components/ActionVerificationWorkspace';
import {
  investigationsApi,
  InvestigationDetail,
  Observation,
  CreateObservationPayload,
  InvestigationStatusType,
  ObservationSeverityType,
  ObservationSourceType,
  GeoJSONFeature,
} from '../../../lib/api';
import {
  FileTextIcon,
  MapPinIcon,
  PlusIcon,
  ArrowRightIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  CloseIcon,
  ActivityIcon,
  EyeIcon,
  ShieldCheckIcon,
} from '../../../components/Icons';

// Dynamically import mini map preview with SSR disabled
const EnvironmentalMap = dynamic(
  () => import('../../../components/EnvironmentalMap').then((m) => m.EnvironmentalMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[240px] w-full items-center justify-center rounded-xl bg-slate-100 text-slate-400">
        <span className="text-xs">Loading GIS Preview...</span>
      </div>
    ),
  }
);

interface PageProps {
  params: {
    id: string;
  };
}

export default function InvestigationDetailPage({ params }: PageProps) {
  const router = useRouter();
  const { user } = useAuth();
  const investigationId = parseInt(params.id, 10);

  const [investigation, setInvestigation] = useState<InvestigationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status updating
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Add Observation Modal State
  const [isAddObsModalOpen, setIsAddObsModalOpen] = useState(false);
  const [obsCategory, setObsCategory] = useState('water_pollution');
  const [obsDescription, setObsDescription] = useState('');
  const [obsSeverity, setObsSeverity] = useState<ObservationSeverityType>('moderate');
  const [obsSourceType, setObsSourceType] = useState<ObservationSourceType>('observed');
  const [obsConfidence, setObsConfidence] = useState<number>(80);
  const [obsSubmitting, setObsSubmitting] = useState(false);
  const [obsError, setObsError] = useState<string | null>(null);

  // Delete observation state
  const [deletingObsId, setDeletingObsId] = useState<number | null>(null);

  const loadInvestigation = async () => {
    if (isNaN(investigationId)) {
      setError('Invalid investigation ID.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await investigationsApi.get(investigationId);
      setInvestigation(data);
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve investigation.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && !isNaN(investigationId)) {
      loadInvestigation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, investigationId]);

  const handleStatusChange = async (newStatus: InvestigationStatusType) => {
    if (!investigation) return;
    try {
      setUpdatingStatus(true);
      await investigationsApi.patch(investigation.id, { status: newStatus });
      await loadInvestigation();
    } catch (err: any) {
      alert(err.message || 'Failed to update investigation status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleAddObservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!obsDescription.trim()) {
      setObsError('Observation description is required.');
      return;
    }

    setObsSubmitting(true);
    setObsError(null);

    try {
      const payload: CreateObservationPayload = {
        category: obsCategory,
        description: obsDescription.trim(),
        severity: obsSeverity,
        source_type: obsSourceType,
        confidence: obsConfidence,
      };

      await investigationsApi.createObservation(investigationId, payload);
      setIsAddObsModalOpen(false);
      setObsDescription('');
      await loadInvestigation();
    } catch (err: any) {
      setObsError(err.message || 'Failed to record observation.');
    } finally {
      setObsSubmitting(false);
    }
  };

  const handleDeleteObservation = async (obsId: number) => {
    if (!confirm('Are you sure you want to remove this observation?')) return;
    try {
      setDeletingObsId(obsId);
      await investigationsApi.deleteObservation(investigationId, obsId);
      await loadInvestigation();
    } catch (err: any) {
      alert(err.message || 'Failed to delete observation.');
    } finally {
      setDeletingObsId(null);
    }
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'active':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'under_review':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'resolved':
      case 'completed':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'draft':
      default:
        return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'critical':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'high':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'moderate':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'low':
      default:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
  };

  const getSourceTypeBadge = (source: string) => {
    switch (source) {
      case 'observed':
        return { label: 'Observed Field Evidence', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
      case 'user_reported':
        return { label: 'User Reported', cls: 'bg-blue-50 text-blue-800 border-blue-200' };
      case 'inferred':
        return { label: 'Inferred / Modelled', cls: 'bg-purple-50 text-purple-800 border-purple-200' };
      case 'estimated':
        return { label: 'Estimated', cls: 'bg-amber-50 text-amber-800 border-amber-200' };
      default:
        return { label: 'Needs Verification', cls: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  };

  // Convert single investigation location to GeoJSON feature for mini preview map
  const mapFeatures: GeoJSONFeature[] = useMemo(() => {
    if (
      !investigation ||
      !investigation.location ||
      investigation.location.latitude === null ||
      investigation.location.longitude === null
    ) {
      return [];
    }
    return [
      {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [investigation.location.longitude, investigation.location.latitude],
        },
        properties: {
          id: investigation.id,
          title: investigation.title,
          category: investigation.category,
          status: investigation.status,
          created_at: investigation.created_at,
          observation_count: investigation.observations.length,
          accuracy_meters: investigation.location.accuracy_meters,
          location_type: investigation.location.location_type,
          description: investigation.description,
        },
      },
    ];
  }, [investigation]);

  if (loading) {
    return (
      <AppShell title="Investigation Workspace">
        <div className="flex h-96 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-emerald-600 border-t-transparent" />
            <p className="text-xs font-medium text-slate-500">Loading investigation workspace...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error || !investigation) {
    return (
      <AppShell title="Investigation Workspace">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <AlertCircleIcon className="mx-auto h-8 w-8 text-red-600 mb-2" />
          <h3 className="text-base font-bold text-red-900">Investigation Unavailable</h3>
          <p className="mt-1 text-xs text-red-700 max-w-md mx-auto">{error || 'Record not found.'}</p>
          <div className="mt-4">
            <Link
              href="/investigations"
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition"
            >
              Back to Investigations
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const hasCoordinates =
    investigation.location &&
    investigation.location.latitude !== null &&
    investigation.location.longitude !== null;

  return (
    <AppShell
      title={`Investigation #${investigation.id}`}
      headerAction={
        <div className="flex items-center gap-2">
          <Link
            href="/investigations"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            ← All Investigations
          </Link>
          {hasCoordinates && (
            <Link
              href={`/map?id=${investigation.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition"
            >
              <MapPinIcon className="h-3.5 w-3.5" />
              View on Map
            </Link>
          )}
        </div>
      }
    >
      {/* 1. Investigation Workspace Header Card */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold capitalize ${getStatusBadge(
                  investigation.status
                )}`}
              >
                {investigation.status.replace('_', ' ')}
              </span>

              <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold capitalize text-slate-700">
                {investigation.category.replace('_', ' ')}
              </span>

              <span className="text-xs text-slate-400">
                Created {new Date(investigation.created_at).toLocaleDateString()}
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              {investigation.title}
            </h1>

            {investigation.description ? (
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-3xl">
                {investigation.description}
              </p>
            ) : (
              <p className="text-xs text-slate-400 italic">No description provided for this case.</p>
            )}
          </div>

          {/* Status Workflow Selector */}
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Workflow Status
            </label>
            <select
              value={investigation.status}
              disabled={updatingStatus}
              onChange={(e) => handleStatusChange(e.target.value as InvestigationStatusType)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-xs hover:border-slate-300 focus:border-emerald-500 focus:outline-none"
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="under_review">Under Review</option>
              <option value="resolved">Resolved</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Observations Workspace & Timeline (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* 2. Observations Evidence Panel */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <EyeIcon className="h-5 w-5 text-emerald-600" />
                  Recorded Observations ({investigation.observations.length})
                </h2>
                <p className="text-xs text-slate-500">
                  Evidence-first: verifiable field indicators, sensory records, and verified measurements.
                </p>
              </div>

              <button
                onClick={() => setIsAddObsModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition"
              >
                <PlusIcon className="h-4 w-4" />
                Add Observation
              </button>
            </div>

            {investigation.observations.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
                <FileTextIcon className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                <h4 className="text-xs font-bold text-slate-700">No observations recorded yet</h4>
                <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                  Document physical findings, sensory indicators (odor, water color), or scientific evidence.
                </p>
                <button
                  onClick={() => setIsAddObsModalOpen(true)}
                  className="mt-3 inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-slate-50 transition"
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                  Record First Observation
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {investigation.observations.map((obs) => {
                  const srcBadge = getSourceTypeBadge(obs.source_type);
                  return (
                    <div
                      key={obs.id}
                      className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 transition hover:bg-white hover:shadow-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${getSeverityBadge(
                              obs.severity
                            )}`}
                          >
                            {obs.severity}
                          </span>

                          <span
                            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${srcBadge.cls}`}
                          >
                            {srcBadge.label}
                          </span>

                          <span className="text-[11px] font-semibold text-slate-500 capitalize">
                            {obs.category.replace('_', ' ')}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-[11px] text-slate-400">
                            {new Date(obs.observed_at || obs.created_at).toLocaleString()}
                          </span>
                          <button
                            onClick={() => handleDeleteObservation(obs.id)}
                            disabled={deletingObsId === obs.id}
                            className="text-[11px] text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
                          >
                            {deletingObsId === obs.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </div>

                      <p className="mt-2 text-xs text-slate-700 leading-relaxed font-normal">
                        {obs.description}
                      </p>

                      {obs.confidence > 0 && (
                        <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
                          <span className="font-medium">Confidence:</span>
                          <span className="font-semibold text-slate-700">{obs.confidence}%</span>
                        </div>
                      )}

                      {obs.evidence_ids && obs.evidence_ids.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-slate-500">
                            Supporting Evidence ({obs.evidence_count}):
                          </span>
                          {obs.evidence_ids.map((evId) => {
                            const evItem = investigation.evidence?.find((e) => e.id === evId);
                            return (
                              <span
                                key={evId}
                                className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 border border-slate-200"
                              >
                                {evItem?.evidence_type === 'image' ? '📷' : '📄'}{' '}
                                {evItem?.original_filename || `Evidence #${evId}`}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. Evidence Intelligence Panel */}
          <EvidenceSection
            investigationId={investigation.id}
            evidence={investigation.evidence || []}
            observations={investigation.observations || []}
            investigationLocation={investigation.location}
            onEvidenceChanged={loadInvestigation}
          />

          {/* 4. Root-Cause Hypotheses Workspace (Phase 8A) */}
          <HypothesisWorkspace
            investigationId={investigation.id}
            evidenceList={investigation.evidence || []}
            observationsList={investigation.observations || []}
            onHypothesisChanged={loadInvestigation}
          />

          {/* 5. Remediation & Action Verification Workspace (Phase 8C) */}
          <ActionVerificationWorkspace
            investigationId={investigation.id}
            evidenceList={investigation.evidence || []}
            observationsList={investigation.observations || []}
            timelineEntries={investigation.timeline_entries || []}
            onActionChanged={loadInvestigation}
          />

          {/* 6. Investigation Audit Timeline */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-1">
              <ActivityIcon className="h-5 w-5 text-emerald-600" />
              Investigation Timeline
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Chronological immutable event log of all case updates, evidence attachments, and status changes.
            </p>

            {investigation.timeline_entries.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No timeline events recorded yet.</p>
            ) : (
              <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {investigation.timeline_entries.map((entry) => (
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
                        <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">
                          {entry.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Location Card & Mini Map Preview (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* STEP 6: LOCATION CARD WITH MINI MAP PREVIEW */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <MapPinIcon className="h-4 w-4 text-emerald-600" />
                Spatial Location
              </h3>
              {hasCoordinates && (
                <Link
                  href={`/map?id=${investigation.id}`}
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition"
                >
                  View on Map →
                </Link>
              )}
            </div>

            {hasCoordinates ? (
              <div className="space-y-3">
                {/* Interactive Mini Map Preview */}
                <div className="rounded-xl overflow-hidden border border-slate-200 shadow-xs">
                  <EnvironmentalMap
                    features={mapFeatures}
                    selectedFeatureId={investigation.id}
                    initialCenter={[
                      investigation.location!.longitude,
                      investigation.location!.latitude,
                    ]}
                    initialZoom={12}
                    height="220px"
                    showControls={false}
                    interactive={true}
                  />
                </div>

                {/* Coordinate Information Table */}
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Latitude:</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {investigation.location!.latitude.toFixed(6)}°
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Longitude:</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {investigation.location!.longitude.toFixed(6)}°
                    </span>
                  </div>
                  {investigation.location!.accuracy_meters !== null && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Accuracy:</span>
                      <span className="font-semibold text-slate-800">
                        ±{investigation.location!.accuracy_meters} meters
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Spatial Geometry:</span>
                    <span className="font-semibold text-emerald-700 uppercase text-[11px]">
                      PostGIS Point (SRID 4326)
                    </span>
                  </div>
                </div>

                <Link
                  href={`/map?id=${investigation.id}`}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition"
                >
                  <MapPinIcon className="h-3.5 w-3.5" />
                  View on Full GIS Map
                </Link>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
                <MapPinIcon className="mx-auto h-6 w-6 text-slate-300 mb-2" />
                <p className="font-medium text-slate-700">No spatial coordinates attached</p>
                <p className="mt-1 text-slate-400">
                  This investigation does not currently have GPS coordinates anchored in PostGIS.
                </p>
              </div>
            )}
          </div>

          {/* Evidence Gaps & Needs */}
          <EvidenceGapsCard
            investigationId={investigation.id}
            onOpenAddObservation={() => setIsAddObsModalOpen(true)}
          />

          {/* Quick Case Metadata */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs text-xs space-y-3">
            <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
              Case Intelligence
            </h4>
            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Investigation ID:</span>
              <span className="font-mono font-bold text-slate-700">#{investigation.id}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Owner ID:</span>
              <span className="font-mono text-slate-700">User #{investigation.owner_id}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Recorded Observations:</span>
              <span className="font-bold text-slate-700">
                {investigation.observations.length} items
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Total Evidence Files:</span>
              <span className="font-bold text-emerald-700">
                {investigation.evidence?.length ?? 0} files
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-500">Last Updated:</span>
              <span className="text-slate-700">
                {new Date(investigation.updated_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Add Observation Modal */}
      {isAddObsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                  <EyeIcon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Record Field Observation</h3>
                  <p className="text-[11px] text-slate-500">Add physical evidence to this investigation</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddObsModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            {obsError && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-800 flex items-center gap-2">
                <AlertCircleIcon className="h-4 w-4 text-red-600 shrink-0" />
                <span>{obsError}</span>
              </div>
            )}

            <form onSubmit={handleAddObservation} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Category
                </label>
                <select
                  value={obsCategory}
                  onChange={(e) => setObsCategory(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="water_pollution">Water Pollution</option>
                  <option value="vegetation_loss">Vegetation Loss</option>
                  <option value="waste_accumulation">Waste Accumulation</option>
                  <option value="air_quality">Air Quality</option>
                  <option value="soil_contamination">Soil Contamination</option>
                  <option value="general">General / Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description & Evidence Details *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Record verifiable facts, visual indicators, sensor readings, or sample observations..."
                  value={obsDescription}
                  onChange={(e) => setObsDescription(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Severity
                  </label>
                  <select
                    value={obsSeverity}
                    onChange={(e) => setObsSeverity(e.target.value as ObservationSeverityType)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="low">Low</option>
                    <option value="moderate">Moderate</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Source Classification
                  </label>
                  <select
                    value={obsSourceType}
                    onChange={(e) => setObsSourceType(e.target.value as ObservationSourceType)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="observed">Observed (Field Evidence)</option>
                    <option value="user_reported">User Reported</option>
                    <option value="estimated">Estimated</option>
                    <option value="inferred">Inferred</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Confidence Level</label>
                  <span className="text-xs font-bold text-emerald-700">{obsConfidence}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={obsConfidence}
                  onChange={(e) => setObsConfidence(parseInt(e.target.value, 10))}
                  className="w-full accent-emerald-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddObsModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={obsSubmitting}
                  className="rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition"
                >
                  {obsSubmitting ? 'Recording...' : 'Save Observation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
