import React from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useWell } from '../../context/WellContext';

const routeLabel: Record<string, string> = {
  '': 'Fleet Overview',
  telemetry: 'Live Telemetry',
  hydraulics: 'Hydraulics',
  specs: 'Rig & Well Specs',
  why: 'AI Evidence',
  compare: 'Compare',
  investigate: 'Forensic',
  'what-if': 'What-If Sandbox',
  replay: 'Historical Replay',
};

export default function WellBreadcrumb() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { activeWell } = useWell();

  const segments = location.pathname.replace(/^\/well\/[^/]+\/?/, '').split('/').filter(Boolean);
  const sub = segments[0] ?? '';
  const subLabel = routeLabel[sub] ?? sub;

  if (!id || !activeWell) return null;

  return (
    <nav
      aria-label="breadcrumb"
      className="flex items-center gap-1.5 text-[11px] text-ink-400 dark:text-night-500 select-none"
    >
      <Link
        to="/wells"
        className="hover:text-ink-900 dark:hover:text-ivory-200 transition-colors"
      >
        Fleet
      </Link>
      <ChevronRight size={10} />
      <Link
        to={`/well/${encodeURIComponent(id)}`}
        className="hover:text-ink-900 dark:hover:text-ivory-200 transition-colors"
      >
        {activeWell.name || id}
      </Link>
      {sub && (
        <>
          <ChevronRight size={10} />
          <span className="text-ink-700 dark:text-ivory-300">{subLabel}</span>
        </>
      )}
    </nav>
  );
}
