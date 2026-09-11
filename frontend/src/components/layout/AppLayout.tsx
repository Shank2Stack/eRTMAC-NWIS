import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-ivory-100 dark:bg-night-950">

      {/* ── Mobile backdrop overlay ─────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px] md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      {/*
        Mobile: fixed, off-screen by default, slides in with z-50
        Desktop (md+): relative, always visible
      */}
      <div
        className={`
          fixed inset-y-0 left-0 z-50 h-full
          md:relative md:z-auto md:translate-x-0 md:h-screen
          transform transition-transform duration-200 ease-in-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <Sidebar onMobileClose={() => setMobileOpen(false)} />
      </div>

      {/* ── Main content area ────────────────────────────────────────────────── */}
      <main className="relative flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
        {/* Mobile hamburger button — top-left, visible only on mobile */}
        <button
          className="
            fixed top-3 left-3 z-30
            md:hidden
            flex items-center justify-center w-9 h-9
            bg-white dark:bg-night-900
            border border-ivory-300 dark:border-night-700
            rounded-sm shadow-sm
            text-ink-600 dark:text-night-400
            hover:text-ink-900 dark:hover:text-ivory-200
            transition-colors
          "
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
        >
          <Menu size={16} />
        </button>

        <Outlet />
      </main>
    </div>
  );
}
