'use client';

import React, { useEffect, useState, useMemo, Suspense } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { AppShell } from '../../components/AppShell';
import {
  mapApi,
  GeoJSONFeature,
  GeoJSONFeatureCollection,
} from '../../lib/api';
import {
  MapPinIcon,
  LayersIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  PlusIcon,
  ArrowRightIcon,
  CloseIcon,
  FileTextIcon,
  ShieldCheckIcon,
} from '../../components/Icons';

// Dynamically import MapLibre GL component with SSR disabled
const EnvironmentalMap = dynamic(
  () => import('../../components/EnvironmentalMap').then((m) => m.EnvironmentalMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[600px] w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-emerald-600 border-t-transparent" />
          <p className="text-xs font-semibold text-slate-600">Initializing Environmental GIS Map...</p>
        </div>
      </div>
    ),
  }
);

function MapPageContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const initialIdParam = searchParams.get('id');

  const [featureCollection, setFeatureCollection] = useState<GeoJSONFeatureCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected feature
  const [selectedFeature, setSelectedFeature] = useState<GeoJSONFeature | null>(null);

  const loadMapData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await mapApi.getMapInvestigations();
      setFeatureCollection(data);

      // Auto-select if ?id= is present in URL
      if (initialIdParam) {
        const targetId = parseInt(initialIdParam, 10);
        const match = data.features.find((f) => f.properties.id === targetId);
        if (match) {
          setSelectedFeature(match);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve spatial map data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadMapData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, initialIdParam]);

  // Filtered features list
  const filteredFeatures = useMemo(() => {
    if (!featureCollection) return [];

    return featureCollection.features.filter((f) => {
      const p = f.properties;

      if (categoryFilter !== 'all' && p.category !== categoryFilter) {
        return false;
      }
      if (statusFilter !== 'all' && p.status !== statusFilter) {
        return false;
      }
      if (severityFilter !== 'all') {
        if (!p.severity || p.severity !== severityFilter) {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = p.title.toLowerCase().includes(q);
        const matchesDesc = p.description ? p.description.toLowerCase().includes(q) : false;
        if (!matchesTitle && !matchesDesc) {
          return false;
        }
      }
      return true;
    });
  }, [featureCollection, categoryFilter, statusFilter, severityFilter, searchQuery]);

  const hasActiveFilters =
    categoryFilter !== 'all' ||
    statusFilter !== 'all' ||
    severityFilter !== 'all' ||
    searchQuery.trim().length > 0;

  const handleResetFilters = () => {
    setCategoryFilter('all');
    setStatusFilter('all');
    setSeverityFilter('all');
    setSearchQuery('');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
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

  const getSeverityBadge = (severity?: string | null) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'high':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'moderate':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'low':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  const getSourceTypeBadge = (source?: string | null) => {
    switch (source) {
      case 'observed':
        return { label: 'Observed Field Evidence', cls: 'bg-emerald-50 text-emerald-800 border-emerald-300' };
      case 'user_reported':
        return { label: 'User Reported', cls: 'bg-blue-50 text-blue-800 border-blue-300' };
      case 'inferred':
        return { label: 'Inferred / Modelled', cls: 'bg-purple-50 text-purple-800 border-purple-300' };
      case 'estimated':
        return { label: 'Estimated', cls: 'bg-amber-50 text-amber-800 border-amber-300' };
      default:
        return { label: 'Needs Verification', cls: 'bg-slate-100 text-slate-700 border-slate-300' };
    }
  };

  const totalMapped = featureCollection?.features.length || 0;

  return (
    <AppShell
      title="Environmental Map"
      headerAction={
        <Link
          href="/investigations"
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition"
        >
          <PlusIcon className="h-4 w-4" />
          New Investigation
        </Link>
      }
    >
      {/* 1. Header Overview */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-0.5 text-xs font-semibold text-emerald-800">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              PostGIS Spatial Intelligence
            </div>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Environmental Map
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-600 max-w-2xl">
              Spatial exploration of your location-based investigations and field observations. Anchored in real coordinates with PostGIS verification.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-center">
              <span className="block text-xs font-medium text-slate-500">Mapped Locations</span>
              <span className="text-lg font-bold text-slate-900">{totalMapped}</span>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-center">
              <span className="block text-xs font-medium text-slate-500">Filtered In View</span>
              <span className="text-lg font-bold text-emerald-600">{filteredFeatures.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Interactive Filter Bar */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Box */}
          <div className="relative min-w-[200px] flex-1">
            <input
              type="text"
              placeholder="Search mapped investigations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Category Filter */}
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
            <option value="general">General / Other</option>
          </select>

          {/* Status Filter */}
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

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:border-slate-300 focus:border-emerald-500 focus:outline-none"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="moderate">Moderate</option>
            <option value="low">Low</option>
          </select>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
            >
              <CloseIcon className="h-3.5 w-3.5" />
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* 3. Error Banner */}
      {error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircleIcon className="h-5 w-5 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadMapData}
            className="rounded-lg bg-red-100 px-3 py-1 font-semibold text-red-900 hover:bg-red-200 transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* 4. Map and Side Inspection Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Map Container (takes 8 cols if inspection panel open, or 12 cols if closed) */}
        <div className={selectedFeature ? 'lg:col-span-8' : 'lg:col-span-12'}>
          {loading ? (
            <div className="flex h-[600px] w-full items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-xs">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-3 border-emerald-600 border-t-transparent" />
                <p className="text-xs font-medium text-slate-500">Loading spatial intelligence data...</p>
              </div>
            </div>
          ) : totalMapped === 0 ? (
            /* Empty State: No mapped investigations */
            <div className="flex h-[520px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-xs">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 mb-4">
                <MapPinIcon className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">No mapped investigations yet</h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-500 max-w-md leading-relaxed">
                None of your investigations have location coordinates attached yet. Create an investigation with latitude and longitude coordinates to view it on the interactive GIS map.
              </p>
              <div className="mt-6 flex gap-3">
                <Link
                  href="/investigations"
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
                >
                  <PlusIcon className="h-4 w-4" />
                  Create Investigation
                </Link>
                <button
                  onClick={loadMapData}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Refresh
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <EnvironmentalMap
                features={filteredFeatures}
                selectedFeatureId={selectedFeature ? selectedFeature.properties.id : null}
                onSelectFeature={(feat) => setSelectedFeature(feat)}
                height="620px"
              />

              {/* Informational notice when filters yield 0 results */}
              {filteredFeatures.length === 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 flex items-center justify-between">
                  <span>No investigations match the current filter criteria.</span>
                  <button
                    onClick={handleResetFilters}
                    className="font-semibold text-amber-900 underline hover:no-underline"
                  >
                    Reset Filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Selected Feature Card / Detail Drawer */}
        {selectedFeature && (
          <div className="lg:col-span-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-4">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Selected Investigation
                </span>
                <h3 className="mt-1 text-lg font-bold text-slate-900 leading-snug">
                  {selectedFeature.properties.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedFeature(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                title="Close details"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Badges & Properties */}
            <div className="mt-4 flex flex-wrap gap-2">
              <span
                className={`inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-semibold capitalize ${getStatusBadge(
                  selectedFeature.properties.status
                )}`}
              >
                Status: {selectedFeature.properties.status.replace('_', ' ')}
              </span>

              <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold capitalize text-slate-700">
                {selectedFeature.properties.category.replace('_', ' ')}
              </span>

              {selectedFeature.properties.severity && (
                <span
                  className={`inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-semibold capitalize ${getSeverityBadge(
                    selectedFeature.properties.severity
                  )}`}
                >
                  Severity: {selectedFeature.properties.severity}
                </span>
              )}
            </div>

            {/* Evidence Classification Notice */}
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Evidence Classification
              </span>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${
                    getSourceTypeBadge(selectedFeature.properties.source_type).cls
                  }`}
                >
                  {getSourceTypeBadge(selectedFeature.properties.source_type).label}
                </span>
              </div>
              <p className="mt-2 text-[11px] text-slate-500 leading-relaxed">
                Evidence-First: Marker represents recorded field data and observations, not unverified autonomous claims.
              </p>
            </div>

            {/* Coordinates & Accuracy Details */}
            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Longitude:</span>
                <span className="font-mono font-semibold text-slate-800">
                  {selectedFeature.geometry.coordinates[0].toFixed(6)}°
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Latitude:</span>
                <span className="font-mono font-semibold text-slate-800">
                  {selectedFeature.geometry.coordinates[1].toFixed(6)}°
                </span>
              </div>
              {selectedFeature.properties.accuracy_meters !== null &&
                selectedFeature.properties.accuracy_meters !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Accuracy Radius:</span>
                    <span className="font-semibold text-slate-800">
                      ±{selectedFeature.properties.accuracy_meters} meters
                    </span>
                  </div>
                )}
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Observations Count:</span>
                <span className="font-semibold text-slate-800">
                  {selectedFeature.properties.observation_count} recorded
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Created:</span>
                <span className="text-slate-700">
                  {new Date(selectedFeature.properties.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Description Snippet */}
            {selectedFeature.properties.description && (
              <div className="mt-4">
                <span className="text-xs font-semibold text-slate-600 block mb-1">Description</span>
                <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                  {selectedFeature.properties.description}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-6 flex flex-col gap-2">
              <Link
                href={`/investigations/${selectedFeature.properties.id}`}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition"
              >
                Open Investigation
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* 5. Clean Legend */}
      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">
          GIS Map Legend & Classification
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#0284c7] shrink-0" />
            <span className="text-slate-700 font-medium">Water Pollution</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#059669] shrink-0" />
            <span className="text-slate-700 font-medium">Vegetation Loss</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#d97706] shrink-0" />
            <span className="text-slate-700 font-medium">Waste Accumulation</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#7c3aed] shrink-0" />
            <span className="text-slate-700 font-medium">Air Quality</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#b45309] shrink-0" />
            <span className="text-slate-700 font-medium">Soil Contamination</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#475569] shrink-0" />
            <span className="text-slate-700 font-medium">Other / General</span>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default function MapPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-emerald-600 border-t-transparent" />
            <p className="text-xs font-semibold text-slate-600">Loading Map Workspace...</p>
          </div>
        </div>
      }
    >
      <MapPageContent />
    </Suspense>
  );
}
