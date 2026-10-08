'use client';

import React, { useState } from 'react';
import { Evidence, ImageAnalysisResult } from '../lib/api';
import { BeforeAfterSplitSlider } from './BeforeAfterSplitSlider';
import { DifferenceHeatmapView } from './DifferenceHeatmapView';
import { DifferenceRegionView } from './DifferenceRegionView';
import { AlertCircleIcon, CloseIcon, CompareIcon } from './Icons';

export type ComparisonViewMode = 'split' | 'heatmap' | 'region' | 'side_by_side';

interface BeforeAfterComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  investigationId: number;
  evidenceItems: Evidence[];
  imageUrls: Record<number, string>;
  beforeEvidenceId: number | null;
  afterEvidenceId: number | null;
  onSelectBeforeId: (id: number) => void;
  onSelectAfterId: (id: number) => void;
  analysisResult: ImageAnalysisResult | null;
  isAnalyzing: boolean;
  analysisError: string | null;
  onRunAnalysis: () => Promise<void>;
}

export function BeforeAfterComparisonModal({
  isOpen,
  onClose,
  investigationId,
  evidenceItems,
  imageUrls,
  beforeEvidenceId,
  afterEvidenceId,
  onSelectBeforeId,
  onSelectAfterId,
  analysisResult,
  isAnalyzing,
  analysisError,
  onRunAnalysis,
}: BeforeAfterComparisonModalProps) {
  const [activeMode, setActiveMode] = useState<ComparisonViewMode>('split');

  if (!isOpen) return null;

  const imageEvidenceItems = evidenceItems.filter((e) => e.evidence_type === 'image');
  const beforeEvidence = imageEvidenceItems.find((e) => e.id === beforeEvidenceId);
  const afterEvidence = imageEvidenceItems.find((e) => e.id === afterEvidenceId);

  const beforeUrl = beforeEvidence ? imageUrls[beforeEvidence.id] || null : null;
  const afterUrl = afterEvidence ? imageUrls[afterEvidence.id] || null : null;

  const isInvalidPair = !beforeEvidenceId || !afterEvidenceId || beforeEvidenceId === afterEvidenceId;
  const isAlignmentUncertain = analysisResult?.alignment_status === 'ALIGNMENT_UNCERTAIN';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="comparison-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 sm:p-4 overflow-y-auto"
    >
      <div className="relative max-h-[94vh] max-w-5xl w-full flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden my-auto border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 sm:px-6 py-3.5 bg-slate-50">
          <div>
            <div className="flex items-center gap-2">
              <CompareIcon className="h-4 w-4 text-indigo-600 shrink-0" />
              <h3 id="comparison-modal-title" className="text-sm sm:text-base font-bold text-slate-900">
                Eco-Eye Visual Difference Exploration
              </h3>
              <span className="rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                Phase 6B
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Deterministic pixel-level change visualization and spatial region inspection.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close comparison modal"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Global Evidence Protocol Neutral Banner */}
        <div className="border-b border-amber-200 bg-amber-50 px-5 sm:px-6 py-2 text-[11px] text-amber-900 flex items-center gap-2">
          <AlertCircleIcon className="h-4 w-4 text-amber-600 shrink-0" />
          <span>
            <strong>Evidence Protocol:</strong> Visual differences describe optical and pixel-level divergence between captures. They do not independently establish environmental improvement, degradation, or contamination.
          </span>
        </div>

        {/* Main Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Pair Selection & Mode Switcher Bar */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-2xs">
            {/* Dropdown selectors for Before and After */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-600">
                  Before:
                </span>
                <select
                  value={beforeEvidenceId || ''}
                  onChange={(e) => onSelectBeforeId(parseInt(e.target.value, 10))}
                  aria-label="Select Before evidence image"
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {imageEvidenceItems.map((img) => (
                    <option key={img.id} value={img.id}>
                      #{img.id} - {img.original_filename} ({new Date(img.captured_at || img.uploaded_at).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>

              <span className="text-slate-300 font-bold hidden sm:inline">&rarr;</span>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                  After:
                </span>
                <select
                  value={afterEvidenceId || ''}
                  onChange={(e) => onSelectAfterId(parseInt(e.target.value, 10))}
                  aria-label="Select After evidence image"
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {imageEvidenceItems.map((img) => (
                    <option key={img.id} value={img.id}>
                      #{img.id} - {img.original_filename} ({new Date(img.captured_at || img.uploaded_at).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Mode Switcher Segmented Control: [ Split View ] [ Difference Map ] [ Region ] [ Side-by-Side ] */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mr-1 hidden sm:inline">
                Mode:
              </span>
              <div
                role="tablist"
                aria-label="Comparison visualization modes"
                className="flex rounded-lg bg-slate-200/80 p-0.5 text-xs font-semibold text-slate-700"
              >
                <button
                  type="button"
                  role="tab"
                  id="tab-split"
                  aria-selected={activeMode === 'split'}
                  aria-controls="panel-split"
                  onClick={() => setActiveMode('split')}
                  className={`rounded-md px-2.5 py-1 transition ${
                    activeMode === 'split'
                      ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                      : 'hover:text-slate-900 text-slate-600'
                  }`}
                >
                  Split View
                </button>
                <button
                  type="button"
                  role="tab"
                  id="tab-heatmap"
                  aria-selected={activeMode === 'heatmap'}
                  aria-controls="panel-heatmap"
                  onClick={() => setActiveMode('heatmap')}
                  className={`rounded-md px-2.5 py-1 transition ${
                    activeMode === 'heatmap'
                      ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                      : 'hover:text-slate-900 text-slate-600'
                  }`}
                >
                  Difference Map
                </button>
                <button
                  type="button"
                  role="tab"
                  id="tab-region"
                  aria-selected={activeMode === 'region'}
                  aria-controls="panel-region"
                  onClick={() => setActiveMode('region')}
                  className={`rounded-md px-2.5 py-1 transition ${
                    activeMode === 'region'
                      ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                      : 'hover:text-slate-900 text-slate-600'
                  }`}
                >
                  Region
                </button>
                <button
                  type="button"
                  role="tab"
                  id="tab-side-by-side"
                  aria-selected={activeMode === 'side_by_side'}
                  aria-controls="panel-side-by-side"
                  onClick={() => setActiveMode('side_by_side')}
                  className={`rounded-md px-2.5 py-1 transition ${
                    activeMode === 'side_by_side'
                      ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                      : 'hover:text-slate-900 text-slate-600'
                  }`}
                >
                  Side-by-Side
                </button>
              </div>
            </div>
          </div>

          {/* Validation Warnings / Error alerts */}
          {beforeEvidenceId === afterEvidenceId && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 flex items-center gap-2">
              <AlertCircleIcon className="h-4 w-4 text-amber-600 shrink-0" />
              <span>Select two distinct evidence images to perform visual change comparison.</span>
            </div>
          )}

          {analysisError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex items-center gap-2">
              <AlertCircleIcon className="h-4 w-4 text-red-600 shrink-0" />
              <span>{analysisError}</span>
            </div>
          )}

          {/* Interactive Visualization Modes */}
          {!isInvalidPair && (
            <div className="space-y-4">
              {/* MODE 1: SPLIT SLIDER */}
              {activeMode === 'split' && (
                <div role="tabpanel" id="panel-split" aria-labelledby="tab-split">
                  <BeforeAfterSplitSlider
                    beforeUrl={beforeUrl}
                    afterUrl={afterUrl}
                    beforeTitle={beforeEvidence?.original_filename}
                    afterTitle={afterEvidence?.original_filename}
                  />
                </div>
              )}

              {/* MODE 2: DIFFERENCE HEATMAP */}
              {activeMode === 'heatmap' && (
                <div role="tabpanel" id="panel-heatmap" aria-labelledby="tab-heatmap">
                  <DifferenceHeatmapView
                    investigationId={investigationId}
                    beforeEvidenceId={beforeEvidenceId!}
                    afterEvidenceId={afterEvidenceId!}
                    afterImageUrl={afterUrl}
                    alignmentStatus={analysisResult?.alignment_status}
                  />
                </div>
              )}

              {/* MODE 3: DIFFERENCE REGION */}
              {activeMode === 'region' && (
                <div role="tabpanel" id="panel-region" aria-labelledby="tab-region">
                  <DifferenceRegionView
                    beforeImageUrl={beforeUrl}
                    afterImageUrl={afterUrl}
                    differenceRegion={analysisResult?.difference_region || null}
                    analysisDimensions={analysisResult?.analysis_dimensions}
                    beforeDimensions={analysisResult?.before_dimensions}
                    afterDimensions={analysisResult?.after_dimensions}
                    alignmentStatus={analysisResult?.alignment_status}
                  />
                </div>
              )}

              {/* MODE 4: SIDE BY SIDE */}
              {activeMode === 'side_by_side' && (
                <div role="tabpanel" id="panel-side-by-side" aria-labelledby="tab-side-by-side" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Before */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="rounded bg-slate-800 text-white px-2 py-0.5 text-[10px] font-bold uppercase">
                        BEFORE
                      </span>
                      <span className="text-xs font-semibold text-slate-700 truncate max-w-[200px]">
                        {beforeEvidence?.original_filename}
                      </span>
                    </div>
                    <div className="h-64 rounded-lg bg-slate-950 flex items-center justify-center overflow-hidden">
                      {beforeUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={beforeUrl} alt="Before" className="h-full w-full object-contain" />
                      ) : (
                        <span className="text-slate-400 text-xs">Loading image...</span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Captured: {new Date(beforeEvidence?.captured_at || beforeEvidence?.uploaded_at || '').toLocaleString()}
                    </div>
                  </div>

                  {/* After */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="rounded bg-emerald-600 text-white px-2 py-0.5 text-[10px] font-bold uppercase">
                        AFTER
                      </span>
                      <span className="text-xs font-semibold text-slate-700 truncate max-w-[200px]">
                        {afterEvidence?.original_filename}
                      </span>
                    </div>
                    <div className="h-64 rounded-lg bg-slate-950 flex items-center justify-center overflow-hidden">
                      {afterUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={afterUrl} alt="After" className="h-full w-full object-contain" />
                      ) : (
                        <span className="text-slate-400 text-xs">Loading image...</span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Captured: {new Date(afterEvidence?.captured_at || afterEvidence?.uploaded_at || '').toLocaleString()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Analysis Trigger & Metrics Section */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold">
                    Δ
                  </span>
                  <h4 className="text-sm font-bold text-slate-900">
                    Visual Difference Analysis
                  </h4>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                    Deterministic Image Metrics
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Visual differences detected between the selected evidence images.
                </p>
              </div>

              <button
                type="button"
                onClick={onRunAnalysis}
                disabled={isAnalyzing || isInvalidPair}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {isAnalyzing ? (
                  <>
                    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Analyzing Pixels...</span>
                  </>
                ) : (
                  <>
                    <CompareIcon className="h-3.5 w-3.5" />
                    <span>
                      {analysisResult ? 'Re-run Difference Analysis' : 'Run Visual Difference Analysis'}
                    </span>
                  </>
                )}
              </button>
            </div>

            {/* Empty state when analysis is not yet run */}
            {!analysisResult && !isAnalyzing && !isInvalidPair && (
              <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
                <p className="text-xs text-slate-600 font-medium">
                  No comparative analysis has been computed for this image pair.
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Click &ldquo;Run Visual Difference Analysis&rdquo; to execute deterministic alignment and pixel difference quantification.
                </p>
              </div>
            )}

            {/* Analysis Summary */}
            {analysisResult && (
              <div className="mt-5 space-y-4">
                {/* Uncertainty Banner (Step 7) */}
                {isAlignmentUncertain && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-3.5 text-xs text-amber-900 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-amber-950">
                      <AlertCircleIcon className="h-4 w-4 text-amber-600 shrink-0" />
                      <span>Alignment Uncertainty Warning</span>
                    </div>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      Image geometry differs substantially between the two captures (aspect ratio divergence). Perspective, zoom, or camera angle shifts may account for detected visual differences. Visual difference measurements should be interpreted with reduced geometric confidence.
                    </p>
                  </div>
                )}

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                      Similarity
                    </div>
                    <div className="mt-1 text-xl font-bold text-slate-900">
                      {(analysisResult.similarity * 100).toFixed(1)}%
                    </div>
                    <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${Math.min(100, Math.max(0, analysisResult.similarity * 100))}%` }}
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                      Changed Pixels
                    </div>
                    <div className="mt-1 text-xl font-bold text-indigo-700">
                      {analysisResult.changed_pixel_percentage.toFixed(1)}%
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      of analyzed pixels
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                      Alignment
                    </div>
                    <div className="mt-1">
                      {analysisResult.alignment_status === 'ALIGNED' && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                          ALIGNED
                        </span>
                      )}
                      {analysisResult.alignment_status === 'ALIGNED_RESCALED' && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800">
                          ALIGNED_RESCALED
                        </span>
                      )}
                      {analysisResult.alignment_status === 'ALIGNMENT_UNCERTAIN' && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                          ALIGNMENT_UNCERTAIN
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      {analysisResult.alignment_status === 'ALIGNED'
                        ? 'Sub-pixel compensated'
                        : analysisResult.alignment_status === 'ALIGNED_RESCALED'
                        ? 'Rescaled to common dimension'
                        : 'Framing divergence detected'}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                      Difference Region
                    </div>
                    {analysisResult.difference_region ? (
                      <div className="mt-1">
                        <div className="text-xs font-bold text-slate-800">
                          {analysisResult.difference_region.width} &times; {analysisResult.difference_region.height} px
                        </div>
                        <div className="mt-0.5 text-[10px] text-slate-500 font-mono">
                          at ({analysisResult.difference_region.x}, {analysisResult.difference_region.y})
                        </div>
                      </div>
                    ) : (
                      <div className="mt-1 text-xs font-medium text-slate-500">
                        No localized cluster
                      </div>
                    )}
                  </div>
                </div>

                {/* Dimensions and Analysis Date Metadata */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 rounded-xl border border-slate-100 bg-slate-50 p-3 text-[11px]">
                  <div>
                    <span className="text-slate-400 block">Before Dimensions:</span>
                    <span className="font-semibold text-slate-700">
                      {analysisResult.before_dimensions?.width || 'N/A'} &times;{' '}
                      {analysisResult.before_dimensions?.height || 'N/A'} px
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">After Dimensions:</span>
                    <span className="font-semibold text-slate-700">
                      {analysisResult.after_dimensions?.width || 'N/A'} &times;{' '}
                      {analysisResult.after_dimensions?.height || 'N/A'} px
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Analysis Date:</span>
                    <span className="font-semibold text-slate-700">
                      {new Date(analysisResult.analyzed_at).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Warnings List */}
                {analysisResult.warnings && analysisResult.warnings.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900 space-y-1">
                    <div className="font-semibold flex items-center gap-1.5">
                      <AlertCircleIcon className="h-3.5 w-3.5 text-amber-700" />
                      <span>Warnings:</span>
                    </div>
                    <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-amber-800">
                      {analysisResult.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Interpretation & Limitations Guardrail */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                  <div className="text-xs font-bold text-slate-800">Interpretation</div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Visual differences detected between the selected evidence images. These results describe image-level differences and do not independently establish environmental improvement or degradation.
                  </p>

                  <div className="border-t border-slate-200 pt-2.5 mt-2">
                    <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                      Limitations
                    </div>
                    <ul className="mt-1 list-disc pl-4 text-[11px] text-slate-600 space-y-1">
                      {analysisResult.limitations.map((lim, i) => (
                        <li key={i}>{lim}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="border-t border-slate-100 px-5 sm:px-6 py-3 bg-slate-50 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 hidden sm:block">
            Eco-Eye Deterministic Computer Vision Engine • Immutable Evidence Guarantee
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition ml-auto"
          >
            Close Comparison
          </button>
        </div>
      </div>
    </div>
  );
}
