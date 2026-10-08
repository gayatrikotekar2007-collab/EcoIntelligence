'use client';

import React, { useState, useMemo } from 'react';
import {
  Evidence,
  TemporalSequenceResponse,
  evidenceApi,
} from '../lib/api';
import {
  AlertCircleIcon,
  CloseIcon,
  CompareIcon,
  ClockIcon,
  TrendingUpIcon,
  MapPinIcon,
  LayersIcon,
} from './Icons';
import { TemporalTrajectoryMap } from './TemporalTrajectoryMap';

interface TemporalEvidenceSequenceProps {
  isOpen: boolean;
  onClose: () => void;
  investigationId: number;
  evidenceItems: Evidence[];
  imageUrls: Record<number, string>;
  onOpenPairComparison: (
    beforeId: number,
    afterId: number,
    mode: 'split' | 'heatmap' | 'region'
  ) => void;
  onOpenEvidenceDetail?: (id: number) => void;
  onEvidenceChanged?: () => Promise<void>;
}

export function TemporalEvidenceSequence({
  isOpen,
  onClose,
  investigationId,
  evidenceItems,
  imageUrls,
  onOpenPairComparison,
  onOpenEvidenceDetail,
  onEvidenceChanged,
}: TemporalEvidenceSequenceProps) {
  // Filter for image evidence only
  const imageEvidence = useMemo(
    () => evidenceItems.filter((e) => e.evidence_type === 'image'),
    [evidenceItems]
  );

  // Selected evidence IDs (default to selecting all images if >= 3, or first 5)
  const [selectedIds, setSelectedIds] = useState<number[]>(() =>
    imageEvidence.slice(0, Math.max(3, Math.min(5, imageEvidence.length))).map((e) => e.id)
  );

  const [sequenceResult, setSequenceResult] = useState<TemporalSequenceResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'map' | 'timeline'>('all');
  const [selectedMapEvidenceId, setSelectedMapEvidenceId] = useState<number | null>(null);

  // Chronologically sorted selected evidence
  const chronologicalSelected = useMemo(() => {
    const selectedItems = imageEvidence.filter((e) => selectedIds.includes(e.id));
    return selectedItems.sort((a, b) => {
      const dtA = new Date(a.captured_at || a.uploaded_at).getTime();
      const dtB = new Date(b.captured_at || b.uploaded_at).getTime();
      return dtA - dtB || a.id - b.id;
    });
  }, [imageEvidence, selectedIds]);

  if (!isOpen) return null;

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedIds(imageEvidence.map((e) => e.id));
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  const handleRunTemporalAnalysis = async () => {
    if (selectedIds.length < 3) {
      setError('Please select at least 3 image evidence artifacts for multi-temporal sequencing.');
      return;
    }

    try {
      setIsAnalyzing(true);
      setError(null);
      const res = await evidenceApi.analyzeTemporalSequence(investigationId, {
        evidence_ids: selectedIds,
      });
      setSequenceResult(res);
      if (onEvidenceChanged) {
        await onEvidenceChanged();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to analyze multi-temporal evidence sequence.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="temporal-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 sm:p-4 overflow-y-auto"
    >
      <div className="relative max-h-[94vh] max-w-5xl w-full flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden my-auto border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 sm:px-6 py-3.5 bg-slate-50">
          <div>
            <div className="flex items-center gap-2">
              <ClockIcon className="h-5 w-5 text-indigo-600 shrink-0" />
              <h3 id="temporal-modal-title" className="text-sm sm:text-base font-bold text-slate-900">
                Multi-Temporal Evidence Sequencing
              </h3>
              <span className="rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                Phase 7A
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Chronological visual difference progression across 3+ timestamped field evidence captures.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close multi-temporal sequence modal"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Global Evidence Protocol Neutral Banner */}
        <div className="border-b border-amber-200 bg-amber-50 px-5 sm:px-6 py-2 text-[11px] text-amber-900 flex items-center gap-2">
          <AlertCircleIcon className="h-4 w-4 text-amber-600 shrink-0" />
          <span>
            <strong>Evidence-First Protocol:</strong> Multi-temporal visual sequencing evaluates pixel-level variation between consecutive chronological captures. Measurements do not establish environmental recovery, deterioration, or pollution.
          </span>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* 1. Selection & Chronological Order Bar */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3.5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
              <div>
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  1. Select Artifacts for Chronological Sequence
                </span>
                <p className="text-[11px] text-slate-500">
                  Select 3 or more photographic evidence items. Sequence is ordered chronologically by capture date.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
                >
                  Select All ({imageEvidence.length})
                </button>
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Checkbox Selector Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto pr-1">
              {imageEvidence.map((item) => {
                const isSelected = selectedIds.includes(item.id);
                const thumb = imageUrls[item.id];
                const dateStr = new Date(item.captured_at || item.uploaded_at).toLocaleDateString();

                return (
                  <div
                    key={item.id}
                    onClick={() => toggleSelect(item.id)}
                    className={`flex items-center gap-2.5 rounded-xl border p-2 cursor-pointer transition select-none ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50/60 shadow-2xs'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 shrink-0"
                    />

                    <div className="h-10 w-10 rounded-lg bg-slate-950 shrink-0 overflow-hidden flex items-center justify-center">
                      {thumb ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={thumb} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-2 w-2 rounded-full bg-slate-500 animate-pulse" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1 text-xs">
                      <div className="truncate font-semibold text-slate-800" title={item.original_filename}>
                        {item.original_filename}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        #{item.id} • {dateStr}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Chronological Preview Sequence Badges */}
            <div className="pt-2 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="font-semibold text-slate-600 mr-1 text-[11px]">Progression:</span>
                {chronologicalSelected.length === 0 ? (
                  <span className="text-slate-400 italic text-[11px]">No evidence selected.</span>
                ) : (
                  chronologicalSelected.map((item, idx) => {
                    const isFirst = idx === 0;
                    const isLast = idx === chronologicalSelected.length - 1;
                    const roleLabel = isFirst ? 'BASELINE' : isLast ? 'CURRENT' : 'INTERMEDIATE';
                    const roleCls = isFirst
                      ? 'bg-purple-100 text-purple-800 border-purple-300'
                      : isLast
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-blue-100 text-blue-800 border-blue-300';

                    return (
                      <React.Fragment key={item.id}>
                        <span
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold ${roleCls}`}
                        >
                          <span>{roleLabel}</span>
                          <span className="font-mono text-slate-500">#{item.id}</span>
                        </span>
                        {idx < chronologicalSelected.length - 1 && (
                          <span className="text-slate-400 font-bold">&rarr;</span>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </div>

              {/* Execution Trigger Button */}
              <button
                type="button"
                onClick={handleRunTemporalAnalysis}
                disabled={isAnalyzing || selectedIds.length < 3}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition shrink-0"
              >
                {isAnalyzing ? (
                  <>
                    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Analyzing {selectedIds.length} Captures...</span>
                  </>
                ) : (
                  <>
                    <CompareIcon className="h-3.5 w-3.5" />
                    <span>
                      {sequenceResult ? 'Re-analyze Temporal Sequence' : 'Analyze Temporal Sequence'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex items-center gap-2">
              <AlertCircleIcon className="h-4 w-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 2. Temporal Timeline & Geospatial Trajectory */}
          {sequenceResult && (
            <div className="space-y-6">
              {/* Results View Switcher Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold">
                    T
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      Multi-Temporal Trajectory & Visual Progression
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {sequenceResult.sequence.length} captures • {sequenceResult.comparisons.length} intervals • Sequence ID: <span className="font-mono">{sequenceResult.sequence_id}</span>
                    </p>
                  </div>
                </div>

                {/* View Mode Toggle */}
                <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-semibold text-slate-600">
                  <button
                    type="button"
                    onClick={() => setActiveTab('all')}
                    className={`rounded-lg px-3 py-1 transition ${
                      activeTab === 'all'
                        ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                        : 'hover:text-slate-900'
                    }`}
                  >
                    Combined Overview
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('map')}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1 transition ${
                      activeTab === 'map'
                        ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                        : 'hover:text-slate-900'
                    }`}
                  >
                    <MapPinIcon className="h-3.5 w-3.5" />
                    <span>Map Trajectory</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('timeline')}
                    className={`rounded-lg px-3 py-1 transition ${
                      activeTab === 'timeline'
                        ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                        : 'hover:text-slate-900'
                    }`}
                  >
                    Visual Timeline
                  </button>
                </div>
              </div>

              {/* Step 6 & 7: Map Trajectory & Accuracy Envelopes */}
              {(activeTab === 'all' || activeTab === 'map') && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPinIcon className="h-4 w-4 text-indigo-600" />
                      <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                        Geospatial Trajectory Map & Accuracy Envelopes
                      </h5>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      PostGIS / WGS84 Geodesic Trajectory
                    </span>
                  </div>

                  <TemporalTrajectoryMap
                    sequence={sequenceResult.sequence}
                    comparisons={sequenceResult.comparisons}
                    imageUrls={imageUrls}
                    selectedEvidenceId={selectedMapEvidenceId}
                    onSelectEvidence={(id) => setSelectedMapEvidenceId(id)}
                    onOpenPairComparison={onOpenPairComparison}
                    onOpenEvidenceDetail={onOpenEvidenceDetail}
                    height={activeTab === 'map' ? '540px' : '380px'}
                  />
                </div>
              )}

              {/* Step 8 — TEMPORAL TRAJECTORY PANEL */}
              {(activeTab === 'all' || activeTab === 'map') && (
                <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/50 via-white to-slate-50 p-5 space-y-4 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-indigo-100/80 pb-2.5">
                    <div className="flex items-center gap-2">
                      <MapPinIcon className="h-4 w-4 text-indigo-600" />
                      <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
                        TEMPORAL LOCATION & TRAJECTORY
                      </h4>
                    </div>
                    <span className="rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                      Phase 7B Verified
                    </span>
                  </div>

                  <div className="flex flex-col items-center space-y-2 py-2">
                    {sequenceResult.sequence.map((item, idx) => {
                      const isBaseline = item.role === 'BASELINE';
                      const isCurrent = item.role === 'CURRENT';
                      const nextComp = sequenceResult.comparisons[idx];
                      const hasCoords =
                        item.latitude !== null &&
                        item.latitude !== undefined &&
                        item.longitude !== null &&
                        item.longitude !== undefined;

                      return (
                        <React.Fragment key={item.evidence_id}>
                          {/* Node Card */}
                          <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                              <span
                                className={`rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
                                  isBaseline
                                    ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                    : isCurrent
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                                }`}
                              >
                                {item.role}
                              </span>
                              <div>
                                <span className="text-xs font-bold text-slate-800 block">
                                  #{item.evidence_id} {item.original_filename || `Evidence #${item.evidence_id}`}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {item.captured_at
                                    ? new Date(item.captured_at).toLocaleDateString()
                                    : 'Timestamp unavailable'}
                                </span>
                              </div>
                            </div>

                            <div className="text-right text-xs">
                              {hasCoords ? (
                                <>
                                  <div className="font-mono font-semibold text-slate-800 flex items-center justify-end gap-1">
                                    <MapPinIcon className="h-3 w-3 text-indigo-600 shrink-0" />
                                    <span>
                                      {item.latitude!.toFixed(5)}, {item.longitude!.toFixed(5)}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-end gap-1.5 mt-0.5">
                                    <span className="rounded bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 text-[9px] font-semibold text-indigo-700">
                                      {item.location_source || 'UNAVAILABLE'}
                                    </span>
                                    <span className="text-[10px] text-slate-500">
                                      {item.location_accuracy !== null && item.location_accuracy !== undefined
                                        ? `±${item.location_accuracy.toFixed(1)} m`
                                        : '± unk'}
                                    </span>
                                  </div>
                                </>
                              ) : (
                                <div className="text-slate-400 italic text-[11px]">
                                  Coordinates unavailable
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Interval Connector */}
                          {nextComp && (
                            <div className="flex flex-col items-center py-1">
                              <div className="h-2.5 w-0.5 bg-indigo-300"></div>
                              <div className="flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 shadow-2xs my-0.5">
                                <span className="text-xs font-bold text-indigo-900 font-mono">
                                  {nextComp.distance_meters !== null && nextComp.distance_meters !== undefined
                                    ? `${nextComp.distance_meters.toFixed(1)} m`
                                    : 'Distance unk'}
                                </span>
                                <span className="text-slate-300">•</span>
                                <span
                                  className={`rounded px-1.5 py-0.2 text-[9px] font-bold uppercase ${
                                    nextComp.spatial_consistency === 'SAME_LOCATION'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : nextComp.spatial_consistency === 'NEARBY'
                                      ? 'bg-amber-100 text-amber-800'
                                      : nextComp.spatial_consistency === 'DISTANT'
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-slate-200 text-slate-700'
                                  }`}
                                >
                                  {nextComp.spatial_consistency}
                                </span>
                                <span className="text-slate-300">•</span>
                                <span className="text-[10px] font-medium text-slate-600">
                                  {nextComp.changed_pixel_percentage.toFixed(1)}% changed
                                </span>
                              </div>
                              <div className="h-2.5 w-0.5 bg-indigo-300"></div>
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Vertical Chronological Sequence Flow (Timeline) */}
              {(activeTab === 'all' || activeTab === 'timeline') && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-1">
                    <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                      Interval Visual Differences & Spatial Alignment
                    </h5>
                    <span className="text-[10px] text-slate-500">
                      Chronological Order
                    </span>
                  </div>

                  <div className="relative pl-6 space-y-6 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                    {sequenceResult.sequence.map((item, idx) => {
                      const evRecord = evidenceItems.find((e) => e.id === item.evidence_id);
                      const thumb = imageUrls[item.evidence_id];
                      const comparisonWithNext = sequenceResult.comparisons[idx];
                      const isBaseline = item.role === 'BASELINE';
                      const isCurrent = item.role === 'CURRENT';

                      const badgeCls = isBaseline
                        ? 'bg-purple-100 text-purple-800 border-purple-300'
                        : isCurrent
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-blue-100 text-blue-800 border-blue-300';

                      const dotCls = isBaseline
                        ? 'bg-purple-600 ring-4 ring-purple-100'
                        : isCurrent
                        ? 'bg-emerald-600 ring-4 ring-emerald-100'
                        : 'bg-indigo-600 ring-4 ring-indigo-100';

                      return (
                        <div key={item.evidence_id} className="relative space-y-4">
                          {/* Timeline Node Dot */}
                          <div
                            className={`absolute -left-[27px] top-4 h-3.5 w-3.5 rounded-full ${dotCls}`}
                          />

                          {/* Evidence Card */}
                          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="h-14 w-14 rounded-lg bg-slate-950 overflow-hidden shrink-0 flex items-center justify-center">
                                {thumb ? (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img src={thumb} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  <span className="text-[10px] text-slate-400">Loading</span>
                                )}
                              </div>

                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`rounded px-1.5 py-0.2 text-[10px] font-bold border uppercase tracking-wider ${badgeCls}`}
                                  >
                                    {item.role}
                                  </span>
                                  <span className="text-xs font-bold text-slate-900">
                                    #{item.evidence_id} - {item.original_filename || evRecord?.original_filename}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  Captured: {new Date(item.captured_at || item.uploaded_at || '').toLocaleString()}
                                </div>
                                {evRecord?.description && (
                                  <p className="text-[11px] text-slate-600 italic line-clamp-1">
                                    &quot;{evRecord.description}&quot;
                                  </p>
                                )}

                                {/* Location & Accuracy Badge */}
                                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                                  {item.latitude !== null && item.latitude !== undefined && item.longitude !== null && item.longitude !== undefined ? (
                                    <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-700">
                                      <MapPinIcon className="h-2.5 w-2.5 text-indigo-600" />
                                      {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400">
                                      <MapPinIcon className="h-2.5 w-2.5 text-slate-400" />
                                      Coords unavailable
                                    </span>
                                  )}

                                  <span className="rounded bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 text-[10px] font-semibold text-indigo-700">
                                    {item.location_source || 'UNAVAILABLE'}
                                  </span>

                                  {item.location_accuracy !== null && item.location_accuracy !== undefined && (
                                    <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] text-slate-600">
                                      Location accuracy: ±{item.location_accuracy.toFixed(1)} m
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="text-[11px] text-slate-400 self-end sm:self-center font-mono">
                              Sequence Position: {idx + 1} of {sequenceResult.sequence.length}
                            </div>
                          </div>

                          {/* Interval Comparison Connector Card (Between adjacent pairs) */}
                          {comparisonWithNext && (
                            <div className="ml-3 sm:ml-6 rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/70 to-slate-50 p-4 space-y-3 shadow-2xs">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-100/80 pb-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs text-indigo-950">
                                    Interval {idx + 1}: Evidence #{comparisonWithNext.before_evidence_id} &rarr; #{comparisonWithNext.after_evidence_id}
                                  </span>
                                  <span
                                    className={`rounded px-1.5 py-0.2 text-[10px] font-bold border ${
                                      comparisonWithNext.alignment_status === 'ALIGNED'
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                        : comparisonWithNext.alignment_status === 'ALIGNED_RESCALED'
                                        ? 'bg-blue-50 text-blue-800 border-blue-300'
                                        : 'bg-amber-50 text-amber-800 border-amber-300'
                                    }`}
                                  >
                                    {comparisonWithNext.alignment_status}
                                  </span>
                                </div>

                                {/* Interval Exploration Action Buttons */}
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-slate-500 font-semibold mr-1">Inspect:</span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onOpenPairComparison(
                                        comparisonWithNext.before_evidence_id,
                                        comparisonWithNext.after_evidence_id,
                                        'split'
                                      )
                                    }
                                    className="rounded border border-indigo-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-indigo-700 hover:bg-indigo-50 shadow-2xs"
                                    title="Open in Split Slider"
                                  >
                                    Split Slider
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onOpenPairComparison(
                                        comparisonWithNext.before_evidence_id,
                                        comparisonWithNext.after_evidence_id,
                                        'heatmap'
                                      )
                                    }
                                    className="rounded border border-indigo-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-indigo-700 hover:bg-indigo-50 shadow-2xs"
                                    title="Open Difference Heatmap"
                                  >
                                    Heatmap
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onOpenPairComparison(
                                        comparisonWithNext.before_evidence_id,
                                        comparisonWithNext.after_evidence_id,
                                        'region'
                                      )
                                    }
                                    className="rounded border border-indigo-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-indigo-700 hover:bg-indigo-50 shadow-2xs"
                                    title="Open Difference Region"
                                  >
                                    Region
                                  </button>
                                </div>
                              </div>

                              {/* Metrics Grid */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                                <div className="rounded-lg bg-white/90 border border-indigo-50 p-2.5">
                                  <span className="text-[10px] uppercase font-semibold text-slate-500 block">
                                    Visual Similarity
                                  </span>
                                  <span className="text-base font-bold text-slate-900">
                                    {(comparisonWithNext.similarity * 100).toFixed(1)}%
                                  </span>
                                  <div className="mt-1 h-1 w-full rounded-full bg-slate-100 overflow-hidden">
                                    <div
                                      className="h-full bg-emerald-500 rounded-full"
                                      style={{ width: `${comparisonWithNext.similarity * 100}%` }}
                                    />
                                  </div>
                                </div>

                                <div className="rounded-lg bg-white/90 border border-indigo-50 p-2.5">
                                  <span className="text-[10px] uppercase font-semibold text-slate-500 block">
                                    Changed Pixels
                                  </span>
                                  <span className="text-base font-bold text-indigo-700">
                                    {comparisonWithNext.changed_pixel_percentage.toFixed(1)}%
                                  </span>
                                  <div className="mt-1 text-[10px] text-slate-500">
                                    of analyzed pixels
                                  </div>
                                </div>

                                <div className="rounded-lg bg-white/90 border border-indigo-50 p-2.5">
                                  <span className="text-[10px] uppercase font-semibold text-slate-500 block">
                                    Spatial Distance
                                  </span>
                                  <span className="text-base font-bold text-slate-800">
                                    {comparisonWithNext.distance_meters !== null && comparisonWithNext.distance_meters !== undefined
                                      ? `${comparisonWithNext.distance_meters.toFixed(1)} m`
                                      : 'Distance unk'}
                                  </span>
                                  <div className="mt-1 text-[10px] text-slate-500 font-mono">
                                    {comparisonWithNext.bearing_degrees !== null && comparisonWithNext.bearing_degrees !== undefined
                                      ? `bearing ${comparisonWithNext.bearing_degrees}°`
                                      : 'offset unk'}
                                  </div>
                                </div>

                                <div className="rounded-lg bg-white/90 border border-indigo-50 p-2.5">
                                  <span className="text-[10px] uppercase font-semibold text-slate-500 block">
                                    Spatial Consistency
                                  </span>
                                  <span
                                    className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase mt-0.5 ${
                                      comparisonWithNext.spatial_consistency === 'SAME_LOCATION'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : comparisonWithNext.spatial_consistency === 'NEARBY'
                                        ? 'bg-amber-100 text-amber-800'
                                        : comparisonWithNext.spatial_consistency === 'DISTANT'
                                        ? 'bg-rose-100 text-rose-800'
                                        : 'bg-slate-200 text-slate-700'
                                    }`}
                                  >
                                    {comparisonWithNext.spatial_consistency || 'UNKNOWN'}
                                  </span>
                                  <div className="mt-1 text-[10px] text-slate-500">
                                    {comparisonWithNext.accuracy_before_meters && comparisonWithNext.accuracy_after_meters
                                      ? `±${(comparisonWithNext.accuracy_before_meters + comparisonWithNext.accuracy_after_meters).toFixed(1)} m combined uncert`
                                      : 'accuracy unk'}
                                  </div>
                                </div>
                              </div>

                              {/* Step 9 — SPATIAL CONSISTENCY WARNINGS */}
                              {comparisonWithNext.spatial_consistency === 'DISTANT' && (
                                <div className="rounded-xl border border-rose-200 bg-rose-50/90 p-3 text-xs text-rose-900 flex items-start gap-2 shadow-2xs">
                                  <AlertCircleIcon className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                                  <div>
                                    <span className="font-bold block text-rose-950">Spatial consistency: LOW</span>
                                    <p className="mt-0.5 text-[11px] text-rose-800 leading-relaxed">
                                      These captures were taken at substantially different locations. Visual differences should not be interpreted as temporal change at the same site.
                                    </p>
                                  </div>
                                </div>
                              )}

                              {comparisonWithNext.spatial_consistency === 'UNKNOWN' && (
                                <div className="rounded-xl border border-slate-200 bg-slate-100/90 p-3 text-xs text-slate-800 flex items-start gap-2 shadow-2xs">
                                  <AlertCircleIcon className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                                  <div>
                                    <span className="font-bold block text-slate-900">Spatial consistency: UNKNOWN</span>
                                    <p className="mt-0.5 text-[11px] text-slate-600 leading-relaxed">
                                      Location data is insufficient to determine whether the captures represent the same physical site.
                                    </p>
                                  </div>
                                </div>
                              )}

                              {/* Warning notices if alignment is uncertain or other warnings */}
                              {comparisonWithNext.warnings && comparisonWithNext.warnings.length > 0 && (
                                <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-2 text-[11px] text-amber-900 space-y-0.5">
                                  <div className="font-semibold flex items-center gap-1 text-[11px]">
                                    <AlertCircleIcon className="h-3 w-3 text-amber-600" />
                                    <span>Interval Notice:</span>
                                  </div>
                                  <ul className="list-disc pl-4 space-y-0.5 text-[10px] text-amber-800">
                                    {comparisonWithNext.warnings.map((w, wIdx) => (
                                      <li key={wIdx}>{w}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. Trend Visualization (Step 8) */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUpIcon className="h-4 w-4 text-indigo-600" />
                    <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                      Visual Difference Over Time
                    </h5>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">
                    Chronological Progression Trend
                  </span>
                </div>

                {/* SVG Chronological Trend Chart */}
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="h-44 w-full">
                    {(() => {
                      const points = sequenceResult.comparisons.map((c, i) => ({
                        index: i,
                        label: `Interval ${i + 1}`,
                        date: new Date(c.after_captured_at || '').toLocaleDateString(),
                        percentage: c.changed_pixel_percentage,
                        similarity: c.similarity * 100,
                      }));

                      const width = 600;
                      const height = 140;
                      const paddingLeft = 45;
                      const paddingRight = 40;
                      const paddingTop = 20;
                      const paddingBottom = 30;

                      const chartW = width - paddingLeft - paddingRight;
                      const chartH = height - paddingTop - paddingBottom;

                      const maxVal = Math.max(20, Math.min(100, Math.ceil(Math.max(...points.map((p) => p.percentage)) / 10) * 10));

                      const coords = points.map((p, idx) => {
                        const x =
                          points.length === 1
                            ? paddingLeft + chartW / 2
                            : paddingLeft + (idx / (points.length - 1)) * chartW;
                        const y = paddingTop + chartH - (p.percentage / maxVal) * chartH;
                        return { x, y, ...p };
                      });

                      const pathD = coords.reduce((acc, curr, idx) => {
                        return idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
                      }, '');

                      return (
                        <svg
                          viewBox={`0 0 ${width} ${height}`}
                          className="h-full w-full overflow-visible"
                        >
                          {/* Y-axis gridlines */}
                          {[0, maxVal / 2, maxVal].map((val, i) => {
                            const y = paddingTop + chartH - (val / maxVal) * chartH;
                            return (
                              <g key={i}>
                                <line
                                  x1={paddingLeft}
                                  y1={y}
                                  x2={width - paddingRight}
                                  y2={y}
                                  stroke="#e2e8f0"
                                  strokeDasharray="3 3"
                                />
                                <text
                                  x={paddingLeft - 8}
                                  y={y + 3}
                                  fontSize="9"
                                  fill="#94a3b8"
                                  textAnchor="end"
                                  fontFamily="monospace"
                                >
                                  {val.toFixed(0)}%
                                </text>
                              </g>
                            );
                          })}

                          {/* Data line */}
                          {coords.length > 1 && (
                            <path
                              d={pathD}
                              fill="none"
                              stroke="#6366f1"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          )}

                          {/* Data Points and Value Callouts */}
                          {coords.map((pt, i) => (
                            <g key={i}>
                              <circle
                                cx={pt.x}
                                cy={pt.y}
                                r="4.5"
                                fill="#ffffff"
                                stroke="#4f46e5"
                                strokeWidth="2.5"
                              />
                              <text
                                x={pt.x}
                                y={pt.y - 8}
                                fontSize="10"
                                fontWeight="bold"
                                fill="#4338ca"
                                textAnchor="middle"
                              >
                                {pt.percentage.toFixed(1)}%
                              </text>
                              <text
                                x={pt.x}
                                y={height - 12}
                                fontSize="9"
                                fill="#64748b"
                                textAnchor="middle"
                              >
                                {pt.label}
                              </text>
                              <text
                                x={pt.x}
                                y={height - 2}
                                fontSize="8"
                                fill="#94a3b8"
                                textAnchor="middle"
                              >
                                {pt.date}
                              </text>
                            </g>
                          ))}
                        </svg>
                      );
                    })()}
                  </div>
                </div>

                {/* Mandatory Neutral Chart Disclaimer */}
                <p className="text-[10px] text-slate-500 leading-relaxed border-t border-slate-200/80 pt-2">
                  <strong>Interpretation Guardrail:</strong> Changes shown are image-level differences and do not establish environmental improvement or degradation. Sensor variations, lighting changes, vegetation phenology, and viewing angles influence pixel change percentages over time.
                </p>
              </div>

              {/* 4. Scientific Limitations Card */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                <div className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Scientific Limitations & Verification Guardrails
                </div>
                <ul className="list-disc pl-4 text-[11px] text-slate-600 space-y-1">
                  {sequenceResult.limitations.map((lim, i) => (
                    <li key={i}>{lim}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-slate-100 px-5 sm:px-6 py-3 bg-slate-50 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 hidden sm:block">
            Eco-Eye Multi-Temporal Engine • Chronological Visual Sequencing
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition ml-auto"
          >
            Close Sequence
          </button>
        </div>
      </div>
    </div>
  );
}
