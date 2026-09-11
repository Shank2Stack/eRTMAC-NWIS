import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { RefreshCw, AlertCircle } from 'lucide-react';
import * as wellsApi from '../api/wellsApi';
import type { WellState, ReplayPoint } from '../types/api';
import { useWell } from '../context/WellContext';
import { useTheme } from '../context/ThemeContext';
import WellBreadcrumb from '../components/layout/WellBreadcrumb';
import Sparkline from '../components/ui/Sparkline';
import SectionHeader from '../components/ui/SectionHeader';

const SERIES = [
  { key: 'rop',    label: 'ROP',    unit: 'm/h',  color: '#C9A84C' },
  { key: 'wob',    label: 'WOB',    unit: 'kN',   color: '#C0392B' },
  { key: 'rpm',    label: 'RPM',    unit: 'rpm',  color: '#2E7D4F' },
  { key: 'torque', label: 'Torque', unit: 'kNm',  color: '#6B7280' },
  { key: 'depth',  label: 'Depth',  unit: 'm',    color: '#8FA8B8' },
] as const;

export default function Telemetry() {
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
        wellsApi.getReplay(wellId, 60).catch(() => ({ replay_points: [] })),
      ]);
      setWellState(state);
      setReplayPoints(replay.replay_points || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load telemetry sensor feed.');
    } finally {
      setLoading(false);
    }
  }, [wellId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const gridColor  = isDark ? '#2E2E2B' : '#ECEAE3';
  const axisColor  = isDark ? '#4A4A45' : '#B8B4A8';
  const tooltipBg  = isDark ? '#1C1C1A' : '#FFFFFF';
  const tooltipBorder = isDark ? '#2E2E2B' : '#D6D3CB';

  if (loading && !wellState) {
    return (
      <div className="p-4 pt-14 md:p-8 md:pt-8 min-h-screen bg-ivory-100 dark:bg-night-950 flex flex-col items-center justify-center">
        <div className="flex items-center gap-3 text-ink-600 dark:text-night-400">
          <RefreshCw className="animate-spin text-gold" size={20} />
          <span className="text-[13px] font-medium">Connecting to real-time SCADA telemetry feed…</span>
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
            <RefreshCw size={13} /> Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const latestDrilling = wellState?.drilling;
  const currentValues: Record<string, number> = {
    rop: latestDrilling?.ROP ?? 0,
    wob: latestDrilling?.WOB ?? 0,
    rpm: latestDrilling?.RPM ?? 0,
    torque: latestDrilling?.Torque ?? 0,
    depth: latestDrilling?.depth_m ?? 0,
  };

  const chartData = replayPoints.map((p, i) => ({
    i,
    time: p.timestamp ? p.timestamp.split('T')[1]?.slice(0, 5) || `P${i}` : `${i}`,
    rop: p.ROP != null ? +p.ROP.toFixed(1) : 0,
    wob: p.WOB != null ? +p.WOB.toFixed(1) : 0,
    rpm: p.RPM != null ? +p.RPM.toFixed(0) : 0,
    torque: p.Torque != null ? +p.Torque.toFixed(1) : 0,
    depth: p.depth_m != null ? +p.depth_m.toFixed(1) : 0,
  }));

  const sparkData = (key: string) => {
    if (replayPoints.length === 0) return [currentValues[key] || 0];
    return replayPoints.slice(-20).map((p) => {
      if (key === 'rop') return p.ROP ?? 0;
      if (key === 'wob') return p.WOB ?? 0;
      if (key === 'rpm') return p.RPM ?? 0;
      if (key === 'torque') return p.Torque ?? 0;
      if (key === 'depth') return p.depth_m ?? 0;
      return 0;
    });
  };

  return (
    <div className="p-4 pt-14 md:p-8 md:pt-8 space-y-6 bg-ivory-100 dark:bg-night-950 min-h-screen">
      <WellBreadcrumb />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <SectionHeader
          title="Live SCADA Telemetry"
          sub={`${wellId} · Real-Time Drilling Dynamics Feed · ${replayPoints.length} synchronized frames`}
        />
        <button
          onClick={() => loadData()}
          className="inline-flex items-center gap-1.5 text-[11px] text-ink-500 hover:text-gold self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh Stream
        </button>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {SERIES.map(({ key, label, unit, color }) => (
          <div key={key} className="card p-3 sm:p-4 flex flex-col gap-2 min-w-0 overflow-hidden">
            <p className="section-label truncate">{label}</p>
            <p className="num text-xl sm:text-2xl font-semibold text-ink-900 dark:text-ivory-100 truncate leading-tight">
              {(currentValues[key] ?? 0).toFixed(key === 'rpm' ? 0 : 1)}
              <span className="text-[10px] font-normal text-ink-400 dark:text-night-500 ml-1">{unit}</span>
            </p>
            <Sparkline data={sparkData(key)} color={color} width={80} height={24} />
          </div>
        ))}
      </div>

      {/* ── Multi-variable Chart ───────────────────────────────────────────── */}
      <div className="card p-4 sm:p-5">
        <SectionHeader
          title="Telemetry Sensor Traces"
          sub="Synchronized chronological progression across drilling sensor channels"
          className="mb-4"
        />
        <div className="h-72 sm:h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis
                dataKey="time"
                tick={{ fill: axisColor, fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: gridColor }}
              />
              <YAxis
                tick={{ fill: axisColor, fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: gridColor }}
                width={36}
              />
              <Tooltip
                contentStyle={{
                  background: tooltipBg,
                  border: `1px solid ${tooltipBorder}`,
                  borderRadius: 2,
                  fontSize: 11,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={6} />
              {SERIES.filter((s) => s.key !== 'depth').map(({ key, label, color }) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={label}
                  stroke={color}
                  dot={false}
                  strokeWidth={1.5}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
