import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, RefreshCw, AlertCircle } from 'lucide-react';
import { useWell } from '../context/WellContext';
import StatusDot from '../components/ui/StatusDot';
import SectionHeader from '../components/ui/SectionHeader';

export default function FleetOverview() {
  const { allWells, setActiveWellId, loading, error, refreshWells } = useWell();
  const navigate = useNavigate();
  const [filterType, setFilterType] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Extract unique well types from real backend data
  const wellTypes = ['all', ...Array.from(new Set(allWells.map((w) => w.well_type).filter(Boolean) as string[]))];

  const visible = allWells.filter((w) => {
    const matchFilter = filterType === 'all' || w.well_type === filterType;
    const matchSearch =
      search.trim() === '' ||
      w.well_id.toLowerCase().includes(search.toLowerCase()) ||
      w.field.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const totalOil = allWells.reduce((sum, w) => sum + (w.oil_production || 0), 0);
  const totalGas = allWells.reduce((sum, w) => sum + (w.gas_production || 0), 0);

  const openWell = (id: string) => {
    setActiveWellId(id);
    navigate(`/well/${encodeURIComponent(id)}`);
  };

  if (loading && allWells.length === 0) {
    return (
      <div className="min-h-screen bg-ivory-100 dark:bg-night-950 p-6 pt-16 md:p-8 flex flex-col items-center justify-center">
        <div className="flex items-center gap-3 text-ink-600 dark:text-night-400">
          <RefreshCw className="animate-spin text-gold" size={20} />
          <span className="text-[13px] font-medium">Loading well data from National Well System…</span>
        </div>
      </div>
    );
  }

  if (error && allWells.length === 0) {
    return (
      <div className="min-h-screen bg-ivory-100 dark:bg-night-950 p-6 pt-16 md:p-8 flex flex-col items-center justify-center">
        <div className="card p-6 max-w-md w-full text-center space-y-4 border-risk-high/30">
          <AlertCircle className="mx-auto text-risk-high" size={28} />
          <p className="text-[13px] text-ink-700 dark:text-ivory-200">
            {error || 'Unable to load well data. Please verify the backend connection.'}
          </p>
          <button
            onClick={() => refreshWells()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gold text-night-950 text-[12px] font-semibold rounded-sm hover:bg-gold-600 transition-colors"
          >
            <RefreshCw size={13} /> Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ivory-100 dark:bg-night-950 p-4 pt-14 md:p-8 md:pt-8">
      {/* ── KPI Row ───────────────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <p className="section-label">Fleet Status</p>
          <button
            onClick={() => refreshWells()}
            className="inline-flex items-center gap-1 text-[11px] text-ink-500 hover:text-gold transition-colors"
            title="Refresh well list"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 max-w-2xl">
          <div className="card p-4">
            <p className="section-label mb-1">Active Fleet Wells</p>
            <p className="num text-2xl sm:text-3xl font-semibold text-ink-900 dark:text-ivory-100">
              {allWells.length}
            </p>
            <p className="text-[10px] sm:text-[11px] text-ink-400 dark:text-night-500 mt-1">
              Volve Field Subsurface Units
            </p>
          </div>

          <div className="card p-4">
            <p className="section-label mb-1">Cumulative Oil</p>
            <p className="num text-2xl sm:text-3xl font-semibold text-gold">
              {totalOil.toLocaleString(undefined, { maximumFractionDigits: 1 })}
            </p>
            <p className="text-[10px] sm:text-[11px] text-ink-400 dark:text-night-500 mt-1">
              Sm³/day production
            </p>
          </div>

          <div className="card p-4">
            <p className="section-label mb-1">Cumulative Gas</p>
            <p className="num text-2xl sm:text-3xl font-semibold text-ink-700 dark:text-ivory-300">
              {totalGas.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <p className="text-[10px] sm:text-[11px] text-ink-400 dark:text-night-500 mt-1">
              Sm³/day production
            </p>
          </div>
        </div>
      </div>

      <div className="divider mb-6" />

      {/* ── Filter bar ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <SectionHeader title="Tracked Wells" />
        <div className="flex items-center gap-2 sm:ml-auto flex-wrap">
          {wellTypes.map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`
                text-[10px] sm:text-[11px] font-semibold tracking-widest uppercase px-2.5 py-1.5 rounded-sm border
                transition-colors
                ${filterType === t
                  ? 'bg-ink-900 text-ivory-100 border-ink-900 dark:bg-ivory-100 dark:text-ink-900 dark:border-ivory-100'
                  : 'border-ivory-300 text-ink-400 hover:text-ink-900 dark:border-night-700 dark:text-night-500 dark:hover:text-ivory-200'
                }
              `}
            >
              {t === 'all' ? 'All Types' : t}
            </button>
          ))}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search well ID…"
            className="
              text-[12px] px-3 py-1.5 border border-ivory-300 dark:border-night-700
              bg-white dark:bg-night-900 text-ink-900 dark:text-ivory-100
              rounded-sm focus:outline-none focus:ring-1 focus:ring-gold
              placeholder:text-ink-400 dark:placeholder:text-night-500
              w-32 sm:w-44
            "
          />
        </div>
      </div>

      {/* ── Well Grid ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {visible.map((well) => (
          <div
            key={well.well_id}
            className="card p-4 sm:p-5 flex flex-col gap-3 hover:border-gold/40 transition-colors"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <StatusDot level="normal" pulse />
                  <h3 className="text-[14px] font-semibold text-ink-900 dark:text-ivory-100 truncate">
                    {well.well_id}
                  </h3>
                </div>
                <p className="text-[11px] text-ink-400 dark:text-night-500 truncate">
                  {well.field}
                </p>
              </div>
              <span className="badge bg-gold/10 text-gold border border-gold/20 text-[10px] px-2 py-0.5 shrink-0">
                {well.well_type || 'WELL'}
              </span>
            </div>

            {/* Depth reading */}
            <div>
              <div className="flex justify-between text-[11px] text-ink-500 dark:text-night-400 mb-1">
                <span className="section-label">Latest Depth</span>
                <span className="num font-medium text-ink-900 dark:text-ivory-100">
                  {well.latest_depth_m != null ? `${well.latest_depth_m.toLocaleString()} m` : 'N/A'}
                </span>
              </div>
              <div className="h-1 bg-ivory-200 dark:bg-night-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gold rounded-full"
                  style={{ width: `${Math.min(100, ((well.latest_depth_m || 0) / 4500) * 100)}%` }}
                />
              </div>
            </div>

            {/* Production Stats row */}
            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
              <div>
                <p className="section-label">Oil Production</p>
                <p className="text-ink-700 dark:text-ivory-300 num font-medium">
                  {well.oil_production != null ? `${well.oil_production.toLocaleString()} Sm³/d` : '0 Sm³/d'}
                </p>
              </div>
              <div>
                <p className="section-label">Gas Production</p>
                <p className="text-ink-700 dark:text-ivory-300 num font-medium">
                  {well.gas_production != null ? `${well.gas_production.toLocaleString()} Sm³/d` : '0 Sm³/d'}
                </p>
              </div>
            </div>

            {/* Timestamp */}
            {well.latest_timestamp && (
              <p className="text-[10px] num text-ink-400 dark:text-night-500">
                Updated: {well.latest_timestamp.split('T')[0] || well.latest_timestamp.slice(0, 10)}
              </p>
            )}

            {/* Open button */}
            <button
              onClick={() => openWell(well.well_id)}
              className="
                mt-1 flex items-center justify-center gap-1.5
                text-[12px] font-semibold
                border border-ink-200 dark:border-night-700
                text-ink-600 dark:text-night-400
                hover:border-gold hover:text-gold
                px-3 py-2 rounded-sm transition-colors cursor-pointer
              "
            >
              Open Well Cockpit <ArrowRight size={13} />
            </button>
          </div>
        ))}

        {visible.length === 0 && (
          <div className="col-span-full py-16 text-center text-ink-400 dark:text-night-500 text-[13px]">
            No wells match the current filter.
          </div>
        )}
      </div>
    </div>
  );
}
