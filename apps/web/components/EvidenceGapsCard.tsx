'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { EvidenceGap, EvidenceGapsResponse, evidenceApi } from '../lib/api';
import { AlertCircleIcon, CheckCircleIcon, PlusIcon, ShieldCheckIcon } from './Icons';

interface EvidenceGapsCardProps {
  investigationId: number;
  onOpenAddEvidence?: () => void;
  onOpenAddObservation?: () => void;
}

export function EvidenceGapsCard({
  investigationId,
  onOpenAddEvidence,
  onOpenAddObservation,
}: EvidenceGapsCardProps) {
  const [gapsData, setGapsData] = useState<EvidenceGapsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGaps = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await evidenceApi.getEvidenceGaps(investigationId);
      setGapsData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze evidence gaps.');
    } finally {
      setLoading(false);
    }
  }, [investigationId]);

  useEffect(() => {
    fetchGaps();
  }, [fetchGaps]);

  const getSeverityBadge = (sev: string) => {
    switch (sev.toLowerCase()) {
      case 'high':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'medium':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'low':
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
            <AlertCircleIcon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Evidence Gaps</h3>
            <p className="text-[11px] text-slate-500">Deterministic verification checklist</p>
          </div>
        </div>

        {gapsData && (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              gapsData.total_gaps === 0
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}
          >
            {gapsData.total_gaps} {gapsData.total_gaps === 1 ? 'gap' : 'gaps'}
          </span>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-6 text-xs text-slate-400 gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          Analyzing investigation evidence baseline...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={fetchGaps}
            className="font-bold underline hover:no-underline ml-2"
          >
            Retry
          </button>
        </div>
      ) : !gapsData || gapsData.gaps.length === 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-center">
          <CheckCircleIcon className="mx-auto h-6 w-6 text-emerald-600 mb-1.5" />
          <h4 className="text-xs font-bold text-emerald-900">Baseline Evidence Satisfied</h4>
          <p className="mt-1 text-[11px] text-emerald-700 leading-relaxed">
            All observations have supporting evidence, geographic coordinates are established, and records are current.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {gapsData.gaps.map((gap, index) => (
            <div
              key={index}
              className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs space-y-1.5 transition hover:bg-white hover:border-slate-200 hover:shadow-2xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-800">{gap.title}</span>
                <span
                  className={`inline-flex items-center rounded-md border px-2 py-0.2 text-[10px] font-semibold uppercase tracking-wider ${getSeverityBadge(
                    gap.severity
                  )}`}
                >
                  {gap.severity}
                </span>
              </div>

              <p className="text-[11px] text-slate-600 leading-relaxed">{gap.description}</p>

              <div className="pt-1 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                <span className="text-slate-500 italic">
                  💡 {gap.recommendation}
                </span>

                {gap.gap_type === 'no_evidence' && onOpenAddEvidence && (
                  <button
                    onClick={onOpenAddEvidence}
                    className="shrink-0 font-semibold text-emerald-700 hover:text-emerald-900 ml-2"
                  >
                    + Add Evidence
                  </button>
                )}

                {gap.gap_type === 'unsupported_observation' && onOpenAddEvidence && (
                  <button
                    onClick={onOpenAddEvidence}
                    className="shrink-0 font-semibold text-emerald-700 hover:text-emerald-900 ml-2"
                  >
                    + Support Obs
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Evidence-First Footer Note */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 text-[10px] text-slate-400 text-center leading-normal">
        Evidence-first principle: deterministic evaluation. No autonomous inferences.
      </div>
    </div>
  );
}
