import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Compass,
  ChevronLeft,
  ChevronRight,
  X,
  Map,
  Crosshair,
  Activity,
  Droplets,
  Settings,
  Lightbulb,
  GitCompare,
  Search,
  SlidersHorizontal,
  History,
  Globe,
  Sun,
  Moon,
  LogOut,
  User,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useWell } from '../../context/WellContext';
import { useAuth } from '../../context/AuthContext';
import StatusDot from '../ui/StatusDot';

// ─── Navigation items ──────────────────────────────────────────────────────────

const wellNav = (id: string) => {
  const enc = encodeURIComponent(id);
  return [
    { label: '3D Wellbore Twin',    icon: Crosshair,         to: `/well/${enc}` },
    { label: 'Live Telemetry',      icon: Activity,          to: `/well/${enc}/telemetry` },
    { label: 'Hydraulics & Mud',    icon: Droplets,          to: `/well/${enc}/hydraulics` },
    { label: 'Rig & Well Specs',    icon: Settings,          to: `/well/${enc}/specs` },
    { label: 'AI Evidence',         icon: Lightbulb,         to: `/well/${enc}/why` },
    { label: 'Compare Benchmark',   icon: GitCompare,        to: `/well/${enc}/compare` },
    { label: 'Forensic Root Cause', icon: Search,            to: `/well/${enc}/investigate` },
    { label: 'What-If Sandbox',     icon: SlidersHorizontal, to: `/well/${enc}/what-if` },
    { label: 'Historical Replay',   icon: History,           to: `/well/${enc}/replay` },
  ];
};

// ─── Props ─────────────────────────────────────────────────────────────────────

interface SidebarProps {
  onMobileClose?: () => void;
}

// ─── Sidebar ───────────────────────────────────────────────────────────────────

export default function Sidebar({ onMobileClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { toggleTheme, isDark } = useTheme();
  const { activeWell, setActiveWellId, allWells } = useWell();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const activeId = activeWell?.well_id ?? activeWell?.id ?? (allWells[0]?.well_id || '');
  const wellItems = activeId ? wellNav(activeId) : [];

  const handleWellChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setActiveWellId(id);
    navigate(`/well/${encodeURIComponent(id)}`);
    onMobileClose?.();
  };

  // On mobile we never show the collapsed icon rail — always full width
  const showFull = !collapsed;

  return (
    <aside
      className={`
        flex flex-col h-full
        bg-white dark:bg-night-900
        border-r border-ivory-300 dark:border-night-700
        transition-all duration-200 ease-in-out
        ${collapsed ? 'w-16' : 'w-64'}
      `}
    >
      {/* ── Brand ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-4 border-b border-ivory-300 dark:border-night-700 shrink-0">
        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
          {/* Logo mark */}
          <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-sm bg-gold/10 border border-gold/30">
            <Compass size={16} className="text-gold" />
          </div>
          {showFull && (
            <div className="min-w-0 overflow-hidden">
              <p className="text-[13px] font-semibold text-ink-900 dark:text-ivory-100 leading-tight truncate">
                eRTMAC-NWIS
              </p>
              <p className="num text-[10px] text-ink-400 dark:text-night-500 leading-none mt-0.5">
                v2.4
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Desktop collapse button */}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="
              hidden md:flex items-center justify-center w-6 h-6 rounded-sm
              text-ink-400 hover:text-ink-900 dark:text-night-500 dark:hover:text-ivory-200
              hover:bg-ivory-200 dark:hover:bg-night-800 transition-colors
            "
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>

          {/* Mobile close button */}
          <button
            onClick={onMobileClose}
            className="
              flex md:hidden items-center justify-center w-6 h-6 rounded-sm
              text-ink-400 hover:text-ink-900 dark:text-night-500 dark:hover:text-ivory-200
              hover:bg-ivory-200 dark:hover:bg-night-800 transition-colors
            "
            aria-label="Close menu"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ── Active Well Selector ───────────────────────────────────────────── */}
      {showFull && (
        <div className="px-3 py-3 border-b border-ivory-300 dark:border-night-700 shrink-0">
          <p className="section-label mb-1.5">Active Well</p>
          <select
            value={activeId}
            onChange={handleWellChange}
            className="
              w-full text-[12px] font-medium text-ink-900 dark:text-ivory-100
              bg-ivory-100 dark:bg-night-800
              border border-ivory-300 dark:border-night-700
              rounded-sm px-2 py-1.5
              focus:outline-none focus:ring-1 focus:ring-gold
              cursor-pointer
            "
          >
            {allWells.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} — {w.field}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ── Navigation ─────────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto scrollbar-none py-3 space-y-0.5 px-2">

        {/* Fleet */}
        <NavLink
          to="/wells"
          end
          onClick={onMobileClose}
          className={({ isActive }) => isActive ? 'nav-item-active' : 'nav-item'}
        >
          <Map size={15} className="shrink-0" />
          {showFull && (
            <span className="text-[13px] font-medium leading-none truncate">
              Fleet Overview
            </span>
          )}
        </NavLink>

        {/* Well section label */}
        {showFull && (
          <p className="section-label px-2 pt-4 pb-1.5">
            {activeWell?.name ?? 'Well'}
          </p>
        )}
        {!showFull && <div className="h-2" />}

        {/* Well nav items */}
        {wellItems.map(({ label, icon: Icon, to }) => (
          <NavLink
            key={to}
            to={to}
            end
            onClick={onMobileClose}
            className={({ isActive }) => isActive ? 'nav-item-active' : 'nav-item'}
          >
            <Icon size={15} className="shrink-0" />
            {showFull && (
              <span className="text-[13px] font-medium leading-none truncate">
                {label}
              </span>
            )}
          </NavLink>
        ))}

        {/* Studio */}
        {showFull && <p className="section-label px-2 pt-4 pb-1.5">Studio</p>}
        {!showFull && <div className="h-2" />}

        <NavLink
          to="/studio"
          end
          onClick={onMobileClose}
          className={({ isActive }) => isActive ? 'nav-item-active' : 'nav-item'}
        >
          <Globe size={15} className="shrink-0" />
          {showFull && (
            <span className="text-[13px] font-medium leading-none truncate">
              Wellbore Studio
            </span>
          )}
        </NavLink>
      </nav>

      {/* ── Bottom Controls ────────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-ivory-300 dark:border-night-700 px-3 py-3 space-y-1.5">

        {/* SCADA */}
        <div className="flex items-center gap-2 px-2 py-1">
          <StatusDot level="online" pulse size="sm" />
          {showFull && (
            <span className="text-[11px] text-ink-400 dark:text-night-500 leading-none">
              SCADA Live
            </span>
          )}
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="flex items-center gap-2 w-full nav-item px-2 py-1.5 rounded-sm"
          aria-label="Toggle theme"
        >
          {isDark
            ? <Sun size={14} className="shrink-0" />
            : <Moon size={14} className="shrink-0" />
          }
          {showFull && (
            <span className="text-[12px] leading-none">
              {isDark ? 'Light Mode' : 'Dark Mode'}
            </span>
          )}
        </button>

        {/* User profile */}
        {showFull && (
          <div className="flex items-center gap-2 px-2 py-1">
            <div className="shrink-0 w-6 h-6 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center">
              <User size={11} className="text-gold" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-ink-900 dark:text-ivory-200 truncate leading-none">
                {user?.name || 'A. Panchal'}
              </p>
              <p className="num text-[10px] text-ink-400 dark:text-night-500 leading-none mt-0.5">
                {user?.empId || 'EMP-0042'}
              </p>
            </div>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={() => {
            logout();
            navigate('/login');
            onMobileClose?.();
          }}
          className="flex items-center gap-2 w-full nav-item px-2 py-1.5 rounded-sm text-risk-high hover:text-risk-high hover:bg-risk-high/5 cursor-pointer"
          aria-label="Logout"
        >
          <LogOut size={14} className="shrink-0" />
          {showFull && (
            <span className="text-[12px] leading-none">Disconnect</span>
          )}
        </button>
      </div>
    </aside>
  );
}
