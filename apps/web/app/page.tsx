'use client';

import React from 'react';
import Link from 'next/link';
import { Navbar } from '../components/Navbar';
import { useAuth } from '../lib/auth-context';
import { ShieldCheckIcon, EyeIcon, FileTextIcon, ActivityIcon, ArrowRightIcon } from '../components/Icons';

const features = [
  {
    title: 'Environmental investigation workflow',
    description: 'Structure field cases with hypothesis tracking, uncertainty disclosure, and lifecycle stages.',
    icon: FileTextIcon,
  },
  {
    title: 'Field evidence capture',
    description: 'Collect imagery, notes, and sensor readings with cryptographic chain of custody.',
    icon: ShieldCheckIcon,
  },
  {
    title: 'Location-based observations',
    description: 'Anchor environmental findings spatially with PostGIS geospatial indexes.',
    icon: EyeIcon,
  },
  {
    title: 'Transparent confidence and source traces',
    description: 'Distinguish observed fact from AI inference, estimates, and scenario simulations.',
    icon: ActivityIcon,
  },
];

export default function HomePage() {
  const { user, isLoading } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1">
        <section className="mx-auto flex max-w-6xl flex-col justify-center px-6 py-16 md:py-24">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1 text-sm font-semibold text-emerald-800">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              EcoIntelligence Platform
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl leading-tight">
              Environmental intelligence, investigation, and action.
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-slate-600 leading-relaxed">
              The foundation for a platform that helps people detect environmental change, collect evidence,
              investigate conditions, and assess next steps with clarity and traceability.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              {!isLoading && user ? (
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
                >
                  Open Dashboard Workspace
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
              ) : (
                <>
                  <Link
                    href="/register"
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
                  >
                    Start Investigation
                    <ArrowRightIcon className="h-4 w-4" />
                  </Link>
                  <a
                    href="#features"
                    className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:border-slate-400"
                  >
                    Explore foundation
                  </a>
                </>
              )}

              <Link
                href="/docs"
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:border-slate-400"
              >
                View docs
              </Link>
            </div>
          </div>

          <div id="features" className="mt-20 scroll-mt-20">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900">
                Core System Foundations
              </h2>
              <p className="text-sm text-slate-500">
                Architectural capabilities designed for transparent environmental forensics.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.title}
                    className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-slate-300"
                  >
                    <div>
                      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="text-base font-semibold text-slate-900 leading-snug">
                        {feature.title}
                      </h3>
                      <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-6">
        <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© 2026 EcoIntelligence Platform. Public environmental decision support.</p>
          <div className="flex gap-4">
            <Link href="/docs" className="hover:text-slate-800">Docs</Link>
            <Link href="/login" className="hover:text-slate-800">Investigator Login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
