'use client';

import React, { useState } from 'react';
import { BoundingRegion, ImageDimensions } from '../lib/api';
import { AlertCircleIcon } from './Icons';

interface DifferenceRegionViewProps {
  beforeImageUrl: string | null;
  afterImageUrl: string | null;
  differenceRegion: BoundingRegion | null;
  analysisDimensions?: ImageDimensions | null;
  beforeDimensions?: ImageDimensions | null;
  afterDimensions?: ImageDimensions | null;
  alignmentStatus?: string;
  heightClass?: string;
}

export function DifferenceRegionView({
  beforeImageUrl,
  afterImageUrl,
  differenceRegion,
  analysisDimensions,
  beforeDimensions,
  alignmentStatus,
  heightClass = 'h-80 sm:h-96 md:h-[420px]',
}: DifferenceRegionViewProps) {
  const [selectedBaseImage, setSelectedBaseImage] = useState<'after' | 'before'>('after');
  const [showOverlayBox, setShowOverlayBox] = useState<boolean>(true);

  // Determine reference canvas dimensions
  const canvasW =
    analysisDimensions?.width ||
    (beforeDimensions?.width ? Math.min(beforeDimensions.width, 1024) : 1024);
  const canvasH =
    analysisDimensions?.height ||
    (beforeDimensions?.width && beforeDimensions?.height
      ? Math.round(
          Math.min(beforeDimensions.width, 1024) /
            (beforeDimensions.width / beforeDimensions.height)
        )
      : 768);

  const activeUrl = selectedBaseImage === 'after' ? afterImageUrl : beforeImageUrl;

  // Calculate percentage placement
  let boxStyle: React.CSSProperties | null = null;
  if (differenceRegion && canvasW > 0 && canvasH > 0) {
    const leftPct = (differenceRegion.x / canvasW) * 100;
    const topPct = (differenceRegion.y / canvasH) * 100;
    const widthPct = (differenceRegion.width / canvasW) * 100;
    const heightPct = (differenceRegion.height / canvasH) * 100;

    boxStyle = {
      left: `${Math.max(0, Math.min(100, leftPct))}%`,
      top: `${Math.max(0, Math.min(100, topPct))}%`,
      width: `${Math.max(0, Math.min(100 - leftPct, widthPct))}%`,
      height: `${Math.max(0, Math.min(100 - topPct, heightPct))}%`,
    };
  }

  return (
    <div className="flex flex-col space-y-3">
      {/* Uncertainty Notice if Alignment is Uncertain */}
      {alignmentStatus === 'ALIGNMENT_UNCERTAIN' && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2.5 shadow-2xs">
          <AlertCircleIcon className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold">Alignment Uncertainty:</span>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Geometric framing divergence detected. The identified difference region may correspond to uncompensated viewpoint shift rather than localized physical change.
            </p>
          </div>
        </div>
      )}

      {/* Main Viewport */}
      <div
        className={`relative w-full ${heightClass} select-none overflow-hidden rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center`}
      >
        {activeUrl ? (
          <div className="relative h-full w-full flex items-center justify-center">
            {/* Base Image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeUrl}
              alt={`${selectedBaseImage} evidence`}
              className="h-full w-full object-contain pointer-events-none"
            />

            {/* Bounding Region Highlight Box */}
            {differenceRegion && boxStyle && showOverlayBox && (
              <div
                style={boxStyle}
                className="absolute border-2 border-indigo-400 bg-indigo-500/20 shadow-[0_0_20px_rgba(99,102,241,0.4)] pointer-events-none transition-all duration-200"
              >
                {/* Target Reticle Corners */}
                <div className="absolute -top-1 -left-1 h-2.5 w-2.5 border-t-2 border-l-2 border-white" />
                <div className="absolute -top-1 -right-1 h-2.5 w-2.5 border-t-2 border-r-2 border-white" />
                <div className="absolute -bottom-1 -left-1 h-2.5 w-2.5 border-b-2 border-l-2 border-white" />
                <div className="absolute -bottom-1 -right-1 h-2.5 w-2.5 border-b-2 border-r-2 border-white" />

                {/* Floating Dimension Label Tag */}
                <div className="absolute -top-6 left-0 rounded bg-indigo-950/90 px-1.5 py-0.5 text-[9px] font-bold text-indigo-200 border border-indigo-500/30 whitespace-nowrap shadow-xs backdrop-blur-xs">
                  Detected Difference Region: {differenceRegion.width} &times; {differenceRegion.height} px
                </div>
              </div>
            )}

            {/* Empty State when no difference region exists */}
            {!differenceRegion && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-2xs">
                <div className="rounded-xl border border-slate-700 bg-slate-900/90 p-4 text-center text-xs text-slate-300 max-w-sm shadow-xl">
                  <span className="font-bold text-white block mb-1">
                    No Localized Difference Region
                  </span>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Visual changes between these captures are diffuse or below the perceptual noise threshold. No single bounding cluster was detected.
                  </p>
                </div>
              </div>
            )}

            {/* Top-left Indicator Badge */}
            <div className="absolute top-3 left-3 z-10 pointer-events-none">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-900/85 px-2.5 py-1 text-[11px] font-bold text-slate-200 backdrop-blur-xs border border-white/10 shadow-xs">
                <span className="h-2 w-2 rounded-full bg-indigo-400" />
                DIFFERENCE REGION OVERLAY ({selectedBaseImage.toUpperCase()})
              </span>
            </div>
          </div>
        ) : (
          <div className="text-slate-400 text-xs">Loading evidence image...</div>
        )}
      </div>

      {/* Region Metadata & Layer Switcher Controls */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 space-y-3 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Display Over:</span>
            <div className="flex rounded-lg bg-white border border-slate-200 p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setSelectedBaseImage('after')}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                  selectedBaseImage === 'after'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                After Evidence Image
              </button>
              <button
                type="button"
                onClick={() => setSelectedBaseImage('before')}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                  selectedBaseImage === 'before'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Before Evidence Image
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={showOverlayBox}
                onChange={(e) => setShowOverlayBox(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Show Bounding Reticle
            </label>
          </div>
        </div>

        {/* Region Coordinates Breakdown */}
        {differenceRegion ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-[11px]">
            <div className="rounded-lg bg-white border border-slate-200 p-2 space-y-0.5">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Origin (X, Y)</span>
              <div className="font-mono font-bold text-slate-800">
                ({differenceRegion.x}, {differenceRegion.y}) px
              </div>
            </div>
            <div className="rounded-lg bg-white border border-slate-200 p-2 space-y-0.5">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Width &times; Height</span>
              <div className="font-mono font-bold text-slate-800">
                {differenceRegion.width} &times; {differenceRegion.height} px
              </div>
            </div>
            <div className="rounded-lg bg-white border border-slate-200 p-2 space-y-0.5">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Normalized Area</span>
              <div className="font-mono font-bold text-indigo-700">
                {((differenceRegion.width * differenceRegion.height) / (canvasW * canvasH) * 100).toFixed(1)}% of canvas
              </div>
            </div>
            <div className="rounded-lg bg-white border border-slate-200 p-2 space-y-0.5">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Analysis Canvas</span>
              <div className="font-mono font-bold text-slate-700">
                {canvasW} &times; {canvasH} px
              </div>
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-slate-500 italic">
            No bounding coordinates available for this comparison pair.
          </p>
        )}

        {/* Evidence-First Neutral Disclaimer */}
        <p className="text-[10px] text-slate-500 leading-relaxed border-t border-slate-200/80 pt-2">
          <strong>Detected Difference Region:</strong> Demarcates the tightest bounding rectangle enclosing pixels that exceed the perceptual noise threshold. This spatial marker describes image-level variation and does not claim to diagnose an environmental cause or contamination.
        </p>
      </div>
    </div>
  );
}
