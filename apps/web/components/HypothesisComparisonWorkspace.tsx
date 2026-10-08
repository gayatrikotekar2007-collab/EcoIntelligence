'use client';

import React, { useState } from 'react';
import {
  HypothesisComparisonResponse,
  EvidenceMatrixRow,
  ObservationMatrixRow,
  MatrixCell,
  Evidence,
  Observation,
} from '../lib/api';
import {
  CheckCircleIcon,
  AlertCircleIcon,
  EyeIcon,
  FileTextIcon,
  CloseIcon,
  LayersIcon,
  MapPinIcon,
  ClockIcon,
} from './Icons';

interface HypothesisComparisonWorkspaceProps {
  comparison: HypothesisComparisonResponse;
  onClose: () => void;
  evidenceList: Evidence[];
  observationsList: Observation[];
}

export function HypothesisComparisonWorkspace({
  comparison,
  onClose,
  evidenceList,
  observationsList,
}: HypothesisComparisonWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<
    'matrix' | 'discriminating' | 'contradictions' | 'common' | 'missing'
  >('matrix');

  const [matrixFilter, setMatrixFilter] = useState<'both' | 'evidence' | 'observations'>('both');

  // Evidence / Observation modal inspection
  const [inspectedEvidenceId, setInspectedEvidenceId] = useState<number | null>(null);
  const [inspectedObsId, setInspectedObsId] = useState<number | null>(null);

  const inspectedEvidence = inspectedEvidenceId
    ? evidenceList.find((e) => e.id === inspectedEvidenceId) || null
    : null;

  const inspectedObservation = inspectedObsId
    ? observationsList.find((o) => o.id === inspectedObsId) || null
    : null;

  const getRelationshipBadge = (cell: MatrixCell) => {
    switch (cell.relationship_type) {
      case 'SUPPORTS':
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800 shadow-2xs">
            <CheckCircleIcon className="h-3 w-3 text-emerald-600 shrink-0" />
            SUPPORTS
          </span>
        );
      case 'CONTRADICTS':
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-rose-300 bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-800 shadow-2xs">
            <AlertCircleIcon className="h-3 w-3 text-rose-600 shrink-0" />
            CONTRADICTS
          </span>
        );
      case 'CONTEXT':
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-sky-300 bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-800 shadow-2xs">
            <FileTextIcon className="h-3 w-3 text-sky-600 shrink-0" />
            CONTEXT
          </span>
        );
      case 'NOT_LINKED':
      default:
        return (
          <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-400">
            — Not Linked
          </span>
        );
    }
  };

  const getClassificationPill = (classification: string, isDiscriminating: boolean) => {
    if (isDiscriminating) {
      return (
        <span className="inline-flex items-center rounded-md border border-purple-200 bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700">
          Discriminating
        </span>
      );
    }
    if (classification === 'SAME') {
      return (
        <span className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
          Common (Same)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
        Single Association
      </span>
    );
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'MEDIUM':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'LOW':
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header with Guardrail */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100 text-purple-800 font-bold text-xs">
              8B
            </span>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Comparative Hypothesis Evaluation & Matrix Analysis
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-500 max-w-3xl">
            Side-by-side analytical evaluation across competing hypotheses. Pinpoints which evidence distinguishes hypotheses,
            identifies mutual agreements or direct contradictions, and surfaces differentiating information requirements.
          </p>
        </div>

        <button
          onClick={onClose}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition shrink-0"
        >
          <CloseIcon className="h-4 w-4" />
          Exit Comparison
        </button>
      </div>

      {/* 2. Deterministic Guardrail Banner */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 text-xs text-blue-900 flex items-start gap-2.5">
        <AlertCircleIcon className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-semibold text-blue-950">Deterministic Evidence-First Guardrail: </span>
          Matrix cells reflect explicit investigator-recorded relationships only. The system does not assert automated ranking,
          calculate causal probability, or declare a winning hypothesis. The investigator remains solely responsible for evaluation.
        </div>
      </div>

      {/* 3. Selected Hypotheses Chips */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Comparing {comparison.hypotheses.length} Selected Hypotheses:
        </span>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {comparison.hypotheses.map((h, idx) => (
            <div
              key={h.id}
              className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 flex flex-col justify-between"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-900 text-[10px] font-bold text-white shrink-0">
                    H{idx + 1}
                  </span>
                  <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{h.title}</h4>
                </div>
                <span className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-semibold text-slate-600 shrink-0 uppercase">
                  {h.status.replace('_', ' ')}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-200/60">
                <span>Confidence: <strong className="text-slate-700">{h.confidence}</strong></span>
                <span className="text-emerald-700 font-semibold">{h.supporting_evidence_count} Sup</span>
                <span className="text-rose-700 font-semibold">{h.contradicting_evidence_count} Con</span>
                <span className="text-amber-700 font-semibold">{h.missing_evidence_count} Gap</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Comparison Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-center shadow-2xs">
          <span className="block text-xl font-black text-slate-900">
            {comparison.summary.selected_hypotheses_count}
          </span>
          <span className="text-[11px] text-slate-500 font-medium">Hypotheses</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3 text-center shadow-2xs">
          <span className="block text-xl font-black text-blue-700">
            {comparison.summary.total_evidence_referenced}
          </span>
          <span className="text-[11px] text-slate-500 font-medium">Evidence Items</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3 text-center shadow-2xs">
          <span className="block text-xl font-black text-emerald-700">
            {comparison.summary.common_evidence_count}
          </span>
          <span className="text-[11px] text-slate-500 font-medium">Common Evidence</span>
        </div>

        <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-3 text-center shadow-2xs">
          <span className="block text-xl font-black text-purple-800">
            {comparison.summary.discriminating_evidence_count}
          </span>
          <span className="text-[11px] text-purple-700 font-semibold">Discriminating</span>
        </div>

        <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-3 text-center shadow-2xs">
          <span className="block text-xl font-black text-rose-800">
            {comparison.summary.contradicting_evidence_count}
          </span>
          <span className="text-[11px] text-rose-700 font-semibold">Contradictions</span>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 text-center shadow-2xs">
          <span className="block text-xl font-black text-amber-800">
            {comparison.summary.unresolved_requirements_count}
          </span>
          <span className="text-[11px] text-amber-700 font-semibold">Missing Gaps</span>
        </div>
      </div>

      {/* 5. Navigation Tabs */}
      <div className="flex border-b border-slate-200 text-xs overflow-x-auto">
        <button
          onClick={() => setActiveTab('matrix')}
          className={`py-2.5 px-4 font-semibold border-b-2 whitespace-nowrap transition ${
            activeTab === 'matrix'
              ? 'border-emerald-600 text-emerald-800 bg-emerald-50/30'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Comparative Matrix ({comparison.evidence_matrix.length + comparison.observation_matrix.length})
        </button>

        <button
          onClick={() => setActiveTab('discriminating')}
          className={`py-2.5 px-4 font-semibold border-b-2 whitespace-nowrap transition ${
            activeTab === 'discriminating'
              ? 'border-purple-600 text-purple-800 bg-purple-50/30'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Discriminating Evidence ({comparison.discriminating_evidence.length})
        </button>

        <button
          onClick={() => setActiveTab('contradictions')}
          className={`py-2.5 px-4 font-semibold border-b-2 whitespace-nowrap transition ${
            activeTab === 'contradictions'
              ? 'border-rose-600 text-rose-800 bg-rose-50/30'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Contradictions ({comparison.contradicting_evidence.length})
        </button>

        <button
          onClick={() => setActiveTab('common')}
          className={`py-2.5 px-4 font-semibold border-b-2 whitespace-nowrap transition ${
            activeTab === 'common'
              ? 'border-blue-600 text-blue-800 bg-blue-50/30'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Common Evidence ({comparison.common_evidence.length})
        </button>

        <button
          onClick={() => setActiveTab('missing')}
          className={`py-2.5 px-4 font-semibold border-b-2 whitespace-nowrap transition ${
            activeTab === 'missing'
              ? 'border-amber-600 text-amber-800 bg-amber-50/30'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Missing Requirements ({comparison.missing_requirements.length})
        </button>
      </div>

      {/* 6. TAB CONTENT */}

      {/* TAB 1: COMPARATIVE MATRIX */}
      {activeTab === 'matrix' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="text-xs text-slate-600">
              Comparing explicit investigator linkages against evidence and observation records.
            </div>

            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
              <button
                onClick={() => setMatrixFilter('both')}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  matrixFilter === 'both' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Records
              </button>
              <button
                onClick={() => setMatrixFilter('evidence')}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  matrixFilter === 'evidence' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Evidence ({comparison.evidence_matrix.length})
              </button>
              <button
                onClick={() => setMatrixFilter('observations')}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  matrixFilter === 'observations' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Observations ({comparison.observation_matrix.length})
              </button>
            </div>
          </div>

          {/* EVIDENCE MATRIX TABLE */}
          {(matrixFilter === 'both' || matrixFilter === 'evidence') && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileTextIcon className="h-4 w-4 text-emerald-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Evidence Comparison Matrix
                </h3>
              </div>

              {comparison.evidence_matrix.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
                  No evidence items referenced by any of the selected hypotheses.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="py-3 px-4 font-bold min-w-[240px]">Evidence Item</th>
                        <th className="py-3 px-3 font-bold min-w-[120px]">Analysis Type</th>
                        {comparison.hypotheses.map((h, idx) => (
                          <th key={h.id} className="py-3 px-3 font-bold min-w-[160px]">
                            <div className="flex items-center gap-1.5">
                              <span className="flex h-4 w-4 items-center justify-center rounded bg-slate-900 text-[9px] font-bold text-white">
                                H{idx + 1}
                              </span>
                              <span className="line-clamp-1">{h.title}</span>
                            </div>
                          </th>
                        ))}
                        <th className="py-3 px-3 font-bold text-right min-w-[90px]">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {comparison.evidence_matrix.map((row) => (
                        <tr key={row.evidence_id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">
                              #{row.evidence_id} — {row.original_filename}
                            </div>
                            {row.description && (
                              <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                                {row.description}
                              </div>
                            )}
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                              {row.captured_at && (
                                <span className="flex items-center gap-0.5">
                                  <ClockIcon className="h-3 w-3" />
                                  {new Date(row.captured_at).toLocaleDateString()}
                                </span>
                              )}
                              {row.latitude !== null && row.longitude !== null && (
                                <span className="flex items-center gap-0.5">
                                  <MapPinIcon className="h-3 w-3" />
                                  {row.latitude?.toFixed(4)}, {row.longitude?.toFixed(4)}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <div className="space-y-1">
                              <span className="inline-block rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 uppercase">
                                {row.evidence_type}
                              </span>
                              <div>{getClassificationPill(row.relationship_classification, row.is_discriminating)}</div>
                            </div>
                          </td>

                          {row.cells.map((cell) => (
                            <td key={cell.hypothesis_id} className="py-3 px-3 align-top">
                              <div className="space-y-1">
                                <div>{getRelationshipBadge(cell)}</div>
                                {cell.note && (
                                  <p className="text-[10px] text-slate-500 italic bg-slate-50 p-1.5 rounded border border-slate-100 leading-tight">
                                    &ldquo;{cell.note}&rdquo;
                                  </p>
                                )}
                              </div>
                            </td>
                          ))}

                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => setInspectedEvidenceId(row.evidence_id)}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition shadow-2xs"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* OBSERVATIONS MATRIX TABLE */}
          {(matrixFilter === 'both' || matrixFilter === 'observations') && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2">
                <EyeIcon className="h-4 w-4 text-emerald-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Field Observations Comparison Matrix
                </h3>
              </div>

              {comparison.observation_matrix.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
                  No field observations referenced by any of the selected hypotheses.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="py-3 px-4 font-bold min-w-[240px]">Observation Item</th>
                        <th className="py-3 px-3 font-bold min-w-[120px]">Category & Severity</th>
                        {comparison.hypotheses.map((h, idx) => (
                          <th key={h.id} className="py-3 px-3 font-bold min-w-[160px]">
                            <div className="flex items-center gap-1.5">
                              <span className="flex h-4 w-4 items-center justify-center rounded bg-slate-900 text-[9px] font-bold text-white">
                                H{idx + 1}
                              </span>
                              <span className="line-clamp-1">{h.title}</span>
                            </div>
                          </th>
                        ))}
                        <th className="py-3 px-3 font-bold text-right min-w-[90px]">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {comparison.observation_matrix.map((row) => (
                        <tr key={row.observation_id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">
                              Observation #{row.observation_id}
                            </div>
                            <div className="text-[11px] text-slate-700 line-clamp-2 mt-0.5">
                              {row.description}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                              <ClockIcon className="h-3 w-3" />
                              {new Date(row.created_at).toLocaleDateString()}
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <div className="space-y-1">
                              <span className="inline-block rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 capitalize">
                                {row.category.replace('_', ' ')}
                              </span>
                              <div>{getClassificationPill(row.relationship_classification, row.is_discriminating)}</div>
                            </div>
                          </td>

                          {row.cells.map((cell) => (
                            <td key={cell.hypothesis_id} className="py-3 px-3 align-top">
                              <div className="space-y-1">
                                <div>{getRelationshipBadge(cell)}</div>
                                {cell.note && (
                                  <p className="text-[10px] text-slate-500 italic bg-slate-50 p-1.5 rounded border border-slate-100 leading-tight">
                                    &ldquo;{cell.note}&rdquo;
                                  </p>
                                )}
                              </div>
                            </td>
                          ))}

                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => setInspectedObsId(row.observation_id)}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition shadow-2xs"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DISCRIMINATING EVIDENCE */}
      {activeTab === 'discriminating' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-4 text-xs text-purple-900">
            <h4 className="font-bold text-purple-950 mb-1 flex items-center gap-1.5">
              <LayersIcon className="h-4 w-4 text-purple-700" />
              Potentially Discriminating Evidence
            </h4>
            <p className="text-purple-800">
              An item of evidence is identified as potentially discriminating when its explicit investigator-assigned
              relationships differ across the compared hypotheses (e.g. supports one hypothesis while contradicting or providing context to another).
            </p>
          </div>

          {comparison.discriminating_evidence.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
              No discriminating evidence identified across the selected hypotheses yet.
              All referenced evidence either shares identical relationships or is associated with single hypotheses.
            </div>
          ) : (
            <div className="space-y-3">
              {comparison.discriminating_evidence.map((row) => (
                <div
                  key={row.evidence_id}
                  className="rounded-xl border border-purple-200 bg-white p-4 shadow-2xs space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-2">
                    <div>
                      <span className="font-bold text-slate-900 text-xs">
                        Evidence #{row.evidence_id} — {row.original_filename}
                      </span>
                      {row.description && (
                        <p className="text-[11px] text-slate-600 mt-0.5">{row.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => setInspectedEvidenceId(row.evidence_id)}
                      className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition shrink-0"
                    >
                      Inspect Evidence
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {row.cells.map((cell) => {
                      const hyp = comparison.hypotheses.find((h) => h.id === cell.hypothesis_id);
                      return (
                        <div
                          key={cell.hypothesis_id}
                          className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 space-y-1.5"
                        >
                          <div className="text-[11px] font-bold text-slate-800 line-clamp-1">
                            {hyp?.title || `Hypothesis #${cell.hypothesis_id}`}
                          </div>
                          <div>{getRelationshipBadge(cell)}</div>
                          {cell.note ? (
                            <p className="text-[10px] text-slate-600 italic">
                              Note: {cell.note}
                            </p>
                          ) : (
                            <p className="text-[10px] text-slate-400 italic">No investigator note</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CONTRADICTIONS */}
      {activeTab === 'contradictions' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4 text-xs text-rose-900">
            <h4 className="font-bold text-rose-950 mb-1 flex items-center gap-1.5">
              <AlertCircleIcon className="h-4 w-4 text-rose-600" />
              Contradicting Evidence Records
            </h4>
            <p className="text-rose-800">
              This evidence has different investigator-assigned relationships across the selected hypotheses.
              The platform notes that these items explicitly contradict candidate mechanisms without asserting that any hypothesis is conclusively disproven.
            </p>
          </div>

          {comparison.contradicting_evidence.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
              No contradicting evidence relationships recorded for any of the selected hypotheses.
            </div>
          ) : (
            <div className="space-y-3">
              {comparison.contradicting_evidence.map((row) => (
                <div
                  key={row.evidence_id}
                  className="rounded-xl border border-rose-200 bg-white p-4 shadow-2xs space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-2">
                    <div>
                      <span className="font-bold text-slate-900 text-xs">
                        Evidence #{row.evidence_id} — {row.original_filename}
                      </span>
                      {row.description && (
                        <p className="text-[11px] text-slate-600 mt-0.5">{row.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => setInspectedEvidenceId(row.evidence_id)}
                      className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition shrink-0"
                    >
                      Inspect Evidence
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {row.cells.map((cell) => {
                      const hyp = comparison.hypotheses.find((h) => h.id === cell.hypothesis_id);
                      return (
                        <div
                          key={cell.hypothesis_id}
                          className={`rounded-lg border p-2.5 space-y-1.5 ${
                            cell.relationship_type === 'CONTRADICTS'
                              ? 'border-rose-200 bg-rose-50/40'
                              : 'border-slate-200 bg-slate-50'
                          }`}
                        >
                          <div className="text-[11px] font-bold text-slate-800 line-clamp-1">
                            {hyp?.title || `Hypothesis #${cell.hypothesis_id}`}
                          </div>
                          <div>{getRelationshipBadge(cell)}</div>
                          {cell.note && (
                            <p className="text-[10px] text-slate-600 italic">
                              Note: {cell.note}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: COMMON EVIDENCE */}
      {activeTab === 'common' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 text-xs text-blue-900">
            <h4 className="font-bold text-blue-950 mb-1 flex items-center gap-1.5">
              <LayersIcon className="h-4 w-4 text-blue-700" />
              Common Evidence Across Hypotheses
            </h4>
            <p className="text-blue-800">
              Evidence items that are explicitly linked to multiple selected hypotheses.
              Shows whether the hypotheses interpret this common evidence consistently (same relationship) or divergently (different relationship).
            </p>
          </div>

          {comparison.common_evidence.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
              No evidence items are shared across two or more selected hypotheses.
            </div>
          ) : (
            <div className="space-y-3">
              {comparison.common_evidence.map((row) => (
                <div
                  key={row.evidence_id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-xs">
                        Evidence #{row.evidence_id} — {row.original_filename}
                      </span>
                      {getClassificationPill(row.relationship_classification, row.is_discriminating)}
                    </div>
                    <button
                      onClick={() => setInspectedEvidenceId(row.evidence_id)}
                      className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition shrink-0"
                    >
                      Inspect Evidence
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {row.cells.map((cell) => {
                      const hyp = comparison.hypotheses.find((h) => h.id === cell.hypothesis_id);
                      return (
                        <div
                          key={cell.hypothesis_id}
                          className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 space-y-1.5"
                        >
                          <div className="text-[11px] font-bold text-slate-800 line-clamp-1">
                            {hyp?.title || `Hypothesis #${cell.hypothesis_id}`}
                          </div>
                          <div>{getRelationshipBadge(cell)}</div>
                          {cell.note && (
                            <p className="text-[10px] text-slate-600 italic">Note: {cell.note}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: MISSING INFORMATION REQUIREMENTS */}
      {activeTab === 'missing' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-xs text-amber-900">
            <h4 className="font-bold text-amber-950 mb-1 flex items-center gap-1.5">
              <AlertCircleIcon className="h-4 w-4 text-amber-700" />
              Differentiating Information Needed
            </h4>
            <p className="text-amber-800">
              Additional information may help distinguish these hypotheses. Missing evidence requirements identify
              the specific data, samples, or tests required by investigators to evaluate each candidate explanation.
            </p>
          </div>

          {comparison.missing_requirements.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
              No missing evidence requirements recorded across the selected hypotheses.
            </div>
          ) : (
            <div className="space-y-3">
              {comparison.missing_requirements.map((req) => {
                const hyp = comparison.hypotheses.find((h) => h.id === req.hypothesis_id);
                return (
                  <div
                    key={req.id}
                    className="rounded-xl border border-slate-200 bg-white p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs shadow-2xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">
                          {hyp ? hyp.title : `Hypothesis #${req.hypothesis_id}`}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${getPriorityBadge(
                            req.priority
                          )}`}
                        >
                          {req.priority} PRIORITY
                        </span>
                        <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                          {req.status}
                        </span>
                      </div>
                      <p className="text-slate-800 text-xs font-medium">{req.description}</p>
                    </div>

                    <div className="text-[11px] text-slate-400 shrink-0">
                      Requirement #{req.id} • {new Date(req.created_at).toLocaleDateString()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 7. EVIDENCE INSPECT MODAL */}
      {inspectedEvidence && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-2xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileTextIcon className="h-5 w-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Evidence #{inspectedEvidence.id} Details
                </h3>
              </div>
              <button
                onClick={() => setInspectedEvidenceId(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase">
                  Original Filename
                </label>
                <div className="font-medium text-slate-900">{inspectedEvidence.original_filename}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase">
                    Evidence Type
                  </label>
                  <div className="font-medium text-slate-900 uppercase">{inspectedEvidence.evidence_type}</div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase">
                    MIME Type
                  </label>
                  <div className="font-medium text-slate-900">{inspectedEvidence.mime_type}</div>
                </div>
              </div>

              {inspectedEvidence.description && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase">
                    Description
                  </label>
                  <div className="text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    {inspectedEvidence.description}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase">
                    Captured Date
                  </label>
                  <div className="text-slate-700">
                    {inspectedEvidence.captured_at
                      ? new Date(inspectedEvidence.captured_at).toLocaleString()
                      : 'Unavailable'}
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase">
                    Verification State
                  </label>
                  <div className="text-slate-700 uppercase">{inspectedEvidence.verification_state}</div>
                </div>
              </div>

              {inspectedEvidence.latitude !== null && inspectedEvidence.longitude !== null && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                  <span className="block text-[11px] font-bold text-slate-600 mb-1">
                    Geospatial Coordinates:
                  </span>
                  <div className="text-slate-800 font-mono text-[11px]">
                    Lat: {inspectedEvidence.latitude}, Lon: {inspectedEvidence.longitude}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setInspectedEvidenceId(null)}
                className="rounded-xl bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. OBSERVATION INSPECT MODAL */}
      {inspectedObservation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-2xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <EyeIcon className="h-5 w-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Observation #{inspectedObservation.id} Details
                </h3>
              </div>
              <button
                onClick={() => setInspectedObsId(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase">
                    Category
                  </label>
                  <div className="font-medium text-slate-900 capitalize">
                    {inspectedObservation.category.replace('_', ' ')}
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase">
                    Severity
                  </label>
                  <div className="font-medium text-slate-900 capitalize">
                    {inspectedObservation.severity}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase">
                  Description
                </label>
                <div className="text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  {inspectedObservation.description}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase">
                    Observed Date
                  </label>
                  <div className="text-slate-700">
                    {new Date(inspectedObservation.observed_at || inspectedObservation.created_at).toLocaleString()}
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase">
                    Field Confidence
                  </label>
                  <div className="text-slate-700">{inspectedObservation.confidence}%</div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setInspectedObsId(null)}
                className="rounded-xl bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
