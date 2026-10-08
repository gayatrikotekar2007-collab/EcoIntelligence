'use client';

import React from 'react';
import Link from 'next/link';
import { Navbar } from '../../components/Navbar';
import { ShieldCheckIcon, FileTextIcon, ArrowRightIcon } from '../../components/Icons';

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1 py-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 sm:p-10 shadow-xs">
            <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
              System Documentation
            </span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
              EcoIntelligence Architecture & Specification
            </h1>
            <p className="mt-3 text-base text-slate-600 leading-relaxed">
              EcoIntelligence is an environmental investigation and decision-support platform designed to connect evidence, geospatial context, root-cause analysis, and impact verification.
            </p>

            <div className="mt-8 space-y-6">
              <div className="rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-2.5">
                  <ShieldCheckIcon className="h-5 w-5 text-emerald-700" />
                  <h3 className="text-base font-semibold text-slate-900">
                    Evidence-First Core Principle
                  </h3>
                </div>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  The platform clearly distinguishes between observed, user-reported, estimated, inferred, and simulated data. AI inference is never presented as confirmed fact without transparent traceability.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-2.5">
                  <FileTextIcon className="h-5 w-5 text-emerald-700" />
                  <h3 className="text-base font-semibold text-slate-900">
                    Phase 3 — Authentication & Application Shell
                  </h3>
                </div>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Phase 3 introduces user registration, session management, secure password hashing, isolated investigator workspaces, and the authenticated dashboard shell.
                </p>
              </div>
            </div>

            <div className="mt-8 flex gap-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 transition"
              >
                Go to Workspace
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Return to Landing
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
