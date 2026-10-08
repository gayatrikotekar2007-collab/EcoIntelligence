'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '../../lib/auth-context';
import { AppShell } from '../../components/AppShell';
import {
  investigationsApi,
  Investigation,
  CreateInvestigationPayload,
  InvestigationStatusType,
  ObservationSeverityType,
  ObservationSourceType,
} from '../../lib/api';
import {
  FileTextIcon,
  PlusIcon,
  MapPinIcon,
  EyeIcon,
  CloseIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  LayersIcon,
} from '../../components/Icons';

export default function InvestigationsPage() {
  const { user } = useAuth();
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('water_pollution');
  const [status, setStatus] = useState<InvestigationStatusType>('active');
  const [description, setDescription] = useState('');
  const [lat, setLat] = useState<string>('');
  const [lng, setLng] = useState<string>('');
  const [accuracy, setAccuracy] = useState<string>('');
  const [initialObservation, setInitialObservation] = useState('');
  const [initialSeverity, setInitialSeverity] = useState<ObservationSeverityType>('moderate');
  const [initialSourceType, setInitialSourceType] = useState<ObservationSourceType>('observed');
  const [geoLocating, setGeoLocating] = useState(false);
  const [geoNotice, setGeoNotice] = useState<string | null>(null);

  const loadData = async () => {
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
      loadData();
    }
  }, [user]);

  // Geolocation for Form
  const handleUseBrowserLocation = () => {
    if (!navigator.geolocation) {
      setGeoNotice('Geolocation is not supported by your browser.');
      return;
    }
    setGeoLocating(true);
    setGeoNotice(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        if (pos.coords.accuracy) {
          setAccuracy(Math.round(pos.coords.accuracy).toString());
        }
        setGeoLocating(false);
      },
      (err) => {
        setGeoNotice(
          err.code === 1
            ? 'Browser location permission denied.'
            : 'Failed to retrieve current location.'
        );
        setGeoLocating(false);
      },
      { timeout: 8000 }
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setCreateError('Investigation title is required.');
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      const payload: CreateInvestigationPayload = {
        title: title.trim(),
        category,
        status,
        description: description.trim() || undefined,
      };

      if (lat && lng) {
        const parsedLat = parseFloat(lat);
        const parsedLng = parseFloat(lng);
        if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
          payload.location_latitude = parsedLat;
          payload.location_longitude = parsedLng;
          if (accuracy) {
            payload.location_accuracy_meters = parseFloat(accuracy);
          }
        }
      }

      if (initialObservation.trim()) {
        payload.initial_observation = initialObservation.trim();
        payload.initial_severity = initialSeverity;
        payload.initial_source_type = initialSourceType;
      }

      const created = await investigationsApi.create(payload);
      setInvestigations((prev) => [created, ...prev]);

      // Reset Form & Close
      setIsModalOpen(false);
      setTitle('');
      setDescription('');
      setLat('');
      setLng('');
      setAccuracy('');
      setInitialObservation('');
      setGeoNotice(null);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create investigation.');
    } finally {
      setIsCreating(false);
    }
  };

  // Filter investigations
  const filteredInvestigations = useMemo(() => {
    return investigations.filter((item) => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchDesc = item.description ? item.description.toLowerCase().includes(q) : false;
        if (!matchTitle && !matchDesc) return false;
      }
      return true;
    });
  }, [investigations, categoryFilter, statusFilter, searchQuery]);

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

  const hasActiveFilters =
    categoryFilter !== 'all' || statusFilter !== 'all' || searchQuery.trim().length > 0;

  const headerAction = (
    <button
      onClick={() => setIsModalOpen(true)}
      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition"
    >
      <PlusIcon className="h-4 w-4" />
      New Investigation
    </button>
  );

  return (
    <AppShell title="Investigations Workspace" headerAction={headerAction}>
      {/* 1. Page Header Overview */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-0.5 text-xs font-semibold text-emerald-800">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Evidence Collection & Case Management
            </div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              Investigations
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-600 max-w-2xl">
              Track environmental incidents, record observational evidence, pinpoint spatial coordinates, and coordinate field investigations.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/map"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              <MapPinIcon className="h-4 w-4 text-emerald-600" />
              Open GIS Map
            </Link>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition"
            >
              <PlusIcon className="h-4 w-4" />
              New Investigation
            </button>
          </div>
        </div>
      </div>

      {/* 2. Filter Bar */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <input
              type="text"
              placeholder="Search investigations by title or details..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:border-slate-300 focus:border-emerald-500 focus:outline-none"
          >
            <option value="all">All Categories</option>
            <option value="water_pollution">Water Pollution</option>
            <option value="vegetation_loss">Vegetation Loss</option>
            <option value="waste_accumulation">Waste Accumulation</option>
            <option value="air_quality">Air Quality</option>
            <option value="soil_contamination">Soil Contamination</option>
            <option value="general">General</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:border-slate-300 focus:border-emerald-500 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="under_review">Under Review</option>
            <option value="resolved">Resolved</option>
            <option value="completed">Completed</option>
          </select>

          {hasActiveFilters && (
            <button
              onClick={() => {
                setCategoryFilter('all');
                setStatusFilter('all');
                setSearchQuery('');
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
            >
              <CloseIcon className="h-3.5 w-3.5" />
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* 3. Error Alert */}
      {error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircleIcon className="h-5 w-5 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadData}
            className="rounded-lg bg-red-100 px-3 py-1 font-semibold text-red-900 hover:bg-red-200 transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* 4. Investigation List */}
      {loading ? (
        <div className="flex h-64 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-emerald-600 border-t-transparent" />
            <p className="text-xs font-medium text-slate-500">Loading investigations workspace...</p>
          </div>
        </div>
      ) : investigations.length === 0 ? (
        /* Zero state when no investigations exist at all */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-xs">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 mb-4">
            <FileTextIcon className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No investigations created yet</h3>
          <p className="mt-2 text-xs sm:text-sm text-slate-500 max-w-md leading-relaxed">
            Begin by starting your first environmental investigation. Record location coordinates, field observations, and organize evidence.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
          >
            <PlusIcon className="h-4 w-4" />
            Start First Investigation
          </button>
        </div>
      ) : filteredInvestigations.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
          No investigations match your current filter settings.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredInvestigations.map((item) => {
            const hasLocation = item.location && item.location.latitude && item.location.longitude;

            return (
              <div
                key={item.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-slate-300 hover:shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-[11px] font-semibold capitalize ${getStatusBadge(
                        item.status
                      )}`}
                    >
                      {item.status.replace('_', ' ')}
                    </span>
                    <span className="text-[11px] font-medium text-slate-400">
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 className="mt-3 text-base font-bold text-slate-900 leading-snug">
                    <Link
                      href={`/investigations/${item.id}`}
                      className="hover:text-emerald-700 transition"
                    >
                      {item.title}
                    </Link>
                  </h3>

                  {item.description ? (
                    <p className="mt-2 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-slate-400 italic">No description provided</p>
                  )}
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col gap-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-600 capitalize">
                      {item.category.replace('_', ' ')}
                    </span>

                    <span className="text-slate-500 font-medium">
                      {item.observations_count ?? 0} observations
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    {hasLocation ? (
                      <Link
                        href={`/map?id=${item.id}`}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 transition"
                        title="View investigation anchored on GIS Map"
                      >
                        <MapPinIcon className="h-3.5 w-3.5" />
                        <span>
                          {item.location!.latitude.toFixed(3)}°, {item.location!.longitude.toFixed(3)}°
                        </span>
                      </Link>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">No coordinates</span>
                    )}

                    <Link
                      href={`/investigations/${item.id}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition"
                    >
                      Workspace
                      <ArrowRightIcon className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Create Investigation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <FileTextIcon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Start New Investigation</h3>
                  <p className="text-xs text-slate-500">Record an environmental case with field coordinates</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            {createError && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex items-center gap-2">
                <AlertCircleIcon className="h-4 w-4 text-red-600 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Investigation Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Industrial runoff along North Canal"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Category & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
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
                    Initial Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as InvestigationStatusType)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="draft">Draft</option>
                    <option value="under_review">Under Review</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Context & Objectives
                </label>
                <textarea
                  rows={2}
                  placeholder="Describe the environmental incident, scope, or initial context..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Spatial Location Coordinates (PostGIS) */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <MapPinIcon className="h-4 w-4 text-emerald-600" />
                    Spatial Location Coordinates (Optional)
                  </span>
                  <button
                    type="button"
                    onClick={handleUseBrowserLocation}
                    disabled={geoLocating}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 transition"
                  >
                    {geoLocating ? 'Locating...' : 'Use My GPS'}
                  </button>
                </div>

                {geoNotice && (
                  <p className="text-[11px] text-amber-700 mb-2">{geoNotice}</p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 37.7749"
                      value={lat}
                      onChange={(e) => setLat(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. -122.4194"
                      value={lng}
                      onChange={(e) => setLng(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">Accuracy (±m)</label>
                    <input
                      type="number"
                      placeholder="e.g. 10"
                      value={accuracy}
                      onChange={(e) => setAccuracy(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Initial Field Observation (Optional) */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 space-y-2.5">
                <span className="block text-xs font-bold text-slate-700">
                  Initial Field Observation (Optional)
                </span>
                <input
                  type="text"
                  placeholder="e.g. Unpleasant odor and oily rainbow sheen on surface water"
                  value={initialObservation}
                  onChange={(e) => setInitialObservation(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none"
                />

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">Severity</label>
                    <select
                      value={initialSeverity}
                      onChange={(e) => setInitialSeverity(e.target.value as ObservationSeverityType)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="low">Low</option>
                      <option value="moderate">Moderate</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">Source Type</label>
                    <select
                      value={initialSourceType}
                      onChange={(e) => setInitialSourceType(e.target.value as ObservationSourceType)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="observed">Observed Field Evidence</option>
                      <option value="user_reported">User Reported</option>
                      <option value="estimated">Estimated</option>
                      <option value="inferred">Inferred</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition"
                >
                  {isCreating ? 'Creating Case...' : 'Create Investigation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
