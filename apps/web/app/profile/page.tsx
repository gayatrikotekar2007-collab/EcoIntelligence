'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { AppShell } from '../../components/AppShell';
import { UserIcon, ShieldCheckIcon, LogOutIcon } from '../../components/Icons';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <AppShell title="Investigator Profile">
      <div className="space-y-6 max-w-4xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 pb-6 border-b border-slate-100">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800 text-xl font-bold">
                {user?.display_name ? user.display_name.slice(0, 2).toUpperCase() : 'U'}
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {user?.display_name}
                </h2>
                <p className="text-sm text-slate-500">{user?.email}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 uppercase">
                    Role: {user?.role}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                    Status: {user?.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition"
              >
                <LogOutIcon className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                User Identifier
              </span>
              <p className="mt-1 text-sm font-medium text-slate-900">
                ID #{user?.id}
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Member Since
              </span>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {user?.created_at ? new Date(user.created_at).toLocaleString() : '-'}
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Authentication Mode
              </span>
              <p className="mt-1 text-sm font-medium text-slate-900">
                Local Secure JWT (OAuth2 / OIDC Compatible)
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Workspace Permissions
              </span>
              <p className="mt-1 text-sm font-medium text-slate-900">
                Private Case Creation & Evidence Management
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-6 flex items-start gap-3">
          <ShieldCheckIcon className="h-5 w-5 text-emerald-700 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-emerald-900">
              Security & Data Isolation
            </h4>
            <p className="mt-1 text-xs text-emerald-800 leading-relaxed">
              Your account is isolated at the database level. Investigations created under your session are strictly private and cannot be queried or altered by unauthorized users.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
