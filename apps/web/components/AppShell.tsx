'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import {
  EcoLogo,
  LayersIcon,
  FileTextIcon,
  MapPinIcon,
  UserIcon,
  LogOutIcon,
  MenuIcon,
  CloseIcon,
  ShieldCheckIcon,
} from './Icons';

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
  headerAction?: React.ReactNode;
}

export function AppShell({ children, title, headerAction }: AppShellProps) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [user, isLoading, router]);

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm animate-pulse">
            <EcoLogo className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium text-slate-600">
            Verifying secure session...
          </p>
        </div>
      </div>
    );
  }

  const navItems = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: LayersIcon,
      current: pathname === '/dashboard',
    },
    {
      name: 'Investigations',
      href: '/investigations',
      icon: FileTextIcon,
      current: pathname.startsWith('/investigations'),
    },
    {
      name: 'Environmental Map',
      href: '/map',
      icon: MapPinIcon,
      current: pathname === '/map',
    },
    {
      name: 'User Profile',
      href: '/profile',
      icon: UserIcon,
      current: pathname === '/profile',
    },
  ];

  const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-slate-200 bg-white">
        {/* Brand */}
        <div className="flex h-16 items-center gap-2.5 px-6 border-b border-slate-100">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <EcoLogo className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold tracking-tight text-slate-900 text-sm">
              EcoIntelligence
            </span>
            <span className="text-[10px] font-medium tracking-wider uppercase text-emerald-700">
              Investigation Workspace
            </span>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 flex flex-col justify-between px-3 py-6 overflow-y-auto">
          <nav className="space-y-1">
            <p className="px-3 text-[11px] font-semibold tracking-wider uppercase text-slate-400 mb-2">
              Platform Navigation
            </p>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    item.current
                      ? 'bg-emerald-50 text-emerald-900 font-semibold'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 transition ${
                      item.current
                        ? 'text-emerald-700'
                        : 'text-slate-400 group-hover:text-slate-600'
                    }`}
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Environmental Status Banner */}
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/70 p-3.5">
              <div className="flex items-center gap-2">
                <ShieldCheckIcon className="h-4 w-4 text-emerald-700" />
                <span className="text-xs font-semibold text-emerald-900">
                  Evidence-First Engine
                </span>
              </div>
              <p className="mt-1 text-[11px] text-emerald-800 leading-relaxed">
                Observations and claims are recorded with traceability and source validation.
              </p>
            </div>

            {/* User Mini Bar */}
            <div className="border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between px-2">
                <Link
                  href="/profile"
                  className="flex items-center gap-2.5 overflow-hidden group"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700 group-hover:bg-emerald-100 group-hover:text-emerald-800 transition">
                    {getInitials(user.display_name)}
                  </div>
                  <div className="flex flex-col truncate">
                    <span className="truncate text-xs font-semibold text-slate-800 group-hover:text-emerald-700 transition">
                      {user.display_name}
                    </span>
                    <span className="text-[10px] text-slate-400 truncate">
                      {user.email}
                    </span>
                  </div>
                </Link>
                <button
                  onClick={handleLogout}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600 transition"
                  title="Sign out"
                  aria-label="Sign out"
                >
                  <LogOutIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative flex w-full max-w-xs flex-1 flex-col bg-white">
            <div className="flex h-16 items-center justify-between px-6 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-600 text-white">
                  <EcoLogo className="h-4 w-4" />
                </div>
                <span className="font-bold text-slate-900 text-sm">
                  EcoIntelligence
                </span>
              </div>
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
                aria-label="Close sidebar"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileSidebarOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                      item.current
                        ? 'bg-emerald-50 text-emerald-800 font-semibold'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
              <div className="pt-4 mt-4 border-t border-slate-100">
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  <LogOutIcon className="h-4 w-4" />
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Column */}
      <div className="flex flex-1 flex-col lg:pl-64">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 backdrop-blur-sm px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden rounded-md p-2 text-slate-600 hover:bg-slate-100"
              aria-label="Open sidebar menu"
            >
              <MenuIcon className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-semibold text-slate-900">
              {title || 'Dashboard'}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {headerAction && <div>{headerAction}</div>}

            {/* User Profile Menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-white p-1 pr-3 text-xs font-medium text-slate-700 hover:border-slate-300 transition"
                aria-expanded={userMenuOpen}
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-800">
                  {getInitials(user.display_name)}
                </div>
                <span className="hidden sm:inline font-medium text-slate-800">
                  {user.display_name}
                </span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 uppercase">
                  {user.role}
                </span>
              </button>

              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 z-50 mt-2 w-56 origin-top-right rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                    <div className="px-3 py-2 border-b border-slate-100">
                      <p className="text-xs font-semibold text-slate-900 truncate">
                        {user.display_name}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {user.email}
                      </p>
                      <span className="mt-1 inline-flex rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 uppercase">
                        Role: {user.role}
                      </span>
                    </div>

                    <div className="py-1">
                      <Link
                        href="/profile"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                      >
                        <UserIcon className="h-3.5 w-3.5 text-slate-500" />
                        Account Profile
                      </Link>
                      <Link
                        href="/"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                      >
                        <EcoLogo className="h-3.5 w-3.5 text-slate-500" />
                        Public Landing Page
                      </Link>
                    </div>

                    <div className="border-t border-slate-100 pt-1">
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          handleLogout();
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition"
                      >
                        <LogOutIcon className="h-3.5 w-3.5 text-red-500" />
                        Log out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
