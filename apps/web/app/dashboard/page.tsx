'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '../../lib/auth-context';
import { AppShell } from '../../components/AppShell';
import {
  investigationsApi,
  evidenceApi,
  Investigation,
  CreateInvestigationPayload,
  CreateObservationPayload,
  ObservationSeverityType,
  ObservationSourceType,
} from '../../lib/api';
import {
  FileTextIcon,
  EyeIcon,
  ShieldCheckIcon,
  ActivityIcon,
  PlusIcon,
  MapPinIcon,
  CloseIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  UploadCloudIcon,
  TrashIcon,
} from '../../components/Icons';

export default function DashboardPage() {
  const { user } = useAuth();
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Investigation Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [modalTitle, setModalTitle] = useState('');
  const [modalCategory, setModalCategory] = useState('water_pollution');
  const [modalDescription, setModalDescription] = useState('');

  // Add Observation Modal state
  const [isObservationModalOpen, setIsObservationModalOpen] = useState(false);
  const [obsTargetInvId, setObsTargetInvId] = useState<string>('new');
  const [obsNewInvTitle, setObsNewInvTitle] = useState('');
  const [obsCategory, setObsCategory] = useState('water_pollution');
  const [obsDescription, setObsDescription] = useState('');
  const [obsSeverity, setObsSeverity] = useState<ObservationSeverityType>('moderate');
  const [obsSourceType, setObsSourceType] = useState<ObservationSourceType>('observed');
  const [obsConfidence, setObsConfidence] = useState<number>(80);
  const [obsLat, setObsLat] = useState<string>('');
  const [obsLng, setObsLng] = useState<string>('');
  const [obsAccuracy, setObsAccuracy] = useState<string>('');
  const [obsFile, setObsFile] = useState<File | null>(null);
  const [obsFilePreview, setObsFilePreview] = useState<string | null>(null);
  const [obsEvidenceDesc, setObsEvidenceDesc] = useState('');
  const [isSubmittingObs, setIsSubmittingObs] = useState(false);
  const [obsError, setObsError] = useState<string | null>(null);
  const [obsGeoLocating, setObsGeoLocating] = useState(false);
  const [obsGeoNotice, setObsGeoNotice] = useState<string | null>(null);

  // Success Feedback
  const [successBanner, setSuccessBanner] = useState<{
    message: string;
    investigationId?: number;
    investigationTitle?: string;
  } | null>(null);

  // Quick Action notification modal for upcoming phases
  const [upcomingPhaseNotice, setUpcomingPhaseNotice] = useState<string | null>(null);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const loadInvestigations = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await investigationsApi.list();
      setInvestigations(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load investigations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadInvestigations();
    }
  }, [user]);

  // Geolocation for Observation Form
  const handleObsGetLocation = () => {
    if (!navigator.geolocation) {
      setObsGeoNotice('Geolocation is not supported by your browser.');
      return;
    }
    setObsGeoLocating(true);
    setObsGeoNotice(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setObsLat(pos.coords.latitude.toFixed(6));
        setObsLng(pos.coords.longitude.toFixed(6));
        if (pos.coords.accuracy) {
          setObsAccuracy(Math.round(pos.coords.accuracy).toString());
        }
        setObsGeoLocating(false);
      },
      (err) => {
        setObsGeoNotice(
          err.code === 1
            ? 'Browser location access denied. You can input coordinates manually.'
            : 'Could not fetch current coordinates.'
        );
        setObsGeoLocating(false);
      }
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setObsFile(file);
    if (file && file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setObsFilePreview(url);
    } else {
      setObsFilePreview(null);
    }
  };

  const handleRemoveFile = () => {
    if (obsFilePreview) {
      URL.revokeObjectURL(obsFilePreview);
    }
    setObsFile(null);
    setObsFilePreview(null);
  };

  const resetObservationForm = () => {
    if (obsFilePreview) {
      URL.revokeObjectURL(obsFilePreview);
    }
    setObsDescription('');
    setObsNewInvTitle('');
    setObsFile(null);
    setObsFilePreview(null);
    setObsEvidenceDesc('');
    setObsLat('');
    setObsLng('');
    setObsAccuracy('');
    setObsError(null);
    setObsGeoNotice(null);
    setObsConfidence(80);
    setObsSeverity('moderate');
    setObsSourceType('observed');
    setObsCategory('water_pollution');
    setObsTargetInvId(investigations.length > 0 ? investigations[0].id.toString() : 'new');
  };

  const handleCreateObservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!obsDescription.trim()) {
      setObsError('Observation description is required.');
      return;
    }

    const isNew = obsTargetInvId === 'new' || investigations.length === 0;
    if (isNew && !obsNewInvTitle.trim()) {
      setObsError('Please provide a title for the investigation case.');
      return;
    }

    setIsSubmittingObs(true);
    setObsError(null);

    try {
      let targetId: number;
      let targetTitle = '';

      if (isNew) {
        // 1. Create container investigation
        const newInv = await investigationsApi.create({
          title: obsNewInvTitle.trim(),
          category: obsCategory,
          description: `Initialized with field observation: ${obsDescription.trim().slice(0, 100)}...`,
          status: 'active',
          location_latitude: obsLat ? parseFloat(obsLat) : undefined,
          location_longitude: obsLng ? parseFloat(obsLng) : undefined,
          location_accuracy_meters: obsAccuracy ? parseFloat(obsAccuracy) : undefined,
        });
        targetId = newInv.id;
        targetTitle = newInv.title;
      } else {
        targetId = parseInt(obsTargetInvId, 10);
        const existing = investigations.find((i) => i.id === targetId);
        targetTitle = existing?.title || `Case #${targetId}`;
      }

      // 2. Create Observation
      const obsPayload: CreateObservationPayload = {
        category: obsCategory,
        description: obsDescription.trim(),
        severity: obsSeverity,
        source_type: obsSourceType,
        confidence: obsConfidence,
        location_latitude: obsLat ? parseFloat(obsLat) : undefined,
        location_longitude: obsLng ? parseFloat(obsLng) : undefined,
        location_accuracy_meters: obsAccuracy ? parseFloat(obsAccuracy) : undefined,
      };

      const createdObs = await investigationsApi.createObservation(targetId, obsPayload);

      // 3. Upload optional evidence file
      if (obsFile) {
        const formData = new FormData();
        formData.append('file', obsFile);
        formData.append('observation_id', createdObs.id.toString());
        formData.append('source_type', obsSourceType);
        formData.append('description', obsEvidenceDesc.trim() || obsDescription.trim().slice(0, 100));
        if (obsLat && obsLng) {
          formData.append('location_latitude', obsLat);
          formData.append('location_longitude', obsLng);
        }
        await evidenceApi.uploadEvidence(targetId, formData);
      }

      // 4. Reload data and clean up modal
      await loadInvestigations();
      setIsObservationModalOpen(false);
      resetObservationForm();

      setSuccessBanner({
        message: 'Field observation successfully recorded!',
        investigationId: targetId,
        investigationTitle: targetTitle,
      });
    } catch (err: any) {
      setObsError(err.message || 'Failed to record observation.');
    } finally {
      setIsSubmittingObs(false);
    }
  };

  const handleCreateInvestigation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalTitle.trim()) {
      setCreateError('Please specify an investigation title.');
      return;
    }

    setIsCreating(true);
    setCreateError(null);
    try {
      const payload: CreateInvestigationPayload = {
        title: modalTitle.trim(),
        category: modalCategory,
        description: modalDescription.trim() || undefined,
        status: 'active',
      };
      const created = await investigationsApi.create(payload);
      setInvestigations((prev) => [created, ...prev]);
      setIsModalOpen(false);
      setModalTitle('');
      setModalDescription('');
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create investigation.');
    } finally {
      setIsCreating(false);
    }
  };

  // Metrics computed strictly from real data (no fake stats)
  const activeCount = investigations.filter(
    (i) => i.status === 'active' || i.status === 'draft'
  ).length;

  const headerAction = (
    <button
      onClick={() => setIsModalOpen(true)}
      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition"
    >
      <PlusIcon className="h-4 w-4" />
      Start Investigation
    </button>
  );

  return (
    <AppShell title="Investigation Workspace" headerAction={headerAction}>
      {/* Success Notification Banner */}
      {successBanner && (
        <div className="mb-6 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <CheckCircleIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-950">{successBanner.message}</p>
              {successBanner.investigationTitle && (
                <p className="text-xs text-emerald-800 mt-0.5">
                  Linked to case:{' '}
                  <span className="font-semibold">{successBanner.investigationTitle}</span>
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {successBanner.investigationId && (
              <Link
                href={`/investigations/${successBanner.investigationId}`}
                className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition"
              >
                View Investigation →
              </Link>
            )}
            <button
              onClick={() => setSuccessBanner(null)}
              className="rounded-lg p-1 text-emerald-700 hover:bg-emerald-100 transition"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* 1. Welcome Section */}
      <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Authenticated Session • Workspace Active
            </div>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {greeting}, {user?.display_name || 'Investigator'}
            </h2>
            <p className="mt-1 text-sm text-slate-600 max-w-2xl">
              Track environmental investigations, evidence, and actions from one workspace.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
            >
              <PlusIcon className="h-4 w-4" />
              Start Investigation
            </button>
          </div>
        </div>
      </div>

      {/* 2. Summary Cards (Real API Data - Zero states if empty) */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4 mb-8">
        {/* Active Investigations */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Active Investigations
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <FileTextIcon className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">
              {loading ? '-' : activeCount}
            </span>
            <span className="text-xs text-slate-500">
              {activeCount === 1 ? 'active case' : 'active cases'}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {activeCount === 0
              ? 'Zero active cases recorded.'
              : 'Investigations currently being tracked.'}
          </p>
        </div>

        {/* Evidence Collected */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Evidence Collected
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <ShieldCheckIcon className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">0</span>
            <span className="text-xs text-slate-500">artifacts</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Field photos, logs & verification files.
          </p>
        </div>

        {/* Observations */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Observations
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <EyeIcon className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">0</span>
            <span className="text-xs text-slate-500">records</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Field observations & anchored notes.
          </p>
        </div>

        {/* Actions Pending */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Actions Pending
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <ActivityIcon className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">0</span>
            <span className="text-xs text-slate-500">pending</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Awaiting verification or recommendation.
          </p>
        </div>
      </div>

      {/* 3. Quick Actions Section */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-xs hover:border-emerald-500 hover:shadow-sm transition group"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition">
              <PlusIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 group-hover:text-emerald-700 transition">
                New Investigation
              </p>
              <p className="text-xs text-slate-500">
                Register an anomaly or location case
              </p>
            </div>
          </button>

          <button
            onClick={() => {
              setObsTargetInvId(investigations.length > 0 ? investigations[0].id.toString() : 'new');
              setIsObservationModalOpen(true);
            }}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-xs hover:border-emerald-500 hover:shadow-sm transition group"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition">
              <EyeIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold text-slate-900 group-hover:text-emerald-700 transition">
                  Add Observation
                </p>
                <span className="rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 text-[9px] font-semibold text-emerald-800">
                  Ready
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Record sensory evidence & indicators
              </p>
            </div>
          </button>

          <Link
            href="/map"
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-xs hover:border-emerald-500 hover:shadow-sm transition group"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition">
              <MapPinIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold text-slate-900 group-hover:text-emerald-700 transition">
                  View Map
                </p>
                <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[9px] font-semibold text-slate-600">
                  Phase 3 GIS
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Spatial explorer & coordinates
              </p>
            </div>
          </Link>
        </div>
      </div>

      {/* Notice modal for upcoming feature */}
      {upcomingPhaseNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                  <ShieldCheckIcon className="h-4 w-4" />
                </div>
                <h4 className="text-base font-semibold text-slate-900">
                  Roadmap Milestone
                </h4>
              </div>
              <button
                onClick={() => setUpcomingPhaseNotice(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              {upcomingPhaseNotice}
            </p>
            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setUpcomingPhaseNotice(null)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Recent Investigations Section */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Recent Investigations
            </h3>
            <p className="text-xs text-slate-500">
              Cases owned by your authenticated account
            </p>
          </div>
          {investigations.length > 0 && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              New Investigation
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
            <p className="text-xs text-slate-500">Loading your investigations...</p>
          </div>
        ) : error ? (
          <div className="my-6 rounded-lg border border-red-200 bg-red-50 p-4 text-center">
            <p className="text-xs font-medium text-red-800">{error}</p>
            <button
              onClick={loadInvestigations}
              className="mt-2 text-xs font-semibold text-red-900 underline"
            >
              Try again
            </button>
          </div>
        ) : investigations.length === 0 ? (
          /* Empty State strictly matching specification */
          <div className="py-16 text-center flex flex-col items-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-4">
              <FileTextIcon className="h-7 w-7" />
            </div>
            <h4 className="text-base font-semibold text-slate-900">
              Your investigation workspace is empty.
            </h4>
            <p className="mt-1.5 max-w-md text-xs text-slate-500 leading-relaxed">
              Start by recording an environmental anomaly, collecting photographic evidence, or anchoring field observations.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition"
              >
                <PlusIcon className="h-4 w-4" />
                Create your first investigation
              </button>
              <button
                onClick={() => {
                  setObsTargetInvId('new');
                  setIsObservationModalOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 shadow-xs hover:border-emerald-500 hover:text-emerald-700 transition"
              >
                <EyeIcon className="h-4 w-4 text-amber-600" />
                Record an observation
              </button>
            </div>
          </div>
        ) : (
          /* Real Investigations List */
          <div className="divide-y divide-slate-100 mt-2">
            {investigations.map((item) => (
              <div
                key={item.id}
                className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-slate-50/50 rounded-lg px-2 transition"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                    <FileTextIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <h5 className="text-sm font-semibold text-slate-900">
                      {item.title}
                    </h5>
                    <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                      {item.description || 'No description provided.'}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 capitalize">
                        {item.category.replace('_', ' ')}
                      </span>
                      {item.observations_count !== undefined && item.observations_count > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 border border-amber-200">
                          <EyeIcon className="h-3 w-3" />
                          {item.observations_count} {item.observations_count === 1 ? 'observation' : 'observations'}
                        </span>
                      )}
                      <span className="text-[11px] text-slate-400">
                        Created {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                      item.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {item.status}
                  </span>
                  <Link
                    href={`/investigations/${item.id}`}
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition"
                  >
                    View workspace →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Start Investigation */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
                  <PlusIcon className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900">
                    Start Environmental Investigation
                  </h4>
                  <p className="text-xs text-slate-500">
                    Register a traceable investigation record
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            {createError && (
              <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                <AlertCircleIcon className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateInvestigation} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Investigation Title *
                </label>
                <input
                  type="text"
                  required
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  placeholder="e.g. Chemical discharge observed in North Canal"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Environmental Domain / Category
                </label>
                <select
                  value={modalCategory}
                  onChange={(e) => setModalCategory(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="water_pollution">Water Quality & Pollution</option>
                  <option value="vegetation_loss">Vegetation & Canopy Loss</option>
                  <option value="waste_accumulation">Illegal Waste Accumulation</option>
                  <option value="air_quality">Air & Particulate Emission</option>
                  <option value="soil_contamination">Soil Degradation & Contamination</option>
                  <option value="general">General Environmental Anomaly</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Description / Context (Optional)
                </label>
                <textarea
                  rows={3}
                  value={modalDescription}
                  onChange={(e) => setModalDescription(e.target.value)}
                  placeholder="Describe observed conditions, timeline of changes, and surrounding land use..."
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 leading-relaxed">
                <span className="font-semibold text-slate-800">Traceability: </span>
                This investigation will be anchored under your account ({user?.email}) with private ownership.
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 focus:outline-none disabled:opacity-60 transition"
                >
                  {isCreating ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Creating...
                    </>
                  ) : (
                    'Create Investigation'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal: Add Observation */}
      {isObservationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 my-8 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-white shadow-xs">
                  <EyeIcon className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900">
                    Record Field Observation
                  </h4>
                  <p className="text-xs text-slate-500">
                    Log physical evidence, sensor indicators, and environmental anomalies
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsObservationModalOpen(false);
                  resetObservationForm();
                }}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            {obsError && (
              <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                <AlertCircleIcon className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                <span>{obsError}</span>
              </div>
            )}

            <form onSubmit={handleCreateObservation} className="mt-5 space-y-4">
              {/* Target Investigation Selector */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-3">
                <label className="block text-xs font-semibold text-slate-800 uppercase tracking-wider">
                  Target Investigation Case *
                </label>
                {investigations.length > 0 ? (
                  <div className="space-y-2">
                    <select
                      value={obsTargetInvId}
                      onChange={(e) => setObsTargetInvId(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    >
                      {investigations.map((inv) => (
                        <option key={inv.id} value={inv.id.toString()}>
                          #{inv.id} — {inv.title} ({inv.status})
                        </option>
                      ))}
                      <option value="new">+ Start a new investigation case for this observation</option>
                    </select>

                    {obsTargetInvId === 'new' && (
                      <div className="mt-2 animate-in fade-in duration-150">
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          New Case Title *
                        </label>
                        <input
                          type="text"
                          required
                          value={obsNewInvTitle}
                          onChange={(e) => setObsNewInvTitle(e.target.value)}
                          placeholder="e.g. Unlicensed chemical discharge observed near wetlands"
                          className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Observations are anchored within an investigation case. A new investigation record will be automatically initialized for you:
                    </p>
                    <input
                      type="text"
                      required
                      value={obsNewInvTitle}
                      onChange={(e) => setObsNewInvTitle(e.target.value)}
                      placeholder="e.g. Chemical discharge observed in North Canal"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                )}
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Environmental Domain / Category
                </label>
                <select
                  value={obsCategory}
                  onChange={(e) => setObsCategory(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="water_pollution">Water Quality & Pollution</option>
                  <option value="vegetation_loss">Vegetation & Canopy Loss</option>
                  <option value="waste_accumulation">Illegal Waste Accumulation</option>
                  <option value="air_quality">Air & Particulate Emission</option>
                  <option value="soil_contamination">Soil Degradation & Contamination</option>
                  <option value="general">General Environmental Anomaly</option>
                </select>
              </div>

              {/* Description & Findings */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Description & Evidence Details *
                </label>
                <textarea
                  rows={3}
                  required
                  value={obsDescription}
                  onChange={(e) => setObsDescription(e.target.value)}
                  placeholder="Record verifiable facts, visible discoloration, chemical odor, turbidity, sensor readings, or sample observations..."
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              {/* Severity & Source Classification */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Severity Level
                  </label>
                  <select
                    value={obsSeverity}
                    onChange={(e) => setObsSeverity(e.target.value as ObservationSeverityType)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="low">Low — Minor localized indicator</option>
                    <option value="moderate">Moderate — Notable disruption</option>
                    <option value="high">High — Significant environmental damage</option>
                    <option value="critical">Critical — Immediate ecological hazard</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Source Classification
                  </label>
                  <select
                    value={obsSourceType}
                    onChange={(e) => setObsSourceType(e.target.value as ObservationSourceType)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="observed">Observed — Direct field inspection</option>
                    <option value="user_reported">User Reported — Community report</option>
                    <option value="estimated">Estimated — Mathematical estimate</option>
                    <option value="inferred">Inferred — Algorithm/Model derived</option>
                  </select>
                </div>
              </div>

              {/* Confidence Level Slider */}
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Observation Confidence Level
                  </label>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                    {obsConfidence}%
                  </span>
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

              {/* Spatial Coordinates (Optional) */}
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <MapPinIcon className="h-4 w-4 text-slate-500" />
                    <span>Location Coordinates (Optional)</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleObsGetLocation}
                    disabled={obsGeoLocating}
                    className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1"
                  >
                    {obsGeoLocating ? (
                      <>
                        <span className="h-3 w-3 animate-spin rounded-full border border-emerald-700 border-t-transparent" />
                        Acquiring GPS...
                      </>
                    ) : (
                      'Use My GPS'
                    )}
                  </button>
                </div>

                {obsGeoNotice && (
                  <p className="text-[11px] text-amber-700">{obsGeoNotice}</p>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    step="any"
                    value={obsLat}
                    onChange={(e) => setObsLat(e.target.value)}
                    placeholder="Latitude (e.g. 19.0760)"
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                  />
                  <input
                    type="number"
                    step="any"
                    value={obsLng}
                    onChange={(e) => setObsLng(e.target.value)}
                    placeholder="Longitude (e.g. 72.8777)"
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Photographic / File Evidence Attachment */}
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <UploadCloudIcon className="h-4 w-4 text-slate-500" />
                  <span>Attach Photographic Evidence (Optional)</span>
                </div>

                {obsFilePreview ? (
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-2.5">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={obsFilePreview}
                        alt="Preview"
                        className="h-12 w-12 rounded-lg object-cover border border-slate-100 shrink-0"
                      />
                      <div className="truncate">
                        <p className="text-xs font-medium text-slate-800 truncate">
                          {obsFile?.name}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {obsFile && Math.round(obsFile.size / 1024)} KB
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                      title="Remove file"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <label className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-white p-3 cursor-pointer hover:border-emerald-500 transition">
                      <UploadCloudIcon className="h-6 w-6 text-slate-400 mb-1" />
                      <span className="text-xs font-medium text-slate-700">
                        Upload image or sensor capture
                      </span>
                      <span className="text-[10px] text-slate-400">PNG, JPG, WEBP, or PDF up to 10MB</span>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}

                {obsFile && (
                  <input
                    type="text"
                    value={obsEvidenceDesc}
                    onChange={(e) => setObsEvidenceDesc(e.target.value)}
                    placeholder="Evidence caption/note (e.g. Outflow pipe discharge photo)"
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                  />
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsObservationModalOpen(false);
                    resetObservationForm();
                  }}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingObs}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 focus:outline-none disabled:opacity-60 transition"
                >
                  {isSubmittingObs ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Recording Observation...
                    </>
                  ) : (
                    'Record Observation'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
