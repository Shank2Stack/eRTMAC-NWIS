import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Droplets, RefreshCw, AlertCircle, Gauge, Activity } from 'lucide-react';
import * as wellsApi from '../api/wellsApi';
import type { WellState, ReplayPoint } from '../types/api';
import { useWell } from '../context/WellContext';
import { useTheme } from '../context/ThemeContext';
import WellBreadcrumb from '../components/layout/WellBreadcrumb';
import SectionHeader from '../components/ui/SectionHeader';

export default function Hydraulics() {
  const { id } = useParams<{ id: string }>();
  const { activeWell, setActiveWellId } = useWell();
  const { isDark } = useTheme();

  const wellId = id || activeWell?.well_id || '';

  const [wellState, setWellState] = useState<WellState | null>(null);
  const [replayPoints, setReplayPoints] = useState<ReplayPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (wellId && activeWell?.well_id !== wellId) {
      setActiveWellId(wellId);
    }
  }, [wellId, activeWell?.well_id, setActiveWellId]);

  const loadData = useCallback(async () => {
    if (!wellId) return;
    setLoading(true);
    setError(null);
    try {
      const [state, replay] = await Promise.all([
        wellsApi.getWellData(wellId),
        wellsApi.getReplay(wellId, 40).catch(() => ({ replay_points: [] })),
      ]);
      setWellState(state);
      setReplayPoints(replay.replay_points || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load hydraulics and mud system data.');
    } finally {
      setLoading(false);
    }
  }, [wellId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const gridColor     = isDark ? '#2E2E2B' : '#ECEAE3';
  const axisColor     = isDark ? '#4A4A45' : '#B8B4A8';
  const tooltipBg     = isDark ? '#1C1C1A' : '#FFFFFF';
  const tooltipBorder = isDark ? '#2E2E2B' : '#D6D3CB';

  if (loading && !wellState) {
    return (
      <div className="p-4 pt-14 md:p-8 md:pt-8 min-h-screen bg-ivory-100 dark:bg-night-950 flex flex-col items-center justify-center">
        <div className="flex items-center gap-3 text-ink-600 dark:text-night-400">
          <RefreshCw className="animate-spin text-gold" size={20} />
          <span className="text-[13px] font-medium">Monitoring mud circulation & downhole hydraulic pressure…</span>
        </div>
      </div>
    );
  }

  if (error && !wellState) {
    return (
      <div className="p-4 pt-14 md:p-8 md:pt-8 min-h-screen bg-ivory-100 dark:bg-night-950 flex flex-col items-center justify-center">
        <div className="card p-6 max-w-md w-full text-center space-y-4 border-risk-high/30">
          <AlertCircle className="mx-auto text-risk-high" size={28} />
          <p className="text-[13px] text-ink-700 dark:text-ivory-200">{error}</p>
          <button
            onClick={() => loadData()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gold text-night-950 text-[12px] font-semibold rounded-sm hover:bg-gold-600 transition-colors"
          >
            <RefreshCw size={13} /> Retry Loading
          </button>
        </div>
      </div>
    );
  }

  const mud = wellState?.mud;
  const prod = wellState?.production;

  // Chart data from replay
  const pressureData = replayPoints.map((p, i) => ({
    i,
    time: p.timestamp ? p.timestamp.split('T')[1]?.slice(0, 5) || `P${i}` : `${i}`,
    rop: p.ROP != null ? +p.ROP.toFixed(1) : 0,
    wob: p.WOB != null ? +p.WOB.toFixed(1) : 0,
    torque: p.Torque != null ? +p.Torque.toFixed(1) : 0,
    depth: p.depth_m != null ? +p.depth_m.toFixed(1) : 0,
  }));

  return (
    <div className="p-4 pt-14 md:p-8 md:pt-8 space-y-6 bg-ivory-100 dark:bg-night-950 min-h-screen">
      <WellBreadcrumb />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <SectionHeader
          title="Hydraulics & Mud Circulation"
          sub={`${wellId} · Closed-Loop Mud Circuit & Formation Containment`}
        />
        <button
          onClick={() => loadData()}
          className="inline-flex items-center gap-1.5 text-[11px] text-ink-500 hover:text-gold self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh Hydraulics
        </button>
      </div>

      {/* ── KPI Grid ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-3 sm:p-4">
          <p className="section-label">Mud Flow Rate</p>
          <p className="num text-xl sm:text-2xl font-semibold text-ink-900 dark:text-ivory-100 mt-1">
            {mud?.mud_flow_rate != null ? mud.mud_flow_rate.toFixed(1) : '—'}{' '}
            <span className="text-[10px] font-normal text-ink-400">L/min</span>
          </p>
          <p className="text-[10px] text-ink-400 dark:text-night-500 mt-0.5">Surface pump feed</p>
        </div>

        <div className="card p-3 sm:p-4">
          <p className="section-label">Mud Pressure</p>
          <p className="num text-xl sm:text-2xl font-semibold text-gold mt-1">
            {mud?.mud_pressure != null ? mud.mud_pressure.toFixed(1) : '—'}{' '}
            <span className="text-[10px] font-normal text-ink-400">bar</span>
          </p>
          <p className="text-[10px] text-ink-400 dark:text-night-500 mt-0.5">Circulation standpipe</p>
        </div>

        <div className="card p-3 sm:p-4">
          <p className="section-label">Mud Weight</p>
          <p className="num text-xl sm:text-2xl font-semibold text-ink-900 dark:text-ivory-100 mt-1">
            {mud?.mud_weight != null ? mud.mud_weight.toFixed(2) : '—'}{' '}
            <span className="text-[10px] font-normal text-ink-400">SG</span>
          </p>
          <p className="text-[10px] text-ink-400 dark:text-night-500 mt-0.5">Specific gravity</p>
        </div>

        <div className="card p-3 sm:p-4">
          <p className="section-label">Mud Loss Rate</p>
          <p className="num text-xl sm:text-2xl font-semibold text-ink-900 dark:text-ivory-100 mt-1">
            {mud?.mud_loss_rate != null ? mud.mud_loss_rate.toFixed(1) : '0.0'}{' '}
            <span className="text-[10px] font-normal text-ink-400">L/min</span>
          </p>
          <p className="text-[10px] text-ink-400 dark:text-night-500 mt-0.5">Formation loss</p>
        </div>
      </div>

      {/* ── Subsurface Pressures & Wellhead Section ──────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-3.5 bg-ivory-50 dark:bg-night-800/40">
          <p className="section-label">Downhole Pressure</p>
          <p className="num text-lg font-semibold text-ink-900 dark:text-ivory-100 mt-1">
            {prod?.avg_downhole_pressure_bar != null ? `${prod.avg_downhole_pressure_bar.toFixed(1)} bar` : '—'}
          </p>
          <p className="text-[10px] text-ink-400 dark:text-night-500">Reservoir pore boundary</p>
        </div>

        <div className="card p-3.5 bg-ivory-50 dark:bg-night-800/40">
          <p className="section-label">Wellhead Pressure</p>
          <p className="num text-lg font-semibold text-ink-900 dark:text-ivory-100 mt-1">
            {prod?.avg_wellhead_pressure_bar != null ? `${prod.avg_wellhead_pressure_bar.toFixed(1)} bar` : '—'}
          </p>
          <p className="text-[10px] text-ink-400 dark:text-night-500">Tree surface manifold</p>
        </div>

        <div className="card p-3.5 bg-ivory-50 dark:bg-night-800/40">
          <p className="section-label">Downhole Temperature</p>
          <p className="num text-lg font-semibold text-ink-900 dark:text-ivory-100 mt-1">
            {prod?.avg_downhole_temperature_c != null ? `${prod.avg_downhole_temperature_c.toFixed(1)} °C` : '—'}
          </p>
          <p className="text-[10px] text-ink-400 dark:text-night-500">Geothermal gradient</p>
        </div>

        <div className="card p-3.5 bg-ivory-50 dark:bg-night-800/40">
          <p className="section-label">Choke Manifold Opening</p>
          <p className="num text-lg font-semibold text-ink-900 dark:text-ivory-100 mt-1">
            {prod?.avg_choke_size_pct != null ? `${prod.avg_choke_size_pct.toFixed(1)} %` : '—'}
          </p>
          <p className="text-[10px] text-ink-400 dark:text-night-500">
            DP Choke: {prod?.dp_choke_size_bar != null ? `${prod.dp_choke_size_bar.toFixed(1)} bar` : '—'}
          </p>
        </div>
      </div>

      {/* ── Trend Chart ─────────────────────────────────────────────────── */}
      <div className="card p-4 sm:p-5">
        <SectionHeader
          title="Downhole Circulation Telemetry Progression"
          sub="Recent hydraulic trends and drilling dynamics"
          className="mb-4"
        />

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={pressureData} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="time" stroke={axisColor} tick={{ fontSize: 10 }} />
              <YAxis stroke={axisColor} tick={{ fontSize: 10 }} width={36} />
              <Tooltip
                contentStyle={{
                  background: tooltipBg,
                  border: `1px solid ${tooltipBorder}`,
                  borderRadius: 2,
                  fontSize: 11,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="rop" name="ROP (m/h)" stroke="#C9A84C" fill="#C9A84C" fillOpacity={0.15} />
              <Area type="monotone" dataKey="wob" name="WOB (kN)" stroke="#2E7D4F" fill="#2E7D4F" fillOpacity={0.15} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
