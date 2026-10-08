'use client';

import React, { useState, useEffect } from 'react';
import { evidenceApi } from '../lib/api';
import { AlertCircleIcon } from './Icons';

interface DifferenceHeatmapViewProps {
  investigationId: number;
  beforeEvidenceId: number;
  afterEvidenceId: number;
  afterImageUrl: string | null;
  alignmentStatus?: string;
  heightClass?: string;
}

export function DifferenceHeatmapView({
  investigationId,
  beforeEvidenceId,
  afterEvidenceId,
  afterImageUrl,
  alignmentStatus,
  heightClass = 'h-80 sm:h-96 md:h-[420px]',
}: DifferenceHeatmapViewProps) {
  const [heatmapUrl, setHeatmapUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<'standalone' | 'overlay'>('overlay');
  const [overlayOpacity, setOverlayOpacity] = useState<number>(75);

  useEffect(() => {
    let isCancelled = false;
    let createdUrl: string | null = null;

    const loadHeatmap = async () => {
      try {
        setLoading(true);
        setError(null);
        const blob = await evidenceApi.fetchDifferenceMapBlob(
          investigationId,
          beforeEvidenceId,
          afterEvidenceId
        );
        if (!isCancelled) {
          createdUrl = URL.createObjectURL(blob);
          setHeatmapUrl(createdUrl);
        }
      } catch (err: any) {
        if (!isCancelled) {
          setError(err.message || 'Failed to load visual difference heatmap.');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    loadHeatmap();

    return () => {
      isCancelled = true;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [investigationId, beforeEvidenceId, afterEvidenceId]);

  return (
    <div className="flex flex-col space-y-3">
      {/* Uncertainty Notice if Alignment is Uncertain */}
      {alignmentStatus === 'ALIGNMENT_UNCERTAIN' && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2.5 shadow-2xs">
          <AlertCircleIcon className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold">Alignment Uncertainty Notice:</span>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Image geometry or framing differs substantially between the captures. Detected visual differences may reflect camera angle, zoom, or perspective variations rather than physical scene changes.
            </p>
          </div>
        </div>
      )}

      {/* Main Heatmap Canvas Viewport */}
      <div
        className={`relative w-full ${heightClass} select-none overflow-hidden rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center`}
      >
        {loading && (
          <div className="flex flex-col items-center gap-2 text-slate-300 text-xs">
            <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
            <span>Computing deterministic difference map...</span>
          </div>
        )}

        {error && !loading && (
          <div className="max-w-md p-6 text-center text-xs text-red-300 space-y-2">
            <AlertCircleIcon className="h-6 w-6 text-red-400 mx-auto" />
            <div className="font-semibold text-red-200">{error}</div>
            <p className="text-[11px] text-slate-400">
              Ensure both evidence images are accessible and valid image formats.
            </p>
          </div>
        )}

        {!loading && !error && (
          <div className="relative h-full w-full flex items-center justify-center">
            {/* Base AFTER Image (when overlay mode is enabled) */}
            {displayMode === 'overlay' && afterImageUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={afterImageUrl}
                alt="After Evidence"
                className="absolute inset-0 h-full w-full object-contain pointer-events-none"
              />
            )}

            {/* Difference Heatmap Layer */}
            {heatmapUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={heatmapUrl}
                alt="Visual Difference Heatmap"
                className="absolute inset-0 h-full w-full object-contain pointer-events-none transition-opacity duration-150"
                style={{
                  opacity: displayMode === 'overlay' ? overlayOpacity / 100 : 1,
                  mixBlendMode: displayMode === 'overlay' ? 'screen' : 'normal',
                }}
              />
            )}

            {/* View Badge */}
            <div className="absolute top-3 left-3 z-10 pointer-events-none">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-900/85 px-2.5 py-1 text-[11px] font-bold text-slate-200 backdrop-blur-xs border border-white/10 shadow-xs">
                <span className="h-2 w-2 rounded-full bg-indigo-400" />
                {displayMode === 'overlay'
                  ? `HEATMAP OVERLAY (${overlayOpacity}%)`
                  : 'STANDALONE DIFFERENCE MAP'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Controls & Heatmap Legend */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 space-y-3 text-xs">
        {/* View & Blend Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Display Mode:</span>
            <div className="flex rounded-lg bg-white border border-slate-200 p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setDisplayMode('overlay')}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                  displayMode === 'overlay'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Overlay on After Image
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('standalone')}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                  displayMode === 'standalone'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Standalone Heatmap
              </button>
            </div>
          </div>

          {displayMode === 'overlay' && (
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-slate-600 font-medium">Overlay Opacity:</span>
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={overlayOpacity}
                onChange={(e) => setOverlayOpacity(parseInt(e.target.value, 10))}
                className="w-28 accent-indigo-600 cursor-pointer"
                aria-label="Heatmap overlay opacity"
              />
              <span className="font-mono text-[11px] text-slate-700 font-bold w-8 text-right">
                {overlayOpacity}%
              </span>
            </div>
          )}
        </div>

        {/* Scientific Difference Intensity Legend */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold text-slate-800 uppercase tracking-wide">
              Visual Difference Intensity
            </span>
            <span className="text-slate-500 font-mono text-[10px]">
              0.0 (No Shift) &rarr; 1.0 (Maximum Delta)
            </span>
          </div>

          {/* Color Gradient Scale */}
          <div className="h-3 w-full rounded-md shadow-inner overflow-hidden border border-slate-300"
               style={{
                 background: 'linear-gradient(to right, #0f172a 0%, #1e293b 10%, #0ea5e9 35%, #eab308 65%, #f97316 85%, #e11d48 100%)',
               }}
          />

          <div className="flex items-center justify-between text-[10px] text-slate-600 font-medium pt-0.5">
            <span>Low Difference (Sensor/Lighting Noise)</span>
            <span>Moderate Difference</span>
            <span>High Visual Difference</span>
          </div>

          {/* Neutral Guardrail Note */}
          <p className="text-[10px] text-slate-500 leading-relaxed border-t border-slate-200/80 pt-1.5 mt-1">
            <strong>Evidence Interpretation:</strong> Visual difference map quantifies per-pixel luminance divergence between aligned captures. Color intensity represents optical variance only and does not establish environmental damage, pollution, or improvement.
          </p>
        </div>
      </div>
    </div>
  );
}
